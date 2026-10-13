// Gated by data-consent="analytics". Loaded only after Analytics is allowed; mounts and unmounts with the choice.
// Shows the "fresh from the oven" counter and heat badges on the products, and counts product views on this device.
const O = window.orvelle;
const KEY = 'dv50b.analytics';
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 1) return d; } catch {} return { v: 1, since: Date.now(), views: {} }; };
const store = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} O.changed(); };
const fmt = { format: (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') };   // no Intl: its first call is a long task on slow phones
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const heatColor = (h) => { const t = Math.max(0, Math.min(1, (h - 40) / 60)); const c = t < 0.5 ? mix([217, 160, 60], [214, 92, 22], t * 2) : mix([214, 92, 22], [168, 30, 50], (t - 0.5) * 2); return `rgb(${c})`; };

let data, oven, tick, io, seen, onBasket;
function heatOf(p) { return Math.min(99, Math.round(p.heat * 0.85 + Math.min(15, (data.views[p.id] || 0) * 3))); }
function badge(p, i) {
  const h = heatOf(p), slot = p.el.querySelector('[data-badges]');
  let b = slot.querySelector('.heat');
  if (!b) { b = document.createElement('span'); b.className = 'heat'; b.style.setProperty('--d', `${i * 60}ms`); slot.prepend(b); }
  b.style.setProperty('--heat', heatColor(h)); b.style.setProperty('--w', `${h}%`);
  b.innerHTML = `<i></i>${h >= 80 ? 'Hot' : h >= 60 ? 'Popular' : 'Steady'} · ${h}`;
  b.setAttribute('aria-label', `Popularity ${h} out of 100`);
}
function baked() { // a believable morning count: about 2.4 pastries a minute since 5:00 (demo figures)
  const now = new Date(), five = new Date(now); five.setHours(5, 0, 0, 0); if (now < five) five.setDate(five.getDate() - 1);
  return Math.round((now - five) / 60000 * 2.4) + 180;
}
function mount() {
  data = load(); store(data);
  oven = document.createElement('p'); oven.className = 'oven'; oven.dataset.feature = 'analytics';
  let n = baked();
  oven.innerHTML = `<span class="oven-dot" aria-hidden="true"></span><span><b data-n>${fmt.format(n)}</b> pastries out of the oven since 5:00 <small>· shop counter, demo figures</small></span>`;
  O.slots.oven.appendChild(oven);
  const num = oven.querySelector('[data-n]');
  tick = setInterval(() => { n += 1 + (Math.random() < 0.4); num.textContent = fmt.format(n); }, 2600);
  requestAnimationFrame(() => setTimeout(() => { if (data) O.products.forEach(badge); }, 0));   // badges a frame after the counter
  // count a view when a product is at least 60% visible for 0.8 s (once per page view each)
  seen = new Set(); const timers = new Map();
  io = new IntersectionObserver((es) => { for (const e of es) {
    const id = e.target.dataset.id;
    if (e.intersectionRatio >= 0.6 && !seen.has(id)) timers.set(id, setTimeout(() => { if (!data) return; seen.add(id); data.views[id] = (data.views[id] || 0) + 1; store(data); badge(O.byId[id], 0); }, 800));
    else { clearTimeout(timers.get(id)); timers.delete(id); }
  } }, { threshold: [0, 0.6] });
  O.products.forEach((p) => io.observe(p.el));
  onBasket = (e) => { const id = e.detail.id; data.views[id] = (data.views[id] || 0) + 2; store(data); badge(O.byId[id], 0); };
  window.addEventListener('orvelle:basket', onBasket);
}
function unmount() {
  clearInterval(tick); io && io.disconnect(); window.removeEventListener('orvelle:basket', onBasket);
  const gone = [oven, ...document.querySelectorAll('.heat')];
  for (const el of gone) { if (!el) continue; el.classList.add('out'); setTimeout(() => el.remove(), 300); }
  oven = null; data = null;
}
O.register('analytics', { mount, unmount });
