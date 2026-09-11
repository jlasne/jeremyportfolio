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
| `#/` | The landing: the promise, a 12 second animation from website to chart, the four things a lead carries, a comparison table, the two steps, the API, the volume picker with two ways to take it, six questions. Every call to action books a demo |
| `#/contacts` | The one list. A handle, the stars, the email, followers and engagement. One dropdown that picks a whole campaign or one agent inside it, plus more filters. The checkbox selects rows for a tag, done or reject in bulk |
| `#/campaign` | Leads a day over 7, 30 or 90 days, stacked by campaign, with the qualified share as a line on a right axis. Under it every campaign, each with its agents as a sublist you edit in place. Opening one shows its website, its audience, its agents and its delivery |
| `#/connect` | A coming soon popup over the blurred page. Behind it, one API that reads your leads and runs your campaigns, with the copy buttons off |
| `#/settings` | Billing, feedback, your account |
| `#/onboarding` | Set up your first campaign, then the first list over 8 seconds and straight into it |

A **campaign** is a group, and it starts from your website. We read it and
write the audience it should hunt for, in as many words as it takes, and you
edit any of it. A campaign holds one or more **agents**, and the agents are
what run. Each takes one angle on that audience and brings its own share of
leads a day. They show as a sublist under their campaign, on the campaigns
page and in the side nav, and you rename them, move their volume and pause
them from either place. Filters live on Contacts, so a campaign carries none.
Every contact carries the campaign that found it and the agent that brought
it in.

On Contacts the checkbox selects. Selecting opens a bar to tag, mark done or
reject in bulk. One dropdown filters the list at either level: a whole
campaign, or one agent inside it. Campaign ids start with `a` and agent ids
with `g`, so `#/contacts/a1` and `#/contacts/g2` both work and `scopeOf` in
`app/src/data/index.ts` reads which is which. Tags sit inside more filters
with a count each. Audience size,
engagement and posted are slide bars: audience size carries a from and a to on
the same scale, the other two carry one thumb each. Stars filter through a
slider for the total, plus a switch per criterion: niche, selling and signal
each off, meaning any, or on, meaning half a star and up.

**Qualified** means 0.5 stars or more. About 9 leads in 10 reach it. Each of niche, selling and signal is worth
one star, half when it half fits.

## Design

White ground, ink `#101014`, one accent: orange `#ff5c2b`. Same mood as
Gojiberry. The landing sits on a faint grid with one warm glow in the top
right corner, and stacks rounded slabs on it, each with its own colour: a
tinted comparison, an ink steps section, an orange call to action, an ink
footer. Corners run wide everywhere: 32px on a slab, 22px on a card, 14px on
an input, a full pill on a button. The mark is two circles overlapping in two
oranges, the overlap knocked out. The campaign colours in the chart, orange,
purple `#7c5cff`, green `#2aa17a` and gold `#e0a100`, pass the colourblind and
contrast checks and always sit next to a legend.

Unbounded for display, Satoshi for everything else, both lifted from
`brand/index.html` and bundled as woff2 so nothing loads from the network.

Volume, not price: the section leads with one slide bar, 100 to 1,000 leads a
day, and reads back the week, the month and how many of those come back
qualified. Under it, two ways to take that volume: every month, or a one off
30,000 lead pack. The cards show lead counts and carry no figure, since the
number is not decided.

**Connect is one API.** One base URL and one key read this morning's leads and
run the campaigns that fill them. No MCP server: the API covers both, and the
AI tools that would have used MCP read it the same way they read any API.

Works down to a phone, keyboard focus visible, reduced motion respected: the
hero animation holds on its final chart, the switches and the reading dots
stop moving.
