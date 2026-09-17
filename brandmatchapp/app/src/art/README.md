# Artwork

Put illustrations here, not in `brandmatchapp/assets`.

`npm run build` deletes `brandmatchapp/assets` and rebuilds it from the bundle,
so anything dropped there by hand is gone on the next build. Files in this
folder are imported by name, hashed by the bundler, and published with the app.

    import art from '../art/creator-cards.png'

House style: flat vector on a #F0F0F1 ground, 4px black outlines, no fill,
rounded caps, and exactly one element in #FF5C2B. No text in the image.

| File | Where it shows |
| --- | --- |
| `creator-cards.png` | The hero, under the headline |
| `connect.png` | Connect your agent, beside the config block |
| `price-tag.png` | Pricing, above the price |
| `empty-tray.png` | Every empty list in the app |
