# jeremyportfolio

Pixel-art single-page portfolio for [Jeremy Lasne](https://x.com/jeremylasne) — builder & founder, shipping consumer apps since 2024.

A scrolling Pokémon-style world: hero → **The Founder's Quarter** → **The Projects Village** → **The Outskirts**. Click any building to read more.

## Stack

- Single self-contained `index.html` — React + Babel-standalone bundled inline, no build step, no network at runtime
- Stardew-flavored pixel art (9 building sprites) rendered as crisp inline SVG
- Parallax scroll engine with day-to-night sky gradient, drifting stars, walking character
- Press Start 2P + Geist Mono fonts inlined as base64 woff2

A v1 (pure-HTML/CSS prototype with no React) lives at [`index-v1.html`](index-v1.html).

### Editing the landing page

`index.html` is a self-contained bundle: the page HTML lives JSON-encoded in a
`__bundler/template` script and the JS, fonts and images live gzipped+base64 in
a `__bundler/manifest` script. Unpack it, edit the asset, pack it back — packing
leaves untouched assets byte-for-byte alone, so the diff stays small.

## Pages

| Path | What it is |
| --- | --- |
| `/` | the pixel-art landing world |
| `/wealth` | **Wealth Architecture** — the research index and the book behind it |
| `/wealth/principles` | fourteen principles in four parts, with hairline SVG figures |
| `/wealth/country` | thirty-two countries read three ways |
| `/wealth/exercice` | the same three maps as an interactive lecture (was `/investment`) |
| `/economy` | *The Four Clocks* — the same argument as one classical essay |
| `/mobileapp` | the revenue-machine playbook |
| `/dayzero` | the "think bigger" article |
| `/overlap` | **Overlap** — landing page and live world clock |
| `/overlap/team` · `/plan` · `/next` | the app: the team, the meeting, and what to build next |

**Overlap** is the one page here that is a product rather than a piece of
writing. Three steps — Team, Plan, Next — with the overlap drawn the
WorldTimeBuddy way: one row per person, hours running left to right, every
column the same instant on a different clock. White is possible, black is not,
grey means only some of them. It runs with no backend at all (team in
`localStorage`, shared by link); connecting Convex adds accounts, teams and
invite links. See [`overlap/README.md`](overlap/README.md) for the setup and
the data model.

The four `/wealth` pages share one design system in
[`wealth/style.css`](wealth/style.css) — warm paper, hairline rules, a single
gold accent, Instrument Serif over DM Sans. It is deliberately unlike the rest
of the site: that material is long-form and wants to be read, not played.

`/investment` and `/invest` are redirect stubs to their new homes.

## Run locally

Just open `index.html` in a browser, or:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Deploy

Drop the folder on any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).

## Design references

Original Claude-design screenshots live in `_check/`.
