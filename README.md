# jeremylasne.com

I build mobile apps with influencers. A creator brings the audience, I bring
the whole build and run it, and we split what it earns. This repository is
the site behind that, plus everything else I keep in public.

The landing page: a portrait, a name, social icons, CreatorMatch with our
work as a row of phones under it, then three personal projects as app icons.
Everything sits straight on the ridge, with no panels.

- **Socials.** YouTube [@jeremyfounder](https://www.youtube.com/@jeremyfounder),
  X [@jeremylasne](https://x.com/jeremylasne), Instagram
  [@creatormatch.app](https://www.instagram.com/creatormatch.app/) and email,
  as four icons under the name. The email icons also copy the address
- **CreatorMatch.** One centred line, no fill: the logo,
  [CreatorMatch](https://creatormatch.app) and "I build mobile apps with influencers"
- **Our work.** Under it, full width, one phone per page of
  [creatormatch.app/work](https://www.creatormatch.app/work/): 11 apps made for
  11 wellness creators. The phone in the middle is the largest; each step away
  it gets smaller and fainter. A click on a side phone, a swipe, a sideways
  trackpad scroll, the arrow keys or the two buttons bring the next one to the
  middle, round and round. A click on the middle phone opens its page. Under
  the phones: the two arrows, no caption
- **Autoplay.** Every phone in sight plays its page scrolling by itself, muted
  and looping, eased in and out, on phones too. The deck rests when it leaves
  the screen, and a visitor who asks for less motion keeps the stills
- **Re-recording.** The videos and stills in `media/apps` are made by `media/apps/record.mjs`
  (`NODE_PATH=$(npm root -g) node media/apps/record.mjs [hannaheden] [dana] ...`, no name
  records all 11). It needs playwright and ffmpeg. Run it again when a page changes, and add
  the slug to `SLUGS` and a phone to `index.html` when /work gets a new page. It opens the
  page at 390 x 844, like an iPhone, photographs it frame by frame, then speeds the video up
  where the page barely moves while the scroll goes on (up to 24x), so the recording never
  seems to stop. Each video is a loop whose end melts into its start, about 0.8 to 1.2 MB, and
  loads only when its phone comes into sight
- **Personal projects.** Three app icons, each with a halo in its own colour,
  the name, one line and the address: [Wellness](/wellness/), experiments on
  myself to feel alive (its icon is the ridge with a pulse line);
  [tasu](https://tasu.ai), my homemade AI interface;
  [Kaught](https://kaught.app), the animal identifier, with a Live badge. One
  under the other on phones, three across from 560px. A hover lifts the icon

## Stack

Single hand-written `index.html`. No build step, no framework, no bundler.
Open it and edit it.

- System font stack, dark ink, one blue accent, and the greys of ice
  between. `/wealth` shares the palette, the ridge and the snow
- The ridge photo (`wellness/bg.jpg`) blurred behind everything (9.5px); snow drawn on a
  canvas by `snow.js`; the wind looping from `media/wind.mp3` with one mute
  button top right. Mute once and it stays muted on the next visit
- The CreatorMatch, tasu (`tasu.svg`, the same file as tasu.ai/brand/tasu.svg) and Kaught logos are in `media/logos`. The CreatorMatch one is the same file as `favicon.svg` in [jlasne/creatormatch](https://github.com/jlasne/creatormatch). The still under each video is in `media/apps`: the first frame of its recording
- Rows reveal on load; `prefers-reduced-motion` turns that off
- `og-image.png` is generated, not hand-drawn: render the hero at 1200×630
  and screenshot it. The source is not checked in, so redraw it to match if
  the copy changes

## Pages

| Path | What it is |
| --- | --- |
| `/` | the landing |
| `/wealth` | **Wealth Layers** · map your wealth in three layers: a cash pillow held by you, one liquid fat layer in one broker, then the investments outside the strategy, with debts linked to an asset or to you. The map is the page: one bubble per holding, area = value, no arrows. The income each bet pays shows as a blue moon with its yield. With nothing selected the map takes the full width; tapping a bubble opens its panel beside it. Edit mode is the table. Dragging a bubble onto another layer simulates a sale or a move; a simulation bar shows net worth, fat layer share, debt, income and the largest country before and after, and nothing changes until it is applied. Tap the fat layer to open it: its lines as bubbles with dashed plan rings, colored by asset class or fragility, the four portfolio checks, a rebalance plan that uses new money first (no sale, no tax) or the fewest switches, Gave's square read per line in its own country, a fragility axis, movement against danger, and the correlation map. The crash ladder picks any country, region, continent or bloc you hold, plus energy and war, and shows the loss in money and in % of net worth, layer by layer, at an adjustable drop. Asset and country data read 2 Oct 2026; ECB rates of 14 Oct 2026; numbers stay in the browser with a copy and paste backup. Same palette, ridge and snow as the landing; D3 from cdnjs for the map. Not linked from the landing |
| `/wellness` | **Wellness · Phase 0, normal** · my sleep and my sport, logged every day before any habit is tested. Starts from the Exp 0 nights and sessions of October, so normal has data from day one. **Night by night**: last night's **night score** as one big number (0 to 100: the average of sleep score, HRV, RHR, readiness and time asleep, each set against the last 30 days, 100 being the best of the month), then the night score of the last 30 nights as thin blocks, with the sport of the day before under each column. **Sport by day**: the load of each day (each session's minutes times its effort, all sports added up), stacked by sport. Effort mixes the average and peak heart rate against the highest heart rate logged so far with the effort level felt (1 to 5), weighted by the session's target (cardio, speed or strength). Then each sport's 30-day load, effort and form (runs scaled to 5 km, lifts as an estimated 1RM; swims are training sessions, with no form). The full sport log is on the details page. **After sport, or not**: the average night after a session against after a rest day, in two columns. The **Log** button top left opens the log over the page; one passphrase writes. The log also keeps **my max**: the most I did, typed by hand, each with a name and any of reps, weight, metres, speed and time, picked per max and editable any time (table `maxes`). Once unlocked, the log exports every day as a CSV (one row per session, the night beside it). A day the server cannot take (offline) is kept on the device and sent up the next time it answers. A pixel mountain on top, drawn at 2 CSS px per pixel, whose sky follows last night. DotGothic16 for the pixel type. Rules in `wellness/spec.js`, data and the scores in `wellness/data.js`, charts in `wellness/charts.js`, styles in `wellness/wellness.css`; days in the `days` table of wellness-api. Linked from the landing's personal projects |
| `/wellness/details` | **Details** · each measure (night score, sleep score, HRV, RHR, readiness, time asleep, bedtime, wake-up): last night, the last 7 nights, normal, best and worst of 30 days. Then one measure at a time night by night, and the last 30 nights from bed to wake, each with its times, hours asleep and night score. Last, the full sport log: my max (name, day and numbers, newest first), a calendar of the days and every session with its measure, effort and form |
| `/wellness/exp0` | **Exp 0 · Learn and get better** · October 2026, 31 days: intake, sport, sleep and the watch logged daily, then two grids of what moved recovery, sleep, weight, HRV and resting HR. `/bio` redirects here. Not linked from the landing |
| `/brandmatchapp` | **brandmatch** · a daily feed of Instagram creators ready for a brand deal, ranked by intent and match stars, live at [brandmatch.app](https://brandmatch.app). Apify crawls the profiles, OpenRouter reads them against the brief, and Convex holds a creator pool shared across every campaign. A second Vercel project builds this repo with `brandmatchapp` as its root directory, so the folder stays here even though nothing on the landing links to it. The source is Vite and React under `brandmatchapp/app`; `npm run build` there commits the built app to the folder that project serves. See [`brandmatchapp/README.md`](brandmatchapp/README.md) |

**Exp 0** keeps its numbers in the wellness-api Convex deployment behind a
passphrase; see [`wellness/exp0/README.md`](wellness/exp0/README.md).

## Run locally

Open `index.html` in a browser, or:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Deploy

Static. Drop the folder on any host — GitHub Pages, Vercel, Netlify, Cloudflare
Pages.
