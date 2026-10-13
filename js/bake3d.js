// ORVELLE · shared 3D kit (three r186, vendored): noise, baked-goods textures, the fortune cookie (whole or cracked),
// the stoneware plate, crumbs, and the studio lighting. Used by the live consent plate (fortune.js) and by the
// stills renderer (dev/render.html) that bakes the product photographs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------- seeded random + value noise
export function rng(seed = 1) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const sm = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y, z = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
           l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf) * 2 - 1;
}
export function fbm(x, y, z = 0, oct = 4, lac = 2.03, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f + i * 7.13); n += a; a *= gain; f *= lac; }
  return s / n;
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export const U = { clamp, mix, smooth };

// paint a texture from fn(u, v) → [r, g, b] (0–255); wraps nothing, so seams are the caller's job
export function paint(size, fn, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = fn((x + 0.5) / size, 1 - (y + 0.5) / size), i = (y * size + x) * 4;
    d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------- parametric thick shells
// P(s, t) → Vector3 on [0,1]²; sRange(t) → [s0, s1] lets a piece have a jagged border (the crack).
// Builds outer + inner surface (offset along the normal) and the four rim strips, with uv = global (s, t) and a
// 'shade' attribute (1 outer, 0 inner, 0.5 rim) the material reads to toast the rims and pale the inside.
export function shell(P, { ns = 48, nt = 48, thick = 0.03, sRange = () => [0, 1], uvOf = (s, t) => [s, t] }) {
  const grid = [], nrm = [], uvs = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  for (let j = 0; j <= nt; j++) {
    const t = j / nt, [s0, s1] = sRange(t);
    for (let i = 0; i <= ns; i++) { const s = s0 + (s1 - s0) * (i / ns); grid.push(P(s, t)); uvs.push(uvOf(s, t)); }
  }
  const at = (i, j) => grid[j * (ns + 1) + i];
  for (let j = 0; j <= nt; j++) for (let i = 0; i <= ns; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(ns, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nt, j + 1);
    a.subVectors(at(i1, j), at(i0, j)); b.subVectors(at(i, j1), at(i, j0));
    const n = new THREE.Vector3().crossVectors(a, b);
    if (n.lengthSq() < 1e-12) n.set(0, 0, 1); nrm.push(n.normalize());
  }
  const pos = [], nor = [], uv = [], shade = [], idx = [];
  const push = (p, n, u, sh) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(u[0], u[1]); shade.push(sh); return pos.length / 3 - 1; };
  // outer (+n) and inner (−n) surfaces
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let k = 0; k < grid.length; k++) {
      c.copy(nrm[k]).multiplyScalar(side * thick / 2).add(grid[k]);
      d.copy(nrm[k]).multiplyScalar(side);
      push(c, d, uvs[k], side > 0 ? 1 : 0);
    }
    for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) {
      const q = base + j * (ns + 1) + i, r = q + 1, s = q + ns + 1, t = s + 1;
      if (side > 0) idx.push(q, r, t, q, t, s); else idx.push(q, t, r, q, s, t);
    }
  }
  // rim strips: walk the border of the grid, add a quad strip between the two surfaces
  const border = [];
  for (let i = 0; i <= ns; i++) border.push([i, 0]);
  for (let j = 1; j <= nt; j++) border.push([ns, j]);
  for (let i = ns - 1; i >= 0; i--) border.push([i, nt]);
  for (let j = nt - 1; j >= 1; j--) border.push([0, j]);
  const ring = [];
  for (const [i, j] of border) ring.push(j * (ns + 1) + i);
  ring.push(ring[0]);
  for (let k = 0; k < ring.length - 1; k++) {
    const k0 = ring[k], k1 = ring[k + 1], p0 = grid[k0], p1 = grid[k1];
    if (p0.distanceToSquared(p1) < 1e-12) continue;
    const n0 = nrm[k0], n1 = nrm[k1];
    const out = new THREE.Vector3().subVectors(p1, p0).cross(n0).normalize();
    const v = [
      push(c.copy(n0).multiplyScalar(thick / 2).add(p0), out, uvs[k0], 0.5),
      push(c.copy(n1).multiplyScalar(thick / 2).add(p1), out, uvs[k1], 0.5),
      push(c.copy(n1).multiplyScalar(-thick / 2).add(p1), out, uvs[k1], 0.5),
      push(c.copy(n0).multiplyScalar(-thick / 2).add(p0), out, uvs[k0], 0.5),
    ];
    idx.push(v[0], v[2], v[1], v[0], v[3], v[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1));
  g.setIndex(idx);
  // orientation check: flip winding if the outer surface ended up facing inward
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- the fortune cookie
// A disc of radius R folded over its diameter (the crease, along y), then bent over a rim so the two corners of the
// crease come down and together while the open edge flares into two lobes. Units: R = 1.
export function fortuneSurface({ R = 1, seed = 1, bend = 0.95, bendW = 0.32, pinchW = 0.24, lobe = 0.3, lobeTurn = 0.7 } = {}) {
  const wob = seed * 3.1;
  // the crease as a curve in the (x, y) plane (the layers stay isometric: they roll around an axis parallel to z):
  // its tangent turns by θ(y) = bend·tanh(y / bendW), so the bend is concentrated at the pinch (pressed over the rim)
  // and the two arms run nearly straight to the corners. CY/CZ hold the crease's (y, x) here.
  const N = 256, CY = new Float32Array(N + 1), CZ = new Float32Array(N + 1), TH = new Float32Array(N + 1);
  const th = (y) => bend * Math.tanh(y / (bendW * R));
  { const dy = 2 * R / N; let y0 = 0, x0 = 0; const mid = N / 2; CY[mid] = 0; CZ[mid] = 0; TH[mid] = 0;
    for (let k = mid + 1; k <= N; k++) { const y = (k - mid) * dy, t = th(y - dy / 2); y0 += Math.cos(t) * dy; x0 -= Math.sin(t) * dy; CY[k] = y0; CZ[k] = x0; TH[k] = th(y); CY[N - k] = -y0; CZ[N - k] = x0; TH[N - k] = -th(y); } }
  const crease = (y) => { const f = clamp((y / R + 1) / 2) * N, k = Math.min(N - 1, Math.floor(f)), r = f - k;
    return [mix(CY[k], CY[k + 1], r), mix(CZ[k], CZ[k + 1], r), mix(TH[k], TH[k + 1], r)]; };
  return (s, t) => {
    const u = 2 * s - 1, v = 2 * t - 1;
    const y = u * R * 0.985;
    const w = Math.sqrt(Math.max(0, 1 - u * u)) * R;
    const side = v < 0 ? -1 : 1;
    let a = Math.abs(v) * w;
    const pinch = Math.exp(-((u / pinchW) ** 2));                     // 1 where it was pressed over the rim
    a *= (1 + 0.035 * vnoise(u * 2.2 + wob, side * 1.7, wob)) * (1 - 0.32 * pinch);   // hand-cut, and pressed in at the pinch
    const rad = R * mix(lobe, 0.05, pinch);
    const thMax = Math.PI * mix(lobeTurn, 0.5, pinch);
    let X, Z;
    const a0 = rad * thMax;
    if (a <= a0) { const q = a / rad; X = rad * Math.sin(q); Z = rad * (1 - Math.cos(q)); }
    else { X = rad * Math.sin(thMax) + (a - a0) * Math.cos(thMax); Z = rad * (1 - Math.cos(thMax)) + (a - a0) * Math.sin(thMax); }
    X = Math.max(X, 0.028 * R * Math.min(1, a / (0.04 * R))) * side;
    // place the cross-section on the bent crease: in (x, y) the tangent is (−sin θ, cos θ), the layer normal (cos θ, sin θ)
    const [cy, cx, q] = crease(y);
    const n = 0.016 * R * vnoise(s * 3 + wob, t * 3, 2.5);
    const Xn = X + n * side;
    return new THREE.Vector3(cx + Math.cos(q) * Xn, cy + Math.sin(q) * Xn, Z + n);
  };
}

export function crackLine(seed = 1) {
  return (t) => 0.5 + 0.035 * vnoise(t * 6 + seed, seed * 0.7) + 0.018 * vnoise(t * 17 + seed, 3.3) + (t - 0.5) * 0.04;
}

// whole cookie or its two halves. Returns { whole } or { left, right, crackCenter }
export function fortuneCookieGeometry({ R = 1, seed = 1, cracked = false, ns = 40, nt = 44, thick = 0.032 } = {}) {
  const P = fortuneSurface({ R, seed });
  if (!cracked) return { whole: shell(P, { ns: ns * 2, nt, thick }) };
  const cl = crackLine(seed);
  const left = shell(P, { ns, nt, thick, sRange: (t) => [0, cl(t)] });
  const right = shell(P, { ns, nt, thick, sRange: (t) => [cl(t), 1] });
  return { left, right, crackCenter: P(cl(0.5), 0.5) };
}

// colour: toasted golden-brown, pale where the batter was thick, darker on the rim and the corners, fine freckles
export function cookieTextures({ size = 512, seed = 1 } = {}) {
  const z = seed * 1.37;
  const map = paint(size, (s, t) => {
    const u = 2 * s - 1, v = 2 * t - 1;
    const w = Math.sqrt(Math.max(0.0001, 1 - u * u));
    const rr = Math.sqrt(u * u + (v * w) * (v * w));          // distance from the disc centre (0 centre, 1 rim)
    const blot = fbm(s * 5, t * 5, z, 4);
    let toast = smooth(0.55, 1.02, rr + 0.14 * blot) * 0.9 + 0.3 * smooth(0.0, 0.8, blot) + 0.12;
    toast = clamp(toast + 0.1 * fbm(s * 22, t * 22, z + 4, 3));
    // pale golden → amber → toasted brown
    const c0 = [230, 194, 128], c1 = [206, 152, 80], c2 = [138, 82, 38];
    const k = toast < 0.55 ? toast / 0.55 : (toast - 0.55) / 0.45, A = toast < 0.55 ? c0 : c1, B = toast < 0.55 ? c1 : c2;
    let r = mix(A[0], B[0], k), g = mix(A[1], B[1], k), b = mix(A[2], B[2], k);
    // freckles and tiny pores
    const fr = vnoise(s * 160, t * 160, z + 9);
    if (fr > 0.72) { const f = (fr - 0.72) * 2.2; r *= 1 - f * 0.35; g *= 1 - f * 0.42; b *= 1 - f * 0.5; }
    const pore = vnoise(s * 90, t * 90, z + 13);
    if (pore > 0.78) { const f = (pore - 0.78) * 3; r = mix(r, 245, f * 0.35); g = mix(g, 214, f * 0.35); b = mix(b, 150, f * 0.35); }
    return [r, g, b];
  });
  const bump = paint(size, (s, t) => {
    const h = 0.5 + 0.28 * fbm(s * 48, t * 48, z + 2, 3) - 0.35 * Math.max(0, vnoise(s * 90, t * 90, z + 13) - 0.6) + 0.12 * fbm(s * 9, t * 9, z, 2);
    const q = clamp(h) * 255; return [q, q, q];
  }, { srgb: false });
  const rough = paint(size >> 1, (s, t) => {
    const r = 0.52 - 0.16 * smooth(-0.2, 0.6, fbm(s * 6, t * 6, z + 5, 3)) + 0.12 * Math.max(0, vnoise(s * 90, t * 90, z + 13) - 0.5);
    const q = clamp(r) * 255; return [q, q, q];
  }, { srgb: false });
  return { map, bump, rough };
}

export function cookieMaterial(tex, { tint = 0 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    map: tex.map, bumpMap: tex.bump, bumpScale: 3.2, roughnessMap: tex.rough, roughness: 1, metalness: 0,
    clearcoat: 0.32, clearcoatRoughness: 0.42, sheen: 0.2, sheenRoughness: 0.6, sheenColor: new THREE.Color('#f1d3a0'),
    specularIntensity: 0.6,
  });
  // the 'shade' attribute: the inside is paler and drier, the cut edge shows the airy crumb
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float shade; varying float vShade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShade = shade;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vShade;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float inner = 1.0 - smoothstep(0.0, 0.5, vShade);
        float rim = 1.0 - abs(vShade - 0.5) * 2.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.1, 1.02), inner * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.66, 0.38), step(0.99, rim) * 0.55);`);
  };
  m.customProgramCacheKey = () => 'fortune-cookie';
  return m;
}

// ---------------------------------------------------------------- stoneware plate (a rounded-rectangle tray)
// Superellipse outline (n = 4) swept with a rim profile. size = [half length x, half depth z].
export function plateGeometry({ hx = 2.6, hz = 1.05, n = 4, rim = 0.16, seg = 160 } = {}) {
  // profile: (ρ, y) from the centre of the floor out over the rim and down the outer wall to the foot
  const prof = [];
  const add = (r, y) => prof.push([r, y]);
  add(0, 0); add(0.5, 0); add(0.78, 0.0);
  for (let i = 1; i <= 10; i++) { const k = i / 10; add(0.78 + 0.2 * k, rim * Math.pow(Math.sin(k * Math.PI / 2), 1.6)); }
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI; add(0.98 + 0.035 * Math.sin(a), rim + 0.028 * Math.sin(a) - 0.012 * (1 - Math.cos(a))); }
  add(0.985, rim * 0.6); add(0.95, 0.02); add(0.93, -0.03); add(0.86, -0.04); add(0, -0.04);
  const outline = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [hx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), hz * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)];
  };
  // the profile ρ scales towards the outline, but the rim keeps a constant width: offset rather than scale near the edge
  const pos = [], uv = [], idx = [];
  const np = prof.length;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, [ox, oz] = outline(a), L = Math.hypot(ox, oz);
    for (let k = 0; k < np; k++) {
      const [r, y] = prof[k];
      // distance-from-edge form: points near r = 1 sit a fixed world distance inside the outline
      const inset = (1 - r) * 1.0;                      // world units at r = 0 → the centre region collapses nicely
      const f = Math.max(0, 1 - inset * 1.0 / L);
      const fx = r < 0.78 ? (r / 0.78) * Math.max(0, 1 - 0.22 / L * 1.0) : f;
      pos.push(ox * fx, y, oz * fx); uv.push(i / seg, k / (np - 1));
    }
  }
  for (let i = 0; i < seg; i++) for (let k = 0; k < np - 1; k++) {
    const a = i * np + k, b = a + 1, c = a + np, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function plateMaterial({ size = 512, seed = 3, color = [241, 236, 226] } = {}) {
  const map = paint(size, (s, t) => {
    let [r, g, b] = color;
    const cloud = fbm(s * 4, t * 4, seed, 3) * 6;
    r += cloud; g += cloud; b += cloud * 0.8;
    const sp = vnoise(s * 260, t * 260, seed + 1);                // iron speckle in the clay
    if (sp > 0.8) { const f = (sp - 0.8) * 4; r -= 70 * f; g -= 80 * f; b -= 90 * f; }
    // a toasted, unglazed lip: the profile's top band (v ≈ 0.6–0.8 in the uv set by plateGeometry)
    const lip = smooth(0.66, 0.72, t) * (1 - smooth(0.8, 0.86, t));
    r = mix(r, 196, lip * 0.55); g = mix(g, 160, lip * 0.55); b = mix(b, 122, lip * 0.55);
    return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
  }, { repeat: true });
  map.repeat.set(1, 1);
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0, specularIntensity: 0.7 });
}

// ---------------------------------------------------------------- crumbs (one instanced mesh)
export function crumbGeometry(seed = 7) {
  const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position, R = rng(seed);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.6 + 0.6 * R()), p.getY(i) * (0.4 + 0.5 * R()), p.getZ(i) * (0.6 + 0.6 * R()));
  g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------- the fortune paper (a thin strip, front printed in a texture)
export function paperMaterial() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#c0392b'; g.globalAlpha = 0.55;
  for (let i = 0; i < 6; i++) g.fillRect(40 + i * 30, 30, 18, 3);
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------- studio light
export function studioLights(renderer, scene, { env = 0.9, key = 2.4, keyPos = [3.5, 6, 4.5], shadow = 1024, fill = 0.35, warm = '#fff1dc' } = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex; scene.environmentIntensity = env;
  const k = new THREE.DirectionalLight(warm, key); k.position.set(...keyPos);
  k.castShadow = shadow > 0;
  if (shadow) { k.shadow.mapSize.set(shadow, shadow); k.shadow.bias = -0.0004; k.shadow.normalBias = 0.02; k.shadow.radius = 6; k.shadow.camera.near = 0.5; k.shadow.camera.far = 30; Object.assign(k.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); }
  scene.add(k);
  const f = new THREE.DirectionalLight('#dfe8ff', fill); f.position.set(-5, 3, -2); scene.add(f);
  pmrem.dispose();
  return { key: k, fill: f };
}
