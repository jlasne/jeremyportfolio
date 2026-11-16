// tasu.ai UI element PNGs. Run it from anywhere after a build: node taste/_tools/elements.cjs [id ...]
// Renders each rebuilt element (all of them by default) alone on a transparent page, with the
// built elements/elements.css and the self-hosted fonts/apps.css, and saves
// media/elements/<id>.png: 2x, transparent background, cropped to the element. Offline: every
// request is served from the repo. build.mjs shows the PNG button when the file exists, so run
// the build again after this script.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TASTE = path.resolve(__dirname, '..');
const ROOT = path.resolve(TASTE, '..');
const ORIGIN = 'http://el.local';
const OUT = path.join(TASTE, 'media', 'elements');

(async () => {
  const only = process.argv.slice(2);
  const files = fs.readdirSync(path.join(TASTE, '_data', 'elements')).filter(f => f.endsWith('.json')).sort();
  const els = files.flatMap(f => JSON.parse(fs.readFileSync(path.join(TASTE, '_data', 'elements', f), 'utf8')).elements || [])
    .filter(e => e && e.id && e.html && (!only.length || only.includes(e.id)));
  if (!fs.existsSync(path.join(TASTE, 'elements', 'elements.css'))) throw new Error('Run build.mjs first: elements/elements.css is missing');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  let html = ''; // the page of the element being rendered
  await page.route(`${ORIGIN}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/el.html') return route.fulfill({ contentType: 'text/html', body: html });
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) route.fulfill({ path: file });
    else route.fulfill({ status: 404, body: '' });
  });
  const failed = [];
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  for (const el of els) {
    html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/taste/fonts/apps.css"><link rel="stylesheet" href="/taste/elements/elements.css">
<style>html,body{margin:0;background:transparent}body{padding:16px}</style></head><body>${el.html}</body></html>`;
    await page.goto(`${ORIGIN}/el.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const root = page.locator(`.x-${el.id}`).first();
    const out = path.join(OUT, `${el.id}.png`);
    await root.screenshot({ path: out, omitBackground: true });
    console.log(`${path.relative(ROOT, out)} ${Math.round(fs.statSync(out).size / 1024)} KB`);
  }
  await browser.close();
  if (failed.length) { console.error('Failed requests:\n' + failed.join('\n')); process.exit(1); }
})();
