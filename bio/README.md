# /bio

One page over a moonlit ridge, at [jeremylasne.com/bio](https://www.jeremylasne.com/bio):
three training numbers and a fifteen-day habit ramp. Everyone reads it.
One passphrase writes it.

## Stack

- **`index.html`** — the page, hand-written, no build step. Bebas Neue for
  headings and the big numbers, Inter for body, JetBrains Mono for labels
  and units, all from Google Fonts. The mountains are drawn at load: four
  ridgelines by midpoint displacement, each blurred a little less than the
  one behind it, under a moon. Seeded, so it is the same mountain on every
  visit, and drawn for the hero's own aspect ratio, so a phone gets the
  peaks and the moon rather than the middle of a widescreen crop.
- **`spec.js`** — the single source of truth: the three exercises, the
  habits and the day each unlocks, the start date, the ranges a number may
  take. The page imports it and so does the server
  ([`overlap/convex/bio.ts`](../overlap/convex/bio.ts)), so the unlock rule
  cannot drift between the two. `spec.d.ts` is its types for `tsc`.
- **Data** — one document in the Overlap Convex deployment (table `bio`),
  through the same `/overlap` door Founder City uses. Three operations:
  `bio.get`, `bio.unlock`, `bio.save`. The page renders the fallbacks from
  `spec.js` first and patches in what the server has, so it reads even
  when the server does not answer.
- **Auth** — a passphrase, `BIO_PASSPHRASE` on the Convex deployment.
  *Edit* asks for it once per tab (kept in `sessionStorage`), unlocks the
  inputs and the checkboxes of the habits that are open today, and *Save*
  sends it along with the values. The server clamps every number, drops
  unknown habits and switches off any habit still locked on its own
  calendar, whatever the page sent.

## Editing it

Everything that is copy lives in `spec.js`: the notes under each number,
the why-text under each habit, the unit and step of each input. `start` is
day 1 of the ramp; move it and the whole clock moves. `rampDays` is 15 and
after it the badge reads *Full rhythm* for good.

Habit checks belong to the day they were saved on: open the page on a new
day and they start blank. Sleep and the three performance numbers persist
until the next save.

The first numbers shown are the `fallback` values in `spec.js`, there so the
page never shows dashes. Replace them with real ones on the first *Save*.

## Deploy

The page is part of the main site: push to `main` and Vercel serves it at
`/bio` with everything else. Saving needs the Convex side once:
`cd overlap && npx convex deploy`, then in the dashboard (Settings →
Environment Variables) set `BIO_PASSPHRASE`. If `OVERLAP_ALLOW_ORIGIN` is
set, it can be a comma-separated list, e.g.
`https://www.jeremylasne.com,https://jeremylasne.com`.

## Run locally

From the repository root, so `/bio/spec.js` resolves:

```bash
python -m http.server 8000
# → http://localhost:8000/bio/
```

The page is an ES module and imports `spec.js`, so it needs a server; a
`file://` open shows the hero and nothing under it.
