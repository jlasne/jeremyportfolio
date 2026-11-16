#!/usr/bin/env node
/* tasu.ai generator. Run it from anywhere: node taste/_tools/build.mjs
   No dependencies. Reads the data, writes the static site into taste/:
     data.js              window.TASU_APPS, a summary of every app
     index.html           home: hero, gallery, library teaser, closing line
     <slug>/index.html    one page per app: design and paywall
     library/index.html   every UI element cut from the paywalls, filterable by type
   Inputs:
     _data/selection.json       display order (captures first), each app's niche and chip group
     _data/raw/<slug>.json      facts from Apple's public App Store data
     _data/analysis/<slug>.json opinions and derived values (optional, field by field)
     media/<slug>/...           icons, screenshots, paywall captures, font crops, element crops
   It also copies the rules of brand/loops/loops.css into tasu.css, between the loops:start and
   loops:end marks, so the mascot loops never drift from the brand kit.
   Full run after a media or data change:
     python3 taste/_tools/media.py   small WebP icons and hero thumbnails (used when present)
     node taste/_tools/build.mjs     this file
     node taste/_tools/og.cjs        the 1200x630 share card of each app page, from data.js
     node taste/_tools/build.mjs     again, so the pages point to the new cards
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
const OG = { src: '/taste/brand/og.png', w: 1200, h: 630, alt: 'tasu.ai: design & paywalls behind top apps' };

/* ---------------------------------------------------------------- log */
const notes = [];
const log = msg => notes.push(msg);

/* ---------------------------------------------------------------- helpers */
const readJSON = (file, fallback) => {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
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
};

/* ---------------------------------------------------------------- vocabulary */
const TYPES = [
  ['plan-picker', 'Plan picker', 'plan pickers'],
  ['trial-toggle', 'Trial toggle', 'trial toggles'],
  ['main-button', 'Main button', 'main buttons'],
  ['close-button', 'Close button', 'close buttons'],
  ['feature-list', 'Feature list', 'feature lists'],
  ['social-proof', 'Social proof', 'social proof blocks'],
  ['trial-timeline', 'Trial timeline', 'trial timelines'],
  ['discount-badge', 'Discount badge', 'discount badges'],
  ['hero-visual', 'Hero visual', 'hero visuals'],
  ['legal-links', 'Legal links', 'legal link blocks'],
];
const TYPE = Object.fromEntries(TYPES.map(([k, one, many], i) => [k, { one, many, i }]));
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
      saving: null,
    });
  }
  app.listed = [...rows]; // the analysis order: its main plans come first
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
    hits.forEach(r => { r.saving = app.savingPct; });
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
  app.typeStyle = b.typeStyle || '';
  app.font = b.font || null;
  if (!app.font) missing('branding.font');
  if (app.font?.crop) {
    const s = imageSize(app.font.crop);
    app.fontCrop = s ? { src: app.font.crop, ...s } : null;
  }
  app.visualStyle = b.visualStyle || '';
  if (!app.visualStyle) missing('branding.visualStyle');
  app.traits = (b.styleTraits || []).filter(Boolean);
  if (!app.traits.length) missing('branding.styleTraits');

  app.read = (an.ourRead || []).filter(Boolean);
  if (!app.read.length) missing('ourRead');
  app.fixes = (an.improvements || []).filter(f => f && f.title);
  if (!app.fixes.length) missing('improvements');
  app.prompt = an.stylePrompt || '';
  if (!app.prompt) { missing('stylePrompt'); app.prompt = composePrompt(app); }

  app.elements = (an.elements || []).flatMap(e => {
    if (!TYPE[e.type]) { log(`${slug}: unknown element type ${e.type}, skipped`); return []; }
    const s = imageSize(e.src);
    if (!s) return [];
    return [{ type: e.type, src: e.src, w: s.w, h: s.h, note: e.note || '' }];
  });
  return app;
}

// A style prompt from the colors, the font and the plans, for an app whose analysis has none.
function composePrompt(app) {
  const [c60, c30, c10] = app.colors;
  const font = app.font?.name || app.font?.closeTo;
  const yearly = app.listed.find(r => r.period === 'year');
  const monthly = app.listed.find(r => r.period === 'month');
  const parts = [
    `Build a paywall in ${app.name}'s style.`,
    'Top to bottom: a bold 2-line headline, the plans as stacked rows, then one full-width main button.',
    font ? `Type: ${font}${app.font?.weights ? `, ${app.font.weights.toLowerCase()}` : ''}.` : (app.typeStyle ? `Type: ${app.typeStyle}.` : ''),
    `Colors: ${c60.name} ${c60.hex} (60) for the background, ${c30.name} ${c30.hex} (30) for text and cards, ${c10.name} ${c10.hex} (10) for the main button only.`,
    yearly && monthly ? `Plans: preselect Yearly at ${yearly.price} and show its price per month next to Monthly at ${monthly.price}.`
      : 'Plans: preselect the longest plan and show its price per month.',
    app.trial ? 'Name the free trial on the main button.' : 'Show a trial only if you offer one.',
    'Use my brand colors in the same 60/30/10 roles.',
  ];
  return parts.filter(Boolean).join(' ');
}

const apps = order.map(loadApp).filter(Boolean);
if (!apps.length) { console.error('No apps to build.'); process.exit(1); }

/* ---------------------------------------------------------------- numbers across the 12 apps */
// The yearly price of each app: its key number when that is a yearly price, else its first yearly row.
for (const app of apps) {
  const kl = app.key.label || '';
  const yearRow = app.subs.find(r => r.period === 'year');
  const monthRow = app.subs.find(r => r.period === 'month');
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

function head({ title, description, path, type = 'website', image = OG, jsonld, preload = '' }) {
  const url = ABS + path;
  const img = SITE + image.src;
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
<script src="/taste/tasu.js" defer></script>
<link rel="icon" href="/taste/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/taste/brand/apple-touch-icon.png">
<meta property="og:type" content="${type}">
${type === 'article' ? `<meta property="article:published_time" content="${DATE}">
<meta property="article:modified_time" content="${DATE}">
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

// current: 'apps' (home), 'library', or 'app' (an app page: "Apps" is its section, not the page).
function header(current) {
  const cur = k => (k === current ? ' aria-current="page"' : k === 'apps' && current === 'app' ? ' aria-current="true"' : '');
  return `<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap header-in">
    <a class="brand" href="/taste/" aria-label="tasu.ai home">
      <span class="tasu-loop tasu-loop--blink" aria-hidden="true"></span>
      <img class="brand-l" src="/taste/brand/loops/wordmark.svg" width="86" height="32" alt="">
      <img class="brand-d" src="/taste/brand/loops/wordmark-dark.svg" width="86" height="32" alt="">
    </a>
    <nav class="nav" aria-label="Main">
      <a href="/taste/#apps"${cur('apps')}>Apps</a>
      <a href="/taste/library/"${cur('library')}>Library</a>
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
    <p class="footer-brand"><img src="/taste/brand/icon.svg" width="24" height="24" alt=""><span>tasu.ai · taste using AI · by <a href="https://www.jeremylasne.com/">Jeremy Lasne</a></span></p>
    <p>Data: Apple App Store, US, ${DAY}</p>
    <nav class="footer-links" aria-label="Footer">
      <a href="/taste/#apps">Apps</a>
      <a href="/taste/library/">Library</a>
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
  const label = `${rows.length} listings from ${money(Math.min(...ns))} to ${money(Math.max(...ns))}`;
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

function tile(el, app, href) {
  const t = TYPE[el.type];
  const alt = `${t.one} from ${app.name}${el.note ? `: ${smart(el.note)}` : ''}`;
  return `<a class="tile" href="${href}">
        <span class="tile-img"><img src="${el.src}" width="${el.w}" height="${el.h}" alt="${esc(alt)}" loading="lazy" decoding="async"></span>
        <span class="tile-type">${t.one}</span>
        <span class="tile-app"><img src="${app.iconSm}" width="20" height="20" alt="" loading="lazy" decoding="async">${esc(app.name)}</span>
      </a>`;
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

function appRow(app) {
  const words = [app.name, app.fullName, app.subtitle, app.category, app.group, app.niche, app.developer, app.key.value,
    ...app.colors.map(c => c.name), app.font?.name, app.font?.closeTo].filter(Boolean);
  const text = [...new Set(words)].join(' ');
  const pw = app.paywalls[0];
  // A drawn plan is a dark island on both themes, so it reads as a phone screen, never as a
  // second card; its mark and note say it is drawn from prices.
  const firstScreen = app.drawn
    ? `<li class="screen screen--drawn" data-theme="dark"><span class="mark">Drawn plan</span>${drawn(app, 4)}<p class="drawn-note">Drawn from App Store prices, not a screenshot</p></li>`
    : `<li class="screen"><span class="mark">Paywall</span><img src="${pw.src}" width="${pw.w}" height="${pw.h}" alt="${txt(pw.alt)}" loading="lazy" decoding="async"></li>`;
  const screens = app.screens.map(s =>
    `<li class="screen"><img src="${s.src}" width="${s.w}" height="${s.h}" alt="${txt(s.alt)}" loading="lazy" decoding="async"></li>`).join('\n        ');
  const colorNames = app.colors.map(c => c.name).join(', ').replace(/, ([^,]*)$/, ' and $1');
  return `<li class="app-row" data-filter-item data-tags="${app.groupKey}" data-text="${esc(text)}" data-reveal>
    <a class="app-card" href="${app.page}" aria-labelledby="n-${app.slug}" aria-describedby="k-${app.slug}">
      <img class="app-icon" src="${app.iconSm}" width="64" height="64" alt="" loading="lazy" decoding="async">
      <p class="app-rank">${rankShort(app)}</p>
      <h3 class="app-name" id="n-${app.slug}">${esc(app.name)}</h3>
      <p class="app-sub">${esc(app.subtitle)}</p>
      <p class="key" id="k-${app.slug}"><span class="key-num">${esc(app.key.value)}</span><span class="key-label">${txt(app.key.label)}</span></p>
      <p class="app-colors" role="img" aria-label="${esc(`Brand colors: ${colorNames}`)}">${app.colors.map(c => `<span style="--c:${c.hex}"></span>`).join('')}</p>
      <dl class="stats">
        <div><dt>${compact(app.ratingCount)} ratings</dt><dd>${app.rating1}</dd></div>
        <div><dt>prices</dt><dd>${app.priceCount}</dd></div>
      </dl>
    </a>
    <div class="strip" data-strip>
      <ol class="strip-track" role="list" tabindex="0" aria-label="${esc(app.name)} screens">
        ${firstScreen}
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
  const elements = apps.flatMap(a => a.elements.map(e => ({ ...e, app: a })));
  const elApps = new Set(elements.map(e => e.app.slug)).size;
  // The 4 crops that show their type best; any missing one is replaced by the next type in line.
  const teaserPicks = ['hevy/el-plan-picker-1', 'strava/el-trial-timeline-1', 'rise/el-discount-badge-2', 'myfitnesspal/el-social-proof-1'];
  let teaser = teaserPicks.map(k => elements.find(e => e.src === `/taste/media/${k}.jpg`)).filter(Boolean);
  for (const e of elements) {
    if (teaser.length >= 4) break;
    if (!teaser.some(x => x.type === e.type)) teaser.push(e);
  }
  teaser = teaser.slice(0, 4);

  const title = 'tasu.ai: design & paywalls behind top apps';
  const description = `The design and paywalls of ${n} top consumer apps: plans and prices, 3 brand colors, the font, the design style and 3 fixes for each.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${ABS}#website`, name: 'tasu.ai', alternateName: 'taste using AI', url: ABS, description, inLanguage: 'en', author: AUTHOR, publisher: AUTHOR },
      { '@type': 'CollectionPage', '@id': `${ABS}#page`, url: ABS, name: title, description, isPartOf: { '@id': `${ABS}#website` }, inLanguage: 'en', dateModified: DATE, primaryImageOfPage: SITE + OG.src, mainEntity: { '@id': `${ABS}#apps` } },
      { '@type': 'ItemList', '@id': `${ABS}#apps`, name: `${n} app breakdowns`, numberOfItems: n, itemListOrder: 'https://schema.org/ItemListUnordered',
        itemListElement: apps.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: a.url, name: `${a.name}: design and paywall` })) },
    ],
  };

  // The hero loop is the largest paint of the first screen: fetch its sprite with the stylesheet.
  const preload = '<link rel="preload" href="/taste/brand/loops/taste.svg" as="image" fetchpriority="high">\n';
  const html = `${head({ title, description, path: '', jsonld, preload })}
${header('apps')}
<main id="main">

<section class="hero" aria-labelledby="hero-title">
  <div class="hero-scene" data-parallax aria-hidden="true">
    ${floats()}
  </div>
  <div class="wrap hero-in">
    <span class="tasu-loop tasu-loop--taste hero-mascot" role="img" aria-label="Tasu, the tasu.ai mascot, licks a paywall card"></span>
    <h1 class="display" id="hero-title"><span class="hl">Design &amp; paywalls</span> behind top apps</h1>
    <p class="lead hero-sub"><span>${n} consumer apps from Apple’s US Top Grossing charts.</span> <span>For each: paywall strategy, colors, font, design style, and how I’d improve it.</span></p>
    <div class="actions">
      ${xButton('Follow on X', true)}
      <a class="btn btn-secondary btn-lg" href="#apps">Browse the apps</a>
    </div>
  </div>
</section>

<section class="section" id="apps" aria-labelledby="apps-title" data-filter data-filter-main data-filter-url data-noun-one="app" data-noun-many="apps">
  <div class="wrap">
    <div class="gallery-head">
      <h2 class="title-xl" id="apps-title">${n} apps, from paywall to palette</h2>
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
${teaser.length ? `
<section class="section" aria-labelledby="lib-title" data-reveal>
  <div class="wrap">
    <div class="section-head">
      <h2 class="title-xl" id="lib-title">${elements.length} UI elements from ${elApps} web paywalls</h2>
      <a class="link-arrow" href="/taste/library/">Open the library ${I.arrow}</a>
    </div>
    <ul class="tiles" role="list">
      ${teaser.map(e => `<li>${tile(e, e.app, `/taste/library/?tag=${e.type}`)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>
` : ''}
<section class="section" aria-labelledby="closing-title" data-reveal>
  <div class="wrap closing">
    ${happy()}
    <h2 class="title-xl" id="closing-title">A new app breakdown every day on X</h2>
    ${xButton('@jeremylasne', false)}
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
            <p class="source-note plans-note">${app.iapCount} In-App Purchases listed on the App Store, US, ${DAY}</p>
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

function colorsCard(app) {
  const label = app.colors.map(c => `${c.name} ${c.role}%`).join(', ');
  return `<div class="card">
          <h2 class="title-m" id="colors-title">Colors</h2>
          <ul class="colors" role="list">
            ${app.colors.map(c => `<li class="color"><span class="color-chip" style="--c:${c.hex}"></span><span><span class="color-role">${ROLE[c.role] || 'Main'}</span><span class="color-line"><span class="color-name">${txt(c.name)}</span><button class="copy-hex" type="button" data-copy="${c.hex}" aria-label="Copy ${esc(c.name)}, ${c.hex}"><span data-copy-label>${c.hex}</span>${I.copySm}</button></span>${c.use ? `<span class="color-use">${copy(c.use.charAt(0).toUpperCase() + c.use.slice(1))}</span>` : ''}</span></li>`).join('\n            ')}
          </ul>
          <div class="ratio" role="img" aria-label="${esc(`60/30/10 split: ${label}`)}">${app.colors.map(c => `<span style="--c:${c.hex};--w:${c.role}%"></span>`).join('')}</div>
        </div>`;
}

function fontCard(app) {
  const f = app.font;
  let nameLine, free = '';
  if (f?.name) {
    nameLine = esc(f.name);
    if (f.closeTo && f.closeTo !== f.name) free = `Closest free font: ${esc(f.closeTo)}`;
    else if (f.closeTo) free = 'A free Google Font';
  } else if (f?.closeTo) {
    nameLine = `Close to ${esc(f.closeTo)}`;
    free = 'The closest free Google Font to the app’s type';
  }
  if (!f) log(`${app.slug}: font card shows typeStyle only`);
  // A font seen only on the web pricing page says so: the app itself may use another one.
  if (f?.scope) free = `On the ${esc(f.scope)}${free ? `. ${free}` : ''}`;
  const from = f?.scope ? `${app.name}’s ${f.scope}` : `${/^[aeiou]/i.test(app.name) ? 'an' : 'a'} ${app.name} App Store screenshot`;
  const crop = app.fontCrop
    ? `<img class="specimen" src="${app.fontCrop.src}" width="${app.fontCrop.w}" height="${app.fontCrop.h}" alt="${esc(`Headline text cut from ${from}`)}" loading="lazy" decoding="async">`
    : '';
  const facts = [];
  if (f?.look) facts.push(['Look', txt(f.look.charAt(0).toUpperCase() + f.look.slice(1))]);
  if (f?.weights) facts.push(['Weights', txt(f.weights.charAt(0).toUpperCase() + f.weights.slice(1))]);
  if (!f && app.typeStyle) facts.push(['Type', txt(app.typeStyle)]);
  return `<div class="card">
          <h2 class="title-m" id="font-title">Font</h2>
          ${crop}${nameLine ? `
          <p class="font-name">${nameLine}</p>` : ''}${free ? `
          <p class="font-free">${free}</p>` : ''}
          <dl class="facts">
            ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n            ')}
          </dl>
        </div>`;
}

function styleCard(app) {
  return `<div class="card">
          <h2 class="title-m" id="style-title">Design style</h2>
          ${app.visualStyle ? `<p class="style-text">${copy(app.visualStyle)}</p>` : app.typeStyle ? `<p class="style-text">${txt(app.typeStyle)}</p>` : ''}${app.traits.length ? `
          <ul class="bullets" role="list">
            ${app.traits.map(t => `<li>${copy(t)}</li>`).join('\n            ')}
          </ul>` : ''}
        </div>`;
}

function fixesBlock(app) {
  const rule = r => esc(String(r).replace(/"([^"]*)"/g, '‘$1’').replace(/(\w)'(\w)/g, '$1’$2'));
  return app.fixes.map(f => `<li class="fix">
          <h3 class="title-s">${txt(f.title)}</h3>
          <p>${copy(f.detail)}</p>
          ${f.rule ? `<p class="fix-rule">“${rule(f.rule)}” <cite>taste.md, ${esc(f.source || '')}</cite></p>` : ''}
        </li>`).join('\n        ');
}

function appPage(app, i) {
  const prev = apps[(i - 1 + apps.length) % apps.length];
  const next = apps[(i + 1) % apps.length];
  const subs = app.subs.map(r => r.n);
  const fontPhrase = app.font?.name ? (app.font.scope ? `a ${app.font.scope} set in ${app.font.name}` : `set in ${app.font.name}`)
    : app.font?.closeTo ? `a font close to ${app.font.closeTo}` : '';
  const hexes = app.colors.map(c => c.hex);
  let description = `${app.name}’s design and paywall: ${app.priceCount} prices from ${money(Math.min(...subs))} to ${money(Math.max(...subs))}, colors ${hexes[0]}, ${hexes[1]} and ${hexes[2]}${fontPhrase ? `, ${fontPhrase}` : ''}, and 3 fixes.`;
  if (!subs.length) description = `${app.name}’s design and paywall: colors ${hexes.join(', ')}${fontPhrase ? `, ${fontPhrase}` : ''}, and 3 fixes from the taste rules.`;
  if (description.length > 160) description = description.replace(/, (a [a-z ]+ set in|set in|a font close to) [^,]+,/, ',');
  let title = `${app.name} design and paywall | tasu.ai`;
  if (title.length > 60) title = `${app.name} paywall | tasu.ai`;
  const pw = app.paywalls[0];
  // The share card: 1200x630, made by _tools/og.cjs (app icon, name, brand colors, paywall).
  const card = `/taste/media/${app.slug}/og.jpg`;
  const image = existsSync(fileOf(card))
    ? { src: card, w: 1200, h: 630, alt: `${app.name}: design and paywall, by tasu.ai` }
    : (log(`${app.slug}: no media/${app.slug}/og.jpg, the page shares og.png (run _tools/og.cjs)`), OG);
  const offers = app.rows.map(r => ({ '@type': 'Offer', name: r.name, price: r.n.toFixed(2), priceCurrency: 'USD' }));
  const prices = app.rows.map(r => r.n);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${app.url}#article`,
        headline: `${app.name}: design and paywall`,
        description,
        image: [SITE + image.src, ...(pw ? [SITE + pw.src] : [])],
        datePublished: DATE,
        dateModified: DATE,
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
  const html = `${head({ title, description, path: `${app.slug}/`, type: 'article', image, jsonld })}
${header('app')}
<main id="main" class="page-app">

<section class="section app-top" aria-labelledby="app-title">
  <div class="wrap">
    <div class="app-head">
      <img class="app-head-icon" src="${app.iconSm}" width="128" height="128" alt="${esc(app.name)} app icon" fetchpriority="high">
      <div>
        <h1 class="title-xl" id="app-title">${esc(app.name)}<span class="h1-rest">: design and paywall</span></h1>
        <p class="lead">${copy(app.oneLiner)}</p>
        <ul class="meta" role="list">
          ${metaItems.map(m => `<li>${m}</li>`).join('\n          ')}
        </ul>
        <p class="source-note">${SOURCE}</p>
        <div class="actions"><a class="btn btn-secondary" href="${esc(app.appStore)}">View on the App Store ${I.external}</a></div>
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="paywall-title">
  <div class="wrap">
    <div class="section-head"><h2 class="title-l" id="paywall-title">Paywall strategy</h2></div>
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
${app.screens.length ? `
<section class="section" aria-labelledby="shots-title" data-reveal>
  <div class="wrap">
    <div class="section-head"><h2 class="title-l" id="shots-title">App Store screenshots</h2><p class="source-note">${app.screens.length} screenshots, ${SOURCE}</p></div>
    <div class="strip strip--page" data-strip>
      <ol class="strip-track" role="list" tabindex="0" aria-label="${esc(app.name)} App Store screenshots">
        ${app.screens.map(s => `<li class="screen"><img src="${s.src}" width="${s.w}" height="${s.h}" alt="${txt(s.alt)}" loading="lazy" decoding="async"></li>`).join('\n        ')}
      </ol>${stripButtons('screenshots')}
    </div>
  </div>
</section>
` : ''}
<section class="section" aria-label="Colors, font and design style" data-reveal>
  <div class="wrap">
    <div class="design-grid">
        ${colorsCard(app)}
        ${fontCard(app)}
        ${styleCard(app)}
    </div>
  </div>
</section>
${app.fixes.length ? `
<section class="section" aria-labelledby="fix-title" data-reveal>
  <div class="wrap">
    <div class="section-head"><h2 class="title-l" id="fix-title">How I’d improve it</h2></div>
    <ol class="fixes" role="list">
        ${fixesBlock(app)}
    </ol>
  </div>
</section>
` : ''}
<section class="section" aria-labelledby="prompt-title" data-reveal>
  <div class="wrap prompt-block">
    <h2 class="title-l" id="prompt-title">Copy this style</h2>
    <div class="prompt">
      <p class="prompt-text" id="style-prompt">${copy(app.prompt)}</p>
    </div>
    <div class="prompt-actions">
      <button class="btn btn-secondary js-only" type="button" data-copy-target="#style-prompt">${I.copy}<span data-copy-label>Copy prompt</span></button>
      <p class="prompt-hint">Paste it into Claude Code or Cursor.</p>
    </div>
  </div>
</section>
${app.elements.length ? `
<section class="section" aria-labelledby="el-title" data-reveal>
  <div class="wrap">
    <div class="section-head">
      <h2 class="title-l" id="el-title">UI elements in this paywall</h2>
      <a class="link-arrow" href="/taste/library/">Open the library ${I.arrow}</a>
    </div>
    <ul class="tiles" role="list">
      ${app.elements.map(e => `<li>${tile(e, app, `/taste/library/?tag=${e.type}`)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>
` : ''}
<section class="section" aria-labelledby="next-title" data-reveal>
  <div class="wrap">
    <h2 class="sr-only" id="next-title">Next breakdown</h2>
    <nav class="pager" aria-label="More apps">
      <a href="${prev.page}" rel="prev"><img src="${prev.iconSm}" width="48" height="48" alt="" loading="lazy" decoding="async"><span><small>Previous</small>${esc(prev.name)}</span></a>
      <a href="${next.page}" rel="next"><img src="${next.iconSm}" width="48" height="48" alt="" loading="lazy" decoding="async"><span><small>Next</small>${esc(next.name)}</span></a>
    </nav>
    <div class="closing">
      ${happy()}
      ${xButton('Follow on X for the next breakdown', true)}
    </div>
  </div>
</section>

</main>
${footer()}`;
  return { html, title, description };
}

/* ---------------------------------------------------------------- library */
function libraryPage() {
  const items = apps.flatMap(a => a.elements.map(e => ({ ...e, app: a })))
    .sort((x, y) => TYPE[x.type].i - TYPE[y.type].i || apps.indexOf(x.app) - apps.indexOf(y.app));
  const n = items.length;
  const nApps = new Set(items.map(e => e.app.slug)).size;
  const counts = new Map();
  for (const e of items) counts.set(e.type, (counts.get(e.type) || 0) + 1);
  const byCount = [...counts.entries()].sort((x, y) => y[1] - x[1] || TYPE[x[0]].i - TYPE[y[0]].i);
  const chips = TYPES.filter(([k]) => counts.has(k));
  const top3 = byCount.slice(0, 3).map(([k, c]) => `${c} ${TYPE[k].many}`);
  const title = 'Paywall UI elements from top apps | tasu.ai';
  const description = `${n} UI elements cut from the web pricing pages of ${nApps} top apps: ${top3[0]}, ${top3[1]} and ${top3[2]}. Filter by type to compare them.`;
  const url = `${ABS}library/`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${url}#page`, url, name: title, description, inLanguage: 'en', dateModified: DATE,
        isPartOf: { '@type': 'WebSite', '@id': `${ABS}#website`, name: 'tasu.ai', url: ABS }, author: AUTHOR,
        mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: items.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: `${TYPE[e.type].one} from ${e.app.name}`, url: e.app.url, image: SITE + e.src })) } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'tasu.ai', item: ABS },
        { '@type': 'ListItem', position: 2, name: 'Library', item: url },
      ] },
    ],
  };
  const html = `${head({ title, description, path: 'library/', jsonld })}
${header('library')}
<main id="main">

<section class="section lib-top" aria-labelledby="lib-title" data-filter data-filter-url data-noun-one="element" data-noun-many="elements">
  <div class="wrap">
    <div class="gallery-head">
      <div class="lib-intro">
        <h1 class="title-xl" id="lib-title">${n} paywall UI elements, sorted by type</h1>
        <p class="lead">Cut from the web pricing pages of ${nApps} apps on Apple’s US Top Grossing charts. Pick a type to compare them.</p>
      </div>
      <div class="chips js-only" role="group" aria-label="Element types">
        <button class="chip" type="button" data-filter-chip="all" aria-pressed="true">All <span class="chip-count">${n}</span></button>
        ${chips.map(([k, one]) => `<button class="chip" type="button" data-filter-chip="${k}" aria-pressed="false">${one} <span class="chip-count">${counts.get(k)}</span></button>`).join('\n        ')}
      </div>
    </div>
    <div class="toolbar">
      <p class="toolbar-status" data-filter-status aria-live="polite">${n} elements</p>
    </div>
    <ul class="tiles" role="list">
      ${items.map(e => `<li data-filter-item data-tags="${e.type}" data-text="${esc(`${TYPE[e.type].one} ${e.app.name}`)}">${tile(e, e.app, e.app.page)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="closing-title" data-reveal>
  <div class="wrap closing">
    ${happy()}
    <h2 class="title-xl" id="closing-title">A new app breakdown every day on X</h2>
    ${xButton('Follow on X', true)}
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
    fullName: a.fullName,
    developer: a.developer,
    category: a.category,
    rank: a.rank,
    chart: a.chart,
    rankLabel: `#${a.rank} in ${a.chart}`,
    rating: Number(a.rating.toFixed(2)),
    ratingCount: a.ratingCount,
    subtitle: a.subtitle,
    niche: a.niche,
    group: a.group,
    oneLiner: smart(a.oneLiner),
    keyNumber: { value: a.key.value, label: smart(a.key.label) },
    plans: a.subs.length,
    priceCount: a.priceCount,
    iapCount: a.iapCount,
    prices: a.rows.map(r => ({ name: r.name, price: r.price, period: r.period })),
    yearly: a.yearly ?? null,
    colors: a.colors,
    font: a.font ? { name: a.font.name || null, closeTo: a.font.closeTo || null } : null,
    paywall: a.drawn ? { source: 'drawn', label: a.paywallLabel } : { source: a.paywalls[0].source, src: a.paywalls[0].src, label: a.paywallLabel.replace(/&nbsp;/g, ' '), captures: a.paywalls.length },
    elements: a.elements.map(e => e.type),
    icon: a.icon,
    page: a.page,
    appStore: a.appStore,
  }));
  return `/* tasu.ai apps. Generated by _tools/build.mjs from _data/: do not edit by hand.
   App Store data, US, 15 Nov 2026. Analysis is Jeremy Lasne's opinion. */
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
const home = homePage();
pages.push(['index.html', home]);
apps.forEach((a, i) => pages.push([`${a.slug}/index.html`, appPage(a, i)]));
pages.push(['library/index.html', libraryPage()]);
write('data.js', dataJS());
for (const [rel, p] of pages) write(rel, p.html);
for (const [rel, p] of pages) check(rel, p);

const elementsTotal = apps.reduce((s, a) => s + a.elements.length, 0);
console.log(`tasu.ai: ${apps.length} apps, ${pages.length} pages, ${elementsTotal} UI elements`);
console.log(`Medians: yearly ${medians.year ? money(medians.year) : 'n/a'} over ${withYear.length} apps, top listed price ${medians.top ? money(medians.top) : 'n/a'} over ${withTop.length} apps`);
console.log(`Wrote ${written.join(', ')}`);
if (notes.length) console.log(`\nNotes (${notes.length}):\n- ${notes.join('\n- ')}`);
else console.log('No notes: every field was present.');
