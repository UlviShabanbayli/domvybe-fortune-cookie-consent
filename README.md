# Fortune-cookie consent — UI component

**[Live demo](https://domvybe.com/components/fortune-cookie-consent/)** · [Step-by-step tutorial](https://domvybe.com/library/fortune-cookie-consent/) · [Download the ZIP](https://github.com/UlviShabanbayli/domvybe-fortune-cookie-consent/releases/latest/download/fortune-cookie-consent-source.zip)

A cookie banner of four 3D fortune cookies: crack one, read what it does, flip its switch and the page changes at once; Reject is as easy as Accept.

Open `index.html` through any local static server (for example `python3 -m http.server`) and try it with a mouse,
a finger or the keyboard. Plain HTML, CSS and JavaScript; no build step; one library, three.js (vendored in vendor/three/, MIT).

- `index.html` — the ORVELLE bakery page and the consent panel (a non-modal dialog), with the gated scripts inert until allowed
- `css` — site.css (the page) and fortune.css (the consent panel, the paper slip, the phone sheet)
- `js` — consent.js (the consent store: window.consent, events, expiry), fortune.js (the panel: crack, read, decide), plate3d.js + bake3d.js (the three.js plate), site.js, main.js, and features/ (the three gated scripts)
- `img` — the pastry pictures and the cookie sprites, studio renders made in code
- `vendor` — three.js r186 and the addons it uses, with its MIT LICENSE

ORVELLE is a made-up pâtisserie. The 3D is made in code with three.js: the plate and the cookies are drawn live, and the
pastry pictures and cookie sprites are studio renders made in code; no photos and no AI pictures. three.js (r186) is in
`vendor/three/` under its own MIT licence (`vendor/three/LICENSE`). The consent record stays in `localStorage`; nothing
is sent anywhere. The gated scripts stay `type="text/plain"` until their category is allowed; put your own analytics or
marketing code in `js/features/`. Without JavaScript the page is readable and the consent controls are hidden.

It respects `prefers-reduced-motion`. Made by Ulvi (Code with Ulvi) · domvybe.com

## Licence

MIT — see [LICENSE](LICENSE). Use it in your own projects, commercial ones included.
