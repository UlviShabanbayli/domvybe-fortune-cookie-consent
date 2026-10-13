// ORVELLE · the page side of consent: the basket (essential), the feature registry the gated scripts plug into,
// the "What changed" toast and the "On this device" inspector.
import { OPTIONAL } from './consent.js';

const BASKET = 'dv50b.basket';
export const FEATURE_TEXT = {
  analytics: { name: 'Analytics', on: 'Oven counter and popularity badges are on.', off: 'Oven counter and badges removed.' },
  marketing: { name: 'Marketing', on: 'Sunday box offer and newsletter card shown.', off: 'Offer ribbon and newsletter card removed.' },
  personalisation: { name: 'Personalisation', on: 'Counter reordered to your taste.', off: 'Counter back in the bakers’ order.' },
};
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSite(consent) {
  consent.store('analytics', 'dv50b.analytics');
  consent.store('marketing', 'dv50b.mkt');
  consent.store('personalisation', 'dv50b.taste');

  const grid = document.querySelector('[data-grid]');
  const cards = [...grid.querySelectorAll('.card')];
  const products = cards.map((c, i) => ({ id: c.dataset.id, i, name: c.querySelector('h3').textContent, tags: c.dataset.tags.split(' '),
    heat: +c.dataset.heat, img: c.querySelector('img').getAttribute('src'), price: c.querySelector('.price').textContent, el: c }));
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const slots = Object.fromEntries([...document.querySelectorAll('[data-slot]')].map((s) => [s.dataset.slot, s]));

  // ---------------------------------------------------------------- FLIP: measure, change the DOM, play the move
  function flip(container, mutate, { duration = 560 } = {}) {
    const box = container.getBoundingClientRect();
    if (reduced() || box.bottom < -200 || box.top > innerHeight + 200) { mutate(); return; }   // nobody would see the move
    const kids = [...container.children], before = new Map(kids.map((k) => [k, k.getBoundingClientRect()]));
    mutate();
    if (reduced()) return;
    for (const k of container.children) {
      const a = before.get(k); if (!a) continue;
      const b = k.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      k.classList.add('moving');
      k.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing: 'cubic-bezier(.2,.75,.2,1)' })
        .finished.then(() => k.classList.remove('moving'), () => k.classList.remove('moving'));
    }
  }
  // put the product cards in this order; extra tiles (the newsletter card) keep their slot
  let order = products.map((p) => p.id);
  function arrange(ids = order, { animate = true } = {}) {
    order = ids.slice();
    const run = () => {
      const extras = [...grid.children].filter((k) => !k.classList.contains('card'));
      for (const id of order) grid.appendChild(byId[id].el);
      for (const x of extras) x.remove();
      for (const x of extras) grid.insertBefore(x, grid.children[+x.dataset.slotAt || 4] || null);
    };
    animate ? flip(grid, run) : run();
  }

  // ---------------------------------------------------------------- basket (essential)
  const basketBtn = document.querySelector('[data-basket]'), basketN = document.querySelector('[data-basket-n]');
  let basket = safe(() => JSON.parse(localStorage.getItem(BASKET)) || [], []);
  if (!Array.isArray(basket)) basket = [];
  const paintBasket = () => { basketN.textContent = basket.length; basketBtn.setAttribute('aria-label', `Basket, ${basket.length} item${basket.length === 1 ? '' : 's'}`); };
  paintBasket();
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const id = b.closest('.card').dataset.id;
    basket.push(id); safe(() => localStorage.setItem(BASKET, JSON.stringify(basket)));
    paintBasket(); basketBtn.classList.remove('bump'); void basketBtn.offsetWidth; basketBtn.classList.add('bump');
    b.classList.add('added'); b.firstChild.textContent = 'Added'; setTimeout(() => { b.classList.remove('added'); b.firstChild.textContent = 'Add'; }, 1400);
    window.dispatchEvent(new CustomEvent('orvelle:basket', { detail: { id } }));
    inspect();
  });

  // ---------------------------------------------------------------- the feature registry the gated scripts plug into
  // mounting and unmounting are queued one feature per task, each a couple of frames apart, so turning three
  // features on at once (Accept all) never lands in a single frame
  const features = {}, mounted = {};
  let queued = false;
  // one job per frame: every deferred DOM change (feature mounts, FLIP steps, the toast) waits its turn, so two never
  // share a frame even when they are scheduled in the same task
  const jobs = []; let pumping = false;
  const pump = () => requestAnimationFrame(() => setTimeout(() => { const fn = jobs.shift(); if (fn) safe(fn); if (jobs.length) pump(); else pumping = false; }, 0));
  const later = (fn) => { jobs.push(fn); if (!pumping) { pumping = true; pump(); } };
  function reconcileStep() {
    for (const cat of OPTIONAL) {
      const f = features[cat], on = consent.allowed(cat);
      if (f && on && !mounted[cat]) { mounted[cat] = true; safe(() => f.mount()); return true; }
      if (f && !on && mounted[cat]) { mounted[cat] = false; safe(() => f.unmount()); return true; }
    }
    return false;
  }
  function reconcile() {
    if (queued) return; queued = true;
    const run = () => { if (reconcileStep()) later(run); else { queued = false; later(inspect); } };
    later(run);
  }
  // run steps in separate frames (each after a paint), so one change never stacks several layouts in one frame
  function seq(...fns) { for (const fn of fns) later(fn); }
  const O = window.orvelle = {
    seq,
    products, byId, grid, slots, flip, arrange, order: () => order.slice(), basket: () => basket.slice(),
    register(cat, f) { features[cat] = f; reconcile(); },
    changed: () => inspect(),
    mounted: () => ({ ...mounted }),
  };

  // ---------------------------------------------------------------- toast
  const toast = document.querySelector('[data-toast]'), list = document.querySelector('[data-toast-list]');
  let toastT = 0;
  function showToast(lines) {
    if (!lines.length) return;
    list.replaceChildren(...lines.map(([cls, html]) => { const li = document.createElement('li'); li.className = cls; li.innerHTML = html; return li; }));
    clearTimeout(toastT); toast.hidden = false; toast.classList.remove('hide'); toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    toastT = setTimeout(() => { toast.classList.add('hide'); toastT = setTimeout(() => { toast.hidden = true; }, 320); }, 5200);
  }
  window.addEventListener('consent:change', (e) => {
    const d = e.detail;
    reconcile();
    later(() => toastFor(d));
  });
  function toastFor(d) {
    const lines = d.changes.map(({ cat, on }) => {
      const t = FEATURE_TEXT[cat], gone = d.deleted.filter((k) => (consent.stores()[cat] || []).includes(k));
      return [on ? 'on' : 'off', `<b>${t.name} ${on ? 'on' : 'off'}.</b> ${on ? t.on : t.off}${gone.length ? `<small>Deleted ${gone.join(', ')} from this device.</small>` : ''}`];
    });
    if (!lines.length && (d.method === 'dismissed' || d.method === 'save-defaults' || d.method === 'reject-non-essential')) lines.push(['off', '<b>Essential only.</b> Nothing optional runs on this page.']);
    if (!lines.length && d.method === 'save') {
      const on = OPTIONAL.filter((c) => d[c]).map((c) => FEATURE_TEXT[c].name);
      lines.push(['on', on.length ? `<b>Saved.</b> ${on.join(', ')} on; everything else off.` : '<b>Saved.</b> Essential only.']);
    }
    if (d.method === 'reset') lines.push(['off', '<b>Forgotten.</b> Every key this page stored is gone.']);
    showToast(lines);
  }
  window.addEventListener('consent:ready', reconcile);

  // ---------------------------------------------------------------- "On this device"
  const insp = document.querySelector('[data-inspector]');
  let ghosts = new Map();
  function inspect() {
    if (!insp) return;
    const keys = safe(() => Object.keys(localStorage).filter((k) => k.startsWith('dv50b.')).sort(), []);
    const rows = keys.map((k) => { const li = document.createElement('li'); li.innerHTML = `<span>${k}</span><span>${(safe(() => localStorage.getItem(k).length, 0))} B</span>`; return li; });
    for (const [k, t] of ghosts) { if (Date.now() - t > 6000 || keys.includes(k)) { ghosts.delete(k); continue; } const li = document.createElement('li'); li.className = 'gone'; li.innerHTML = `<span>${k}</span><span>deleted</span>`; rows.push(li); }
    if (!rows.length) { const li = document.createElement('li'); li.innerHTML = '<span>Nothing stored yet</span><span></span>'; rows.push(li); }
    insp.replaceChildren(...rows);
  }
  window.addEventListener('consent:change', (e) => { for (const k of e.detail.deleted) ghosts.set(k, Date.now()); setTimeout(inspect, 6200); });
  document.querySelector('[data-forget]')?.addEventListener('click', () => {
    basket = []; safe(() => localStorage.removeItem(BASKET)); paintBasket();
    consent.reset(); consent.open();
  });
  inspect();
  return O;
}
