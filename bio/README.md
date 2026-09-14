# jeremylasne.com/bio

October 2026, 31 days. Eighteen things measured every day, then a matrix of
what actually moved my recovery, resting heart rate and sleep. Everyone
reads it. One passphrase writes it.

## The shape of it

Nine things are tapped by hand, nine are read off the watch, the scale and
Yazio. The four things the body answers with (recovery, resting heart rate,
sleep, sleep score) are read **the morning after** the day that caused them,
because a night is what answers a day. A drink on Tuesday is scored against
Wednesday.

| Group | Fields |
| --- | --- |
| Tap as it happens | coffee, water, alcohol, showers |
| Tonight, 30 seconds | cold shower, gym, bath, sun, deep work |
| From the watch, each morning | sleep score, sleep, recovery, resting HR, HRV, steps, zone minutes, weight, eaten |

Under two minutes a day.

## Stack

- **`index.html`** — the page, hand-written, no build step. Bebas Neue for
  headings and the big numbers, Inter for body, JetBrains Mono for labels,
  all from Google Fonts. The background is `bg.jpg`, fixed, blurred and
  darkened by CSS, and the page darkens it further as it scrolls; without
  that file a gradient stands in.
- **`spec.js`** — the single source of truth: the field list, the ranges a
  number may take, what a save may contain, and the correlation itself. The
  page imports it and so does the server
  ([`overlap/convex/bio.ts`](../overlap/convex/bio.ts)), so the two agree on
  which fields exist and what a day may hold. `spec.d.ts` is its types for
  `tsc`.
- **Data** — one document in the Overlap Convex deployment (table `bio`, key
  `oct26`), through the same `/overlap` door Founder City uses. Three
  operations: `bio.get`, `bio.unlock`, `bio.save`.
- **Auth** — a passphrase, `BIO_PASSPHRASE` on the Convex deployment.
  *Log* asks for it once per device (kept in `localStorage`), then every tap
  saves itself about a second after the last change. There is no Save
  button. A failed save keeps the change on screen and retries.

## The matrix

A row is something I did, a column is what the body said the next morning.

- An on/off row (gym, cold shower) splits on itself. A counted row splits at
  its **own median** across the logged days, so "high coffee" means high for
  me, not against a table.
- The percent is how far the average moved between the two groups.
- The label is Cohen's *d*: how far apart the groups sit, measured in the
  spread of the days themselves. A big percent on a wild metric says less
  than a small one on a steady metric. Under 0.3 weak, 0.6 medium, 1.0
  strong, above that very strong.
- Colour follows meaning, not sign: a resting heart rate going **down** is
  green, because `better: 'low'` says so in `spec.js`.
- A cell needs 4 days on each side before it prints, and the whole matrix
  stays shut until 21 days carry both the taps and the body numbers. Under
  that a correlation is a coin toss wearing a percentage.

Rows are ordered by the loudest thing they say, so the strongest finding is
always the top line.

## Filling the body numbers

Typed each morning until the sync lands, then written by the sync and left
alone. Sleep takes `7:20`, `7h20`, `720` or `7.5` and stores minutes.

The sync is **not built yet**. The Fitbit Web API closed to new developer
registrations and is turned down in September 2026; its replacement is the
Google Health API, a cloud REST API registered through the Google Cloud
console. That work is separate from this page: the fields already exist, so
a sync only has to write them.

## Editing the copy

Everything readable lives in `spec.js`: field names, units, the line under
each group, and the ranges. Changing the month means changing `start` and
`end` there, and nothing else.

## Deploy

The page ships with the main site: it lives at `/bio` on the
`jeremyportfolio` Vercel project, and Vercel serves the folder as is.

The server side needs one deploy and one setting:

1. `cd overlap && npx convex deploy` from a checkout that has this code.
2. In the Convex dashboard (Settings → Environment Variables) set
   `BIO_PASSPHRASE`. If `OVERLAP_ALLOW_ORIGIN` is set, list every origin the
   page is served from, comma-separated.

The document key moved to `oct26` for this shape, so the habit log from
before it sits untouched under `v2` rather than being half-read as this one.

## Run locally

```bash
python -m http.server 8000
# → http://localhost:8000/bio/
```

Serve from the repository root: the page imports `/bio/spec.js` by absolute
path, the way Vercel serves it.
