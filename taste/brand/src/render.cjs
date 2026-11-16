// Renders the 2 PNGs of the tasu.ai brand kit with Playwright (Chromium).
// usage: node src/render.cjs <brandDir>
//   og.png               1200x630, from src/og.html (cream, mascot, wordmark, headline)
//   apple-touch-icon.png 180x180, from src/touch.svg (cream, full bleed)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await pg.goto('file://' + path.join(dir, 'src/og.html'), { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  const ok = await pg.evaluate(() => document.fonts.check('700 76px "Schibsted Grotesk"'));
  if (!ok) throw new Error('Schibsted Grotesk did not load');
  await pg.screenshot({ path: path.join(dir, 'og.png') });
  const svg = fs.readFileSync(path.join(dir, 'src/touch.svg'), 'utf8');
  const p2 = await b.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
  await p2.setContent(`<html><body style="margin:0"><img style="display:block" width="180" height="180" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
  await p2.waitForTimeout(100);
  await p2.screenshot({ path: path.join(dir, 'apple-touch-icon.png'), clip: { x: 0, y: 0, width: 180, height: 180 } });
  await b.close();
  console.log('og.png and apple-touch-icon.png written to', dir);
})();
