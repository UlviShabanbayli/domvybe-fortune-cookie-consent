// ORVELLE · the live 3D plate: four fortune cookies on a stoneware tray (three r186, vendored).
// The DOM decides where the cookies go: one per column of the button grid. This module only draws and animates:
// crack (two halves split on a spring, the cookie hops, crumbs fly, a paper slip rises), close, dust, hover.
// It renders only while something moves, and steps its pixel ratio down if frames run long.
import * as THREE from 'three';
import { fortuneCookieGeometry, cookieTextures, cookieMaterial, plateGeometry, plateMaterial, crumbGeometry, rng } from './bake3d.js';

const OPEN = 0.3;                        // the cracked pose (radians each half turns)
const YAW = [0.28, -0.22, 0.2, -0.3];     // each cookie sits at its own angle

export function createPlate(canvas, { cats, phone = false, onFrame = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.34;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(24, 2, 0.1, 200);

  // light: the same studio rig the product stills use, so the plate matches the page photography
  const pmrem = new THREE.PMREMGenerator(renderer);
  const key = new THREE.DirectionalLight('#fff1dc', 3.4); key.position.set(-4, 7, 3.5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.5); fill.position.set(-5, 3, -2); scene.add(fill);
  const front = new THREE.DirectionalLight('#fff8ee', 0.7); front.position.set(0.5, 2.5, 8); scene.add(front);
  const rim = new THREE.DirectionalLight('#fff4e6', 1.1); rim.position.set(4, 3, -5); scene.add(rim);

  const ready = import('three/addons/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 1.5; pmrem.dispose();
  });

  // plate + a shadow catcher under it (the canvas is transparent over the panel's paper colour)
  let plateHX = 0;
  const plate = new THREE.Mesh(new THREE.BufferGeometry(), plateMaterial({ size: 256 }));
  plate.receiveShadow = true; plate.castShadow = true; plate.position.y = 0.0; scene.add(plate);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.ShadowMaterial({ opacity: 0.16 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.045; catcher.receiveShadow = true; scene.add(catcher);

  // cookies: always two halves (closed = touching), so a crack is just a spring on their angle
  const tex = cookieTextures({ size: phone ? 256 : 384, seed: 2 });
  const mat = cookieMaterial(tex);
  const paperMat = new THREE.MeshStandardMaterial({ color: '#fffdf6', roughness: 0.85, side: THREE.DoubleSide });
  const paperGeo = (() => { const g = new THREE.PlaneGeometry(0.78, 0.3, 16, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.05 * Math.sin(p.getX(i) * 2.4)); g.computeVertexNormals(); return g; })();
  const cookies = {};
  cats.forEach((cat, i) => {
    const g = fortuneCookieGeometry({ seed: i + 1, cracked: true, ns: phone ? 22 : 30, nt: phone ? 26 : 34, thick: 0.034 });
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); inner.rotation.z = Math.PI / 2;
    const halves = [[g.left, -1], [g.right, 1]].map(([geo, sgn]) => {
      const piv = new THREE.Group(); piv.position.copy(g.crackCenter); piv.position.x -= 0.7;
      const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true;
      m.position.copy(g.crackCenter).negate(); m.position.x += 0.7; piv.add(m); inner.add(piv);
      return { piv, sgn, base: piv.position.clone() };
    });
    // rest the cookie on the plate: lowest point at y = 0
    root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(root, true); inner.position.y -= box.min.y;
    const paper = new THREE.Mesh(paperGeo, paperMat); paper.castShadow = true; paper.visible = false; root.add(paper);
    root.rotation.y = YAW[i % 4];
    scene.add(root);
    cookies[cat] = { root, inner, halves, paper, top: box.max.y - box.min.y, open: 0, vel: 0, target: 0, lift: 0, liftV: 0, hover: 0, hoverT: 0, pap: 0, papT: 0 };
  });

  // crumbs: one instanced mesh, simple ballistic physics with a bounce on the plate floor
  const MAXC = 140, crumbs = [], R = rng(11);
  const cmesh = new THREE.InstancedMesh(crumbGeometry(5), new THREE.MeshStandardMaterial({ roughness: 0.7, color: '#ffffff' }), MAXC);
  cmesh.castShadow = true; cmesh.frustumCulled = false;
  const col = new THREE.Color();
  for (let i = 0; i < MAXC; i++) {
    crumbs.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 0, fade: 0, rest: false });
    col.setHSL(0.09 + R() * 0.03, 0.55 + R() * 0.2, 0.42 + R() * 0.2); cmesh.setColorAt(i, col);
  }
  const hideM = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAXC; i++) cmesh.setMatrixAt(i, hideM);
  scene.add(cmesh);
  let nextCrumb = 0;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();

  // ---------------------------------------------------------------- layout from the DOM
  let W = 1, H = 1, k = 0.01, hz = 1.3, xs = [];
  const quality = { dprCap: Math.min(2, window.devicePixelRatio || 1), shadows: true, slow: 0, n: 0, base: 1e9, stepped: 0 };
  function layout(stageW, stageH, centers, labelBand = 40) {
    W = Math.max(1, stageW); H = Math.max(1, stageH);
    const colW = (centers[centers.length - 1] - centers[0]) / Math.max(1, centers.length - 1) || W / 4;
    k = 2.12 / colW;                                         // world units per CSS px at the cookies' depth
    const fov = cam.fov * Math.PI / 180, el = 0.58;          // ~33° above the plate
    const dist = (H * k) / (2 * Math.tan(fov / 2));
    const target = new THREE.Vector3(0, 0.42, 0.1);
    cam.position.set(0, target.y + Math.sin(el) * dist, Math.cos(el) * dist); cam.lookAt(target);
    cam.aspect = W / H;
    // shift the picture up so the cookies sit above the label band
    const cy = (H - labelBand) * 0.44;
    cam.setViewOffset(W, H, 0, (H / 2 - cy), W, H);
    cam.updateProjectionMatrix();
    xs = centers.map((c) => (c - W / 2) * k);
    cats.forEach((cat, i) => { cookies[cat].root.position.set(xs[i], 0, 0); });
    const hx = (xs[xs.length - 1] - xs[0]) / 2 + colW * k * 0.46;
    hz = Math.min(1.5, hx * 0.3);
    if (Math.abs(hx - plateHX) > 0.02) { plate.geometry.dispose(); plate.geometry = plateGeometry({ hx, hz, rim: 0.15, seg: 120 }); plateHX = hx; }
    key.target.position.set(0, 0, 0);
    Object.assign(key.shadow.camera, { left: -hx - 1, right: hx + 1, top: 4, bottom: -4, near: 0.5, far: 30 }); key.shadow.camera.updateProjectionMatrix();
    resize();
    renderer.shadowMap.needsUpdate = true;
    draw();
  }
  let sized = '';
  function resize() {
    const pr = Math.max(1, Math.min(quality.dprCap, Math.sqrt(0.9e6 / (W * H))));
    const key = `${W}x${H}@${pr}`; if (key === sized) return; sized = key;   // re-sizing a canvas reallocates it: only on change
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
  }

  // ---------------------------------------------------------------- actions
  function emit(cat, n = 14) {
    const c = cookies[cat], base = new THREE.Vector3(0, c.top * 0.75, 0.15).applyEuler(c.root.rotation).add(c.root.position);
    for (let j = 0; j < n; j++) {
      const b = crumbs[nextCrumb]; nextCrumb = (nextCrumb + 1) % MAXC;
      const side = j % 2 ? 1 : -1;
      b.on = true; b.rest = false; b.fade = 0; b.s = 0.035 + R() * 0.05;
      b.p.copy(base).add(new THREE.Vector3((R() - 0.5) * 0.3, (R() - 0.5) * 0.2, (R() - 0.5) * 0.3));
      b.v.set(side * (0.6 + R() * 2.2), 2.2 + R() * 3.2, -0.4 + R() * 2.2);
      b.r.set(R() * 6, R() * 6, R() * 6); b.w.set((R() - 0.5) * 20, (R() - 0.5) * 20, (R() - 0.5) * 20);
    }
  }
  const api = {
    ready,
    crack(cat, { crumbs: withCrumbs = true } = {}) {
      const c = cookies[cat]; if (!c || c.target === OPEN) return;
      c.target = OPEN; c.vel += 4.5; c.liftV += 2.6; c.papT = 1; c.paper.visible = true;
      if (withCrumbs) emit(cat);
      kick();
    },
    close(cat) { const c = cookies[cat]; if (!c) return; c.target = 0; c.papT = 0; kick(); },
    closeAll() { cats.forEach((c) => api.close(c)); },
    dust() { for (const b of crumbs) if (b.on) { b.rest = false; b.v.x += 6 + R() * 4; b.v.y += 0.6 + R(); b.fade = 0.0001; } kick(); },
    reset({ draw: andDraw = true } = {}) {
      for (const cat of cats) { const c = cookies[cat]; Object.assign(c, { open: 0, vel: 0, target: 0, lift: 0, liftV: 0, pap: 0, papT: 0 }); c.paper.visible = false; pose(c); }
      for (let i = 0; i < MAXC; i++) { crumbs[i].on = false; cmesh.setMatrixAt(i, hideM); } cmesh.instanceMatrix.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true; if (andDraw) draw();
    },
    hover(cat, on) { const c = cookies[cat]; if (!c) return; c.hoverT = on ? 1 : 0; kick(); },
    isOpen: (cat) => cookies[cat].target === OPEN,
    layout,
    busy: () => running,
    quality,
    // test hook: where a cookie's top projects, in stage px
    project(cat) { const c = cookies[cat]; const v = new THREE.Vector3(0, c.top * 0.6, 0).add(c.root.position).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; },
    dispose() { renderer.dispose(); },
  };

  // ---------------------------------------------------------------- simulation
  function pose(c) {
    const lift = c.lift + c.hover * 0.12;
    c.inner.parent.position.y = lift;
    for (const h of c.halves) { h.piv.rotation.z = h.sgn * c.open; h.piv.position.y = h.base.y + h.sgn * c.open * 0.25; }
    const p = c.pap;
    c.paper.visible = p > 0.01;
    c.paper.position.set(0, c.top * (0.3 + 0.55 * p), 0.05);
    c.paper.rotation.set(-0.5, -c.root.rotation.y * 0.6, (c.root.rotation.y > 0 ? -1 : 1) * 0.12 * p);
    c.paper.scale.set(0.5 + 0.5 * p, 0.3 + 0.7 * p, 1);
  }
  function step(dt) {
    let moving = false;
    for (const cat of cats) {
      const c = cookies[cat];
      // halves: an under-damped spring, so the break wobbles before it settles
      const a = 190 * (c.target - c.open) - 9.5 * c.vel; c.vel += a * dt; c.open += c.vel * dt;
      if (c.target === 0 && c.open < 0) { c.open = 0; c.vel = 0; }
      // the hop, and the hover lift
      const la = -300 * c.lift - 16 * c.liftV; c.liftV += la * dt; c.lift += c.liftV * dt;
      c.hover += (c.hoverT - c.hover) * Math.min(1, dt * 14);
      // paper: eases out of the crack after the halves part
      const pt = c.papT && c.open > 0.12 ? 1 : (c.papT ? c.pap : 0);
      c.pap += (pt - c.pap) * Math.min(1, dt * (c.papT ? 7 : 12));
      pose(c);
      if (Math.abs(c.target - c.open) > 0.002 || Math.abs(c.vel) > 0.01 || Math.abs(c.lift) > 0.002 || Math.abs(c.liftV) > 0.01 || Math.abs(c.hover - c.hoverT) > 0.004 || Math.abs(pt - c.pap) > 0.004) moving = true;
    }
    let dirty = false;
    const hx = plateHX - 0.25;
    for (let i = 0; i < MAXC; i++) {
      const b = crumbs[i]; if (!b.on || b.rest) continue;
      dirty = moving = true;
      b.v.y -= 16 * dt; b.p.addScaledVector(b.v, dt);
      b.r.x += b.w.x * dt; b.r.y += b.w.y * dt; b.r.z += b.w.z * dt;
      const onPlate = Math.abs(b.p.x) < hx && Math.abs(b.p.z) < hz - 0.2;
      const floor = onPlate ? 0.012 + b.s * 0.4 : -0.04 + b.s * 0.4;
      if (b.p.y < floor && b.fade === 0) {
        b.p.y = floor;
        if (b.v.y < -0.8) { b.v.y *= -0.32; b.v.x *= 0.55; b.v.z *= 0.55; b.w.multiplyScalar(0.5); }
        else { b.v.set(0, 0, 0); b.w.set(0, 0, 0); b.rest = true; }
      }
      let s = b.s;
      if (b.fade > 0) { b.fade += dt * 2.4; s *= Math.max(0, 1 - b.fade); if (b.fade >= 1 || b.p.y < -3) { b.on = false; cmesh.setMatrixAt(i, hideM); continue; } }
      if (Math.abs(b.p.x) > 30) { b.on = false; cmesh.setMatrixAt(i, hideM); continue; }
      Q.setFromEuler(b.r); S.set(s, s * 0.7, s); M.compose(b.p, Q, S); cmesh.setMatrixAt(i, M);
    }
    if (dirty) cmesh.instanceMatrix.needsUpdate = true;
    return moving;
  }
  let running = false, last = 0, settleFrames = 0;
  let tick = 0;
  // while animating, the shadow map is redrawn every other frame (and always on the last one)
  function draw(final = true) { if (quality.shadows && (final || (++tick & 1))) renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); }
  function frame(t) {
    const dt = Math.min(1 / 30, last ? (t - last) / 1000 : 1 / 60);
    // adaptive quality: watch the frame interval while animating; if many run long, drop the pixel ratio, then shadows
    if (last) { const iv = t - last; quality.base = Math.min(quality.base, iv); quality.n++; if (iv > quality.base * 1.6 + 2) quality.slow++;
      if (quality.n >= 60) { if (quality.slow > 18) degrade(); quality.n = 0; quality.slow = 0; } }
    last = t;
    const moving = step(dt);
    draw(!moving);
    onFrame && onFrame();
    if (moving) settleFrames = 0; else settleFrames++;
    if (settleFrames > 2) { running = false; last = 0; return; }
    requestAnimationFrame(frame);
  }
  function degrade() {
    const pr = renderer.getPixelRatio();
    if (pr > 1.01) { quality.dprCap = Math.max(1, pr - 0.25); resize(); quality.stepped++; }
    else if (quality.shadows) { quality.shadows = false; key.castShadow = false; quality.stepped++; }
  }
  function kick() { if (!running) { running = true; settleFrames = 0; last = 0; requestAnimationFrame(frame); } }
  api.kick = kick;
  // compile every program up front, the hidden paper slips and the crumbs included, so the first crack never stalls
  api.compile = async () => {
    await ready;
    for (const cat of cats) cookies[cat].paper.visible = true;
    cmesh.setMatrixAt(0, new THREE.Matrix4().makeScale(0.001, 0.001, 0.001)); cmesh.instanceMatrix.needsUpdate = true;
    renderer.compile(scene, cam); renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam);
    for (const cat of cats) cookies[cat].paper.visible = false;
    cmesh.setMatrixAt(0, hideM); cmesh.instanceMatrix.needsUpdate = true;
    draw();
  };
  return api;
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
