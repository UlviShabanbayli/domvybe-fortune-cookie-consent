// Gated by data-consent="personalisation". Reorders the counter to your taste (FLIP) and adds a "Because you like…" row.
// Taste comes from what you add to the basket and the flavours you pick; it lives in dv50b.taste on this device only.
const O = window.orvelle;
const KEY = 'dv50b.taste';
const FLAVOURS = [['buttery', 'Buttery'], ['chocolate', 'Chocolate'], ['caramel', 'Caramel'], ['citrus', 'Citrus'], ['nutty', 'Nutty'], ['fruity', 'Fruity'], ['spiced', 'Spiced'], ['bread', 'Bread'], ['vanilla', 'Vanilla']];
const LABEL = Object.fromEntries(FLAVOURS);
const store = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} O.changed(); };
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 1) return d; } catch {}
  // first time: start from the basket; with an empty basket, start from what most regulars pick
  const likes = { buttery: 0.6, chocolate: 0.45, spiced: 0.3 };      // what most regulars pick
  const basket = O.basket();
  for (const id of basket) for (const t of O.byId[id].tags) likes[t] = (likes[t] || 0) + 1;
  const seeded = !basket.length;
  return { v: 1, likes, seeded };
}
let data, row, onBasket, note, noteText;
const score = (p) => p.tags.reduce((s, t) => s + (data.likes[t] || 0), 0);
function ranked() { return O.products.slice().sort((a, b) => score(b) - score(a) || a.i - b.i); }
function top() { return Object.entries(data.likes).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t); }
function apply({ split = false } = {}) {
  const r = ranked();
  const move = () => { if (!data) return; O.arrange(r.map((p) => p.id)); };
  const tag = () => {
    if (!data) return;
    document.querySelectorAll('.card .yours').forEach((e) => e.remove());
    r.slice(0, 3).forEach((p) => { if (score(p) > 0) { const t = document.createElement('span'); t.className = 'yours'; t.textContent = 'For you'; p.el.querySelector('.card-media').appendChild(t); } });
    paintRow(r); note.textContent = 'Sorted to your taste.';
  };
  if (split) O.seq(move, tag); else { move(); tag(); }
}
function paintRow(r) {
  const fav = top()[0];
  row.querySelector('[data-fav]').textContent = fav ? `${LABEL[fav] || fav}`.toLowerCase() : 'good';
  row.querySelector('[data-from]').textContent = data.seeded ? 'Starting from our regulars’ favourites. Tap a flavour to tune it.' : 'From what you added and picked. Tap a flavour to tune it.';
  row.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String((data.likes[c.dataset.t] || 0) > 0.4)));
  row.querySelector('.picks').replaceChildren(...r.slice(0, 3).map((p) => {
    const li = document.createElement('li'); li.className = 'pick';
    li.innerHTML = `<img src="${p.img}" alt="" width="56" height="56" decoding="async"><div><b>${p.name}</b><span>${p.price} · ${p.tags.map((t) => LABEL[t] || t).join(', ')}</span></div>`;
    return li;
  }));
}
function mount() {
  data = load(); store(data);
  note = document.querySelector('[data-order-note]'); noteText = note.textContent;
  row = document.createElement('section'); row.className = 'taste'; row.dataset.feature = 'personalisation'; row.setAttribute('aria-labelledby', 'taste-title');
  row.innerHTML = `<div class="taste-head"><h2 id="taste-title">Because you like <em data-fav></em> things</h2><p data-from></p></div>
    <ul class="chips" aria-label="Flavours you like">${FLAVOURS.map(([t, l]) => `<li><button class="chip" type="button" data-t="${t}" aria-pressed="false">${l}</button></li>`).join('')}</ul>
    <ul class="picks" aria-label="Picked for you"></ul>`;
  row.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    if (!data) return; const t = c.dataset.t; data.likes[t] = (data.likes[t] || 0) > 0.4 ? 0 : 1.2; data.seeded = false; store(data); apply();
  });
  paintRow(ranked());
  // the row lands as an empty box of about its size (page shifts once), its contents lay out in the next frame,
  // then the counter reorders and gets its tags: each step in its own frame
  const parts = [...row.children]; parts.forEach((p) => p.classList.add('pending'));
  O.slots.taste.appendChild(row);
  O.seq(...parts.map((p) => () => p.classList.remove('pending')));
  apply({ split: true });
  onBasket = (e) => { for (const t of O.byId[e.detail.id].tags) data.likes[t] = (data.likes[t] || 0) + 0.5; data.seeded = false; store(data); apply(); };
  window.addEventListener('orvelle:basket', onBasket);
}
function unmount() {
  window.removeEventListener('orvelle:basket', onBasket);
  const r = row; row = null; data = null;
  O.seq(() => { document.querySelectorAll('.card .yours').forEach((e) => e.remove()); if (note) note.textContent = noteText; r && r.classList.add('out'); },
        () => O.arrange(O.products.map((p) => p.id)),
        () => setTimeout(() => r && r.remove(), 260));
}
O.register('personalisation', { mount, unmount });
