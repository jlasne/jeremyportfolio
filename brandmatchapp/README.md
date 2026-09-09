# brandmatch.app

A daily feed of Instagram creators for brands, ranked by stars.

The brand enters its website. A campaign, run by one or more agents, crawls
Instagram every day, scores every profile, and delivers the list sorted best
first.

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
| `app/src/mock/` | All mock data, one file per entity: creators, posts, campaigns, daily counts over 90 days, notes, tags, rejections, filters, settings. No data literal lives anywhere else |
| `app/src/data/index.ts` | The data functions every screen reads through: contacts, one creator, note, tag, reject, export, campaigns and their agents, daily rows, settings, first run. Swap the mock for the real source here and nothing else changes |
| `app/src/data/store.ts` | The one in memory state, seeded from the mock folder. Refresh resets it |
| `app/src/screens/` | Landing, Onboarding, Contacts, Campaign, Connect, Settings |
| `app/src/components/` | Stars, Signal, the detail panel, the filter chips, the stacked daily chart, the hero animation |
| `app/src/data/score.ts` | The scoring rule, in one place |
| `app/src/lib/` | Formatting, CSV, hash router, placeholder images drawn on the device |

## Screens

A landing page, one onboarding step, and two app screens. In the app the nav
sits on the left, full height, and collapses to a scrolling bar across the
top under 900px.

| Route | What it holds |
| --- | --- |
| `#/` | The landing: the promise, a 12 second animation from website to chart, a comparison table, the two steps, MCP and the API, two plans, six questions |
| `#/contacts` | The one list. A handle, the stars, the email, followers and engagement. Two dropdowns, campaign and tag, plus more filters. The checkbox selects rows for a tag, done or reject in bulk |
| `#/campaign` | Leads a day over 7, 30 or 90 days, stacked by campaign with the total as a line, then the campaigns. Clicking one opens its website, its audience, its agents and its delivery |
| `#/connect` | A coming soon popup over the blurred page. Behind it, MCP to get your leads and the API to manage your campaigns, with the copy buttons off |
| `#/settings` | Billing, feedback, your account |
| `#/onboarding` | Set up your first campaign, then the first list over 8 seconds and straight into it |

A **campaign** starts from your website. We read it and write the audience it
should hunt for, in as many words as it takes, and you edit any of it. A
campaign holds one or more **agents**. Each agent takes one angle on that
audience and brings its own share of leads a day. Filters live on Contacts, so
a campaign carries none. Every contact carries the campaign that found it.

On Contacts the checkbox selects. Selecting opens a bar to tag, mark done or
reject in bulk. Campaign and tag filter through dropdowns. Stars filter through a
slider for the total, plus a minimum per criterion: niche, selling and signal
each set to any, half or full.

**Qualified** means 0.5 stars or more. About 9 leads in 10 reach it. Each of niche, selling and signal is worth
one star, half when it half fits.

## Design

Broken white ground `#fbf9f7`, ink `#1b1420`, and two accents: orange
`#f2662a` and purple `#7c5cff`. The landing stacks them as flat slabs: an
orange hero, a purple steps section, an orange call to action and an ink
footer. No gradients anywhere. The mark is two circles overlapping, orange and
purple, with the middle knocked out. The campaign colours, orange, purple,
green `#2aa17a` and gold `#e0a100`, pass the colourblind and contrast checks
and always sit next to a legend.

Unbounded for display, Satoshi for everything else, both lifted from
`brand/index.html` and bundled as woff2 so nothing loads from the network.

Pricing: a monthly plan at 100 to 1,000 leads a day, or a one off 30,000 lead
pack at the same price with no renewal. The cards show lead counts and carry no
figure, since the number is not decided.

Works down to a phone, keyboard focus visible, reduced motion respected: the
hero animation holds on its final chart, the grain and the reading dots stop.
