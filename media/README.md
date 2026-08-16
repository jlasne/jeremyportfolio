# Hero backdrop

Drop a painted backdrop here and the hero swaps to it automatically.

- **File:** `hero-bg.png` → served at `/media/hero-bg.png`

When the file is present, the drawn sun, mountain ridges and ground band step
aside and the image becomes the whole hero. **The walking deer stays in front
of it** — it's the one piece of the scene that is kept.

When the file is absent the image simply never loads and the original drawn
scene renders as before, so the hero can never end up blank.

## Format

| | |
|---|---|
| **Format** | PNG (lossless — keeps pixel-art edges hard; JPG smears them) |
| **Size** | 1920×1080. 16:9 matches the crop best |
| **Weight** | under ~500 KB. Pixel art quantizes well — 32–64 colors is usually plenty |

The layer uses `image-rendering: pixelated`, so a smaller canvas (e.g. 960×540)
upscales crisply rather than going blurry, if that suits the art better.

## Composition

The image is drawn `cover`, anchored **center bottom**, so the bottom edge is
pinned to the floor of the hero at every window size and the sides crop first.

- Keep the **foreground ground in the bottom ~15%** — that strip is where the
  deer walks (it stands 131px tall at 34px off the bottom).
- Keep the **middle third quiet**. The name, tagline and buttons sit there, and
  the two floating newspapers sit at roughly 23–31% from the top, left and right.
- The drawn drifting clouds are dropped when a backdrop is present — the art
  brings its own. The **birds still fly** over the top, since they read as small
  dark specks against any sky. Both are gated on `photo` in `Hero()`.

Switching the Tweaks panel to the `dusk` sky warms the image with a CSS filter
(`.sky--dusk .hero-photo`) so it still reads as evening.

## Changing the path

`media/hero-bg.png` is referenced in two places that must agree — `HERO_BG` in
the app script and the `url()` in `.hero-photo`. Both live inside the bundled
`index.html`; see the unbundle/rebundle note in `HANDOFF-v1.md`.

---

# Journey videos

Drop the intro video here and it shows in **The Journey** section on the home page.

- **Video:** `journey/hashtag-0.mp4` → served at `/media/journey/hashtag-0.mp4`
- **Poster (optional):** `journey/hashtag-0.jpg` — shown before the viewer hits play

Keep files under GitHub Pages' **100 MB / file** limit.
