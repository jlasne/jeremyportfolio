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

- Type is the system stack, which resolves to SF Pro on the devices this will
  actually be opened on and costs nothing to download
- Sections alternate dark and light so each lands on its own
- Everything interactive degrades: `prefers-reduced-motion` is respected
  throughout, and the page is readable with JavaScript off apart from the
  earnings model

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

### The earnings model

Four sliders in the `.calc` section, wired up at the bottom of the script.
`STORE_FEE` is 0.15 (Apple's Small Business Program, which applies under
$1M/yr) and `SPLIT` is 0.5. The audience slider runs on a log curve — 1k to 5M
— so the low end gets as much of the track as the millions do.

The assumptions are printed on the page on purpose. An influencer will
interrogate the number, and the defensible one is more persuasive than the
flattering one.

### The phone mockups

Built in CSS, not screenshots. The viewfinder is a gradient stand-in.
**Swap these for real Kaught screenshots when you have them** — a premium page
lives or dies on the device shots, and a real one will always beat a drawn one.

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
