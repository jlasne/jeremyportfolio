# jeremylasne.com/bio

One page over a snowy ridge that runs behind the whole site: a fifteen-day
daily log of five habits and sleep, then one number per training
discipline. Everyone reads it. One passphrase writes it.

## Stack

- **`index.html`** — the page, hand-written, no build step. Bebas Neue for
  headings and the big numbers, Inter for body, JetBrains Mono for labels,
  all from Google Fonts. The mountains are drawn at load and fixed behind
  the page: five ridgelines by midpoint displacement, each with a snow cap
  that fades out by altitude, the two far ranges blurred and hazed, film
  grain over everything. The page darkens the scene as it scrolls over it.
  Seeded, so it is the same mountain on every visit, and drawn for the
  viewport's own aspect ratio so a phone gets the peaks and the moon.
- **`spec.js`** — the single source of truth: the start date and length of
  the log, the five habits, the three tests and the ranges a number may
  take. The page imports it and so does the server
  ([`overlap/convex/bio.ts`](../overlap/convex/bio.ts)), so the two agree
  on which days exist and what a save may contain. `spec.d.ts` is its
  types for `tsc`.
- **Data** — one document in the Overlap Convex deployment (table `bio`),
  through the same `/overlap` door Founder City uses. Three operations:
  `bio.get`, `bio.unlock`, `bio.save`. The page renders the fallbacks from
  `spec.js` first and patches in what the server has.
- **Auth** — a passphrase, `BIO_PASSPHRASE` on the Convex deployment.
  *Edit* asks for it once per tab (kept in `sessionStorage`), opens the
  rows for today and past days plus the three numbers, and *Save* sends it
  along with the values. The server clamps every number, keeps only the
  days of the log up to today and only the known habits, whatever the page
  sent.

## Editing it

Copy lives in `spec.js`: the why-text under each habit, the note under each
number, units and steps. `start` is day 1 of the log; move it and the
fifteen rows move with it. Old days stay in the document and are ignored.

The log is one row per day. Every habit is open from day 1. Sleep is a
number per row, in hours. Rows after today are dimmed and locked; today and
the days before it are editable, so yesterday can be filled in.

The first numbers shown are the `fallback` values in `spec.js`, there so
the page never shows dashes. Replace them on the first *Save*.

## Deploy

The page ships with the main site: it lives at `/bio` on the
`jeremyportfolio` Vercel project, and Vercel serves the folder as is.

The server side needs one deploy and one setting:

1. `cd overlap && npx convex deploy` from a checkout that has this code.
2. In the Convex dashboard (Settings → Environment Variables) set
   `BIO_PASSPHRASE`. If `OVERLAP_ALLOW_ORIGIN` is set, list every origin
   the page is served from, comma-separated.

## Run locally

```bash
python -m http.server 8000
# → http://localhost:8000/bio/
```

Serve from the repository root: the page imports `/bio/spec.js` by
absolute path, the way Vercel serves it.
