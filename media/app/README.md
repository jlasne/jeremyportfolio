# App screenshots for the hero phone

The five screens in the hero phone are these files. Replace one and the page
shows the new one; nothing in `index.html` needs editing.

| File | Screen |
| --- | --- |
| `1.png` | Kaught welcome |
| `2.png` | your collection |
| `3.png` | identifying |
| `4.png` | animals near you |
| `5.png` | species detail |

Add more by adding a `<div class="scr">` and a dot in `index.html`; up to five
is wired already.

## Format

| | |
| --- | --- |
| **Format** | PNG, JPEG or WebP. The extension does not have to match the real format — browsers sniff it — but matching is tidier |
| **Ratio** | 9:19.5. A straight phone screenshot already is this |
| **Size** | 1080×2340 or 1179×2556 both work; anything from 750px wide up is fine |
| **Weight** | under ~400 KB each, or the hero gets slow on 4G |

## The bottom of the frame

The image is drawn 7% taller than the screen and pinned to the top, so the
phone's own navigation bar (the back/home/recents strip, ~6% of an Android
screenshot) falls off the bottom edge and the app fills the frame. The status
bar at the top is kept, and the drawn notch hides itself whenever a real
screenshot is present.

If you shoot on a device with no bottom bar, that 7% eats a sliver of real UI
instead. Change `height: 107%` on `.shot` back to `100%` if so.

## Missing files

A file that is not there removes its own `<img>` and leaves a dark screen
behind it, so a missing screenshot never breaks the layout.

## Shrinking them

macOS, no extra tools:

```bash
sips -Z 1179 raw.png --out 1.png
```
