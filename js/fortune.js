// ORVELLE · the fortune-cookie consent panel: crack, read, decide.
// Each cookie is a real button; its paper slip carries a real role=switch. A switch flip is a choice and applies at
// once (the page changes behind the panel). Save, Accept all and Reject non-essential fold the papers back, dust the
// crumbs off the plate and tuck the panel into the fortune-cookie button in the corner.
import { CATEGORIES, OPTIONAL } from './consent.js';

export const FORTUNES = {
  essential: { no: 'No. 1', text: 'Without this one your basket forgets you between pages. It stays, and it never leaves this site.',
    meta: '<b>Keeps</b> your basket and this choice · <b>shares</b> nothing' },
  analytics: { no: 'No. 2', text: 'A little bird counts which pastries get looked at, never who looked.',
    meta: '<b>Keeps</b> view counts on this device · <b>shows</b> the oven counter and heat badges' },
  marketing: { no: 'No. 3', text: 'A Sunday box at fifteen percent off is in your future, if you would like to hear about it.',
    meta: '<b>Keeps</b> that you saw the offer · <b>shows</b> the offer ribbon and the newsletter' },
  personalisation: { no: 'No. 4', text: 'The pastries you love will drift to the front of the counter.',
    meta: '<b>Keeps</b> your flavour picks · <b>reorders</b> the counter to your taste' },
};
const NAME = { essential: 'Essential', analytics: 'Analytics', marketing: 'Marketing', personalisation: 'Personalisation' };
const HINT = 'Tap a cookie. Each one hides a sentence about what it does.';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export async function createFortune({ consent, internal }) {
  const root = document.getElementById('fc');
  const $ = (s) => root.querySelector(s);
  const stage = $('[data-stage]'), canvas = $('.fc-canvas'), slip = $('#fc-slip'), sw = $('#fc-switch'), live = $('[data-live]');
  const reopen = document.querySelector('[data-reopen]');
  const btn = Object.fromEntries(CATEGORIES.map((c) => [c, root.querySelector(`.fc-cookie[data-cat="${c}"]`)]));
  const q = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = () => innerWidth <= 640;

  // first in the tab order: right after the skip link
  document.querySelector('.skip').after(root);

  // ---------------------------------------------------------------- 3D or the static plate
  let plate = null;
  const wantStatic = () => reduced.matches || q.has('static');
  async function boot3d() {
    if (wantStatic()) return null;
    const { createPlate, webglAvailable } = await import('./plate3d.js');
    if (!webglAvailable()) return null;
    try { const p = createPlate(canvas, { cats: CATEGORIES, phone: phone() }); await p.ready; return p; }
    catch (e) { console.warn('3D plate unavailable, using the static plate', e); return null; }
  }
  plate = await boot3d();
  root.classList.toggle('static', !plate);

  function measure() {
    const r = stage.getBoundingClientRect();
    const centers = CATEGORIES.map((c) => { const b = btn[c].getBoundingClientRect(); return b.left - r.left + b.width / 2; });
    return { w: r.width, h: r.height, centers };
  }
  function relayout() { if (!plate) return; const m = measure(); if (m.w > 0) plate.layout(m.w, m.h, m.centers, phone() ? 34 : 38); }
  new ResizeObserver(() => { if (state.open) relayout(); }).observe(stage);
  reduced.addEventListener?.('change', () => { if (reduced.matches && plate) { root.classList.add('static'); plate = null; syncCracks(); } });

  // ---------------------------------------------------------------- state
  const state = { open: false, active: '', cracked: Object.fromEntries(CATEGORIES.map((c) => [c, false])), busy: 0, showcase: false };
  const say = (t) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = t; }); };
  function status(cat) {
    const s = consent.get();
    if (cat === 'essential') return ['locked', 'Always on'];
    if (!s.decided) return ['', state.cracked[cat] ? 'Not chosen yet' : 'Unopened'];   // opened is not decided: a neutral label until a choice is saved
    return s[cat] ? ['on', 'Allowed'] : ['off', 'No thanks'];
  }
  function syncStatus() {
    for (const c of CATEGORIES) { const [k, t] = status(c); btn[c].dataset.status = k; btn[c].querySelector('.fc-status').textContent = t; }
    if (FORTUNES[state.active]) paintSwitch(state.active);
  }
  function syncCracks() { for (const c of CATEGORIES) { btn[c].classList.toggle('cracked', state.cracked[c]); btn[c].setAttribute('aria-expanded', String(state.active === c)); } }
  function paintSwitch(cat) {
    const locked = cat === 'essential', on = locked || consent.allowed(cat);
    sw.setAttribute('aria-checked', String(on));
    sw.toggleAttribute('aria-disabled', false);
    if (locked) sw.setAttribute('aria-disabled', 'true');
    $('[data-switch-label]').textContent = locked ? `${NAME[cat]} cookies, always on` : `Allow ${NAME[cat].toLowerCase()} cookies`;
    sw.querySelector('[data-on]').textContent = locked ? 'Always on' : 'Allow';
  }
  function paintSlip(cat) {
    slip.dataset.cat = cat;
    const f = FORTUNES[cat];
    $('[data-slip-name]').textContent = cat === 'all' ? 'All four' : cat ? NAME[cat] : 'Your fortune';
    $('[data-slip-no]').textContent = f ? f.no : '';
    $('[data-slip-text]').textContent = cat === 'all' ? 'Fortune favours the curious. Everything is on; the page has already changed behind this note.'
      : cat === 'none' ? 'Only the essential one. Noted, no hard feelings; nothing optional will run.'
      : cat ? f.text : HINT;
    $('[data-slip-meta]').innerHTML = cat && f ? f.meta : '';
    if (cat === 'all' || cat === 'none') slip.dataset.cat = '';
    if (f) paintSwitch(cat);
  }
  async function showSlip(cat, from) {
    paintSlip(cat);
    if (reduced.matches) { slip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'linear' }); return; }
    // the paper slides out of the cookie: start at the cookie, small and folded, end at rest (no transform at rest)
    const a = from ? from.getBoundingClientRect() : null, b = slip.getBoundingClientRect();
    const dx = a ? a.left + a.width / 2 - (b.left + b.width / 2) : 0, dy = a ? a.top + a.height * 0.35 - (b.top + b.height / 2) : -20;
    slip.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.18, .08)`, opacity: 0 },
      { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(.7, .35)`, opacity: 1, offset: 0.35 },
      { transform: 'translate(0, 3px) scale(1.01, 1.02)', offset: 0.78 },
      { transform: 'none', opacity: 1 },
    ], { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }

  // ---------------------------------------------------------------- crack, read, decide
  async function crack(cat, { focusSwitch = false, quiet = false } = {}) {
    const first = !state.cracked[cat];
    state.cracked[cat] = true; state.active = cat;
    if (plate) plate.crack(cat, { crumbs: first });
    syncCracks();
    await nextFrame();                       // the crack starts this frame; the paper and the labels follow in the next
    syncStatus();
    await showSlip(cat, btn[cat]);
    if (!quiet) {
      const [, t] = status(cat);
      say(`${NAME[cat]} cookie ${first ? 'cracked' : 'open'}. ${FORTUNES[cat].text} ${cat === 'essential' ? 'Always on.' : t === 'Not chosen yet' ? 'Not chosen yet: off until you allow it.' : `Currently ${t}.`}`);
    }
    if (focusSwitch) sw.focus();
  }
  function flip() {
    const cat = state.active; if (!cat || !FORTUNES[cat]) return;
    if (cat === 'essential') {
      sw.classList.remove('nudge'); void sw.offsetWidth; sw.classList.add('nudge');
      say('Essential cookies cannot be switched off. They keep your basket and this choice, and nothing else.');
      return;
    }
    const on = !consent.allowed(cat);
    // the knob moves this frame; the choice is saved (and the page starts changing) in the next task
    sw.setAttribute('aria-checked', String(on));
    requestAnimationFrame(() => setTimeout(() => {
      consent.set({ [cat]: on }, 'switch');
      paintSwitch(state.active === cat ? cat : state.active); syncStatus();
      say(`${NAME[cat]} ${on ? 'allowed' : 'switched off'}. ${on ? 'The page has changed.' : 'Its data was deleted.'}`);
    }, 0));
  }

  async function acceptAll() {
    if (state.busy) return; state.busy++;
    consent.acceptAll();
    const order = CATEGORIES.filter((c) => !state.cracked[c]);
    // the cascade: every unopened cookie cracks, a beat apart
    for (const [i, c] of order.entries()) { setTimeout(() => { state.cracked[c] = true; plate && plate.crack(c); syncCracks(); }, i * 120); }
    state.active = 'all'; syncStatus();
    await wait(order.length * 120); syncCracks();
    await showSlip('all', btn.marketing);
    say('All four cookies allowed. Saved.');
    await wait(reduced.matches ? 500 : 1300);
    state.busy--;
    await tuck('accept');
  }
  async function rejectAll() {
    if (state.busy) return; state.busy++;
    consent.rejectAll();
    state.active = 'none'; syncStatus(); syncCracks();
    await showSlip('none', btn.essential);
    say('Only essential cookies. Saved.');
    await wait(reduced.matches ? 400 : 900);
    state.busy--;
    await tuck('reject');
  }
  async function save() {
    if (state.busy) return;
    const s = consent.get();
    consent.set(Object.fromEntries(OPTIONAL.map((k) => [k, s[k]])), s.decided ? 'save' : 'save-defaults');
    say('Choices saved.');
    await tuck('save');
  }
  async function dismiss() {
    if (state.busy) return;
    if (!consent.get().decided) consent.rejectAll('dismissed');
    await tuck('close');
  }

  // ---------------------------------------------------------------- open / tuck
  let tucking = null;
  async function tuck(why) {
    if (!state.open || tucking) return tucking;
    tucking = (async () => {
      const hadFocus = root.contains(document.activeElement);
      state.busy++;
      // 1. the papers fold back
      const rm = reduced.matches;
      const fold = slip.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1, .06)', opacity: 0 }], { duration: rm ? 180 : 260, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
      // 2. the halves close and the crumbs are dusted off the plate
      if (plate) { plate.closeAll(); plate.dust(); }
      for (const c of CATEGORIES) state.cracked[c] = false;
      state.active = ''; syncCracks();
      await wait(rm ? 200 : 620);
      // 3. the panel tucks itself into the cookie button in the corner
      reopen.hidden = false;
      const a = root.getBoundingClientRect(), b = reopen.getBoundingClientRect();
      const sx = b.width / a.width, sy = b.height / a.height;
      const tx = b.left + b.width / 2 - (a.left + a.width / 2), ty = b.top + b.height / 2 - (a.top + a.height / 2);
      reopen.style.visibility = 'hidden';
      await root.animate(rm ? [{ opacity: 1 }, { opacity: 0 }] : [
        { transform: 'none', opacity: 1, borderRadius: '24px' },
        { transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`, opacity: 0.2, borderRadius: '50%' },
      ], { duration: rm ? 200 : 420, easing: 'cubic-bezier(.6,0,.3,1)' }).finished.catch(() => {});
      fold.cancel();
      setClosed();
      reopen.style.visibility = '';
      reopen.classList.remove('pop'); void reopen.offsetWidth; if (!rm) reopen.classList.add('pop');
      if (plate) plate.reset();
      paintSlip('');
      if (hadFocus) reopen.focus({ preventScroll: true });
      state.busy--;
      root.dispatchEvent(new CustomEvent('fortune:tucked', { detail: { why } }));
    })();
    try { await tucking; } finally { tucking = null; }
  }
  function setClosed() {
    state.open = false; root.dataset.state = 'closed'; root.setAttribute('aria-hidden', 'true'); root.inert = true;
  }
  async function open({ first = false, focus = true } = {}) {
    if (state.open) { if (focus) btn.essential.focus(); return; }
    state.open = true;
    root.inert = false; root.removeAttribute('aria-hidden'); root.dataset.state = 'open';
    for (const c of CATEGORIES) state.cracked[c] = false;
    // a first visit opens on the showcase: the Essential cookie is already cracked and its fortune is already out on
    // the very first painted frame (it is always on, so nothing optional is pre-ticked). The paper is plain DOM here,
    // with no slide-in animation, timer or frame callback in front of it: nothing can leave an empty slot under the
    // cookies (2026-10-13 fix: before, the paper only came out 700 ms + a frame later, and in a real browser the slot
    // between the cookie row and the buttons could stay empty until a tap).
    const showcase = first;
    if (showcase) { state.showcase = true; state.cracked.essential = true; state.active = 'essential'; paintSlip('essential'); }
    else { state.active = ''; paintSlip(''); }
    syncCracks(); syncStatus();
    // the plate resets and re-measures a frame later, in one draw, while the panel is still tiny in its grow-in; on the
    // showcase the 3D Essential cookie then cracks open (halves part, a hop, crumbs) as the panel lands
    if (plate) {
      const p = plate;
      requestAnimationFrame(() => setTimeout(() => {
        p.reset({ draw: false }); relayout();
        if (showcase) setTimeout(() => { if (state.open && state.cracked.essential && plate === p) p.crack('essential'); }, reduced.matches ? 0 : 320);
      }, 0));
    }
    const fromBtn = !reopen.hidden;
    let grow = null;
    if (!reduced.matches) {
      if (fromBtn) {
        const a = root.getBoundingClientRect(), b = reopen.getBoundingClientRect();
        grow = root.animate([{ transform: `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${b.width / a.width}, ${b.height / a.height})`, opacity: 0.2, borderRadius: '50%' },
          { transform: 'none', opacity: 1, borderRadius: '24px' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else grow = root.animate([{ transform: 'translateY(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    reopen.hidden = true;
    if (focus && !first) btn.essential.focus({ preventScroll: true });
    // the first open settles before the page reports ready (capped, so a hidden tab never holds it up)
    if (first && grow) await Promise.race([grow.finished.catch(() => {}), wait(700)]);
  }

  // ---------------------------------------------------------------- input
  for (const c of CATEGORIES) {
    const b = btn[c];
    b.addEventListener('click', (e) => { if (state.busy) return; crack(c, { focusSwitch: e.detail === 0 }); });
    b.addEventListener('pointerenter', () => plate && plate.hover(c, true));
    b.addEventListener('pointerleave', () => plate && plate.hover(c, false));
    b.addEventListener('focus', () => plate && plate.hover(c, true));
    b.addEventListener('blur', () => plate && plate.hover(c, false));
    b.addEventListener('keydown', (e) => {
      const i = CATEGORIES.indexOf(c), n = CATEGORIES.length;
      const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
      if (j >= 0) { e.preventDefault(); btn[CATEGORIES[j]].focus(); }
    });
  }
  sw.addEventListener('click', flip);
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'accept') acceptAll(); else if (act === 'reject') rejectAll(); else if (act === 'save') save(); else if (act === 'close') dismiss();
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } });
  reopen.addEventListener('click', () => open());
  document.querySelectorAll('[data-open-prefs]').forEach((b) => b.addEventListener('click', () => open()));
  internal.ui.open = (o) => open(o || {});
  internal.ui.close = () => dismiss();
  window.addEventListener('consent:change', () => syncStatus());

  // ---------------------------------------------------------------- start
  if (plate) await plate.compile();
  const s = consent.get();
  if (!s.decided) await open({ first: true, focus: false });
  else { reopen.hidden = false; setClosed(); }

  // test hook
  const idle = async () => { for (let i = 0; i < 400; i++) { if (!state.busy && !tucking && !(plate && plate.busy())) return true; await wait(25); } return false; };
  window.__fortune = {
    mode: plate ? '3d' : 'static',
    state: () => ({ open: state.open, active: state.active, cracked: { ...state.cracked }, busy: state.busy, status: Object.fromEntries(CATEGORIES.map((c) => [c, status(c)[1]])),
      switch: sw.getAttribute('aria-checked'), quality: plate ? { dpr: plate.quality.dprCap, shadows: plate.quality.shadows, stepped: plate.quality.stepped } : null }),
    idle,
    center: (sel) => { const el = typeof sel === 'string' && btn[sel] ? btn[sel] : document.querySelector(sel); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
    cookieTop: (cat) => { const r = stage.getBoundingClientRect(); if (!plate) return window.__fortune.center(cat); const [x, y] = plate.project(cat); return [r.left + x, r.top + y]; },
  };
  return { open, tuck, crack };
}
