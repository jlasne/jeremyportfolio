# Artwork

Put illustrations and images here, not in `brandmatchapp/assets`.

`npm run build` deletes `brandmatchapp/assets` and rebuilds it from the bundle,
so anything dropped there by hand is gone on the next build. Files in this
folder are imported by name, hashed by the bundler, and published with the app.

    import art from '../art/creator-cards.png'

- `creator-cards.png` — three outlined Instagram cards with a three-star badge.
  Used in the hero.
