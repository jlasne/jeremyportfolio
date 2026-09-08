# brandmatch.app

A daily feed of Instagram creators for brands, ranked by stars.

The brand writes one sentence about who it wants. An agent crawls Instagram
every day, scores every profile, and delivers the list sorted best first.

**One score per creator, 0 to 3 stars. One star each, added up.**

| Star | Earned when |
| --- | --- |
| Niche | Content and audience fit the brief |
| Selling | Sells a program, coaching, an ebook or an app |
| Signal | A brand signal fired in the last 30 days |

The three are independent. A creator selling with a fresh signal scores 2 even
outside the niche. Each row shows which stars it earned.

The rule lives in one file, `app/src/data/score.ts`. Change it there and every
screen follows. `brandmatch-spec.md` still describes the two score version it
was written with.

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

Opens on `http://localhost:5173/brandmatchapp/`.

## Publish

The site has no build step, so the built app is committed at the folder root
and served straight from `jeremylasne.com/brandmatchapp`.

```bash
cd app
npm run build
```

That typechecks, builds, and copies `index.html` and `assets/` up one level,
replacing the previous build. Commit those two alongside the source.

The build hard codes `/brandmatchapp/` in its asset paths, set by `base` in
`app/vite.config.ts`. Vercel answers `/brandmatchapp` with the index and adds
no trailing slash, so relative paths would resolve one level too high and
return 404. Serving this app from another path means changing `base` first.

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

The nav sits on the right edge, full height, and is the only navigation: the
section you are in opens to list what it holds, so every screen runs full
width. Under 900px it collapses to a scrolling bar across the top.

| Route | What it holds |
| --- | --- |
| `#/dashboard` | Leads today, high leads at 2 or 3 stars, leads in total, 14 days of leads gathered per day, how many leads earned each star, and a row per agent |
| `#/feed` | One list, best first. Click a row for the detail panel |
| `#/groups` | Leads grouped by the agent that found them |
| `#/contacts` | Every lead with an email, filtered by stars and tags, tags assigned inline |
| `#/agents` | One agent per saved search: name, brief, filters, leads a day, run time, pause, delete |
| `#/lists` | Saved lists with notes and tags, one filled, one empty |
| `#/settings` | The brief, the filters, the tag list, how the score works, the timezone |
| `#/onboarding/who` | One question, one text box |
| `#/onboarding/details` | Three follow ups with chips and free text, all skippable |
| `#/onboarding/filters` | The filter bar |
| `#/onboarding/running` | The first batch, progress over 8 seconds, ends on the feed |

An **agent** is one saved search that runs every morning. It owns a brief, its
own filters, and how many leads a day it should deliver. Every lead carries the
agent that found it, which is what Groups reads.

## Mock data

40 creators in the fitness and nutrition niche: 8 at three stars, 14 at two,
14 at one, 4 at zero. 32 fit the niche, 25 sell something, 9 carry a signal
from the last 30 days. 5 first seen in the last 24
hours, 3 saved with a note and a tag, 2 rejected. 22 carry an email. Followers
from 12k to 840k, engagement from 0.8% to 9%. Six countries: US, UK, Canada,
Australia, France, Germany. Three agents, one of them paused, plus 14 days of
crawl output for the dashboard.

The score is computed, never stored. Each creator carries three facts: does it
fit the brief, what does it sell, and what signals fired with what date.

Dates are relative to the day the app runs, so "11 days ago" stays true.
Pictures and thumbnails are SVGs generated on the device instead of a
placeholder image service, so nothing fails offline.

## Design

Five colors: Ink `#1A1A17`, warm Paper `#F7F6F3`, Line `#E9E6E0`, Amber
`#C8860D` on the stars, Blue `#2F5BD6` on links and the chart.
One typeface, Inter over the system stack, with tabular numerals for every
metric. A 216px nav on the right, white cards on warm paper with a 1px border
and a soft shadow, flat rows split by hairlines, and a detail panel that slides
over the list.

The stars and the dated signal are the only color in a row. Everything else is
grey text. The dashboard chart is one series in blue, checked against the
colorblind and contrast rules before shipping. Works down to a phone, keyboard
focus visible, reduced motion respected.
