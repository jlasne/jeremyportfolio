# jeremylasne.com

A landing page with one job: tell someone who has an audience that I will build
them a mobile app, run it, and split what it earns.

The pitch is the whole page. You bring distribution, I bring the entire build —
product, design, both stores, subscriptions, analytics, paywall, retention,
support — and we split the equity. Terms are negotiated per project and stated
plainly on the page rather than saved for a call.

## Stack

Single hand-written `index.html`. No build step, no framework, no bundler, no
network requests at runtime. Open it and edit it.

- **Nunito**, inlined once as a variable woff2 covering weights 400–800. One
  file, one family, no second voice, and no FOUT because nothing is fetched
- Black, white, and the greys between. The only colour on the page lives
  inside the phone, because that is the product
- Bands alternate white and black. A `.band--dark` section re-points the
  colour tokens rather than overriding components, so every card, rule, chip
  and slider inside it inverts on its own
- Project logos are the real icons from each site, resized to 128px and
  inlined as webp (340 KB of source PNGs down to 14 KB)
- Interactive without being fussy: the claim counts up on arrival, cards take
  a pointer-tracked sheen, the phone cycles and swipes, the nav retreats on the
  way down and returns on the way up
- Everything degrades: `prefers-reduced-motion` is respected throughout, and
  the page reads fine with JavaScript off apart from the earnings model
- Every text node on the page meets WCAG AA contrast in both bands

## Editing it

### The Kaught numbers — the one thing that needs real data

`KAUGHT_STATS` at the top of the `<script>` block. Fill in the `v` values and
they render as a stat strip in the Kaught section:

```js
var KAUGHT_STATS = [
  { v: '12k',  k: 'DOWNLOADS' },
  { v: '$2.4k', k: 'MONTHLY REVENUE' },
  ...
];
```

An empty `v` is skipped. If every one is empty the strip hides itself and a
qualitative line shows instead, so the page never displays placeholder dashes.

Keep these honest — the people this page is aimed at will ask you to back them
up on the first call.

### The revenue claim

One number: up to $500/month more per 100,000 views, counted up when it scrolls
into view. It is hard-coded in the `#revenue` markup with `data-count-to`, so
changing the figure means editing that attribute.

There is no simulator and no split shown. Four sliders invited fiddling and let
a visitor dial the number down to nothing; the terms belong in a conversation,
not on a landing page.

### The phone screenshots

The hero phone shows five real Kaught screens from `media/app/1.png` through
`5.png`. Replace a file and the page shows the new one; `index.html` needs no
editing.

Each image runs 7% taller than the frame and is pinned to the top, so the
device's own navigation bar falls off the bottom edge. A missing file removes
its own `<img>` rather than breaking the layout.

See [`media/app/README.md`](media/app/README.md) for formats and sizes.

### The social card

`og-image.png` is generated, not hand-drawn. It mirrors the hero. Regenerate it
by rendering a 1200×630 page and screenshotting — the source used to make the
current one is not checked in, so redraw it to match if the hero copy changes.

## Pages

| Path | What it is |
| --- | --- |
| `/` | the pitch |
| `/wealth` | **Wealth Architecture** — the research index and the book behind it |
| `/wealth/principles` | fourteen principles in four parts, with hairline SVG figures |
| `/wealth/country` | thirty-two countries read three ways |
| `/wealth/exercice` | the same three maps as an interactive lecture |
| `/overlap` | **Overlap** — landing page and live world clock |
| `/overlap/team` · `/plan` · `/next` | the app: the team, the meeting, and what to build next |

`/investment` and `/invest` are redirect stubs into `/wealth`.

The four `/wealth` pages share one design system in
[`wealth/style.css`](wealth/style.css) — warm paper, hairline rules, a single
gold accent, Instrument Serif over DM Sans. It is a different audience and a
different voice, and it is deliberately not linked from the landing page.

**Overlap** is the one page here that is a product rather than a piece of
writing. Three steps — Team, Plan, Next — with the overlap drawn the
WorldTimeBuddy way: one row per person, hours running left to right, every
column the same instant on a different clock. It runs with no backend at all
(team in `localStorage`, shared by link); connecting Convex adds accounts,
teams and invite links. See [`overlap/README.md`](overlap/README.md).

## Run locally

Open `index.html` in a browser, or:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Deploy

Static. Drop the folder on any host — GitHub Pages, Vercel, Netlify, Cloudflare
Pages.
