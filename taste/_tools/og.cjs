// tasu.ai share cards. Run it from anywhere after a build: node taste/_tools/og.cjs [slug ...]
// Renders _tools/og.html for each app (all of them by default), and _tools/og-main.html for the 4 main pages with Playwright (Chromium) into
// media/<slug>/og.jpg: 1200x630, JPEG quality 82. Offline: every request is served from the repo.
// build.mjs uses the card as og:image and twitter:image when the file exists, so run the build
// again after this script.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TASTE = path.resolve(__dirname, '..');
const ROOT = path.resolve(TASTE, '..');
const ORIGIN = 'http://og.local';

(async () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(TASTE, 'data.js'), 'utf8'), sandbox);
  const apps = sandbox.window.TASU_APPS || [];
  const only = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.route(`${ORIGIN}/**`, route => {
    const file = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname));
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) route.fulfill({ path: file });
    else route.fulfill({ status: 404, body: '' });
  });
  const failed = [];
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  for (const app of apps) {
    if (only.length && !only.includes(app.slug)) continue;
    await page.goto(`${ORIGIN}/taste/_tools/og.html?slug=${app.slug}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const ok = await page.evaluate(() => document.body.getAttribute('data-ready') === '1' && document.fonts.check('600 66px "Schibsted Grotesk"'));
    if (!ok) throw new Error(`${app.slug}: the card did not render (data or font missing)`);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
    const out = path.join(TASTE, 'media', app.slug, 'og.jpg');
    await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
    console.log(`${path.relative(ROOT, out)} ${Math.round(fs.statSync(out).size / 1024)} KB`);
  }
  // The main pages: brand/og-<page>.jpg
  for (const key of ['home', 'design', 'paywall', 'unslop']) {
    if (only.length && !only.includes(key)) continue;
    await page.goto(`${ORIGIN}/taste/_tools/og-main.html?page=${key}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const ok = await page.evaluate(() => document.body.getAttribute('data-ready') === '1' && document.fonts.check('600 84px "Schibsted Grotesk"'));
    if (!ok) throw new Error(`${key}: the card did not render`);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
    const out = path.join(TASTE, 'brand', `og-${key}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 84 });
    console.log(`${path.relative(ROOT, out)} ${Math.round(fs.statSync(out).size / 1024)} KB`);
  }
  await browser.close();
  if (failed.length) { console.error('Failed requests:\n' + failed.join('\n')); process.exit(1); }
})();
