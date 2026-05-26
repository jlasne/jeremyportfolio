# jeremyportfolio

Pixel-art single-page portfolio for [Jeremy Lasne](https://x.com/jeremylasne) — builder & founder, shipping consumer apps since 2024.

A scrolling Pokémon-style world: hero → **The Founder's Quarter** → **The Projects Village** → **The Outskirts**. Click any building to read more.

## Stack

- Single self-contained `index.html` — React + Babel-standalone bundled inline, no build step, no network at runtime
- Stardew-flavored pixel art (9 building sprites) rendered as crisp inline SVG
- Parallax scroll engine with day-to-night sky gradient, drifting stars, walking character
- Press Start 2P + Geist Mono fonts inlined as base64 woff2

A v1 (pure-HTML/CSS prototype with no React) lives at [`index-v1.html`](index-v1.html).

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
