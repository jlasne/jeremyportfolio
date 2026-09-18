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

| File | Where it shows |
| --- | --- |
| `stack.png` | The hero, beside the headline |
| `connect.png` | Connect your agent, beside the heading |
| `tests.png` | The dark tests band, beside the three tests |
| `price-tag.png` | Pricing, hung on the top of the card |
| `empty-tray.png` | Every empty list in the app |
| `creator-cards.png` | Held for the social preview image |
