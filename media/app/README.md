# App screenshots for the hero phone

Drop real screenshots in here and the phone on the landing page uses them
automatically. Nothing in `index.html` needs editing.

## What to drop in

| File | Which screen |
| --- | --- |
| `1.png` | first screen — currently the drawn home screen |
| `2.png` | second screen |
| `3.png` | third screen |
| `4.png` | fourth screen |

Any file you leave out keeps its drawn stand-in, so you can add one, or four,
or start with just `1.png`. There is no half-broken state: a missing file
removes its own `<img>` and the drawing underneath shows through.

## Format

| | |
| --- | --- |
| **Format** | PNG or WebP |
| **Ratio** | 9:19.5 — a straight iPhone screenshot is already this |
| **Size** | 1179×2556 (iPhone 15/16 Pro) is ideal; anything from 750px wide up is fine |
| **Weight** | keep each under ~400 KB, or the hero gets slow on 4G |

The image is drawn `cover`, anchored **top centre**, so the top of the
screenshot is always pinned and the bottom crops first if the ratio is off.

Include the status bar. The drawn notch hides itself as soon as a real
screenshot loads, because the screenshot brings its own.

## Getting the screenshots

- **iPhone:** press side button + volume up, then AirDrop them to the Mac
- **Simulator:** `xcrun simctl io booted screenshot 1.png`
- **App Store:** the listing images work too, but crop off any marketing
  frame or text first — this phone draws its own bezel

## Shrinking them

macOS, no extra tools:

```bash
sips -Z 1179 raw.png --out 1.png
```

Then commit and push. That is the whole job.
