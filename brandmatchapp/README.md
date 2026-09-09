# brandmatch.app

A daily feed of Instagram creators for brands, ranked by stars.

The brand writes one sentence about who it wants. An agent crawls Instagram
every day, scores every profile, and delivers the list sorted best first.

**One score per creator, 0 to 3 stars in half steps.** Three criteria, one
star each, added up. A criterion that half fits pays half a star.

| Star | Full | Half |
| --- | --- | --- |
| Niche | Content and audience fit the brief | The right discipline, a different audience |
| Selling | Actively doing business, an own product on sale | A few collabs already done |
| Signal | A brand signal in the last 4 days | A brand signal in the last 10 days |

The stars sit in that fixed order, so the row shows which criteria fired, not
only how many. The three are independent: a creator selling with a fresh signal
scores 2 even outside the niche.

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
| `app/src/screens/` | Onboarding, Contacts, Agents |
| `app/src/components/` | Stars, Signal, the detail panel, the filter chips, the daily line |
| `app/src/data/score.ts` | The scoring rule, in one place |
| `app/src/lib/` | Formatting, CSV, hash router, placeholder images drawn on the device |

## Screens

Two screens. The nav sits on the left, full height, and collapses to a
scrolling bar across the top under 900px.

| Route | What it holds |
| --- | --- |
| `#/contacts` | The one list. Three controls above it: a stars slider with must-have criteria, agent chips that take several at once, and more Instagram filters with your tags inside. A row shows the picture, the name, the stars, the signal with its date, followers and engagement. Everything else lives behind the row, in the panel |
| `#/agents` | Qualified leads as columns and every lead as a smooth line over 14 days, per agent or all together, four counts, then who is running and who is paused. Clicking one opens its sentence, its filters, its delivery and how it scores |
| `#/onboarding/*` | One question, three follow ups, the filters, then the first batch over 8 seconds |

An **agent** is one saved search that runs every morning. It owns one sentence
about who to look for, its own filters, how many **qualified** leads a day it
should deliver and when. Qualified means 2 stars or more, and about 1 lead in
10 comes back qualified, so a target of 25 asks for 250 leads a day. Every lead
shows in the list, qualified or not. Every contact carries the agent that found it, and the chip
row on Contacts filters on it. Tags do the work saved lists used to do.

Filters are written as choices, not number boxes: audience size, engagement,
reel views, posts a month, when they last posted, email, 18 countries and 10
languages. Six presets set several at once, from `Micro and engaged` to
`Ready to contact`.

The chart on Agents runs two scales, columns on the right and the line on the
left, because qualified leads are about a tenth of the total. Each axis prints
its maximum in its own colour. Where the two marks cross means nothing.

Every count of qualified leads carries its total and its share, so `41` always
reads as `41 qualified of 400, 10%`.

## Mock data

40 creators in the fitness and nutrition niche: 4 at three stars, 12 from 2 to
2.5, 17 from 1 to 1.5, 7 under 1. 23 fit the niche and 11 half fit. 19 sell
their own product and 6 sell a download. 4 carry a strong fresh signal and 9 a
softer one. 5 first seen in the last 24
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
metric. A 216px nav on the left, white cards on warm paper with a 1px border
and a soft shadow, flat rows split by hairlines, and a detail panel that slides
over the list.

The stars and the dated signal are the only color in a row. Everything else is
grey text. The dashboard chart is one series in blue, checked against the
colorblind and contrast rules before shipping. Works down to a phone, keyboard
focus visible, reduced motion respected.
