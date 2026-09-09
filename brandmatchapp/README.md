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
| `app/src/screens/` | Landing, Onboarding, Contacts, Agents |
| `app/src/components/` | Stars, Signal, the detail panel, the filter chips, the daily line |
| `app/src/data/score.ts` | The scoring rule, in one place |
| `app/src/lib/` | Formatting, CSV, hash router, placeholder images drawn on the device |

## Screens

A landing page, one onboarding step, and two app screens. In the app the nav
sits on the left, full height, and collapses to a scrolling bar across the
top under 900px.

| Route | What it holds |
| --- | --- |
| `#/` | The landing: the promise, the app in a frame, why it beats a database, three steps, connecting your AI, two plans, four questions |
| `#/contacts` | The one list. A handle, the stars, the email, followers and engagement. Two dropdowns, agent and tag, plus more filters. Tick a row to mark it done and it leaves the list |
| `#/agent` | Leads a day over 14 days, then the agents. Clicking one opens its sentence, its filters and its delivery |
| `#/connect` | MCP and API. An address, a key, one example each, and what an AI can ask for |
| `#/settings` | Timezone, tags, what counts as qualified, your account, start over |
| `#/onboarding` | Set up your first agent, then the first list over 8 seconds and straight into it |

An **agent** is one saved sentence plus filters that runs every morning. It owns
how many leads a day it delivers. Every contact carries the agent that found it.

**Qualified** means above 1.5 stars. Each of niche, selling and signal is worth
one star, half when it half fits.

## Design

The app is light and the landing is dark, both on the CreatorMatch system:
navy `#070a12`, off white `#f2f3f7`, hairline rules at 10% white, translucent
cards at 4.5% white, no shadows, and a grain overlay. Unbounded for display,
Satoshi for everything else, both lifted from `brand/index.html` and bundled as
woff2 so nothing loads from the network.

The mark is two circles overlapping with the middle knocked out. The overlap is
the match, and it sits beside the CreatorMatch circle and square as a sibling.

The landing carries no invented prices. The monthly plan sets a daily volume,
the one off pack is 1,000 creators at 50% more per creator. Real numbers go in
when they are decided.

Works down to a phone, keyboard focus visible, reduced motion respected: the
rolling hero number and the grain both stop.
