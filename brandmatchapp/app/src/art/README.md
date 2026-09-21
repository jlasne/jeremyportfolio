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
| `bg.webp` | The sunrise behind the nav and the hero, in `styles.css` |

`bg.webp` arrived as a 1.6 MB PNG and left as 39 KB: it is a smooth gradient
with no detail to lose, so `sharp` at 1600px wide and WebP quality 90 costs
nothing and bands nowhere. Any new photograph here gets the same treatment
before it is committed.

The pipeline above still stands. Drop a new drawing in, unmatte it, import it
by name, and add a row to the table.
