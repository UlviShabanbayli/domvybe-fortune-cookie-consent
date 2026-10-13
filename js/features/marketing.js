// Gated by data-consent="marketing". The Sunday box offer ribbon and the newsletter card.
// The newsletter form is a demo: it sends nothing and says so.
const O = window.orvelle;
const KEY = 'dv50b.mkt';
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 1) return d; } catch {} return { v: 1, campaign: 'sunday-box', seen: Date.now(), dismissed: false }; };
const store = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} O.changed(); };
let data, ribbon, card;

function mount() {
  data = load(); store(data);
  if (!data.dismissed) {
    ribbon = document.createElement('aside'); ribbon.className = 'ribbon'; ribbon.setAttribute('aria-label', 'Offer');
    ribbon.innerHTML = `<div class="ribbon-in"><span><b>Sunday Fortune Box.</b> Twelve hand-folded cookies with fortunes you write. 15% off this week with</span> <code>FORTUNE15</code>
      <button class="ribbon-x" type="button" aria-label="Hide this offer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
    ribbon.querySelector('button').addEventListener('click', () => { data.dismissed = true; store(data); drop(ribbon); ribbon = null; });
  }
  const rb = ribbon;
  card = document.createElement('article'); card.className = 'news'; card.dataset.slotAt = '4'; card.dataset.feature = 'marketing';
  card.innerHTML = `<div><p class="eyebrow">Letters from the oven</p><h3>First to know when the Sunday box drops.</h3></div>
    <p>One letter a month: the new fortune flavours and the bake of the week.</p>
    <form novalidate><label for="news-email">Email address</label><input id="news-email" type="email" autocomplete="email" placeholder="you@example.com"><button type="submit">Sign me up</button>
    <p class="demo" aria-live="polite">Demo: nothing is sent. This page has no server.</p></form>`;
  card.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); card.querySelector('.demo').textContent = 'Demo only: nothing was sent, and nothing was stored.'; });
  const c = card;
  O.seq(() => rb && rb.isConnected === false && data && O.slots.ribbon.appendChild(rb), () => c === card && O.flip(O.grid, () => O.grid.insertBefore(c, O.grid.children[4] || null)));
}
function drop(el) { if (!el) return; el.classList.add('out'); setTimeout(() => el.remove(), 300); }
function unmount() {
  drop(ribbon); ribbon = null;
  const c = card; card = null;
  if (c) { c.classList.add('out'); setTimeout(() => O.seq(() => O.flip(O.grid, () => c.remove())), 280); }
  data = null;
}
O.register('marketing', { mount, unmount });
