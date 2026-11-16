# tasu.ai page template

Every page under `/taste/` uses this markup. Pages are full static HTML. `tasu.js` only enhances them.

**The pages are generated.** `node taste/_tools/build.mjs` writes `index.html`, `<slug>/index.html`,
`library/index.html` and `data.js` from `_data/` (order in `_data/selection.json`, facts in `raw/`,
opinions in `analysis/`). Never edit the generated pages by hand: change the data or the generator,
then run it again. The build also copies `brand/loops/loops.css` into `tasu.css` (between the
`loops:start` and `loops:end` marks) and ends with a check of every page it wrote.

**v3 (15 Nov 2026): design and paywall.** tasu.ai covers each app's design and its paywall. The
spec (`scratchpad/tasu3-spec.md`) wins over any older wording below. The markup in sections 2, 5,
6 and 7 is the v3 markup the generator writes.

- Styles: `/taste/tasu.css`. Behaviour: `/taste/tasu.js` (defer).
- Font: `/taste/fonts/` (Schibsted Grotesk, self-hosted, built by `_tools/fonts.py`).
- Brand: `/taste/brand/` (see its README).
- Live sheet of every component, both themes: `/taste/_tools/preview.html`.
- Never write page-level `<style>` or inline colors. Use the classes below. The only inline styles are the custom properties listed here (`--x`, `--c`, `--w`).

## 1. Head, in this exact order

Replace the `{...}` values. Keep the order: charset, viewport, title, description, canonical, theme, the snippet, font, CSS, JS, icons, social tags, JSON-LD.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{TITLE}</title>
<meta name="description" content="{DESCRIPTION}">
<link rel="canonical" href="https://www.jeremylasne.com/taste/{PATH}">
<meta name="theme-color" content="#F3EFE7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1C1B19" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<script>(function(r){var t,v;try{t=localStorage.getItem('tasu-theme');v=localStorage.getItem('tasu-view')}catch(e){}r.classList.add('js');if(v==='grid')r.setAttribute('data-view','grid');if(t==='light'||t==='dark'){r.setAttribute('data-theme',t);var m=document.querySelectorAll('meta[name="theme-color"]'),c=t==='dark'?'#1C1B19':'#F3EFE7';for(var i=0;i<m.length;i++)m[i].setAttribute('content',c)}})(document.documentElement)</script>
<link rel="preload" href="/taste/fonts/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/taste/tasu.css">
<script src="/taste/tasu.js" defer></script>
<link rel="icon" href="/taste/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/taste/brand/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="tasu.ai">
<meta property="og:url" content="https://www.jeremylasne.com/taste/{PATH}">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESCRIPTION}">
<meta property="og:image" content="https://www.jeremylasne.com/taste/brand/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="tasu.ai: design &amp; paywalls behind top apps">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@jeremylasne">
<meta name="twitter:creator" content="@jeremylasne">
<meta name="twitter:title" content="{TITLE}">
<meta name="twitter:description" content="{DESCRIPTION}">
<meta name="twitter:image" content="https://www.jeremylasne.com/taste/brand/og.png">
<script type="application/ld+json">{JSON_LD}</script>
</head>
```

- `{PATH}`: empty for the home (`https://www.jeremylasne.com/taste/`), `{slug}/` for an app, `library/` for the library. Always end with a slash.
- App pages: `og:type` is `article`. Add `<meta property="article:published_time" content="2026-11-15">` and `<meta property="article:modified_time" content="2026-11-15">` right after `og:type`. `og:image` and `twitter:image` point to the app's paywall image (absolute URL), with its real `og:image:width`, `og:image:height` and an `og:image:alt` that describes it.
- `_tools/preview.html` is the one exception: `<meta name="robots" content="noindex, nofollow">` and no canonical, so the sitemap skips it.

### What the snippet does

It runs before the first paint. It adds the `js` class to `<html>` (CSS hides the JS-only controls without it). It applies the saved theme (`data-theme`) and the saved gallery view (`data-view="grid"`), so neither flashes. It repaints the `theme-color` metas for a saved theme. Both storage reads sit in `try/catch`. Copy it byte for byte.

## 2. Body: skip link, header, main, footer

```html
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap header-in">
    <a class="brand" href="/taste/" aria-label="tasu.ai home">
      <span class="tasu-loop tasu-loop--blink" aria-hidden="true"></span>
      <img class="brand-l" src="/taste/brand/loops/wordmark.svg" width="86" height="32" alt="">
      <img class="brand-d" src="/taste/brand/loops/wordmark-dark.svg" width="86" height="32" alt="">
    </a>
    <nav class="nav" aria-label="Main">
      <a href="/taste/#apps" aria-current="page">Apps</a>
      <a href="/taste/library/">Library</a>
    </nav>
    <form class="search search--header" role="search" action="/taste/" method="get">
      <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
      <label class="sr-only" for="site-q">Search apps</label>
      <input id="site-q" type="search" name="q" placeholder="Search apps" autocomplete="off" enterkeyhint="search" data-site-search>
      <kbd class="kbd" aria-hidden="true">/</kbd>
    </form>
    <div class="header-tools">
      <button class="icon-btn theme-toggle js-only" type="button" data-theme-toggle aria-pressed="false" aria-label="Dark theme">
        <svg class="ico i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.64 5.64l1.06 1.06M17.3 17.3l1.06 1.06M5.64 18.36l1.06-1.06M17.3 6.7l1.06-1.06"/></svg>
        <svg class="ico i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z"/></svg>
      </button>
      <a class="icon-btn" href="https://x.com/jeremylasne" aria-label="Jeremy Lasne on X">
        <svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
    </div>
  </div>
</header>

<main id="main">
  ...
</main>

<footer class="site-footer">
  <div class="wrap footer-in">
    <p class="footer-brand"><img src="/taste/brand/icon.svg" width="24" height="24" alt=""><span>tasu.ai · taste using AI · by <a href="https://www.jeremylasne.com/">Jeremy Lasne</a></span></p>
    <p>Data: Apple App Store, US, 15 Nov 2026</p>
    <nav class="footer-links" aria-label="Footer">
      <a href="/taste/#apps">Apps</a>
      <a href="/taste/library/">Library</a>
      <a href="https://x.com/jeremylasne"><svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>@jeremylasne</a>
    </nav>
  </div>
</footer>
</body>
</html>
```

- `aria-current="page"` goes on **Apps** for the home and every app page, and on **Library** for the library.
- The header search sends `/taste/?q=...`. On the home, `tasu.js` filters the gallery in place instead, and reads `?q=` on load.
- Phone (under 720px): the header has 2 rows, logo and nav, then search and tools. From 720px it is 1 row. It never scrolls sideways.

## 3. Rules every page follows

- **One `<h1>`**, an `<h2>` per section, `<h3>` inside sections.
- **Exactly one mint button per page** (`.btn-primary`). Home: "Follow on X". App page: "Follow on X for the next breakdown". Library: "Follow on X". Every other button is `.btn-secondary`.
- **Mascot loops** (`.tasu-loop`, see `brand/README.md`, "Loops"): `blink` in the header, `taste` in the hero, `look` in the empty search state, `happy` above every closing "Follow on X" block. Nowhere else. Jeremy asked for them, so they are the one exception to the no-looping rule. `tasu.js` pauses them off screen; without JS and with reduced motion they show frame 1.
- **Mint only on**: that button, `.hl` under one headline word, `.key-num` (one per card), a selection mark, the mascot. Never mint text on cream: `.key-num` handles this itself (grey with a mint band on cream, mint text on dark).
- **Numbers**: every number is tabular already (the font's `tnum` swaps digits only, so prices keep normal `.` and `,`). No `.num` class needed.
- **No-break spaces** keep a number with its unit and the date in one piece: `15&nbsp;Nov&nbsp;2026`, `#11&nbsp;in Health &amp; Fitness`, `47&nbsp;plans`, `$1.15&nbsp;a&nbsp;week`.
- **Facts carry their source**: "App Store data, US, 15 Nov 2026". Rank on cards: `#11 in Health &amp; Fitness`. Long form on the app page: `#11 in Health &amp; Fitness, US Top Grossing`.
- **Images**: always `width` and `height` (the real pixel size), `alt` on every one (`alt=""` when decorative or repeated), `decoding="async"`, and `loading="lazy"` for everything below the first screen.
- **Drawings** (a drawn paywall, the 60/30/10 bar): `role="img"` plus `aria-label`.
- **Reveal on scroll**: add `data-reveal` to sections and to each `.app-row`. Blocks below the fold fade in, 200ms, 30ms apart. Nothing is hidden without JS.
- **JS-only controls** (theme toggle, gallery search and chips, view toggle) carry `js-only`, so they never show without JS.
- **Theme islands**: `data-theme="light"` or `"dark"` on any element forces that theme inside it.
- **Spacing and type**: use the tokens (`--sp-*`, `--fs-*`, `--r-*`) and the type classes. Never invent a size.

## 4. Type classes

| Class | Phone | Desktop | Use |
|---|---|---|---|
| `.display` | 40 to 46px | 88px | The hero `<h1>` only |
| `.title-xl` | 39px | 61px | Big section headlines, the app name `<h1>` |
| `.title-l` | 31px | 39px | App page `<h2>` |
| `.title-m` | 25px | 25px | Card titles |
| `.title-s` | 20px | 20px | Small headings, "My read" |
| `.lead` | 20px | 20px | Sublines, secondary color |
| `.small` | 13px | 13px | Notes |
| `.muted` | | | Secondary color (text at 76% on cream, 62% on dark) |
| `.hl` | | | The mint band under one headline word |

## 5. Home

### Hero

```html
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-scene" data-parallax aria-hidden="true">
    <img class="float is-icon" src="/taste/media/{slug}/icon.png" width="84" height="84" alt="" style="--x:7%;--y:34%;--xm:7%;--ym:29%;--w:84px;--r:-12deg;--d:1">
    <img class="float m-hide" src="/taste/media/{slug}/pw1.jpg" width="72" height="156" alt="" style="--x:20%;--y:27%;--w:72px;--r:10deg;--d:2">
    <!-- 18 to 22 cards in all -->
  </div>
  <div class="wrap hero-in">
    <span class="tasu-loop tasu-loop--taste hero-mascot" role="img" aria-label="Tasu, the tasu.ai mascot, licks a paywall card"></span>
    <h1 class="display" id="hero-title"><span class="hl">Design &amp; paywalls</span> behind top apps</h1>
    <p class="lead hero-sub"><span>12 consumer apps from Apple’s US Top Grossing charts.</span> <span>For each: paywall strategy, colors, font, design style, and how I’d improve it.</span></p>
    <div class="actions">
      <a class="btn btn-primary btn-lg" href="https://x.com/jeremylasne">{X ICON} Follow on X</a>
      <a class="btn btn-secondary btn-lg" href="#apps">Browse the apps</a>
    </div>
  </div>
</section>
```

Floating cards (`.float`), one `<img>` each:

- `--x`, `--y`: the card's centre, in % of the scene. The scene starts 128px above the hero, behind the header.
- `--w`: width in px (40 to 104). Set the real `width` and `height` attributes to match: icons are square, a 390x844 screen at 72px wide is 72x156.
- `--r`: tilt, -18deg to 18deg.
- `--d`: depth. 1 is near (sharp, full opacity, strong parallax), 2 is middle (2px blur, 65%), 3 is far (4px blur, 30%, small).
- `.is-icon`: app icon corners (22.37%). Without it: 16px corners, for screens.
- Phone (under 720px): cards shrink to 72%. A card shows on phone only with `--xm` and `--ym` (its phone position). Every other card gets `.m-hide`.
- Placement that works (see the preview): about 6 near cards on the left and right edges, the rest at depth 2 or 3. Keep the centre column (30% to 70% of the width) free from the mascot down to the buttons, except tiny depth-3 cards. Keep `--y` at 90% or less, so no card is cut at the hero's bottom edge. On phone, use 5 or 6 cards: beside the mascot (`--ym` 20% to 32%) and under the buttons (`--ym` 92% to 96%).
- Use real content only: the 12 apps' icons and paywall images.

### Gallery

```html
<section class="section" id="apps" aria-labelledby="apps-title" data-filter data-filter-main data-filter-url data-noun-one="app" data-noun-many="apps">
  <div class="wrap">
    <div class="gallery-head">
      <h2 class="title-xl" id="apps-title">{HEADLINE}</h2>
      <div class="gallery-tools js-only">
        <div class="search search--lg">
          {SEARCH ICON}
          <label class="sr-only" for="apps-q">Search the apps</label>
          <input id="apps-q" type="search" placeholder="Search apps, categories, prices" autocomplete="off" enterkeyhint="search" data-filter-search>
          <kbd class="kbd" aria-hidden="true">/</kbd>
        </div>
        <div class="chips" role="group" aria-label="Categories">
          <button class="chip" type="button" data-filter-chip="all" aria-pressed="true">All <span class="chip-count">12</span></button>
          <button class="chip" type="button" data-filter-chip="health-fitness" aria-pressed="false">Health &amp; Fitness <span class="chip-count">6</span></button>
          <!-- one chip per category that has apps -->
        </div>
      </div>
    </div>
    <div class="toolbar">
      <p class="toolbar-status"><span data-filter-status aria-live="polite">12 apps</span><span class="toolbar-source">App Store data, US, 15&nbsp;Nov&nbsp;2026</span></p>
      <div class="view-toggle js-only" role="group" aria-label="View">
        <button type="button" data-view-set="row" aria-pressed="true" aria-label="Rows">{ROWS ICON}</button>
        <button type="button" data-view-set="grid" aria-pressed="false" aria-label="Grid">{GRID ICON}</button>
      </div>
    </div>
  </div>

  <ol class="apps" role="list">
    {ONE .app-row PER APP}
  </ol>

  <div class="wrap">
    <div class="empty" data-filter-empty hidden>
      <span class="tasu-loop tasu-loop--look" role="img" aria-label="Tasu, the tasu.ai mascot, looks around"></span>
      <p class="title-s">No app matches this search</p>
      <button class="btn btn-secondary" type="button" data-filter-reset>Clear the search</button>
    </div>
  </div>
</section>
```

Gallery headline: "12 apps, from paywall to palette". Search placeholder: `Try “sleep” or “orange”` (search also
matches niches, brand color names and font names).

The list `ol.apps` sits **outside** `.wrap`: rows place themselves on the page grid and the strip runs to the screen edge.

One app row:

```html
<li class="app-row" data-filter-item data-tags="health-fitness" data-text="{name} {full name} {subtitle} {category} {developer} {key price}" data-reveal>
  <a class="app-card" href="/taste/{slug}/">
    <img class="app-icon" src="/taste/media/{slug}/icon.png" width="64" height="64" alt="">
    <p class="app-rank">#11&nbsp;in Health &amp; Fitness</p>
    <h3 class="app-name">{name}</h3>
    <p class="app-sub">{subtitle}</p>
    <p class="key"><span class="key-num">$29.99</span><span class="key-label">{key number label}</span></p>
    <p class="app-colors" role="img" aria-label="Brand colors: {60 name}, {30 name} and {10 name}"><span style="--c:#FFFFFF"></span><span style="--c:#1D1A23"></span><span style="--c:#7F7F80"></span></p>
    <dl class="stats">
      <div><dt>rating</dt><dd>4.8</dd></div>
      <div><dt>ratings</dt><dd>312K</dd></div>
      <div><dt>plans</dt><dd>4</dd></div>
    </dl>
  </a>
  <div class="strip" data-strip>
    <ol class="strip-track" role="list" tabindex="0" aria-label="{name} screens">
      <li class="screen"><span class="mark">Paywall</span><img src="/taste/media/{slug}/pw1.jpg" width="{w}" height="{h}" alt="{name} paywall: {what it shows}" decoding="async"></li>
      <li class="screen"><img src="/taste/media/{slug}/s1.jpg" width="{w}" height="{h}" alt="{name} App Store screenshot 1: {what it shows}" loading="lazy" decoding="async"></li>
      <!-- s2 ... s8 -->
    </ol>
    <button class="strip-btn" type="button" data-strip-prev aria-label="Previous screens">{CHEVRON LEFT}</button>
    <button class="strip-btn" type="button" data-strip-next aria-label="Next screens">{CHEVRON RIGHT}</button>
  </div>
</li>
```

- The paywall screen comes first and carries `<span class="mark">Paywall</span>`. Use `paywallShots` first when they exist.
- `.app-colors` sits top right of the card: the app's 3 brand colors, 2 main then the accent (content, so any hex).
- An app with no paywall capture gets a drawn screen first: `<li class="screen screen--drawn"><span class="mark">Paywall</span><div class="drawn" role="img" aria-label="...">...</div></li>` with up to 4 plans. Its type follows the screen width (`cqi`).
- `data-tags`: category slugs separated by spaces. They match the chips' `data-filter-chip`.
- `data-text`: the words search matches. Each typed word must start a word of this text.
- Stats labels are lowercase. Keep the 3 stats: rating, ratings count, number of plans.
- Screens are 320px tall on phone, 400px from 720px, 448px from 1024px. Width follows each image's ratio, so set the real `width` and `height`.
- Grid view: the toggle sets `data-view="grid"` on `<html>`. Each row becomes a tile with the paywall screen on top. No extra markup.

### Library teaser and closing line

```html
<section class="section" aria-labelledby="lib-title" data-reveal>
  <div class="wrap">
    <div class="section-head">
      <h2 class="title-xl" id="lib-title">{HEADLINE}</h2>
      <a class="link-arrow" href="/taste/library/">Open the library {ARROW ICON}</a>
    </div>
    <ul class="tiles" role="list">{4 .tile ITEMS}</ul>
  </div>
</section>

<section class="section" aria-labelledby="closing-title" data-reveal>
  <div class="wrap closing">
    <span class="tasu-loop tasu-loop--happy" role="img" aria-label="Tasu, the tasu.ai mascot, hops with joy"></span>
    <h2 class="title-xl" id="closing-title">A new app breakdown every day on X</h2>
    <a class="btn btn-secondary btn-lg" href="https://x.com/jeremylasne">{X ICON} @jeremylasne</a>
  </div>
</section>
```

Library teaser headline: "{N} UI elements from {M} real paywalls". Its tiles link to `/taste/library/?tag={type}`.

One element tile (home teaser, app page, library):

```html
<li data-filter-item data-tags="plan-picker" data-text="{type} {app name}">
  <a class="tile" href="/taste/library/#plan-picker">
    <span class="tile-img"><img src="/taste/media/{slug}/el-plan-picker-1.jpg" width="{w}" height="{h}" alt="Plan picker from {app}" loading="lazy" decoding="async"></span>
    <span class="tile-type">Plan picker</span>
    <span class="tile-app"><img src="/taste/media/{slug}/icon.png" width="20" height="20" alt="">{app}</span>
  </a>
</li>
```

The `data-filter-item` attributes are for the library page only. Tiles show 2 per row on phone and 280px or wider from 720px.

## 6. App page `/taste/{slug}/`

`<main id="main" class="page-app">` (a tighter section rhythm). Each section is a `<section class="section">` with a `.wrap` inside and an `<h2 class="title-l">` in a `.section-head`, in this order:

1. **App header** (`section.app-top`, holds the h1, no h2): `.app-head` with the icon (128px), `<h1 class="title-xl">{App}<span class="h1-rest">: design and paywall</span></h1>`, the one-liner as `.lead`, `.meta` (developer, `#11&nbsp;in Health &amp; Fitness, US Top Grossing`, `4.8 from 375,860 ratings`), `.source-note` "App Store data, US, 15&nbsp;Nov&nbsp;2026" and the App Store link (`.btn-secondary`).
2. **Paywall strategy**: `.split` with the phone figure, then `.stack-32`: the plans table (`.plans`, a `.plans-note` source under it), the `.facts` (Tiers, Free trial with its `.facts-note` evidence, Consumables, Family plan), the `.compare` line and "My read" (`<h3 class="title-s read-title">` + `.bullets`).
3. **App Store screenshots**: `.strip.strip--page` (runs to the right edge of the screen from 720px).
4. **Colors**, **Font** and **Design style**: `<section aria-label="Colors, font and design style">` holding `.design-grid` with 3 `.card`s, one `<h2 class="title-m">` each.
5. **How I’d improve it**: `.fixes`.
6. **Copy this style**: `.prompt-block` (title, the `.prompt` card, `.prompt-actions` with the secondary "Copy prompt" button and "Paste it into Claude Code or Cursor.").
7. **UI elements in this paywall** (only when the analysis has elements): `.tiles`, each tile linking to `/taste/library/?tag={type}`.
8. `.pager` (previous and next app), then `.closing` with the `happy` loop and the one mint button "Follow on X for the next breakdown".

```html
<!-- 2. The phone: one capture, several captures, or a drawing -->
<figure>
  <div class="phone"><img src="/taste/media/{slug}/pw1.jpg" width="600" height="1006" alt="{what the paywall shows}" decoding="async" fetchpriority="high"></div>
  <figcaption class="source">Web pricing page, captured at iPhone size on 15&nbsp;Nov&nbsp;2026</figcaption>
</figure>

<figure>
  <div class="phone">
    <ol class="phone-track" role="list" tabindex="0" aria-label="{App} paywall, 3 captures" data-phone>
      <li><img src="/taste/media/{slug}/pw1.jpg" ...></li>
      <li><img src="/taste/media/{slug}/pw2.jpg" ... loading="lazy"></li>
    </ol>
  </div>
  <div class="phone-nav js-only" data-phone-nav>
    <button class="icon-btn" type="button" data-phone-prev aria-label="Previous capture">{CHEVRON LEFT}</button>
    <span class="phone-count" data-phone-count>1 of 3</span>
    <button class="icon-btn" type="button" data-phone-next aria-label="Next capture">{CHEVRON RIGHT}</button>
  </div>
  <figcaption class="source">...</figcaption>
</figure>

<!-- No capture: the drawn paywall from the In-App Purchase prices, up to 6 plans -->
<div class="phone">
  <div class="drawn" role="img" aria-label="Drawn paywall for {App} from App Store prices: {plan} {price}, ...">
    <div class="drawn-head"><img src="/taste/media/{slug}/icon.png" width="64" height="64" alt=""><p class="drawn-title">{App} plans</p></div>
    <div class="drawn-plan"><span><b>Unlimited</b></span><span><b>$29.99</b></span></div>
    <div class="drawn-cta">Continue</div>
  </div>
</div>
<figcaption class="source">Drawn from App Store prices, not a screenshot</figcaption>

<!-- Plans: one row per distinct name, price and length. A column shows only when a row has a value. -->
<tr><th scope="row">Streak Restore<span class="plan-period">One-time purchase</span></th><td>$0.99</td></tr>

<!-- The line against the other apps, computed by the generator -->
<p class="compare">Yearly <b>$23.99</b>. Median of 6 apps with a yearly plan: <b>$79.99</b>.</p>

<!-- 4. Colors card -->
<div class="card">
  <h2 class="title-m" id="colors-title">Colors</h2>
  <ul class="colors" role="list">
    <li class="color"><span class="color-chip" style="--c:#FFFFFF"></span><span><span class="color-role">Main</span><span class="color-line"><span class="color-name">White</span><button class="copy-hex" type="button" data-copy="#FFFFFF" aria-label="Copy White, #FFFFFF"><span data-copy-label>#FFFFFF</span>{COPY ICON 16}</button></span><span class="color-use">Background of every screen</span></span></li>
    <!-- Main (30), then Accent (10) -->
  </ul>
  <div class="ratio" role="img" aria-label="60/30/10 split: White 60%, Ink black 30%, Scan grey 10%">...</div>
</div>

<!-- 4. Font card: the crop of real headline text is the specimen -->
<div class="card">
  <h2 class="title-m" id="font-title">Font</h2>
  <img class="specimen" src="/taste/media/{slug}/font-1.jpg" width="{w}" height="{h}" alt="Headline text cut from a {App} screenshot, set in its own font" loading="lazy" decoding="async">
  <p class="font-name">Close to Inter</p>
  <p class="font-free">The closest free Google Font to the app’s type</p>
  <dl class="facts"><div><dt>Look</dt><dd>...</dd></div><div><dt>Weights</dt><dd>...</dd></div></dl>
</div>

<!-- 6. Copy this style -->
<div class="wrap prompt-block">
  <h2 class="title-l" id="prompt-title">Copy this style</h2>
  <div class="prompt"><p class="prompt-text" id="style-prompt">{stylePrompt}</p></div>
  <div class="prompt-actions">
    <button class="btn btn-secondary js-only" type="button" data-copy-target="#style-prompt">{COPY ICON}<span data-copy-label>Copy prompt</span></button>
    <p class="prompt-hint">Paste it into Claude Code or Cursor.</p>
  </div>
</div>
```

- Source labels under the phone: "From the App Store", "Web pricing page, captured at iPhone size on 15&nbsp;Nov&nbsp;2026", or "Drawn from App Store prices, not a screenshot".
- Show the trial only with evidence, and print the evidence under the facts.
- The fixes keep their rule: `<p class="fix-rule">“{rule text from taste.md}” <cite>taste.md, S31</cite></p>`.

## 7. Library `/taste/library/`

A `section.section` with `data-filter data-filter-url data-noun-one="element" data-noun-many="elements"`. Inside `.wrap`: a `.gallery-head` with `.lib-intro` (the `<h1 class="title-xl">` and a `.lead`) and the type chips (`data-filter-chip="plan-picker"` and so on, `all` first, `js-only`), a `.toolbar` with `data-filter-status`, then `<ul class="tiles" role="list">` where every `<li>` carries `data-filter-item data-tags="{type}" data-text="{type} {app}"` and its tile links to the app page. `?tag={type}` opens the library on one type. Then the closing block with the `happy` loop and the one mint "Follow on X".

## 8. Icons

One set: 24-unit grid, `stroke-width="1.5"`, round caps, `class="ico"` (20px), `aria-hidden="true"`. The X logo is the only filled icon.

| Name | Inner markup |
|---|---|
| Search | `<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>` |
| Chevron left | `<path d="m14.5 6-6 6 6 6"/>` |
| Chevron right | `<path d="m9.5 6 6 6-6 6"/>` |
| Arrow right | `<path d="M5 12h14M13 6l6 6-6 6"/>` |
| External | `<path d="M8 16 16 8M9.5 8H16v6.5"/>` |
| Rows | `<rect x="3.75" y="4.75" width="16.5" height="6" rx="2"/><rect x="3.75" y="13.25" width="16.5" height="6" rx="2"/>` |
| Grid | `<rect x="3.75" y="3.75" width="7" height="7" rx="2"/><rect x="13.25" y="3.75" width="7" height="7" rx="2"/><rect x="3.75" y="13.25" width="7" height="7" rx="2"/><rect x="13.25" y="13.25" width="7" height="7" rx="2"/>` |
| Star | `<path d="m12 3.75 2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.36l-4.94 2.6.94-5.5-4-3.9 5.53-.8L12 3.75Z"/>` |

Stroked icons use `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`. The sun, the moon and the X are in the header markup above.

## 9. What tasu.js reads

| Attribute | Where | Effect |
|---|---|---|
| `data-theme-toggle` | button | Switches light and dark with a 200ms cross-fade, saves it (`tasu-theme`), sets `aria-pressed` |
| `data-site-search` | header input | "/" target. On a page with `data-filter-main`, it filters that list in place |
| `data-filter` | section | One filter scope. Add `data-filter-main` (gets the header search) and `data-filter-url` (keeps `?q=` and `?tag=`) on the home gallery |
| `data-filter-search` | input | Instant search inside the scope. "/" focuses it, Escape clears it |
| `data-filter-chip="slug"` | button.chip | One active chip at a time. `all` shows everything. Counts in `.chip-count` follow the search. Left and right arrows move between chips |
| `data-filter-item`, `data-tags`, `data-text` | each item | What chips and search match |
| `data-filter-status` | p | "12 apps" or "3 of 12 apps" (`data-noun-one`, `data-noun-many` on the scope) |
| `data-filter-empty`, `data-filter-reset` | block, button | Shown at 0 results. Reset clears search and chip |
| `data-view-set="row"` or `"grid"` | button | Sets `data-view` on `<html>`, saved as `tasu-view` |
| `data-strip`, `data-strip-prev`, `data-strip-next` | strip, buttons | The arrows page through whole screens. They hide at each end |
| `data-parallax` | `.hero-scene` | Pointer and scroll parallax on mouse devices. Off for touch and for reduced motion |
| `data-reveal` | any block | Fades in when it enters the screen |
| `.tasu-loop` | span | Pauses off screen and while the tab is hidden (`.is-paused`) |
| `data-copy="text"`, `data-copy-target="#id"` | button | Copies the text, or the element's text, to the clipboard. `[data-copy-label]` reads "Copied" for 1.6s |
| `data-phone`, `data-phone-nav`, `data-phone-prev`, `data-phone-next`, `data-phone-count` | phone track, nav | Pages through the paywall captures inside the phone, "1 of 3" |

`window.tasu` exposes `theme()`, `setTheme('light' or 'dark')`, `setView('row' or 'grid')` and `filters`.

## 10. Notes for whoever edits tasu.css

- Secondary text is the text color at **76% on cream** (5.1:1 on the page, 4.7:1 on a card) and 62% on dark (6.5:1, 5.4:1 on a card). The spec's 62% gives 3.5:1 on cream, under the 4.5:1 floor of taste.md section 12, and 72% still drops to 4.3:1 on a card.
- Surfaces are the text color at 8% (light) or 10% (dark), hover 14% or 16%. No other opacity of the text color.
- Shadows exist on `.float` and `.phone` only.
- The phone frame corners (48 outside, 40 inside) follow the iPhone, the one radius off the 8/16/24/32 scale.
- Overlays on screenshots (the "Paywall" mark, strip arrows) use the same night pill in both themes, because they sit on content of any color.
