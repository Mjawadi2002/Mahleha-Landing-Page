# Mahleha landing page

Scroll-story landing page for Mahleha: a flight from Athens to Tunis, then a tour of ten Tunisian places on a 3D map. English and Greek.

Built with Vite, three.js, GSAP ScrollTrigger and Lenis.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

- Copy: English lives in `index.html`; Greek in `src/i18n.js` under the same `data-i18n` keys.
- Places on the tour: `src/places.js`.
- Photos: Wikimedia Commons, credits and licences in `public/img/credits.json` (shown in the footer).
- Coastlines: Natural Earth via `world-atlas` (public domain).
