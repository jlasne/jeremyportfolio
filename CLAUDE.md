# jeremylasne.com: rules for this repository

## Every newsletter issue and article

Each newsletter issue is also published as an article under `/apps/lessons/<slug>/index.html`.
The sitemap picks it up by itself: `scripts/sitemap.mjs` runs on every Vercel deploy
(`buildCommand` in `vercel.json`), lists every page with a canonical and checks the SEO of
every article. Never edit `sitemap.xml` by hand.

To publish one:

1. Copy the newest folder in `apps/lessons/` to `apps/lessons/<slug>/`. The slug is the
   title in lowercase words joined by hyphens, 3 to 6 words, no dates.
2. Keep the design: same `<head>` order, nav, `.post` header (back link, `<time datetime>`,
   read time), `.prose` body and the one-line foot. Only the words change.
3. Fill the SEO, all of it:
   - `<title>`: the headline + ` | Jeremy Lasne`, 60 characters or less
   - `<meta name="description">`: 70 to 160 characters, the answer in the first sentence
   - `<link rel="canonical">`, `og:url`: `https://www.jeremylasne.com/apps/lessons/<slug>/`
   - `og:type` `article`, `og:title`, `og:description`, `og:image`, the `twitter:` tags
   - `article:published_time` and `article:modified_time` (YYYY-MM-DD)
   - JSON-LD `@graph`: a `BlogPosting` (headline, description, datePublished, dateModified,
     wordCount, keywords, image, author, publisher, mainEntityOfPage, isPartOf) and a
     `BreadcrumbList` (Home > Mobile apps > the article)
   - exactly one `<h1>`, `<h2>` per section, `alt` on every image, `role="img"` and an
     `aria-label` on a drawing
   - one link to `/apps/` (the back link)
4. Add the article at the top of the list in `/apps/` (`ol.lessons`), with its date and read time.
5. Run `node scripts/sitemap.mjs`: it rewrites `sitemap.xml` and prints "SEO check: every
   article passes", or the list of what to fix. Fix every line, then commit `sitemap.xml` too.
6. When an article changes, set `dateModified` and `article:modified_time` to that day.

A page stays out of the sitemap with `<meta name="robots" content="noindex">` or no canonical.

## Copy

No em-dashes. Sentences under 30 words. Numbers over adjectives. Say what is, not what is not.
