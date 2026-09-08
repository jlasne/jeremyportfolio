# brandmatch.app

A daily feed of Instagram creators for brands, ranked by stars.

The brand writes one sentence about who it wants. We crawl Instagram every
day, score every profile, and deliver the list sorted best first. Two scores
per creator, 0 to 3 stars each: **Intent**, will this creator take a brand
deal now, and **Match**, does this audience fit the brand.

Same promise as Gojiberry, for creators instead of B2B buyers: stop scrolling
through a database, open the app and see who is ready today.

This folder is the front end prototype. Mock data only. No backend, no API
calls, no auth, no network requests. See `brandmatch-spec.md` for the product
spec this follows.

## Run

```bash
cd app
npm install
npm run dev
```

Opens on `http://localhost:5173`.

## Publish

The site has no build step, so the built app is committed at the folder root
and served straight from `jeremylasne.com/brandmatchapp`.

```bash
cd app
npm run build
```

That typechecks, builds, and copies `index.html` and `assets/` up one level,
replacing the previous build. Commit those two alongside the source. Paths in
the build are relative, so the folder works from any host or subpath.

## Where things live

| Path | What it is |
| --- | --- |
| `index.html`, `assets/` | The built app, committed, served by the site |
| `app/` | The source: Vite, React, TypeScript. Its own `npm install` |
| `app/src/mock/` | All mock data, one file per entity: creators, posts, lists, notes, tags, rejections, brief, filters, questions, settings. No data literal lives anywhere else |
| `app/src/data/index.ts` | The data functions every screen reads through: get the feed, get one creator, save, note, tag, reject, export, brief, filters, settings, first run. Swap the mock for the real source here and nothing else changes |
| `app/src/data/store.ts` | The one in memory state, seeded from the mock folder. Refresh resets it |
| `app/src/screens/` | Onboarding (3 steps and the first run), Feed, Saved lists, Settings |
| `app/src/components/` | Stars, Signal, the lead row, the detail panel, the filter form |
| `app/src/lib/` | Formatting, CSV, hash router, placeholder images drawn on the device |

## Screens

- `#/onboarding/who` one question, one text box
- `#/onboarding/details` three follow ups with chips and free text, all skippable
- `#/onboarding/filters` the filter bar
- `#/onboarding/running` the first batch, fake progress over 8 seconds, ends on the feed
- `#/feed` one list sorted by total stars, intent breaks ties. Click a row for the detail panel
- `#/lists` saved lists with notes and tags, one filled, one empty
- `#/settings` the brief, the filters, the timezone, restart onboarding

## Mock data

40 creators in the fitness and nutrition niche. 8 at three intent stars with a
dated signal in the last 30 days, 12 at two, 14 at one, 6 at zero. Match
scores spread across all four levels. 5 new today, 3 saved with a note and a
tag, 2 rejected. Followers from 12k to 840k, engagement from 0.4% to 9%. Half
with an email. Six countries: US, UK, Canada, Australia, France, Germany.

Dates are relative to the day the app runs, so "11 days ago" stays true.
Pictures and thumbnails are SVGs generated on the device instead of a
placeholder image service, so nothing fails offline.

## Design

Six colors: Ink `#17191F`, Paper `#F4F5F7`, Line `#E3E6EB`, Amber `#D98E04`
for intent stars, Teal `#0F8A7A` for match stars, Blue `#2657D9` for actions.
One typeface, Inter over the system stack, with tabular numerals for every
metric. A 48px top bar, one flat list of rows split by 1px lines, no cards,
and a detail panel that slides in from the right.

The stars and the dated signal are the only color in a row. Everything else
is grey text. Works down to a phone, keyboard focus visible, reduced motion
respected.
