// Redraws og-image.png (1200x630): the home hello, larger, over the ocean.
// Run from the repo root: python3 -m http.server 8765 & node scripts/og-image.cjs
// Then bump ?v= on og-image.png in every page's meta tags.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: `
    .nav, .foot, .sec, .caret { display: none !important; }
    .reveal { animation: none !important; }
    .col { width: 100%; border: 0; min-height: 630px; background: transparent; display: flex; align-items: center; }
    main { display: block; }
    .intro { min-height: 0; width: fit-content; margin-left: 80px; padding: 0; gap: 26px; }
    .intro h1 { font-size: 74px; margin-bottom: 6px; }
    .intro p:not(.socials) { max-width: none; font-size: 31px; line-height: 1.5; }
    .intro .socials { display: none; }
  `});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: 'og-image.png' });
  await b.close();
})();
