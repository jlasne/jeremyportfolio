// Builds sitemap.xml from the pages themselves, then checks the SEO of every article.
// Runs on every Vercel deploy (vercel.json "buildCommand"), and by hand: node scripts/sitemap.mjs
//
// A page joins the sitemap when its index.html has <link rel="canonical"> and no "noindex".
// Its URL is the canonical. Its lastmod comes from, in order:
//   1. an article's dateModified / datePublished (JSON-LD) or article:modified_time / published_time
//   2. the date of its last git commit, where git history exists (here, in a clone)
//   3. the lastmod the committed sitemap.xml already gives it (on Vercel, whose clone is too shallow for dates)
// The SEO check only warns: a missing tag never stops a deploy.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = "https://www.jeremylasne.com";
const SKIP = new Set([".git", "node_modules", "brandmatchapp", "wellness-api", "docs-out", "media", "scripts", "grid-tycoon", "assets"]);
const ARTICLES = "apps/lessons/";

function pages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...pages(p));
    else if (name === "index.html") out.push(p);
  }
  return out;
}

const attr = (html, re) => (html.match(re) || [])[1];
const meta = (html, key) => attr(html, new RegExp(`<meta[^>]+(?:name|property)="${key}"[^>]+content="([^"]*)"`, "i"));
const day = s => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined);

function jsonld(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      out.push(...(j["@graph"] || [j]));
    } catch { /* a broken block is reported by the check below */ }
  }
  return out;
}

// Vercel clones only the last commits, so its git dates would all read "today": use git only off Vercel.
let git = false;
if (!process.env.VERCEL) { try { execSync("git rev-parse --git-dir", { cwd: ROOT, stdio: "pipe" }); git = true; } catch {} }
const gitDay = file => {
  if (!git) return undefined;
  try { return day(execSync(`git log -1 --format=%cs -- "${file}"`, { cwd: ROOT, stdio: "pipe" }).toString().trim()); } catch { return undefined; }
};

const before = {};
const mapFile = join(ROOT, "sitemap.xml");
if (existsSync(mapFile)) {
  for (const m of readFileSync(mapFile, "utf8").matchAll(/<loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) before[m[1]] = m[2];
}

const urls = [];
const warnings = [];
for (const file of pages(ROOT)) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const html = readFileSync(file, "utf8");
  const canonical = attr(html, /<link rel="canonical" href="([^"]+)"/);
  if (!canonical || /<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
  const ld = jsonld(html);
  const post = ld.find(x => x["@type"] === "BlogPosting" || x["@type"] === "Article");
  const lastmod = day(post?.dateModified) || day(post?.datePublished) || day(meta(html, "article:modified_time")) ||
    day(meta(html, "article:published_time")) || gitDay(rel) || before[canonical];
  urls.push({ loc: canonical, lastmod, article: rel.startsWith(ARTICLES) });

  if (rel.startsWith(ARTICLES)) {
    const w = msg => warnings.push(`${rel}: ${msg}`);
    const title = attr(html, /<title>([^<]*)<\/title>/) || "";
    const desc = meta(html, "description") || "";
    if (!title) w("no <title>"); else if (title.length > 60) w(`title is ${title.length} characters, keep it at 60 or less`);
    if (desc.length < 70 || desc.length > 160) w(`description is ${desc.length} characters, keep it between 70 and 160`);
    if (!canonical.startsWith(SITE + "/" + ARTICLES)) w("canonical is outside " + SITE + "/" + ARTICLES);
    for (const k of ["og:title", "og:description", "og:image", "og:url", "article:published_time", "twitter:card"]) if (!meta(html, k)) w(`no ${k}`);
    if (meta(html, "og:type") !== "article") w('og:type is not "article"');
    if (!post) w("no BlogPosting JSON-LD");
    else for (const k of ["headline", "description", "datePublished", "dateModified", "author", "image", "mainEntityOfPage"]) if (!post[k]) w(`BlogPosting has no ${k}`);
    if (!ld.some(x => x["@type"] === "BreadcrumbList")) w("no BreadcrumbList JSON-LD");
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) w(`${h1} <h1>, keep exactly 1`);
    if (!/<html[^>]+lang="/.test(html)) w("no lang on <html>");
    for (const m of html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)) w("an <img> has no alt: " + m[0].slice(0, 60));
    if (!/<time datetime="/.test(html)) w('no <time datetime="..."> for the date');
  }
}

// home first, then the pages by URL; articles newest first under their section
urls.sort((a, b) => (a.loc === SITE + "/" ? -1 : b.loc === SITE + "/" ? 1 :
  a.article && b.article ? (b.lastmod || "").localeCompare(a.lastmod || "") : a.loc.localeCompare(b.loc)));
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Built by scripts/sitemap.mjs on every deploy: do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
writeFileSync(mapFile, xml);
console.log(`sitemap.xml: ${urls.length} pages (${urls.filter(u => u.article).length} articles)${git ? "" : ", on Vercel: lastmod kept from the committed sitemap"}`);
for (const u of urls) console.log(`  ${u.lastmod || "          "}  ${u.loc}`);
if (warnings.length) { console.log(`\nSEO check: ${warnings.length} to fix`); for (const w of warnings) console.log("  - " + w); }
else console.log("\nSEO check: every article passes");
