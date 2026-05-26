# jeremyportfolio

Pixel-art single-page portfolio for [Jeremy Lasne](https://x.com/jeremylasne) — builder & founder, shipping consumer apps since 2024.

A scrolling Pokémon-style world: hero → **The Founder's Quarter** → **The Projects Village** → **The Outskirts**. Click any building to read more.

## Stack

- Single static `index.html` — no build step, no dependencies
- Pixel art rendered as inline SVG (crisp at any size)
- Chiptune loop generated live in-browser with the Web Audio API (no audio files)
- Press Start 2P + JetBrains Mono via Google Fonts

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
