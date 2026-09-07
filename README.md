# jeremylasne.com

I make mobile apps with influencers. A creator brings the audience, I bring
the whole build and run it, and we split what it earns. This repository is
the site behind that, plus everything else I keep in public.

The landing page is one screen: a portrait, one sentence, three lists.

- **Active projects.** [BrandMatch](https://brandmatch.app) is the offer
  itself: turn your audience into recurring revenue.
  [Kaught](https://kaught.app) names any wild animal with your camera.
  [TrustViews](https://trustviews.io) ranks verified sites on real traffic
- **Social.** YouTube ([@jerandmax](https://www.youtube.com/@jerandmax)),
  X ([@jeremylasne](https://x.com/jeremylasne)) and email
- **Personal.** Three private equity positions (SaaS health, H100
  datacenters, an astronomy blog), the Bio tracker and the brain

## Stack

Single hand-written `index.html`. No build step, no framework, no bundler.
Open it and edit it.

- System font stack, dark ink, one blue accent, and the greys of ice
  between. `/wealth` shares the palette, the ridge and the snow
- The ridge photo from `/bio` blurred behind everything; snow drawn on a
  canvas by `snow.js`; the wind looping from `media/wind.mp3` with one mute
  button top right. Mute once and it stays muted on the next visit
- Project logos are the real icons from each site, in `media/logos`
- Rows reveal on load; `prefers-reduced-motion` turns that off
- `og-image.png` is generated, not hand-drawn: render the hero at 1200×630
  and screenshot it. The source is not checked in, so redraw it to match if
  the copy changes

## Pages

| Path | What it is |
| --- | --- |
| `/` | the landing |
| `/wealth` | **Wealth Architecture** — *Era, Season, Compass*: a research note on holding money when the world order turns, the principles on one page, and the country map, thirty-two countries read three ways |
| `/overlap` | **Overlap** — landing page and live world clock |
| `/overlap/team` · `/plan` · `/next` | the app: the team, the meeting, and what to build next |
| `/foundercity` | **Founder City** — product metrics as a pixel skyline at night, one tower per app |
| `/bio` | **Bio** — a fifteen-day daily log of five habits and sleep, then one number per training discipline, live |
| `/brain` | **brain**: a self-tidying knowledge brain in plain markdown, open source. How it works, the folder it makes, the full skill file, and the repo link |

**Bio** keeps its numbers in the Overlap Convex deployment behind a
passphrase; see [`bio/README.md`](bio/README.md).

**Wealth Architecture** is one page, and deliberately not linked from the
landing: a different audience and a different voice. The note is set in
Source Serif and Instrument Serif over the same ridge and snow as the
landing; every figure is inline SVG, and the country map at the end is my
own reading of thirty-two countries, refreshed by hand.

**Overlap** is the one page here that is a product rather than a piece of
writing. Three steps — Team, Plan, Next — with the overlap drawn the
WorldTimeBuddy way: one row per person, hours running left to right, every
column the same instant on a different clock. It runs with no backend at all
(team in `localStorage`, shared by link); connecting Convex adds accounts,
teams and invite links. See [`overlap/README.md`](overlap/README.md).

**Founder City** draws product metrics as a skyline, scrolling left and
right and nothing else: the tallest tower always fills the screen. Height is
MRR on a power curve so a $40k app and a $400k app share one frame. The
building's size, floors times width, is active users, so the width is
whatever the audience needs at that height: a free app with a big crowd is a
wide low block, a premium app with a few hundred customers is a thin spire.
Lit windows are the subscribers among those users, with each floor keeping
its own mood so the lights come in bands. The dark floors at the top are
subscribers lost this month; a crane means the week was up; the crowd at the
door is free trials; the sign on the facade is the app's name and logo, its
colour lifetime revenue from white through cyan and amber to gold. Rank one
stands in the middle and the others alternate outward, so rank reads as
distance from downtown. A band along the top totals the city, a wire along
the bottom carries the latest activity. Everything static bakes once; per
frame the page moves cars, people, clouds, two searchlights and a few dozen
windows. Demo data lives in the `SEED` array at the top of the file; replace
it with a fetch to wire it to real accounts.

Founder City reads RevenueCat from the browser: RevenueCat's API answers
cross-origin requests from this domain, so "Break ground" makes one call to
the overview metrics endpoint with the founder's own key and project id and
keeps the six numbers. The tower and the key then go to the Overlap Convex
deployment (`overlap/convex/city.ts`, table `towers`, ops `city.towers` and
`city.breakGround` on the same `/overlap` door); a cron re-reads every tower
at 04:00 UTC and keeps thirty days of history, and the key never leaves the
server. If the door cannot be reached the tower stays in that browser's
storage. Deploy with
`cd overlap && npx convex deploy`.

## Run locally

Open `index.html` in a browser, or:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Deploy

Static. Drop the folder on any host — GitHub Pages, Vercel, Netlify, Cloudflare
Pages.
