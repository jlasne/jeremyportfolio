# Artwork

Put illustrations here, not in `brandmatchapp/assets`.

`npm run build` deletes `brandmatchapp/assets` and rebuilds it from the bundle,
so anything dropped there by hand is gone on the next build. Files in this
folder are imported by name, hashed by the bundler, and published with the app.

    import art from '../art/stack.png'

## Grounds

A generated image arrives on a flat ground that is never the page's colour and
never quite flat. Every file here has had that ground stripped to transparency
so it sits on any surface, light or dark, with clean edges and its soft shadow
intact. Run this on a new one before importing it:

    node scripts/unmatte.mjs src/art/new-drawing.png

## House style

Flat vector, 4px outlines, no fill, rounded caps, one element in #FF5C2B, no
text in the image. Ask for a #F0F0F1 ground for a light placement and #1D1D1F
for a dark one; the script strips either.

## What is here

| File | Where it shows |
|---|---|
| `Sky.tsx` | The sunrise the landing hero cuts its word out of |

`Sky.tsx` replaced a 39 KB photograph of the same scene. The portal shows the
picture only through the letters of the word, and at rest that word is 63px
tall on a 900px viewport. A 7%-tall window onto a hazy photo is one flat
colour, so every letter came out the same and the word read as painted text.
Drawing it puts the sun, its haze rings and fourteen cloud bars in the band
the word crosses, which varies the letters across the line. Vector also keeps
the dive sharp at any zoom, and the page makes one request fewer.

Measure before changing its colours. The word has to stay readable against the
cream page, `#faf6ec`: across the band the drawing runs 2.72 contrast on open
sky down to 1.47 at the sun core.

A photograph is still the right answer anywhere the picture is seen whole.
Compress it the way `bg.webp` was: `sharp` at 1600px wide, WebP quality 90,
which took that one from 1.6 MB to 39 KB with no banding.

The pipeline above still stands. Drop a new drawing in, unmatte it, import it
by name, and add a row to the table.
