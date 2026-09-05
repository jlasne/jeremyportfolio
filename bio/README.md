# jeremylasne.com/bio

One page over a snowy ridge that runs behind the whole site: a daily log,
one line a day, newest day on top. Five habits and sleep, then every
training session, with the best result per discipline on top. Everyone
reads it. One passphrase writes it.

## Stack

- **`index.html`** — the page, hand-written, no build step. Bebas Neue for
  headings and the big numbers, Inter for body, JetBrains Mono for labels,
  all from Google Fonts. The background is `bg.jpg`, fixed behind the page,
  blurred and darkened by CSS, and the page darkens it further as it
  scrolls. Until that file exists the page draws its own ridge instead:
  five ridgelines by midpoint displacement with snow caps, seeded, so it is
  the same mountain on every visit.
- **`spec.js`** — the single source of truth: the five habits, the three
  tests with their targets, and the ranges a number may take. The page imports it and so does the server
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
  along with the whole log. The server clamps every number, keeps only days
  up to today and only the known habits, whatever the page sent.

## Editing it

Copy lives in `spec.js`: the why-text under each habit, the note under each
number, units, steps and targets.

Both logs are one row per day, today first, back to the first logged day.
Health: five checks and hours slept. Performance: a free line for the
session ("Rest" counts), and when a test was done, which one and its
result. One test a day at most. Fourteen rows show; older days
sit behind *Earlier days*. Every row shown is editable, so yesterday can be
filled in. A new log shows today and yesterday.

The background photo is `bg.jpg` in this folder. Any landscape works; the
page blurs it 16px and takes it down to 45% brightness, so a bright photo
is fine.

The three cards show the best result in the log and the number of sessions
it came from, with the curve of every result under it, the target as a
hairline. Before the first session they show the `target` from
`spec.js`, labelled as such, so the page never shows dashes.

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
