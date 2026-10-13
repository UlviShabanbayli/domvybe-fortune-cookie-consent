// The consent store and its public API (v2). No UI here: fortune.js draws the plate and calls into this.
//
//   consent.get()                 → { essential: true, analytics, marketing, personalisation, decided, method, ts, version }
//   consent.allowed('analytics')  → boolean
//   consent.set({ analytics: true }, method?)  saves a choice ('api' by default)
//   consent.acceptAll() · consent.rejectAll() · consent.reset()
//   consent.open() · consent.close()  (wired by the panel)
//   consent.store('analytics', 'dv50b.analytics')  declares what a category stores; revoking it deletes those keys
//   consent.on(fn)                → unsubscribe; fn(detail) on every change
//   window event 'consent:change' (detail = state + { changes: [{cat, on}], deleted: [keys] }), 'consent:ready' once
//
// Gating: <script type="text/plain" data-consent="analytics" [data-type="module"] [src]> stays inert until its category
// is allowed, then runs once. [data-consent][data-src] (iframes, images) gets its src at the same moment.

export const KEY = 'dv50b.consent';
export const POLICY = 2;                       // v2: the fortune-cookie build. A different version asks again.
const MAX_AGE = 182 * 24 * 3600 * 1000;        // ask again after about six months
export const CATEGORIES = ['essential', 'analytics', 'marketing', 'personalisation'];
export const OPTIONAL = CATEGORIES.slice(1);

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export function createConsent() {
  // forget anything an older build stored: every dv50 key that is not the current dv50b.* family (v1 used dv50a.*)
  safe(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && /^dv50/.test(k) && !k.startsWith('dv50b.')) localStorage.removeItem(k);
    }
  });

  const stores = { analytics: new Set(), marketing: new Set(), personalisation: new Set() };
  const read = () => {
    const r = safe(() => JSON.parse(localStorage.getItem(KEY)), null);
    if (!r || r.v !== POLICY || typeof r.categories !== 'object' || !r.ts || Date.now() - r.ts > MAX_AGE) return null;
    return r;
  };
  let rec = read();
  // a stale or missing record means nothing optional is allowed: clear what those categories may have left behind
  if (!rec) queueMicrotask(() => { for (const c of OPTIONAL) wipe(c); });
  const listeners = new Set();
  const ui = { open: () => {}, close: () => {} };

  const get = () => {
    const c = (rec && rec.categories) || {};
    return { essential: true, analytics: !!c.analytics, marketing: !!c.marketing, personalisation: !!c.personalisation,
      decided: !!rec, method: rec ? rec.method : null, ts: rec ? rec.ts : null, version: POLICY };
  };
  const allowed = (cat) => cat === 'essential' || (!!rec && !!rec.categories[cat]);

  function wipe(cat) {
    const gone = [];
    for (const k of stores[cat] || []) if (safe(() => localStorage.getItem(k) !== null, false)) { safe(() => localStorage.removeItem(k)); gone.push(k); }
    return gone;
  }

  function save(choice, method) {
    const before = get();
    const categories = { essential: true };
    for (const k of OPTIONAL) categories[k] = !!choice[k];
    rec = { v: POLICY, ts: Date.now(), method, categories };
    const stored = safe(() => { localStorage.setItem(KEY, JSON.stringify(rec)); return true; }, false);
    const changes = OPTIONAL.filter((k) => before[k] !== categories[k]).map((cat) => ({ cat, on: categories[cat] }));
    const deleted = changes.filter((c) => !c.on).flatMap((c) => wipe(c.cat));
    emit({ changes, deleted, stored });
    return stored;
  }

  function runGates() {
    document.querySelectorAll('script[type="text/plain"][data-consent]').forEach((old) => {
      if (!old.dataset.consent.split(/\s+/).every(allowed)) return;
      const s = document.createElement('script');
      for (const a of old.attributes) if (a.name !== 'type') s.setAttribute(a.name, a.value);
      if (old.dataset.type) s.type = old.dataset.type;
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
    document.querySelectorAll('[data-consent][data-src]:not(script)').forEach((el) => {
      if (el.dataset.consent.split(/\s+/).every(allowed) && !el.getAttribute('src')) el.setAttribute('src', el.dataset.src);
    });
  }

  function emit(extra = {}) {
    const detail = { ...get(), changes: [], deleted: [], ...extra };
    for (const fn of listeners) safe(() => fn(detail));
    window.dispatchEvent(new CustomEvent('consent:change', { detail }));
    // gated scripts run a frame later, so the page's own reaction and the scripts it unlocks don't share one frame
    requestAnimationFrame(() => setTimeout(runGates, 0));
  }

  const api = {
    version: POLICY, key: KEY, categories: CATEGORIES.slice(),
    get, allowed,
    set: (partial, method = 'api') => save({ ...get(), ...partial }, method),
    acceptAll: (method = 'accept-all') => save(Object.fromEntries(OPTIONAL.map((k) => [k, true])), method),
    rejectAll: (method = 'reject-non-essential') => save({}, method),
    reset: () => {
      const before = get();
      rec = null; safe(() => localStorage.removeItem(KEY));
      const changes = OPTIONAL.filter((k) => before[k]).map((cat) => ({ cat, on: false }));
      const deleted = OPTIONAL.flatMap(wipe);
      emit({ changes, deleted, method: 'reset' });
    },
    store: (cat, key) => { if (stores[cat]) stores[cat].add(key); if (!allowed(cat)) wipe(cat); },
    stores: () => Object.fromEntries(Object.entries(stores).map(([k, v]) => [k, [...v]])),
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    open: (opts) => ui.open(opts),
    close: () => ui.close(),
  };
  window.consent = api;
  runGates();
  queueMicrotask(() => window.dispatchEvent(new CustomEvent('consent:ready', { detail: get() })));
  return { api, internal: { ui, save } };
}
