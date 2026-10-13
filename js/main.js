// ORVELLE · boot: consent store → page features → the fortune-cookie panel.
import { createConsent } from './consent.js';
import { createSite } from './site.js';
import { createFortune } from './fortune.js';

const { api, internal } = createConsent();
createSite(api);
window.__ready = false;
window.__fortuneReady = createFortune({ consent: api, internal })
  .then(() => { window.__ready = true; })
  .catch((e) => { console.error(e); window.__ready = true; });
