# Hero backdrop

Drop a painted backdrop here and the hero swaps to it automatically. It takes
either an animated loop or a single still:

| Files | Result |
|---|---|
| `hero-bg-01.png` … `hero-bg-10.png` | **animated** — loops 1→10 at 200 ms/frame (2 s) |
| `hero-bg.png` | single still |
| neither | the original drawn scene |

Names must be exactly two digits, `01` through `10` — `hero-bg-1.png` won't be
found. All ten have to be present: the loop is all-or-nothing, because a
partial set would stutter. Miss one and it quietly falls back to the still.

When a backdrop is present, the drawn sun, mountain ridges and ground band step
aside and the image becomes the whole hero. **The walking deer stays in front
of it** — it's the one piece of the scene that is kept.

Frames are decoded before the layer mounts, so the first pass through the loop
is as smooth as the rest and the hero never flashes a half-loaded frame.

### Weight

Ten full-size frames is ten times the download — keep the set under **~3 MB
total** or the hero will crawl on mobile. Consecutive frames of the same scene
compress far better as one animated file: if the loop is heavy, an **animated
WebP or APNG** saved as `hero-bg.png` plays natively with no JS and usually
lands a fraction of the size. The frame loop is there for when you have ten
separate exports.

### Changing the timing or frame count

`HERO_BG_FRAMES` and `HERO_BG_MS` at the top of the app script. Both feed
`heroFrameSrc()`, so bumping the count to 12 just means adding `hero-bg-11.png`
and `hero-bg-12.png`.

## Format

| | |
|---|---|
| **Format** | PNG (lossless — keeps pixel-art edges hard; JPG smears them) |
| **Size** | 1920×1080, identical across every frame. 16:9 matches the crop best |
| **Weight** | under ~500 KB for a still, ~300 KB/frame for a loop. Pixel art quantizes well — 32–64 colors is usually plenty |

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

Motion is respected: with the Tweaks panel's motion off, or with the visitor's
OS set to reduced motion, the loop holds on frame 1 instead of cycling.

## Changing the paths

`HERO_BG`, `HERO_BG_FRAMES`, `HERO_BG_MS` and `heroFrameSrc()` at the top of the
app script — the only place the paths appear now. They live inside the bundled
`index.html`; see the unbundle/rebundle note in `HANDOFF-v1.md`.

---

# Journey videos

Drop the intro video here and it shows in **The Journey** section on the home page.

- **Video:** `journey/hashtag-0.mp4` → served at `/media/journey/hashtag-0.mp4`
- **Poster (optional):** `journey/hashtag-0.jpg` — shown before the viewer hits play

Keep files under GitHub Pages' **100 MB / file** limit.
