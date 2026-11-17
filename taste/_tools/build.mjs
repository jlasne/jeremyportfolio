#!/usr/bin/env node
/* tasu.ai generator. Run it from anywhere: node taste/_tools/build.mjs
   No dependencies. Reads the data, writes the static site into taste/:
     data.js              window.TASU_APPS, what the share cards (_tools/og.html) read
     index.html           home: hero, gallery, design, paywall and prompts teasers, closing line
     <slug>/index.html    one page per app: screenshots, design, style prompt, paywall
     design/index.html    how to build a style guide, a color and font builder, big prompts
     paywall/index.html   paywall tips computed from the App Store data of the 12 apps
     unslop/index.html    prompts that fix one part of an app each, with a rule and its numbers
   Inputs:
     _data/selection.json       display order, each app's niche and chip group
     _data/raw/<slug>.json      facts from Apple's public App Store data
     _data/analysis/<slug>.json opinions and derived values (optional, field by field)
     _data/paywall-tips.json    the tips of the Paywall page (numbers checked against the data)
     _data/prompts.json         the Prompts page
     media/<slug>/...           icons, screenshots, paywall captures, font crops
     fonts/apps.css             the free fonts of the apps' names, specimens and the builder
                                (self-hosted subsets, made by _tools/fonts-apps.mjs)
   It also copies the rules of brand/loops/loops.css into tasu.css, between the loops:start and
   loops:end marks, so the mascot loops never drift from the brand kit.
   Full run after a media or data change:
     python3 taste/_tools/media.py      small WebP icons and hero thumbnails (used when present)
     node taste/_tools/fonts-apps.mjs   the font subsets, after a change to names or fonts
     node taste/_tools/build.mjs        this file
     node taste/_tools/og.cjs           the 1200x630 share card of each app page, from data.js
     node taste/_tools/build.mjs        again, so the pages point to the new cards
   Markup contract: _tools/template-notes.md. Every page is complete HTML; tasu.js only enhances.
   A missing analysis file or field never stops the build: the page falls back to the facts and
   the log says what is missing. The build ends with a check of every page it wrote. */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TASTE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.jeremylasne.com';
const BASE = '/taste/';
const ABS = SITE + BASE;
const DATE = '2026-11-15';
// The day the pages last changed. The data stays the 15 Nov snapshot (DATE, DAY).
const MODIFIED = '2026-11-17';
const DAY = '15&nbsp;Nov&nbsp;2026';
const SOURCE = `App Store data, US, ${DAY}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-11-16" reads "16 Nov 2026", with no-break spaces like DAY.
const dayOf = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])}&nbsp;${MONTHS[Number(m[2]) - 1]}&nbsp;${m[1]}` : DAY;
};
const X_URL = 'https://x.com/jeremylasne';
const AUTHOR = { '@type': 'Person', name: 'Jeremy Lasne', url: 'https://www.jeremylasne.com/', sameAs: [X_URL] };
const OG = { src: '/taste/brand/og.png', w: 1200, h: 630, alt: 'tasu.ai: steal the taste of top apps' };
// Every page links the X account with the same 2 lines (spec v4, picked by a judge panel).
const CLOSING = {
  title: 'Follow the builder behind tasu.ai',
  sub: 'I build a portfolio of mobile apps with taste. Kaught has 1,000+ users.',
};
const APPS_CSS = '/taste/fonts/apps.css'; // the free fonts of the apps, from _tools/fonts-apps.mjs

/* ---------------------------------------------------------------- log */
const notes = [];
const log = msg => notes.push(msg);

/* ---------------------------------------------------------------- helpers */
// A missing file falls back; a broken one stops the build and names the file.
const readJSON = (file, fallback) => {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
};
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Typographic quotes and apostrophes for display copy.
const smart = s => String(s ?? '')
  .replace(/(^|[\s(\[{])"/g, '$1“').replace(/"/g, '”')
  .replace(/(\w)'(\w)/g, '$1’$2').replace(/(^|[\s(])'/g, '$1‘').replace(/'/g, '’');
const txt = s => esc(smart(s));
// Visible copy: a number keeps its unit on the same line (14&nbsp;days, 30&nbsp;px).
const UNIT = /(\d)\s(days?|weeks?|months?|years?|px|pt|plans?|apps?|screens?|captions?|listings?|prices?|items?|cards?|lines?|ratings?|members?|accounts?|times?|x\b|%)/g;
const copy = s => txt(s).replace(UNIT, '$1&nbsp;$2');
const num = s => {
  if (typeof s === 'number') return s;
  const m = String(s ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const money = n => '$' + n.toFixed(2);
const compact = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
const thousands = n => Number(n).toLocaleString('en-US');
const median = list => {
  const a = [...list].sort((x, y) => x - y);
  const k = a.length;
  return k % 2 ? a[(k - 1) / 2] : (a[k / 2 - 1] + a[k / 2]) / 2;
};
const slugify = s => String(s).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ld = obj => JSON.stringify(obj).replace(/</g, '\\u003c');
const plural = (n, one, many) => `${n}&nbsp;${n === 1 ? one : many}`;
const fileOf = web => join(TASTE, String(web).replace(/^\/taste\//, ''));

// Real pixel size of a PNG or JPEG, read from its header.
const sizes = new Map();
function imageSize(web) {
  if (sizes.has(web)) return sizes.get(web);
  let out = null;
  const file = fileOf(web);
  if (existsSync(file)) {
    const b = readFileSync(file);
    if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') out = { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    else if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          out = { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
          break;
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } else {
    log(`missing file ${web}`);
  }
  sizes.set(web, out);
  return out;
}

/* ---------------------------------------------------------------- icons (one set, 1.5px strokes) */
const stroke = (inner, extra = 'stroke-linecap="round" stroke-linejoin="round"') =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ${extra} aria-hidden="true">${inner}</svg>`;
const I = {
  search: stroke('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>'),
  left: stroke('<path d="m14.5 6-6 6 6 6"/>'),
  right: stroke('<path d="m9.5 6 6 6-6 6"/>'),
  arrow: stroke('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  external: stroke('<path d="M8 16 16 8M9.5 8H16v6.5"/>'),
  rows: stroke('<rect x="3.75" y="4.75" width="16.5" height="6" rx="2"/><rect x="3.75" y="13.25" width="16.5" height="6" rx="2"/>', 'stroke-linejoin="round"'),
  grid: stroke('<rect x="3.75" y="3.75" width="7" height="7" rx="2"/><rect x="13.25" y="3.75" width="7" height="7" rx="2"/><rect x="3.75" y="13.25" width="7" height="7" rx="2"/><rect x="13.25" y="13.25" width="7" height="7" rx="2"/>', 'stroke-linejoin="round"'),
  copy: stroke('<rect x="8.75" y="8.75" width="11.5" height="11.5" rx="2.5"/><path d="M15.25 8.75v-2a2.5 2.5 0 0 0-2.5-2.5h-6.5a2.5 2.5 0 0 0-2.5 2.5v6.5a2.5 2.5 0 0 0 2.5 2.5h2"/>'),
  copySm: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.75" y="8.75" width="11.5" height="11.5" rx="2.5"/><path d="M15.25 8.75v-2a2.5 2.5 0 0 0-2.5-2.5h-6.5a2.5 2.5 0 0 0-2.5 2.5v6.5a2.5 2.5 0 0 0 2.5 2.5h2"/></svg>',
  sun: '<svg class="ico i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.64 5.64l1.06 1.06M17.3 17.3l1.06 1.06M5.64 18.36l1.06-1.06M17.3 6.7l1.06-1.06"/></svg>',
  moon: '<svg class="ico i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z"/></svg>',
  x: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  download: stroke('<path d="M12 4.25v10.5M7.25 10 12 14.75 16.75 10M5 19.25h14"/>'),
  image: stroke('<rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2.5"/><circle cx="9" cy="10" r="1.5"/><path d="m4.5 17.5 4.75-4.5 3 2.75 2.75-2.5 4.5 4.25"/>'),
  code: stroke('<path d="m9 7.25-4.75 4.75L9 16.75M15 7.25l4.75 4.75L15 16.75"/>'),
};

/* ---------------------------------------------------------------- vocabulary */
const PERIOD = { year: 'Yearly', month: 'Monthly', week: 'Weekly', lifetime: 'Lifetime', consumable: 'One-time purchase' };
// A plan named "Annual Subscription" or "1 Month" needs no "Yearly" or "Monthly" under it.
const SAYS_PERIOD = /\b(year|yearly|annual|annually|month|monthly|week|weekly|lifetime|forever)\b/i;
const periodLabel = r => (PERIOD[r.period] && !(r.period !== 'consumable' && SAYS_PERIOD.test(r.name)) ? PERIOD[r.period] : '');
const PERIOD_ORDER = { year: 0, month: 1, week: 2, lifetime: 3, unknown: 4, consumable: 5 };
const APP_CATEGORY = {
  'Health & Fitness': 'HealthApplication',
  'Medical': 'HealthApplication',
  'Education': 'EducationalApplication',
  'Productivity': 'UtilitiesApplication',
  'Lifestyle': 'LifestyleApplication',
};
const ROLE = { 60: 'Main', 30: 'Main', 10: 'Accent' };

/* ---------------------------------------------------------------- load */
const DATA = join(TASTE, '_data');
const selection = readJSON(join(DATA, 'selection.json'), null);
let order = selection?.apps?.map(a => a.slug) || [];
if (!order.length) {
  order = readdirSync(join(DATA, 'raw')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
  log('no _data/selection.json: apps in alphabetical order');
}
const selBySlug = new Map((selection?.apps || []).map(a => [a.slug, a]));

function loadApp(slug) {
  const raw = readJSON(join(DATA, 'raw', `${slug}.json`), null);
  if (!raw) { log(`${slug}: no raw file, app skipped`); return null; }
  let an = readJSON(join(DATA, 'analysis', `${slug}.json`), null);
  if (!an) { log(`${slug}: no analysis file, page built from facts only`); an = {}; }
  const missing = field => log(`${slug}: analysis has no ${field}, used the fallback`);
  const sel = selBySlug.get(slug) || {};

  const app = {
    slug,
    id: raw.id,
    name: raw.name,
    fullName: raw.fullName || raw.name,
    developer: raw.developer,
    category: raw.category,
    cat: slugify(raw.category),
    rank: raw.rank,
    chart: raw.chart || raw.category,
    rating: raw.rating,
    // One decimal, rounded like Apple's App Store page: Ladder's 4.9504 reads 5.0 there and here.
    rating1: (Math.round(raw.rating * 10) / 10).toFixed(1),
    ratingCount: raw.ratingCount,
    appStore: raw.url,
    subtitle: raw.subtitle || '',
    niche: sel.niche || '',
    // The gallery chip: a group of niches from selection.json, else the App Store category.
    group: sel.group || raw.category,
    icon: raw.icon || `/taste/media/${slug}/icon.png`,
    page: `${BASE}${slug}/`,
    url: `${ABS}${slug}/`,
    // The App Store page lists 10 In-App Purchases at most, so a count of 0 proves nothing.
    iapCount: (raw.iaps || []).length,
    // The App Store page can hold more screenshots than the pages show.
    screenTotal: raw.screenshotTotal || (raw.screenshots || []).length,
    // Every screenshot full size on Apple's CDN (it allows cross-origin reads): the downloads.
    appleShots: (raw.appleShots || []).filter(u => /^https:\/\/[a-z0-9-]+\.mzstatic\.com\//.test(u)),
  };
  app.groupKey = slugify(app.group);
  // A 256px WebP for every icon shown at 128 CSS px or less; icon.png stays for JSON-LD and og cards.
  const smallIcon = `/taste/media/${slug}/icon-256.webp`;
  app.iconSm = existsSync(fileOf(smallIcon)) ? smallIcon : app.icon;
  if (app.iconSm === app.icon) log(`${slug}: no icon-256.webp, pages use icon.png (run _tools/media.py)`);

  // Screens, paywall captures and their alt text (analysis.screenshots carries both).
  const alts = new Map((an.screenshots || []).map(s => [s.src, s.alt]));
  const sized = (item, fallbackAlt) => {
    const s = imageSize(item.src) || { w: item.w, h: item.h };
    if (!alts.get(item.src) && !item.alt) log(`${slug}: no alt text for ${item.src}, used a generic one`);
    return { ...item, w: s.w, h: s.h, alt: alts.get(item.src) || item.alt || fallbackAlt };
  };
  app.screens = (raw.screenshots || [])
    .filter(s => existsSync(fileOf(s.src)))
    .map((s, i) => sized(s, `${raw.name} App Store screenshot ${i + 1}`));
  const shots = (raw.paywallShots || []).map(p => ({ ...p, source: p.source || 'phone' }));
  app.paywalls = [...shots, ...(raw.paywall || []).filter(p => p.src)]
    .filter(p => existsSync(fileOf(p.src)))
    .map((p, i) => sized(p, `${raw.name} paywall, capture ${i + 1}`));
  app.drawn = app.paywalls.length === 0;
  const first = app.paywalls[0];
  app.paywallLabel = first?.label || sel.paywallLabel || (app.drawn
    ? 'Drawn from App Store prices, not a screenshot'
    : first.source === 'appstore' ? 'From the App Store'
    : first.source === 'phone' ? 'In-app paywall, screenshot from an iPhone'
    : `Web pricing page, captured at iPhone size on ${dayOf(first.capturedAt)}`);

  // Plans: one row per distinct name, price and period. Known lengths first, then by price.
  let plans = an.plans;
  if (!plans?.length) {
    missing('plans');
    plans = (raw.iaps || []).map(p => ({ name: p.name, price: p.price, period: 'unknown' }));
  }
  // How many times the App Store lists each name and price: exact repeats show as one row.
  const listedTimes = new Map();
  for (const p of raw.iaps || []) listedTimes.set(`${p.name}|${p.price}`, (listedTimes.get(`${p.name}|${p.price}`) || 0) + 1);
  const seen = new Set();
  const rows = [];
  for (const p of plans) {
    const period = PERIOD_ORDER[p.period] !== undefined ? p.period : 'unknown';
    const key = [p.name, p.price, period].join('|');
    if (seen.has(key) || num(p.price) === null) continue;
    seen.add(key);
    rows.push({
      name: p.name,
      price: p.price,
      n: num(p.price),
      period,
      perMonth: typeof p.perMonth === 'number' ? p.perMonth : null,
      perWeek: typeof p.perWeek === 'number' ? p.perWeek : null,
      // A plan can carry its own saving (against the monthly plan of the same name).
      saving: typeof p.saving === 'number' ? p.saving : null,
      listed: listedTimes.get(`${p.name}|${p.price}`) || 1,
    });
  }
  app.listed = [...rows]; // the analysis order: its main plans come first
  app.repeats = rows.reduce((n, r) => n + r.listed - 1, 0);
  rows.sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period] || b.n - a.n);
  app.rows = rows;
  app.subs = rows.filter(r => r.period !== 'consumable');
  // Distinct prices: one price listed under 2 names counts once.
  app.priceCount = new Set(app.subs.map(r => r.n)).size;

  const pw = an.paywall || {};
  if (!an.paywall) missing('paywall');
  app.tiers = pw.tiers ?? null;
  app.trial = pw.trial?.stated && pw.trial?.evidence ? pw.trial.evidence : null;
  app.consumables = pw.consumables ?? rows.filter(r => r.period === 'consumable').length;
  app.family = pw.family ?? null;
  app.savingPct = pw.yearlySavingPct ?? null;
  app.savingInFacts = false;
  if (app.savingPct !== null) {
    // Put the saving on every yearly row it was computed from (one price can sit under 2 names),
    // or in the facts.
    const months = rows.filter(r => r.period === 'month').map(r => r.n);
    const hits = rows.filter(r => r.period === 'year')
      .filter(r => months.some(m => Math.abs(Math.round((1 - r.n / 12 / m) * 100) - app.savingPct) <= 1));
    hits.forEach(r => { if (r.saving === null) r.saving = app.savingPct; });
    if (!hits.length) app.savingInFacts = true;
  }

  // Card: one line and one key number.
  const card = an.card || {};
  app.oneLiner = card.oneLiner || raw.subtitle || raw.fullName;
  if (!card.oneLiner) missing('card.oneLiner');
  const year = app.subs.find(r => r.period === 'year');
  const top = [...app.subs].sort((a, b) => b.n - a.n)[0];
  app.key = card.keyNumber?.value ? card.keyNumber
    : year ? { value: year.price, label: 'Yearly plan' }
    : top ? { value: top.price, label: 'Highest listed price' }
    : { value: app.rating1, label: 'App Store rating' };
  if (!card.keyNumber?.value) missing('card.keyNumber');
  // One metric, 2 labels across the gallery, so the big numbers compare: a yearly price, or the
  // highest listed price when the listings give no length.
  if (/year|annual/i.test(app.key.label || '')) app.key = { ...app.key, label: 'Yearly plan' };
  else if (top && num(app.key.value) === top.n) app.key = { ...app.key, label: 'Highest listed price' };
  else log(`${slug}: key number ${app.key.value} is neither a yearly price nor the highest listed price, label kept`);

  // Branding: 3 colors (60/30/10), the font, the style.
  const b = an.branding || {};
  let colors = (b.colors || []).filter(c => /^#[0-9a-f]{6}$/i.test(c.hex));
  if (colors.length < 3) {
    missing('branding.colors');
    const pal = raw.palette?.icon || [];
    colors = pal.slice(0, 3).map((c, i) => ({ hex: c.hex, role: ['60', '30', '10'][i], name: c.hex, use: 'Sampled from the app icon' }));
  }
  app.colors = colors.slice(0, 3).sort((x, y) => num(y.role) - num(x.role))
    .map(c => ({ hex: c.hex.toUpperCase(), role: String(c.role), name: c.name || c.hex, use: c.use || '' }));

  // 2 fonts, headline and body: the real name when known, and the closest free Google Font,
  // which the pages self-host (fonts/apps.css).
  const fonts = b.fonts || {};
  if (!b.fonts) missing('branding.fonts');
  const fontOf = role => {
    const f = fonts[role];
    if (!f?.closeTo) return null;
    const s = f.crop ? imageSize(f.crop) : null;
    return { name: f.name || null, closeTo: f.closeTo, weight: Number(f.weight) || (role === 'headline' ? 700 : 400), look: f.look || '', crop: s ? { src: f.crop, ...s } : null };
  };
  app.fonts = { headline: fontOf('headline'), body: fontOf('body') };
  // The design style: a summary and 6 labeled traits (Layout, Shapes, Color, Type, Imagery, Components).
  const st = b.style || {};
  if (!b.style) missing('branding.style');
  app.styleSummary = st.summary || '';
  app.traits = (st.traits || []).filter(t => t?.text).map(t => ({ label: t.label || '', text: t.text }));

  app.short = card.short || app.subtitle;
  if (!card.short) missing('card.short');
  app.read = (an.ourRead || []).filter(Boolean);
  if (!app.read.length) missing('ourRead');
  app.prompt = an.stylePrompt || '';
  if (!app.prompt) missing('stylePrompt');

  return app;
}

const apps = order.map(loadApp).filter(Boolean);
if (!apps.length) { console.error('No apps to build.'); process.exit(1); }
const PAYWALL_TIPS = readJSON(join(DATA, 'paywall-tips.json'), { tips: [] });
const PROMPTS = readJSON(join(DATA, 'prompts.json'), { prompts: [] });
if (!PAYWALL_TIPS.tips?.length) log('no _data/paywall-tips.json: the Paywall page has no tips');
if (!PROMPTS.prompts?.length) log('no _data/prompts.json: the Prompts page is empty');

/* ---------------------------------------------------------------- numbers across the 12 apps */
// The yearly price of each app: its key number when that is a yearly price, else its first yearly row.
for (const app of apps) {
  const kl = app.key.label || '';
  // Without a key number: the first yearly and monthly plans in the analysis order (its main plans
  // come first), the same prices the paywall tips use.
  const yearRow = app.listed.find(r => r.period === 'year');
  const monthRow = app.listed.find(r => r.period === 'month');
  if (/\b(year|yearly|annual)\b/i.test(kl) && num(app.key.value) !== null) app.yearly = num(app.key.value);
  else if (yearRow) app.yearly = yearRow.n;
  if (/\b(month|monthly)\b/i.test(kl) && num(app.key.value) !== null) app.monthly = num(app.key.value);
  else if (monthRow) app.monthly = monthRow.n;
  app.topPrice = app.subs.length ? Math.max(...app.subs.map(r => r.n)) : null;
}
const withYear = apps.filter(a => a.yearly != null);
const withMonth = apps.filter(a => a.monthly != null);
const withTop = apps.filter(a => a.topPrice != null);
const medians = {
  year: withYear.length ? median(withYear.map(a => a.yearly)) : null,
  month: withMonth.length ? median(withMonth.map(a => a.monthly)) : null,
  top: withTop.length ? median(withTop.map(a => a.topPrice)) : null,
};
function compareLine(app) {
  const n = apps.length;
  const over = (k, what) => k === n ? `the ${n} apps` : `${k} apps with ${what}`;
  if (app.yearly != null) return `Yearly <b>${money(app.yearly)}</b>. Median of ${over(withYear.length, 'a yearly plan')}: <b>${money(medians.year)}</b>.`;
  if (app.monthly != null) return `Monthly <b>${money(app.monthly)}</b>. Median of ${over(withMonth.length, 'a monthly plan')}: <b>${money(medians.month)}</b>.`;
  // No listing gives a length: compare the highest listed price, and say so on both sides.
  if (app.topPrice != null) return `Highest listed price <b>${money(app.topPrice)}</b>. Median highest listed price of ${over(withTop.length, 'a listed price')}: <b>${money(medians.top)}</b>.`;
  return '';
}

/* ---------------------------------------------------------------- page shell */
const SNIPPET = "(function(r){var t,v;try{t=localStorage.getItem('tasu-theme');v=localStorage.getItem('tasu-view')}catch(e){}r.classList.add('js');if(v==='grid')r.setAttribute('data-view','grid');if(t==='light'||t==='dark'){r.setAttribute('data-theme',t);var m=document.querySelectorAll('meta[name=\"theme-color\"]'),c=t==='dark'?'#1C1B19':'#F3EFE7';for(var i=0;i<m.length;i++)m[i].setAttribute('content',c)}})(document.documentElement)";

// css: extra stylesheets after tasu.css (the app fonts), js: extra deferred scripts, only where used.
function head({ title, description, path, type = 'website', image = OG, jsonld, preload = '', css = [], js = [] }) {
  const url = ABS + path;
  const img = SITE + image.src;
  const extra = css.filter(href => existsSync(fileOf(href))).map(href => `<link rel="stylesheet" href="${href}">\n`).join('')
    + js.map(src => `<script src="${src}" defer></script>\n`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#F3EFE7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1C1B19" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<script>${SNIPPET}</script>
<link rel="preload" href="/taste/fonts/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
${preload}<link rel="stylesheet" href="/taste/tasu.css">
${extra}<script src="/taste/tasu.js" defer></script>
<link rel="icon" href="/taste/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/taste/brand/apple-touch-icon.png">
<meta property="og:type" content="${type}">
${type === 'article' ? `<meta property="article:published_time" content="${DATE}">
<meta property="article:modified_time" content="${MODIFIED}">
` : ''}<meta property="og:site_name" content="tasu.ai">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="${image.w}">
<meta property="og:image:height" content="${image.h}">
<meta property="og:image:alt" content="${esc(image.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@jeremylasne">
<meta name="twitter:creator" content="@jeremylasne">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${img}">
<meta name="twitter:image:alt" content="${esc(image.alt)}">
<script type="application/ld+json">${ld(jsonld)}</script>
</head>`;
}

// current: 'apps' (home), 'app' (an app page: "Apps" is its section, not the page), 'design',
// 'paywall' or 'unslop'.
const NAV = [
  ['apps', '/taste/#apps', 'Apps'],
  ['design', '/taste/design/', 'Design'],
  ['paywall', '/taste/paywall/', 'Paywall'],
  ['unslop', '/taste/unslop/', 'Unslop'],
];
// The wordmark is live text: "tasu.ai" unfolds into "taste using ai" (tasu.js animates the 3
// parts that change). Without JS it reads "tasu.ai".
const WORDMARK = '<span class="wm" data-wm aria-hidden="true"><span class="wm-k">tas</span><span class="wm-x">te&nbsp;</span><span class="wm-k">u</span><span class="wm-x">sing&nbsp;</span><span class="wm-dot">.</span><span class="wm-k">ai</span></span>';
// The hero's version folds and unfolds every 2 seconds (tasu.js); it starts unfolded, so without
// JS the headline reads "Design apps with taste using ai".
const HERO_WM = WORDMARK.replace('class="wm" data-wm', 'class="wm wm--hero is-open" data-wm-loop');
function header(current) {
  const cur = k => (k === current ? ' aria-current="page"' : k === 'apps' && current === 'app' ? ' aria-current="true"' : '');
  return `<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap header-in">
    <a class="brand" href="/taste/" aria-label="tasu.ai, taste using AI, home" data-wm-link>
      <span class="tasu-loop tasu-loop--blink" aria-hidden="true"></span>
      ${WORDMARK}
    </a>
    <nav class="nav" aria-label="Main">
      ${NAV.map(([k, href, label]) => `<a href="${href}"${cur(k)}>${label}</a>`).join('\n      ')}
    </nav>
    <form class="search search--header" role="search" action="/taste/#apps" method="get">
      ${I.search}
      <label class="sr-only" for="site-q">Search apps</label>
      <input id="site-q" type="search" name="q" placeholder="Search apps" autocomplete="off" enterkeyhint="search" data-site-search>
      <kbd class="kbd" aria-hidden="true">/</kbd>
    </form>
    <div class="header-tools">
      <button class="icon-btn theme-toggle js-only" type="button" data-theme-toggle aria-pressed="false" aria-label="Dark theme">
        ${I.sun}
        ${I.moon}
      </button>
      <a class="icon-btn" href="${X_URL}" aria-label="Jeremy Lasne on X">
        ${I.x}
      </a>
    </div>
  </div>
</header>
`;
}

const footer = () => `
<footer class="site-footer">
  <div class="wrap footer-in">
    <p class="footer-brand"><img src="/taste/brand/icon.svg" width="24" height="24" alt=""><span>tasu.ai, taste using AI, by <a href="https://www.jeremylasne.com/">Jeremy Lasne</a></span></p>
    <p>Data: Apple App Store, US, ${DAY}</p>
    <nav class="footer-links" aria-label="Footer">
      ${NAV.map(([, href, label]) => `<a href="${href}">${label}</a>`).join('\n      ')}
      <a href="${X_URL}">${I.x}@jeremylasne</a>
    </nav>
  </div>
</footer>
</body>
</html>
`;

/* ---------------------------------------------------------------- shared parts */
const rankShort = a => `#${a.rank}&nbsp;in ${esc(a.chart)}`;
const rankLong = a => `#${a.rank}&nbsp;in ${esc(a.chart)}, US Top Grossing`;
const happy = () => '<span class="tasu-loop tasu-loop--happy" role="img" aria-label="Tasu, the tasu.ai mascot, hops with joy"></span>';
const xButton = (label, primary) =>
  `<a class="btn ${primary ? 'btn-primary' : 'btn-secondary'} btn-lg" href="${X_URL}">${I.x} ${label}</a>`;
const stripButtons = what => `
    <button class="strip-btn" type="button" data-strip-prev aria-label="Previous ${what}">${I.left}</button>
    <button class="strip-btn" type="button" data-strip-next aria-label="Next ${what}">${I.right}</button>`;

// A drawn plan: the real In-App Purchase names and prices as plan rows, for apps with no capture.
// It holds nothing else (no button): no source shows this app's paywall.
function drawn(app, max) {
  const rows = app.subs.slice(0, max);
  const ns = rows.map(r => r.n);
  // Count App Store listings, exact repeats included, as the reads and the table note do.
  const listed = rs => rs.reduce((n, r) => n + r.listed, 0);
  const range = `${money(Math.min(...ns))} to ${money(Math.max(...ns))}`;
  const label = rows.length === app.subs.length ? `${listed(rows)} listings from ${range}`
    : `${listed(rows)} of ${listed(app.subs)} listings, from ${range}`;
  const plan = r => {
    const left = periodLabel(r) ? `<b>${esc(r.name)}</b>${periodLabel(r)}` : `<b>${esc(r.name)}</b>`;
    const right = r.period === 'year' && r.perMonth ? `<b>${esc(r.price)}</b>${money(r.perMonth)} a month` : `<b>${esc(r.price)}</b>`;
    return `<div class="drawn-plan"><span>${left}</span><span>${right}</span></div>`;
  };
  return `<div class="drawn" role="img" aria-label="${esc(`Drawn plan for ${app.name} from App Store prices: ${label}`)}">
          <div class="drawn-head"><img src="${app.iconSm}" width="64" height="64" alt="" loading="lazy" decoding="async"><p class="drawn-title">${esc(app.name)} plans</p></div>
          ${rows.map(plan).join('\n          ')}
        </div>`;
}

// The closing block of every page: Tasu hops, the 2 lines, the X button (mint where the page
// has no other mint button).
const closing = primary => `<div class="closing">
    ${happy()}
    <h2 class="title-xl" id="closing-title">${txt(CLOSING.title)}</h2>
    <p class="lead closing-sub">${copy(CLOSING.sub)}</p>
    ${xButton('Follow @jeremylasne', primary)}
  </div>`;

// A free font in a style attribute: the family the pages self-host, its weight, a UI fallback.
const fontCSS = f => (f ? `font-family:'${f.closeTo}',var(--font);font-weight:${f.weight}` : '');
// The font's name for people: the real one when known, else the free match it is close to.
const fontName = f => (f ? f.name || f.closeTo : '');
// Black or white text on a color, whichever has the higher contrast (WCAG relative luminance).
function inkOn(hex) {
  const lin = v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#1C1B19' : '#FFFFFF';
}

/* ---------------------------------------------------------------- home */
// Floating hero cards: [slug, image, width, x%, y%, tilt, depth, phone x%, phone y%].
// "icon" is the app icon, "pw1".. a paywall capture. Near cards (depth 1) sit at the edges and the
// centre column stays clear from the mascot to the buttons. Up to 1023px only the 5 cards with a
// phone place show, at that place. The near layer stays calm (Cal AI's black and white icon, no
// green owl next to the mint), so the mint band is the loudest color of the hero.
const FLOATS = [
  ['cal-ai', 'icon', 84, 7, 34, -12, 1, 7, 29],
  ['strava', 'pw1', 72, 20, 27, 10, 2],
  ['ladder', 'pw3', 104, 3, 62, 8, 1],
  ['flo', 'icon', 56, 17, 48, -8, 3],
  ['duolingo', 'icon', 80, 12, 80, 14, 2, 11, 95],
  ['hevy', 'pw1', 72, 26, 68, -10, 3],
  ['finch', 'icon', 56, 23, 88, -16, 2],
  ['myfitnesspal', 'pw1', 100, 92, 34, 12, 1, 96, 31],
  ['headspace', 'icon', 60, 80, 24, -10, 2, 22, 22],
  ['strava', 'icon', 84, 97, 60, -8, 2],
  ['rise', 'icon', 52, 84, 47, 16, 3],
  ['opal', 'pw1', 104, 89, 76, -12, 1],
  ['huckleberry', 'pw1', 68, 75, 66, 6, 3],
  ['opal', 'icon', 64, 78, 89, 18, 2, 86, 95],
  ['huckleberry', 'icon', 44, 38, 17, 8, 3],
  ['rise', 'pw1', 52, 63, 15, -12, 3],
  ['headspace', 'pw1', 60, 36, 89, 10, 3],
  ['myfitnesspal', 'icon', 48, 64, 91, -14, 2],
  ['ladder', 'icon', 40, 31, 39, 12, 3],
  ['strava', 'pw3', 48, 70, 37, -8, 3],
  ['hevy', 'icon', 44, 47, 9, -10, 3],
  ['opal', 'pw2', 56, 97, 90, 10, 2],
];
function floats() {
  const bySlug = new Map(apps.map(a => [a.slug, a]));
  return FLOATS.flatMap(([slug, kind, w, x, y, r, dpt, xm, ym]) => {
    const app = bySlug.get(slug);
    if (!app) return [];
    let src = app.iconSm, h = w, cls = 'float is-icon';
    if (kind !== 'icon') {
      const shot = app.paywalls[Number(kind.slice(2)) - 1];
      if (!shot) return [];
      // A small WebP of the capture (_tools/media.py): the cards render 40 to 104px wide.
      const small = shot.src.replace(/\/([^/]+)\.jpg$/, '/thumb-$1.webp');
      src = small !== shot.src && existsSync(fileOf(small)) ? small : shot.src;
      h = Math.round(w * shot.h / shot.w);
      cls = 'float';
    }
    const phone = xm !== undefined ? `--xm:${xm}%;--ym:${ym}%;` : '';
    if (!phone) cls += ' m-hide';
    // Cards hidden on phones load lazily, so they never load there; desktop loads them after layout.
    return [`<img class="${cls}" src="${src}" width="${w}" height="${h}" alt=""${phone ? '' : ' loading="lazy"'} decoding="async" fetchpriority="low" style="--x:${x}%;--y:${y}%;${phone}--w:${w}px;--r:${r}deg;--d:${dpt}">`];
  }).join('\n    ');
}

function fontRow(role, f) {
  if (!f) return '';
  const close = f.name ? '' : '<span class="font-close">close to </span>';
  return `<div><dt>${role}</dt><dd>${close}<span class="font-sample" style="${fontCSS(f)}">${esc(fontName(f))}</span></dd></div>`;
}

function appRow(app) {
  const { headline, body } = app.fonts;
  const words = [app.name, app.fullName, app.subtitle, app.short, app.category, app.group, app.niche, app.developer,
    ...app.colors.flatMap(c => [c.name, c.hex]), headline?.name, headline?.closeTo, body?.name, body?.closeTo].filter(Boolean);
  const text = [...new Set(words)].join(' ');
  const screens = app.screens.map(s =>
    `<li class="screen"><img src="${s.src}" width="${s.w}" height="${s.h}" alt="${txt(s.alt)}" loading="lazy" decoding="async"></li>`).join('\n        ');
  const colorList = app.colors.map(c => `${c.name} ${c.hex} ${c.role}%`).join(', ').replace(/, ([^,]*)$/, ' and $1');
  return `<li class="app-row" data-filter-item data-tags="${app.groupKey}" data-text="${esc(text)}" data-reveal>
    <a class="app-card" href="${app.page}" aria-labelledby="n-${app.slug}" aria-describedby="d-${app.slug}">
      <img class="app-icon" src="${app.iconSm}" width="64" height="64" alt="" loading="lazy" decoding="async">
      <p class="app-rank">${rankShort(app)}</p>
      <h3 class="app-name" id="n-${app.slug}"${headline ? ` style="${fontCSS(headline)}"` : ''}>${esc(app.name)}</h3>
      <p class="app-short" id="d-${app.slug}">${copy(app.short)}</p>
      <div class="app-design">
        <div class="mini-poster" role="img" aria-label="${esc(`Brand colors: ${colorList}`)}">
          ${app.colors.map(c => `<span class="mp mp-${c.role}" style="--c:${c.hex};--ink:${inkOn(c.hex)}"><span class="mp-pct">${c.role}%</span><span class="mp-hex">${c.hex}</span></span>`).join('\n          ')}
        </div>
        <dl class="app-fonts">
          ${fontRow('Headline', headline)}
          ${fontRow('Body', body)}
        </dl>
      </div>
    </a>
    <div class="strip" data-strip>
      <ol class="strip-track" role="list" tabindex="0" aria-label="${esc(app.name)} App Store screenshots">
        ${screens}
      </ol>${stripButtons('screens')}
    </div>
  </li>`;
}

function homePage() {
  const n = apps.length;
  // Chips: the niche groups of selection.json, biggest first, then in gallery order.
  const groups = new Map();
  apps.forEach((a, i) => {
    const g = groups.get(a.groupKey) || { name: a.group, count: 0, first: i };
    g.count++;
    groups.set(a.groupKey, g);
  });
  const chips = [...groups.entries()].sort((x, y) => y[1].count - x[1].count || x[1].first - y[1].first);
  // The 2 names most readers know open the subtitle (judge panel pick), else the first 2 apps.
  let named = ['duolingo', 'strava'].map(s => apps.find(a => a.slug === s)).filter(Boolean);
  if (named.length < 2) named = apps.slice(0, 2);
  const tips = PAYWALL_TIPS.tips || [];

  const title = 'tasu.ai: steal the taste of top apps';
  const description = `The 3 colors, 2 fonts and design rules of ${n} top-grossing iPhone apps, a style guide builder, paywall tips and prompts for your AI.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${ABS}#website`, name: 'tasu.ai', alternateName: 'taste using AI', url: ABS, description, inLanguage: 'en', author: AUTHOR, publisher: AUTHOR },
      { '@type': 'CollectionPage', '@id': `${ABS}#page`, url: ABS, name: title, description, isPartOf: { '@id': `${ABS}#website` }, inLanguage: 'en', dateModified: MODIFIED, primaryImageOfPage: SITE + OG.src, mainEntity: { '@id': `${ABS}#apps` } },
      { '@type': 'ItemList', '@id': `${ABS}#apps`, name: `${n} app breakdowns`, numberOfItems: n, itemListOrder: 'https://schema.org/ItemListUnordered',
        itemListElement: apps.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: a.url, name: `${a.name}: fonts, colors and UI` })) },
    ],
  };

  // The hero loop is the largest paint of the first screen: fetch its sprite with the stylesheet.
  const preload = '<link rel="preload" href="/taste/brand/loops/taste.svg" as="image" fetchpriority="high">\n';
  const html = `${head({ title, description, path: '', jsonld, preload, css: [APPS_CSS] })}
${header('apps')}
<main id="main">

<section class="hero" aria-labelledby="hero-title">
  <div class="hero-scene" data-parallax aria-hidden="true">
    ${floats()}
  </div>
  <div class="wrap hero-in">
    <span class="tasu-loop tasu-loop--taste hero-mascot" role="img" aria-label="Tasu, the tasu.ai mascot, licks a paywall card"></span>
    <h1 class="display hero-title" id="hero-title"><span class="hero-l1">Design apps with</span> <span class="hero-l2"><span class="hl hero-hl"><span class="sr-only">taste using AI</span>${HERO_WM}</span></span></h1>
    <p class="lead hero-sub">Design is what people judge an app by first, so give yours the taste and the wow of the top-grossing apps.</p>
    <div class="actions">
      ${xButton('Follow on X', true)}
      <a class="btn btn-secondary btn-lg" href="#apps">Browse the apps</a>
    </div>
  </div>
</section>

<section class="section" id="apps" aria-labelledby="apps-title" data-filter data-filter-main data-filter-url data-noun-one="app" data-noun-many="apps">
  <div class="wrap">
    <div class="gallery-head">
      <h2 class="title-xl" id="apps-title">Find the taste your app needs</h2>
      <div class="gallery-tools js-only">
        <div class="search search--lg">
          ${I.search}
          <label class="sr-only" for="apps-q">Search the apps</label>
          <input id="apps-q" type="search" placeholder="Try “sleep” or “orange”" autocomplete="off" enterkeyhint="search" data-filter-search>
          <kbd class="kbd" aria-hidden="true">/</kbd>
        </div>
        <div class="chips" role="group" aria-label="Categories">
          <button class="chip" type="button" data-filter-chip="all" aria-pressed="true">All <span class="chip-count">${n}</span></button>
          ${chips.map(([k, c]) => `<button class="chip" type="button" data-filter-chip="${k}" aria-pressed="false">${esc(c.name)} <span class="chip-count">${c.count}</span></button>`).join('\n          ')}
        </div>
      </div>
    </div>
    <div class="toolbar">
      <p class="toolbar-status"><span data-filter-status aria-live="polite">${n} apps</span><span class="toolbar-source">${SOURCE}</span></p>
      <div class="view-toggle js-only" role="group" aria-label="View">
        <button type="button" data-view-set="row" aria-pressed="true" aria-label="Rows">${I.rows}</button>
        <button type="button" data-view-set="grid" aria-pressed="false" aria-label="Grid">${I.grid}</button>
      </div>
    </div>
  </div>

  <ol class="apps" role="list">
  ${apps.map(appRow).join('\n  ')}
  </ol>

  <div class="wrap">
    <div class="empty" data-filter-empty hidden>
      <span class="tasu-loop tasu-loop--look" role="img" aria-label="Tasu, the tasu.ai mascot, looks around"></span>
      <p class="title-s">No app matches this search</p>
      <button class="btn btn-secondary" type="button" data-filter-reset>Clear the search</button>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="dz-title" data-reveal>
  <div class="wrap">
    <div class="section-head">
      <h2 class="title-xl" id="dz-title">Keep 1 style in every update</h2>
      <a class="link-arrow" href="/taste/design/">Set your style guide ${I.arrow}</a>
    </div>
    <ol class="steps steps--teaser" role="list">
      ${STEPS.slice(0, 3).map(([name, text], i) => `<li class="step"><span class="step-num" aria-hidden="true">${i + 1}</span><div><h3 class="title-s">${name}</h3><p>${copy(text)}</p></div></li>`).join('\n      ')}
    </ol>
  </div>
</section>
${tips.length ? `
<section class="section" aria-labelledby="tips-title" data-reveal>
  <div class="wrap">
    <div class="section-head">
      <h2 class="title-xl" id="tips-title">Price your app like the top earners</h2>
      <a class="link-arrow" href="/taste/paywall/">See the paywall tips ${I.arrow}</a>
    </div>
    <ul class="tip-teaser" role="list">
      ${tips.slice(0, 3).map(t => `<li><a class="tip-mini" href="/taste/paywall/#${t.id}"><span class="tip-stat">${esc(t.stat.value)}</span><span class="tip-label">${copy(t.stat.label)}</span><span class="title-s">${txt(t.title)}</span></a></li>`).join('\n      ')}
    </ul>
  </div>
</section>
` : ''}${PROMPTS.prompts?.length ? `
<section class="section" aria-labelledby="pr-title" data-reveal>
  <div class="wrap">
    <div class="section-head">
      <h2 class="title-xl" id="pr-title">Unslop your app with principles</h2>
      <a class="link-arrow" href="/taste/unslop/">See all ${PROMPTS.prompts.length} prompts ${I.arrow}</a>
    </div>
    <ul class="pr-teaser" role="list">
      ${PROMPTS.prompts.slice(0, 3).map(p => `<li><a class="pr-mini" href="/taste/unslop/#${p.id}"><span class="pr-area">${esc(p.area)}</span><span class="title-s">${txt(p.title)}</span><span class="pr-when">${copy(p.when)}</span></a></li>`).join('\n      ')}
    </ul>
  </div>
</section>
` : ''}
<section class="section" aria-labelledby="closing-title" data-reveal>
  <div class="wrap">
  ${closing(false)}
  </div>
</section>

</main>
${footer()}`;
  return { html, title, description };
}

/* ---------------------------------------------------------------- app page */
// The drawn phone shows the first 6 plans; the table under it lists only what the phone does not.
const DRAWN_ROWS = 6;
function phoneBlock(app) {
  if (app.drawn) {
    return `<figure>
          <div class="phone">${drawn(app, DRAWN_ROWS)}</div>
          <figcaption class="source">${app.paywallLabel}. In-App Purchases, US, ${DAY}</figcaption>
        </figure>`;
  }
  const imgs = app.paywalls;
  if (imgs.length === 1) {
    const p = imgs[0];
    return `<figure>
          <div class="phone"><img src="${p.src}" width="${p.w}" height="${p.h}" alt="${txt(p.alt)}" decoding="async" fetchpriority="high"></div>
          <figcaption class="source">${app.paywallLabel}</figcaption>
        </figure>`;
  }
  return `<figure>
          <div class="phone">
            <ol class="phone-track" role="list" tabindex="0" aria-label="${esc(`${app.name} paywall, ${imgs.length} captures`)}" data-phone>
              ${imgs.map((p, i) => `<li><img src="${p.src}" width="${p.w}" height="${p.h}" alt="${txt(p.alt)}" decoding="async"${i ? ' loading="lazy"' : ' fetchpriority="high"'}></li>`).join('\n              ')}
            </ol>
          </div>
          <div class="phone-nav js-only" data-phone-nav>
            <button class="icon-btn" type="button" data-phone-prev aria-label="Previous capture">${I.left}</button>
            <span class="phone-count" data-phone-count aria-live="polite" aria-atomic="true">1 of ${imgs.length}</span>
            <button class="icon-btn" type="button" data-phone-next aria-label="Next capture">${I.right}</button>
          </div>
          <figcaption class="source">${app.paywallLabel}</figcaption>
        </figure>`;
}

// rows: the plans to list (the drawn apps pass only the rows their drawn phone does not show).
// On phones each row becomes a card; data-label names the computed values there.
function plansTable(app, rows = app.rows) {
  if (!rows.length) return '';
  // A column shows only when one row at least has a value in it.
  const hasMonth = rows.some(r => r.perMonth !== null);
  const hasWeek = rows.some(r => r.perWeek !== null);
  const hasSaving = rows.some(r => r.saving !== null);
  const cell = (v, label) => (v == null ? '<td></td>' : `<td${label ? ` data-label="${label}"` : ''}>${v}</td>`);
  const body = rows.map(r => `<tr><th scope="row">${esc(r.name)}${periodLabel(r) ? `<span class="plan-period">${periodLabel(r)}</span>` : ''}</th>${cell(esc(r.price))}${hasMonth ? cell(r.perMonth !== null ? money(r.perMonth) : null, 'Per month') : ''}${hasWeek ? cell(r.perWeek !== null ? money(r.perWeek) : null, 'Per week') : ''}${hasSaving ? cell(r.saving !== null ? `${r.saving}%` : null, 'Saving') : ''}</tr>`).join('\n                ');
  return `<div>
            <div class="plans" role="region" aria-label="${esc(app.name)} plans" tabindex="0">
              <table${hasMonth || hasWeek || hasSaving ? '' : ' class="is-short"'}>
                <thead><tr><th scope="col">Plan</th><th scope="col">Price</th>${hasMonth ? '<th scope="col">Per month</th>' : ''}${hasWeek ? '<th scope="col">Per week</th>' : ''}${hasSaving ? '<th scope="col">Saving</th>' : ''}</tr></thead>
                <tbody>
                ${body}
                </tbody>
              </table>
            </div>
            <p class="source-note plans-note">${app.iapCount} In-App Purchases listed on the App Store, US, ${DAY}${app.repeats ? '; repeats show once' : ''}</p>
          </div>`;
}

function trialDays(evidence) {
  const days = new Set();
  for (const m of evidence.matchAll(/(\d+)[\s-]*days?\b/gi)) days.add(Number(m[1]));
  if (/free week|1[\s-]week/i.test(evidence)) days.add(7);
  const list = [...days].sort((a, b) => b - a);
  return list.length ? `${list.join(' or ')}&nbsp;days` : 'Yes';
}

// Only what the app sells: the App Store lists 10 In-App Purchases at most, so a 0 proves nothing.
function factsBlock(app) {
  const items = [];
  if (app.tiers !== null) items.push(['Tiers', String(app.tiers)]);
  if (app.trial) items.push(['Free trial', trialDays(app.trial)]);
  if (app.consumables > 0) items.push(['One-time purchases', String(app.consumables)]);
  if (app.family) {
    const fam = app.rows.find(r => /family/i.test(r.name));
    const per = fam && (fam.period === 'year' || fam.period === 'month') ? `&nbsp;a&nbsp;${fam.period}` : '';
    items.push(['Family plan', fam ? `${esc(fam.price)}${per}` : 'Yes']);
  }
  if (app.savingInFacts) items.push(['Yearly saving', `${app.savingPct}%`]);
  if (!items.length && !app.trial) return '';
  return `<div>
            <dl class="facts">
              ${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n              ')}
            </dl>${app.trial ? `
            <p class="facts-note">Trial: ${copy(app.trial)}</p>` : ''}
          </div>`;
}

// Colors as a poster: 3 fields sized by role (60 on top, then 30 and 10), each printed with its
// name, role and hex in black or white. A click copies the hex. One "use" line per color under it.
function colorsCard(app) {
  const field = c => `<button class="pf pf-${c.role}" type="button" style="--c:${c.hex};--ink:${inkOn(c.hex)}" data-copy="${c.hex}" aria-label="Copy ${esc(c.name)}, ${c.hex}">
              <span class="pf-role">${ROLE[c.role] || 'Main'}, ${c.role}%</span>
              <span class="pf-name">${txt(c.name)}</span>
              <span class="pf-hex"><span data-copy-label>${c.hex}</span>${I.copySm}</span>
            </button>`;
  return `<div class="card colors-card">
          <h3 class="title-m" id="colors-title">Colors</h3>
          <div class="poster">
            ${app.colors.map(field).join('\n            ')}
          </div>
          <ul class="poster-uses" role="list">
            ${app.colors.filter(c => c.use).map(c => `<li><span class="dot" style="--c:${c.hex}"></span><span><b>${txt(c.name)}</b> ${copy(c.use.charAt(0).toLowerCase() + c.use.slice(1))}</span></li>`).join('\n            ')}
          </ul>
        </div>`;
}

// The 2 fonts: role, name, a big "Aa" and a sample line in the free match, a link to it, and the
// crop of the app's own text.
function specimen(app, role, f) {
  if (!f) return '';
  const name = f.name ? esc(f.name) : `Close to ${esc(f.closeTo)}`;
  const free = `https://fonts.google.com/specimen/${f.closeTo.replace(/ /g, '+')}`;
  const crop = f.crop
    ? `<img class="sp-crop" src="${f.crop.src}" width="${f.crop.w}" height="${f.crop.h}" alt="${esc(`${role} text cut from ${/^[aeiou]/i.test(app.name) ? 'an' : 'a'} ${app.name} App Store screenshot`)}" loading="lazy" decoding="async">`
    : '';
  return `<div class="sp">
            <p class="sp-role">${role}</p>
            <p class="sp-name">${name}</p>
            <p class="sp-aa" style="${fontCSS(f)}" aria-hidden="true">Aa</p>
            <p class="sp-line" style="${fontCSS(f)}">${esc(app.name)} 0123456789</p>
            ${f.look ? `<p class="sp-look">${copy(f.look.charAt(0).toUpperCase() + f.look.slice(1))}</p>` : ''}
            <p class="sp-free">${f.name && f.name === f.closeTo ? 'A free Google Font' : 'Free match'}: <a href="${free}">${esc(f.closeTo)} ${f.weight}</a></p>
            ${crop}
          </div>`;
}
function fontsCard(app) {
  const { headline, body } = app.fonts;
  if (!headline && !body) return '';
  return `<div class="card fonts-card">
          <h3 class="title-m" id="font-title">Fonts</h3>
          ${specimen(app, 'Headline', headline)}
          ${specimen(app, 'Body', body)}
        </div>`;
}

function styleCard(app) {
  if (!app.styleSummary && !app.traits.length) return '';
  return `<div class="card style-card">
          <h3 class="title-m" id="style-title">Design style</h3>
          ${app.styleSummary ? `<p class="style-text">${copy(app.styleSummary)}</p>` : ''}${app.traits.length ? `
          <dl class="traits">
            ${app.traits.map(t => `<div>${t.label ? `<dt>${esc(t.label)}</dt>` : ''}<dd>${copy(t.text)}</dd></div>`).join('\n            ')}
          </dl>` : ''}
        </div>`;
}

// The screenshots, each with a download button, and "Download all" (a ZIP built in the browser).
// Files come full size from Apple's CDN; the copy hosted here is the fallback.
function screenshotsBlock(app) {
  if (!app.screens.length) return '';
  const all = app.appleShots.length ? app.appleShots : app.screens.map(s => s.apple).filter(Boolean);
  const pad = i => String(i + 1).padStart(2, '0');
  const files = all.map((u, i) => ({ src: u, fallback: app.screens[i]?.src || '', name: `${app.slug}-app-store-${pad(i)}.jpg` }));
  return `<section class="section" aria-labelledby="shots-title">
  <div class="wrap">
    <div class="section-head shots-head">
      <div>
        <h2 class="title-l" id="shots-title">App Store screenshots</h2>
        <p class="source-note">${app.screenTotal > app.screens.length ? `First ${app.screens.length} of ${app.screenTotal}` : app.screens.length} screenshots, ${SOURCE}</p>
      </div>${files.length ? `
      <button class="btn btn-secondary js-only" type="button" data-download-all="${esc(JSON.stringify(files))}" data-zip="${app.slug}-app-store-screenshots.zip">${I.download}<span data-dl-label>Download all ${files.length}</span></button>` : ''}
    </div>
    <div class="strip strip--page" data-strip>
      <ol class="strip-track" role="list" tabindex="0" aria-label="${esc(app.name)} App Store screenshots">
        ${app.screens.map((s, i) => `<li class="screen"><img src="${s.src}" width="${s.w}" height="${s.h}" alt="${txt(s.alt)}" loading="lazy" decoding="async">${s.apple ? `<button class="dl-btn js-only" type="button" data-download="${esc(s.apple)}" data-fallback="${s.src}" data-name="${app.slug}-app-store-${pad(i)}.jpg" aria-label="Download screenshot ${i + 1}, full size">${I.download}</button>` : ''}</li>`).join('\n        ')}
      </ol>${stripButtons('screenshots')}
    </div>
  </div>
</section>`;
}

function appPage(app, i) {
  const prev = apps[(i - 1 + apps.length) % apps.length];
  const next = apps[(i + 1) % apps.length];
  const { headline, body } = app.fonts;
  const hexes = app.colors.map(c => c.hex);
  // "<App>'s design: fonts A and B, colors x, y and z, a style prompt, and its paywall."
  const describe = (h, b, tail) => {
    const fontPart = h && b ? (h === b ? `font ${h}` : `fonts ${h} and ${b}`) : h || b ? `font ${h || b}` : '';
    return `${app.name}’s design: ${fontPart ? `${fontPart}, ` : ''}colors ${hexes[0]}, ${hexes[1]} and ${hexes[2]}, a style prompt${tail}.`;
  };
  let description = describe(fontName(headline), fontName(body), ', and its paywall');
  if (description.length > 160) description = describe(headline?.closeTo, body?.closeTo, ', and its paywall');
  if (description.length > 160) description = describe(headline?.closeTo, body?.closeTo, '');
  let title = `${app.name} fonts, colors and UI | tasu.ai`;
  if (title.length > 60) title = `${app.name} design | tasu.ai`;
  // The share card: 1200x630, made by _tools/og.cjs (app icon, name, colors, first screenshot).
  const card = `/taste/media/${app.slug}/og.jpg`;
  const image = existsSync(fileOf(card))
    ? { src: card, w: 1200, h: 630, alt: `${app.name}: fonts, colors and UI, by tasu.ai` }
    : (log(`${app.slug}: no media/${app.slug}/og.jpg, the page shares og.png (run _tools/og.cjs)`), OG);
  const offers = app.rows.map(r => ({ '@type': 'Offer', name: r.name, price: r.n.toFixed(2), priceCurrency: 'USD' }));
  const prices = app.rows.map(r => r.n);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${app.url}#article`,
        headline: `${app.name}: fonts, colors and UI`,
        description,
        image: [SITE + image.src, ...(app.screens[0] ? [SITE + app.screens[0].src] : [])],
        datePublished: DATE,
        dateModified: MODIFIED,
        author: AUTHOR,
        publisher: { '@type': 'Organization', name: 'tasu.ai', url: ABS, logo: { '@type': 'ImageObject', url: `${SITE}/taste/brand/apple-touch-icon.png`, width: 180, height: 180 } },
        mainEntityOfPage: app.url,
        isPartOf: { '@type': 'WebSite', '@id': `${ABS}#website`, name: 'tasu.ai', url: ABS },
        about: { '@id': `${app.url}#app` },
        inLanguage: 'en',
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${app.url}#app`,
        name: app.fullName,
        alternateName: app.name,
        operatingSystem: 'iOS',
        applicationCategory: APP_CATEGORY[app.category] || 'MobileApplication',
        url: app.appStore,
        image: SITE + app.icon,
        author: { '@type': 'Organization', name: app.developer },
        // No aggregateRating: Google's review snippet rules forbid ratings copied from another site.
        // The App Store rating shows in the page with its source line. The download is free (price 0);
        // the In-App Purchases sit in a second offer.
        offers: [
          { '@type': 'Offer', name: 'Free download', price: '0', priceCurrency: 'USD' },
          ...(prices.length ? [{ '@type': 'AggregateOffer', name: 'In-app purchases', priceCurrency: 'USD', lowPrice: Math.min(...prices).toFixed(2), highPrice: Math.max(...prices).toFixed(2), offerCount: offers.length, offers }] : []),
        ],
      },
      {
        // Home, then the page: "Apps" (/taste/#apps) is the same document as the home.
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'tasu.ai', item: ABS },
          { '@type': 'ListItem', position: 2, name: app.name, item: app.url },
        ],
      },
    ],
  };

  const metaItems = [esc(app.developer), rankLong(app)];
  if (app.category !== app.chart) metaItems.push(esc(app.category));
  metaItems.push(`${app.rating1} from ${thousands(app.ratingCount)} ratings`);
  const compare = compareLine(app);

  // A drawn phone already shows the first plans: the table keeps the rest (consumables, extra plans).
  const shown = app.drawn ? new Set(app.subs.slice(0, DRAWN_ROWS)) : null;
  const tableRows = shown ? app.rows.filter(r => !shown.has(r)) : app.rows;
  const design = [colorsCard(app), fontsCard(app), styleCard(app)].filter(Boolean);
  const html = `${head({ title, description, path: `${app.slug}/`, type: 'article', image, jsonld, css: [APPS_CSS] })}
${header('app')}
<main id="main" class="page-app">

<section class="section app-top" aria-labelledby="app-title">
  <div class="wrap">
    <div class="app-head">
      <img class="app-head-icon" src="${app.iconSm}" width="128" height="128" alt="${esc(app.name)} app icon" fetchpriority="high">
      <div>
        <h1 class="title-xl" id="app-title"><span class="h1-rest">Design like </span>${esc(app.name)}</h1>
        <p class="lead">Take its 3 colors, 2 fonts and design rules into your app, with 1 prompt for your AI.</p>
        <ul class="meta" role="list">
          ${metaItems.map(m => `<li>${m}</li>`).join('\n          ')}
        </ul>
        <p class="source-note">${SOURCE}</p>
        <div class="actions"><a class="btn btn-secondary" href="${esc(app.appStore)}">View on the App Store ${I.external}</a></div>
      </div>
    </div>
  </div>
</section>

${screenshotsBlock(app)}
${design.length ? `
<section class="section" aria-labelledby="design-title" data-reveal>
  <div class="wrap">
    <div class="section-head"><h2 class="title-l" id="design-title">Design</h2></div>
    <div class="design-grid">
        ${design.join('\n        ')}
    </div>
  </div>
</section>
` : ''}${app.prompt ? `
<section class="section" aria-labelledby="prompt-title" data-reveal>
  <div class="wrap prompt-block">
    <h2 class="title-l" id="prompt-title">Copy this style</h2>
    <p class="prompt-sub">A prompt for ${esc(app.name)}’s overall look: colors, type, shapes, layout and its signature components.</p>
    <div class="prompt">
      <p class="prompt-text" id="style-prompt">${txt(app.prompt)}</p>
    </div>
    <div class="prompt-actions">
      <button class="btn btn-secondary js-only" type="button" data-copy-target="#style-prompt" data-copy-raw>${I.copy}<span data-copy-label>Copy prompt</span></button>
      <p class="prompt-hint">Paste it into Claude Code or Cursor.</p>
      <a class="link-arrow" href="/taste/design/">Build your own style guide ${I.arrow}</a>
    </div>
  </div>
</section>
` : ''}
<section class="section" id="paywall" aria-labelledby="paywall-title" data-reveal>
  <div class="wrap">
    <div class="section-head"><h2 class="title-l" id="paywall-title">Paywall</h2><p class="paywall-lead">${copy(app.oneLiner)}</p></div>
    <div class="split">
      ${phoneBlock(app)}
      <div class="stack-32">
          ${plansTable(app, tableRows)}
          ${factsBlock(app)}${compare ? `
          <p class="compare">${compare}</p>` : ''}${app.read.length ? `
          <div>
            <h3 class="title-s read-title">My read</h3>
            <ul class="bullets" role="list">
              ${app.read.map(r => `<li>${copy(r)}</li>`).join('\n              ')}
            </ul>
          </div>` : ''}
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="closing-title" data-reveal>
  <div class="wrap">
    <nav class="pager" aria-label="More apps">
      <a href="${prev.page}" rel="prev"><img src="${prev.iconSm}" width="48" height="48" alt="" loading="lazy" decoding="async"><span><small>Previous</small>${esc(prev.name)}</span></a>
      <a href="${next.page}" rel="next"><img src="${next.iconSm}" width="48" height="48" alt="" loading="lazy" decoding="async"><span><small>Next</small>${esc(next.name)}</span></a>
    </nav>
    ${closing(true)}
  </div>
</section>

</main>
${footer()}`;
  return { html, title, description };
}

/* ---------------------------------------------------------------- design */
// The worked example of the Design page: a real app's full palette, from its own code.
const EXAMPLE = readJSON(join(DATA, 'design-example.json'), null);
const STEPS = [
  ['Colors', 'Pick 1 color for the next action, 1 for structure, 1 to balance, and neutrals. Write each HEX and RGB, its role and the pairs that work. Text needs a 4.5:1 contrast.'],
  ['Type', '2 fonts at most: a bold one for titles, a readable one for text, and the system font as backup. Set 4 levels, title, subtitle, body and caption, each with a size and a weight.'],
  ['Icon', 'Make 4 versions: full color, 1 color, on light and on dark. Check it at home screen size and at search result size.'],
  ['Components', 'Buttons, cards, inputs and tabs: 1 corner scale, 1 spacing scale and 3 states each, default, pressed and disabled.'],
  ['Composition', 'Build 1 sample screen with 5 rules: 1 hero, 3 colors, 1 main button, equal margins, the title and the tabs always in the same place.'],
];
// The first prompt of the page: the palette, after a short interview.
const PALETTE_PROMPT = `Create the color palette of my app. Ask me what you need first, then write it.

Ask me, 1 question at a time:
1. What does the app do, and for whom?
2. Which color do I already own: a logo, a brand, a favorite?
3. Which 3 words should people feel when they open it?
4. Which 2 or 3 apps do I like the look of?
5. Light, dark or both?

Then give me:
- 1 pop color for the next action, used once per screen.
- 1 structure color for icons, links and chosen states.
- 1 balance color, for 1 calm shape per screen.
- Neutrals: a background, a quiet fill, 3 text grays and 1 gray for icons only.
- 3 tints of each color, for cards, chips and done states.
For each color: name, HEX, RGB, role and where it never goes.

Then:
- The pairs that work, with their contrast. Text needs 4.5:1, large text and icons 3:1.
- The colors I must never use.
- The tokens as code for my stack.

Check: every text pair passes, and each screen holds 1 pop element.`;
// Prompts that write the whole guide, then apply and check it. Each one carries the 6 principles.
const BIG_PROMPTS = [
  { id: 'from-scratch', title: 'Start from scratch', when: 'you have no app yet, or you want a new look. Your AI interviews you first.',
    prompt: `Help me create my app's style guide from scratch. Interview me first, then write DESIGN.md.

Ask me 8 questions, 1 at a time, and wait for each answer:
1. What does the app do, for whom, in 1 sentence?
2. Which 3 words should people feel when they open it?
3. Which color, logo or brand do I already have?
4. Which 2 or 3 apps do I like the look of, and why?
5. Light, dark or both?
6. Calm and spacious, or dense and fast?
7. Rounded and soft, or sharp and precise?
8. Which screen matters most: the first one, the main action or the paywall?

Then propose 2 directions in 5 lines each: palette, fonts, corners, density and 1 signature element. Let me pick 1 or mix them.

Write DESIGN.md with 6 principles:
1. A number in every rule: "2 fonts", "3 colors per screen", "1 main button".
2. A role for every element: each color and font has 1 job, written next to it.
3. A closed set: 3 colors plus neutrals, 2 fonts, 1 corner scale.
4. A don't for every rule: write what never happens.
5. A version for every context: light and dark, the icon in color and in 1 color.
6. One sample screen that shows every rule at once.

Sections, in this order:
- Colors: HEX, RGB, role, the pairs and their contrast.
- Type: 2 fonts, 4 levels with size and weight.
- Icon: full color, 1 color, on light, on dark.
- Components: sizes, corners, spacing and states.
- Composition: 5 rules for 1 sample screen.
Add 3 don'ts per section.

Check: someone who never saw the app can build a new screen from DESIGN.md alone.` },
  { id: 'from-my-app', title: 'Start from my app', when: 'your app exists. Your AI reads it, finds the style it is trying to have, and asks only what the code cannot tell.',
    prompt: `Write my app's style guide from what it already is. Read the code and the screens first, then write DESIGN.md. Change no code yet.

1. List every color, font, size, corner and spacing value in the code, with where each appears and how often.
2. Find the style the app is trying to have: the color of the main action, the fonts, the corner and the spacing it uses most.
3. List the values that break it, screen by screen.
4. Ask me 3 questions at most, only about what the code cannot tell you.

Then write DESIGN.md with 6 principles:
- A number in every rule.
- A role for every element.
- A closed set: 3 colors plus neutrals, 2 fonts, 1 corner scale.
- A don't for every rule.
- Light and dark versions.
- 1 sample screen that shows every rule.

Sections, in this order: Colors, Type, Icon, Components, Composition. Add 3 don'ts per section.

End with a table: each value in the code today, and the token that replaces it.

Check:
- Every rule holds a number.
- The guide keeps what already works in the app.
- A new screen built from DESIGN.md alone matches the app.` },
  { id: 'apply-guide', title: 'Apply my style guide to every screen', when: 'DESIGN.md exists, and the screens do not follow it yet.',
    prompt: `Apply DESIGN.md to every screen of my app. Keep features, data and copy.

1. Turn every color, font, size, corner and spacing of DESIGN.md into a named token, in 1 file.
2. Replace every hard-coded value in the code with its token. For a value with no token, use the closest one and list it.
3. Go screen by screen, in this order: onboarding, home, the main action, settings, the paywall.
4. On each screen, apply the 5 composition rules: 1 hero, 3 colors at most, 1 main button, equal margins, the title and the tabs in their fixed spots.
5. Add the dark version of every token that DESIGN.md defines.
6. Fix every don't you find, and name the rule it broke.

Report per screen: rule, before, after.

Check:
- Zero hard-coded colors and font sizes in views.
- 1 main button per screen.
- Text passes 4.5:1 on its background, in light and dark.` },
  { id: 'check-guide', title: 'Check my screens against my style guide', when: 'before a release, to catch what drifted.',
    prompt: `Audit my app against DESIGN.md. Change no code.

For each screen:
- Colors: list every color used. Flag values outside the tokens, and an accent that covers more than 10% of the screen.
- Type: flag a 3rd font, a size outside the scale and a heading that breaks the hierarchy.
- Components: flag a corner, padding or height outside the scales, and a missing state (pressed, disabled, empty, error).
- Composition: count the heroes and the main buttons, and flag more than 1 of each. Flag uneven margins, and a title or tab bar out of place.
- Contrast: flag text under 4.5:1 and large text under 3:1, in light and dark.
- Don'ts: flag every don't of DESIGN.md that the screen shows.

Then:
1. Rank the screens by number of issues.
2. Give the 5 fixes that remove the most issues.
3. Propose rules for DESIGN.md where the screens agree but the guide says nothing.

Report as a table: screen, rule, what breaks it, the fix.` },
];

// WCAG contrast of 2 hex colors, for the example's pairs.
function contrastOf(a, b) {
  const lum = hex => {
    const lin = v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const [r, g, bl] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, k) => k - m);
  return (x + 0.05) / (y + 0.05);
}
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ');

function promptCard(p, level = 3) {
  return `<article class="pr" id="${p.id}">
      <h${level} class="title-m">${txt(p.title)}</h${level}>
      <p class="pr-when">Use it when ${copy(p.when)}</p>
      <div class="pr-box" data-clamp>
        <p class="pr-text" id="bp-${p.id}">${txt(p.prompt)}</p>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm js-only" type="button" data-copy-target="#bp-${p.id}" data-copy-raw>${I.copySm}<span data-copy-label>Copy prompt</span></button>
        <button class="btn btn-secondary btn-sm js-only pr-more" type="button" data-clamp-toggle aria-expanded="false" aria-controls="bp-${p.id}">Show all</button>
        <span class="pr-words">${p.prompt.split(/\s+/).length} words</span>
      </div>
    </article>`;
}

// The example: the logo in its 2 versions, the 60/30/10 split, the 5 core colors with their tints,
// the colors at work in a few of the app's own elements, then the pairs, rules and 2 fonts.
function exampleBlock() {
  const ex = EXAMPLE;
  if (!ex?.core) return '';
  const hex = name => ex.core.flatMap(c => [c, ...c.tints]).find(c => c.name === name)?.hex;
  const P = { paper: hex('Paper'), ink: hex('Ink'), ink2: hex('Ink 2'), muted: hex('Muted'), well: hex('Well'), rose: hex('Rose'), roseInk: hex('Rose ink'), plum: hex('Plum'), plumTint: hex('Plum tint'), sky: hex('Sky') };
  const logo = v => `<svg viewBox="${ex.logo.viewBox}" width="72" height="62" aria-hidden="true"><path d="${ex.logo.hc}" fill="${v.fg}"/><path d="${ex.logo.bar}" fill="none" stroke="${v.stroke}" stroke-width="4.6" stroke-linecap="round"/></svg>`;
  const verdict = (r, c) => (r === 'never' ? 'never for words'
    : r === 'large' ? (c >= 3 ? 'large text only' : 'fails')
    : c >= 4.5 ? 'passes for text' : c >= 3 ? 'large text only' : 'fails');
  const shares = ex.core.filter(c => c.share);
  const check = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const days = [['M', 'done'], ['T', 'done'], ['W', 'today'], ['T', 'next'], ['F', 'next']];
  const head = ex.fonts[0], body = ex.fonts[1];
  return `<div class="ex">
      <div class="ex-row">
        <div class="card ex-logo">
          <h3 class="title-s">The logo</h3>
          <div class="ex-logos">
            ${ex.logo.versions.map(v => `<figure><div class="ex-logo-box${v.icon ? ' is-icon' : ''}" style="--lb:${v.bg}" role="img" aria-label="${esc(`${ex.app} logo, ${v.label}`)}">${logo(v)}</div><figcaption>${esc(v.label)}</figcaption></figure>`).join('\n            ')}
          </div>
        </div>
        <div class="mini-poster ex-poster" role="img" aria-label="${esc(`${ex.app} split: ${shares.map(c => `${c.name} ${c.hex} ${c.share}%`).join(', ')}`)}">
          ${shares.map(c => `<span class="mp mp-${c.share}" style="--c:${c.hex};--ink:${inkOn(c.hex)}"><span class="mp-pct">${c.share}% ${esc(c.name)}</span><span class="mp-hex">${c.hex}</span></span>`).join('\n          ')}
        </div>
      </div>
      <ul class="ex-core" role="list">
        ${ex.core.map(c => `<li class="ex-c">
          <button class="ex-c-sw" type="button" style="--c:${c.hex}" data-copy="${c.hex}" aria-label="Copy ${esc(c.name)}, ${c.hex}"></button>
          <p class="ex-c-name">${esc(c.name)}${c.share ? `<span>${c.share}%</span>` : ''}</p>
          <p class="ex-c-role">${copy(c.role)}</p>
          <p class="ex-code">${c.hex}, RGB ${rgbOf(c.hex)}</p>
          <ul class="ex-tints" role="list">
            ${c.tints.map(t => `<li><span class="ex-dot" style="--c:${t.hex}" aria-hidden="true"></span><span><b>${esc(t.name)}</b> ${t.hex}, ${esc(t.use)}</span></li>`).join('\n            ')}
          </ul>
        </li>`).join('\n        ')}
      </ul>
      <div class="ex-row">
        <div class="card">
          <h3 class="title-s">At work in the app</h3>
          <div class="ex-screen" style="--p:${P.paper};--i:${P.ink};--i2:${P.ink2};--mu:${P.muted};--we:${P.well};--ro:${P.rose};--ri:${P.roseInk};--pl:${P.plum};--pt:${P.plumTint};--sk:${P.sky};--hf:'${head.family}';--bf:'${body.family}'" role="img" aria-label="${esc(`${ex.app} elements: a plum eyebrow, a title in ink, the week's days in rose, a sky tile, a rose button and a plum link, on paper`)}">
            <p class="exs-k">Week 1</p>
            <p class="exs-h">Pelvic Floor 101</p>
            <div class="exs-days">${days.map(([l, s]) => `<span class="exs-day is-${s}"><b>${l}</b><i>${s === 'done' ? check : ''}</i></span>`).join('')}</div>
            <div class="exs-row"><span class="exs-tile">Why train</span><span class="exs-chip">Week 1</span></div>
            <span class="exs-btn">Start now</span>
            <span class="exs-link">Start with the lessons</span>
          </div>
          <ul class="ex-keys" role="list">
            <li><span class="ex-dot" style="--c:${P.roseInk}"></span>Rose ink: the button, the 1 next action</li>
            <li><span class="ex-dot" style="--c:${P.rose}"></span>Rose: done days and today’s ring</li>
            <li><span class="ex-dot" style="--c:${P.plum}"></span>Plum: the eyebrow and the second action</li>
            <li><span class="ex-dot" style="--c:${P.sky}"></span>Sky: the 1 calm shape</li>
          </ul>
        </div>
        <div class="card">
          <h3 class="title-s">The pairs, with their contrast</h3>
          <ul class="ex-pairs" role="list">
            ${ex.pairs.map(p => { const c = contrastOf(p.fg, p.bg); return `<li><span class="ex-chip" style="--fg:${p.fg};--pbg:${p.bg}" aria-hidden="true">Aa</span><span>${esc(p.label)}</span><span class="ex-ratio">${c.toFixed(1)}:1, ${verdict(p.rule, c)}</span></li>`; }).join('\n            ')}
          </ul>
          <h3 class="title-s ex-type-title">The rules</h3>
          <ul class="bullets" role="list">
            ${ex.rules.map(r => `<li>${copy(r)}</li>`).join('\n            ')}
          </ul>
          <h3 class="title-s ex-type-title">The 2 fonts</h3>
          ${ex.fonts.map(f => `<p class="ex-font"><span class="ex-font-name" style="font-family:'${f.family}',var(--font);font-weight:${f.weight}">${esc(f.family)}</span><span>${esc(f.role)}: ${copy(f.sizes)}</span></p>`).join('\n          ')}
        </div>
      </div>
      <p class="source-note">Source: ${esc(ex.source)}.</p>
    </div>`;
}

function designPage() {
  const n = apps.length;
  const title = 'Set your app’s style guide first | tasu.ai';
  const description = 'Set your palette, fonts and rules before the next screen, so every update looks like the same app. Prompts and a full example palette.';
  const url = `${ABS}design/`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${url}#page`, url, name: title, description, inLanguage: 'en', dateModified: MODIFIED,
        isPartOf: { '@type': 'WebSite', '@id': `${ABS}#website`, name: 'tasu.ai', url: ABS }, author: AUTHOR },
      { '@type': 'HowTo', name: 'Set your app’s style guide', description,
        step: STEPS.map(([name, text], i) => ({ '@type': 'HowToStep', position: i + 1, name, text })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'tasu.ai', item: ABS },
        { '@type': 'ListItem', position: 2, name: 'Design', item: url },
      ] },
    ],
  };
  const palette = { id: 'palette', title: 'Create my palette', when: 'you start your style guide. Your AI asks 5 questions, then writes every color with its role.', prompt: PALETTE_PROMPT };
  const html = `${head({ title, description, path: 'design/', jsonld, css: [APPS_CSS] })}
${header('design')}
<main id="main">

<section class="section lib-top" aria-labelledby="dz-title">
  <div class="wrap">
    <div class="lib-intro">
      <h1 class="title-xl" id="dz-title">1 <span class="hl">style</span> for your app, in every update</h1>
      <p class="lead">Set your palette, fonts and rules first. Then every new screen, update and web page your AI builds looks like the same app.</p>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="need-title" data-reveal>
  <div class="wrap">
    <div class="need">
      <div>
        <h2 class="title-l" id="need-title">Start with your palette</h2>
        <p class="need-lead">Your style guide is the rulebook your AI follows. The palette comes first: it decides what people notice on every screen. Have these ready:</p>
        <ul class="bullets" role="list">
          <li>Your app’s job and its audience, in 1 sentence.</li>
          <li>1 color you already own, a logo or a brand, or 3 words for the feeling you want.</li>
          <li>2 or 3 apps you like the look of. The ${n} on <a href="/taste/#apps">tasu.ai</a> are a start.</li>
          <li>Light, dark or both.</li>
        </ul>
      </div>
      ${promptCard(palette)}
    </div>
  </div>
</section>
${EXAMPLE ? `
<section class="section" aria-labelledby="ex-title" data-reveal>
  <div class="wrap">
    <div class="section-head">
      <h2 class="title-l" id="ex-title">A full palette: ${esc(EXAMPLE.app)}</h2>
      <p class="ex-about">${copy(EXAMPLE.app)} is ${copy(EXAMPLE.about)}. This is what the palette prompt gives you.</p>
    </div>
    ${exampleBlock()}
  </div>
</section>
` : ''}
<section class="section" aria-labelledby="first-title" data-reveal>
  <div class="wrap">
    <div class="first card">
      <h2 class="title-l" id="first-title">Set this first, then build</h2>
      <p>Write the guide before the next feature. Each update then reuses the same palette, fonts and rules. The app and its website stay 1 product, release after release.</p>
      <p class="first-test"><b>The test.</b> Give the guide to Claude Code and ask for a new screen. If the screen is right on the first try, the guide works.</p>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="st-title" data-reveal>
  <div class="wrap">
    <div class="section-head"><h2 class="title-l" id="st-title">5 steps to a full style guide</h2></div>
    <ol class="steps" role="list">
      ${STEPS.map(([name, text], i) => `<li class="step"><span class="step-num" aria-hidden="true">${i + 1}</span><div><h3 class="title-s">${name}</h3><p>${copy(text)}</p></div></li>`).join('\n      ')}
    </ol>
    <p class="steps-note">Under every step, add 3 don’ts, like a 4th color, a 3rd font or 2 main buttons on 1 screen.</p>
  </div>
</section>

<section class="section" aria-labelledby="bp-title" data-reveal>
  <div class="wrap">
    <div class="section-head"><h2 class="title-l" id="bp-title">Let your AI write the rest</h2></div>
    <div class="prs">
    ${BIG_PROMPTS.map(p => promptCard(p)).join('\n    ')}
    </div>
  </div>
</section>

<section class="section" aria-labelledby="closing-title" data-reveal>
  <div class="wrap">
  ${closing(true)}
  </div>
</section>

</main>
${footer()}`;
  return { html, title, description };
}

/* ---------------------------------------------------------------- paywall tips */
function paywallPage() {
  const tips = PAYWALL_TIPS.tips || [];
  const bySlug = new Map(apps.map(a => [a.slug, a]));
  const n = apps.length;
  const title = `Paywall tips from ${n} top apps | tasu.ai`;
  const description = `${tips.length} paywall tips from the App Store prices of ${n} top-grossing iPhone apps: trials, yearly plans, tiers and prices, each with a prompt.`;
  const url = `${ABS}paywall/`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${url}#page`, url, name: title, description, inLanguage: 'en', dateModified: MODIFIED,
        isPartOf: { '@type': 'WebSite', '@id': `${ABS}#website`, name: 'tasu.ai', url: ABS }, author: AUTHOR,
        mainEntity: { '@type': 'ItemList', numberOfItems: tips.length, itemListElement: tips.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.title, url: `${url}#${t.id}` })) } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'tasu.ai', item: ABS },
        { '@type': 'ListItem', position: 2, name: 'Paywall tips', item: url },
      ] },
    ],
  };
  const chip = slug => {
    const a = bySlug.get(slug);
    return a ? `<a class="app-chip" href="${a.page}#paywall"><img src="${a.iconSm}" width="24" height="24" alt="" loading="lazy" decoding="async">${esc(a.name)}</a>` : '';
  };
  const tipCard = t => `<article class="tip" id="${esc(t.id)}">
      <p class="tip-stat">${esc(t.stat?.value || '')}<span class="tip-label">${copy(t.stat?.label || '')}</span></p>
      <h2 class="title-m">${txt(t.title)}</h2>
      <p class="tip-body">${copy(t.body)}</p>
      ${(t.apps || []).length ? `<p class="tip-apps">${t.apps.map(chip).join('')}</p>` : ''}
      ${t.prompt ? `<div class="card-actions"><button class="btn btn-secondary btn-sm js-only" type="button" data-copy-target="#tp-${esc(t.id)}" data-copy-raw>${I.copySm}<span data-copy-label>Copy prompt</span></button></div>
      <details class="disclose"><summary>Prompt</summary><p class="disclose-text" id="tp-${esc(t.id)}">${txt(t.prompt)}</p></details>` : ''}
    </article>`;
  const yearOrTop = a => a.yearly != null ? { v: money(a.yearly), k: 'a year' } : a.topPrice != null ? { v: money(a.topPrice), k: 'highest listed' } : null;
  const html = `${head({ title, description, path: 'paywall/', jsonld })}
${header('paywall')}
<main id="main">

<section class="section lib-top" aria-labelledby="pw-title">
  <div class="wrap">
    <div class="lib-intro">
      <h1 class="title-xl" id="pw-title">Price your app like the top <span class="hl">earners</span></h1>
      <p class="lead">${copy(PAYWALL_TIPS.intro || `What the App Store prices of ${n} top-grossing iPhone apps show.`)}</p>
      <p class="source-note">${SOURCE}</p>
    </div>
    <div class="tips">
    ${tips.map(tipCard).join('\n    ')}
    </div>
  </div>
</section>

<section class="section" aria-labelledby="pw-apps-title" data-reveal>
  <div class="wrap">
    <div class="section-head"><h2 class="title-l" id="pw-apps-title">The ${n} paywalls</h2></div>
    <ul class="pw-apps" role="list">
      ${apps.map(a => {
        const p = yearOrTop(a);
        return `<li><a class="pw-app" href="${a.page}#paywall"><img src="${a.iconSm}" width="48" height="48" alt="" loading="lazy" decoding="async"><span class="pw-name">${esc(a.name)}</span><span class="pw-price">${p ? `<b>${p.v}</b> ${p.k}` : ''}</span><span class="pw-trial">${a.trial ? `Free trial: ${trialDays(a.trial)}` : 'No trial stated'}</span></a></li>`;
      }).join('\n      ')}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="closing-title" data-reveal>
  <div class="wrap">
  ${closing(true)}
  </div>
</section>

</main>
${footer()}`;
  return { html, title, description };
}

/* ---------------------------------------------------------------- prompts */
// 14 areas in 3 groups, so each chip holds several prompts.
const PROMPT_GROUP = {
  Unslop: 'Look', Color: 'Look', Type: 'Look', Layout: 'Look', Icons: 'Look', 'Dark mode': 'Look',
  Buttons: 'Feel', States: 'Feel', Motion: 'Feel', Accessibility: 'Feel',
  Copy: 'Screens', Onboarding: 'Screens', Paywall: 'Screens', 'App Store': 'Screens',
};
function promptsPage() {
  const list = PROMPTS.prompts || [];
  const n = list.length;
  const groups = ['Look', 'Feel', 'Screens'].map(g => [g, list.filter(p => (PROMPT_GROUP[p.area] || 'Look') === g).length]).filter(([, c]) => c);
  const title = 'Unslop your app with principles | tasu.ai';
  const description = `Fix what makes your app look AI-made, 1 part at a time, with rules from top apps your AI can check. ${n} prompts for Claude Code or Cursor.`;
  const url = `${ABS}unslop/`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${url}#page`, url, name: title, description, inLanguage: 'en', dateModified: MODIFIED,
        isPartOf: { '@type': 'WebSite', '@id': `${ABS}#website`, name: 'tasu.ai', url: ABS }, author: AUTHOR,
        mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'CreativeWork', name: p.title, url: `${url}#${p.id}`, author: AUTHOR } })) } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'tasu.ai', item: ABS },
        { '@type': 'ListItem', position: 2, name: 'Unslop', item: url },
      ] },
    ],
  };
  const card = p => `<article class="pr" id="${esc(p.id)}" data-filter-item data-tags="${slugify(PROMPT_GROUP[p.area] || 'Look')}" data-text="${esc([p.title, p.area, p.when].join(' '))}">
      <p class="pr-area">${esc(p.area)}</p>
      <h2 class="title-m">${txt(p.title)}</h2>
      <p class="pr-when">Use it when ${copy(p.when.charAt(0).toLowerCase() + p.when.slice(1))}</p>
      <div class="pr-box" data-clamp>
        <p class="pr-text" id="pt-${esc(p.id)}">${txt(p.prompt)}</p>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm js-only" type="button" data-copy-target="#pt-${esc(p.id)}" data-copy-raw>${I.copySm}<span data-copy-label>Copy prompt</span></button>
        <button class="btn btn-secondary btn-sm js-only pr-more" type="button" data-clamp-toggle aria-expanded="false" aria-controls="pt-${esc(p.id)}">Show all</button>
        <span class="pr-words">${p.words || p.prompt.split(/\s+/).length} words${(p.sources || []).length ? `, sources ${p.sources.map(esc).join(', ')} in <a href="/taste/taste.md">taste.md</a>` : ''}</span>
      </div>
    </article>`;
  const html = `${head({ title, description, path: 'unslop/', jsonld })}
${header('unslop')}
<main id="main">

<section class="section lib-top" aria-labelledby="pr-title" data-filter data-filter-url data-noun-one="prompt" data-noun-many="prompts">
  <div class="wrap">
    <div class="gallery-head">
      <div class="lib-intro">
        <h1 class="title-xl" id="pr-title">Unslop your app with <span class="hl">principles</span></h1>
        <p class="lead">${copy(PROMPTS.intro || '')}</p>
        <p class="pr-links"><a class="link-arrow" href="/taste/taste.md">Read the full taste file ${I.arrow}</a></p>
      </div>
      <div class="gallery-tools js-only">
        <div class="search search--lg">
          ${I.search}
          <label class="sr-only" for="pr-q">Search the prompts</label>
          <input id="pr-q" type="search" placeholder="Try “color” or “paywall”" autocomplete="off" enterkeyhint="search" data-filter-search>
          <kbd class="kbd" aria-hidden="true">/</kbd>
        </div>
        <div class="chips" role="group" aria-label="Prompt groups">
          <button class="chip" type="button" data-filter-chip="all" aria-pressed="true">All <span class="chip-count">${n}</span></button>
          ${groups.map(([g, c]) => `<button class="chip" type="button" data-filter-chip="${slugify(g)}" aria-pressed="false">${g} <span class="chip-count">${c}</span></button>`).join('\n          ')}
        </div>
      </div>
    </div>
    <div class="toolbar">
      <p class="toolbar-status"><span data-filter-status aria-live="polite">${n} prompts</span></p>
      <button class="btn btn-secondary btn-sm js-only" type="button" data-copy-target="#all-prompts" data-copy-raw>${I.copySm}<span data-copy-label>Copy all prompts</span></button>
    </div>
    <div class="prs">
    ${list.map(card).join('\n    ')}
    </div>
    <div class="empty" data-filter-empty hidden>
      <span class="tasu-loop tasu-loop--look" role="img" aria-label="Tasu, the tasu.ai mascot, looks around"></span>
      <p class="title-s">No prompt matches this search</p>
      <button class="btn btn-secondary" type="button" data-filter-reset>Clear the search</button>
    </div>
    <div hidden id="all-prompts">${list.map(p => `${esc(p.title)}\n\n${esc(p.prompt)}`).join('\n\n---\n\n')}</div>
  </div>
</section>

<section class="section" aria-labelledby="closing-title" data-reveal>
  <div class="wrap">
  ${closing(true)}
  </div>
</section>

</main>
${footer()}`;
  return { html, title, description };
}

/* ---------------------------------------------------------------- data.js */
function dataJS() {
  const list = apps.map(a => ({
    slug: a.slug,
    name: a.name,
    short: smart(a.short),
    rankLabel: `#${a.rank} in ${a.chart}`,
    colors: a.colors,
    fonts: { headline: a.fonts.headline ? fontName(a.fonts.headline) : null, body: a.fonts.body ? fontName(a.fonts.body) : null },
    shot: a.screens[0] ? { src: a.screens[0].src, w: a.screens[0].w, h: a.screens[0].h } : null,
    icon: a.icon,
    page: a.page,
    appStore: a.appStore,
  }));
  return `/* tasu.ai apps. Generated by _tools/build.mjs from _data/: do not edit by hand.
   App Store data, US, 15 Nov 2026. Read by _tools/og.html (the share cards). */
window.TASU_APPS = ${JSON.stringify(list, null, 1)};
`;
}

/* ---------------------------------------------------------------- loops sync */
function syncLoops() {
  const srcFile = join(TASTE, 'brand/loops/loops.css');
  const cssFile = join(TASTE, 'tasu.css');
  if (!existsSync(srcFile)) { log('brand/loops/loops.css is missing: loops not synced'); return; }
  const body = readFileSync(srcFile, 'utf8')
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')
    .replace(/url\("([a-z0-9-]+\.svg)"\)/gi, 'url("brand/loops/$1")')
    .trim();
  const css = readFileSync(cssFile, 'utf8');
  const re = /(\/\* loops:start[\s\S]*?\*\/\n)[\s\S]*?(\/\* loops:end \*\/)/;
  if (!re.test(css)) { log('tasu.css has no loops:start and loops:end marks: loops not synced'); return; }
  const out = css.replace(re, (m, a, b) => `${a}${body}\n${b}`);
  if (out !== css) { writeFileSync(cssFile, out); log('tasu.css: loops rules copied from brand/loops/loops.css'); }
}

/* ---------------------------------------------------------------- write and check */
const written = [];
function write(rel, content) {
  const file = join(TASTE, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  written.push(rel);
}

function check(rel, page) {
  const { html, title, description } = page;
  const w = msg => log(`CHECK ${rel}: ${msg}`);
  if (title.length > 60) w(`title is ${title.length} characters`);
  if (description.length < 70 || description.length > 160) w(`description is ${description.length} characters`);
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) w(`${h1} h1 elements`);
  const mint = (html.match(/class="btn btn-primary/g) || []).length;
  if (mint !== 1) w(`${mint} mint buttons`);
  if (/\u2014/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) w('an em-dash in the copy');
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) w(`an image without alt: ${m[0].slice(0, 80)}`);
  for (const m of html.matchAll(/(?:src|href)="(\/taste\/[^"#?]*)"/g)) {
    const p = m[1];
    const f = p.endsWith('/') ? fileOf(p + 'index.html') : fileOf(p);
    if (!existsSync(f) && !written.includes(p.replace(/^\/taste\//, '') + (p.endsWith('/') ? 'index.html' : ''))) w(`broken link ${p}`);
  }
  try {
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
  } catch { w('JSON-LD does not parse'); }
}

syncLoops();
const pages = [];
pages.push(['index.html', homePage()]);
apps.forEach((a, i) => pages.push([`${a.slug}/index.html`, appPage(a, i)]));
pages.push(['design/index.html', designPage()]);
pages.push(['paywall/index.html', paywallPage()]);
pages.push(['unslop/index.html', promptsPage()]);
write('data.js', dataJS());
for (const [rel, p] of pages) write(rel, p.html);
for (const [rel, p] of pages) check(rel, p);
// A page this build no longer writes (the old library) must not stay on disk and in the sitemap.
for (const old of ['library/index.html', 'elements/index.html', 'prompt/index.html']) if (existsSync(join(TASTE, old))) log(`${old} is not built any more: delete it`);

console.log(`tasu.ai: ${apps.length} apps, ${pages.length} pages, ${(PAYWALL_TIPS.tips || []).length} paywall tips, ${(PROMPTS.prompts || []).length} prompts`);
console.log(`Medians: yearly ${medians.year ? money(medians.year) : 'n/a'} over ${withYear.length} apps, top listed price ${medians.top ? money(medians.top) : 'n/a'} over ${withTop.length} apps`);
console.log(`Wrote ${written.join(', ')}`);
if (notes.length) console.log(`\nNotes (${notes.length}):\n- ${notes.join('\n- ')}`);
else console.log('No notes: every field was present.');
