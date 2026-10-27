# jeremylasne.com

I make mobile apps with wellness content creators. A creator brings the
audience and the content, I build, launch, run and grow the app, and we split
what it earns. This repository is the site behind that, plus everything else I
keep in public.

The site is four pages, after [daoho.dev](https://www.daoho.dev/): an ocean
of sharks and narwhals drawn in characters behind them, a nav on top, and the
projects one under the other.

- **Sized like a native app.** On a phone (under 760px): a top bar with my
  face and name and the theme switch, frosted once the page scrolls, and a tab
  bar at the bottom with the four pages (an icon and a word each, the page you
  are on in blue), 44px touch targets and the safe areas of the notch and the
  home indicator. On a computer: the nav centred on top, lowercase, and the
  text, the column (up to 1320px) and the ocean grow with the screen up to a
  2560px display. The nav and the tabs are written out in each page's HTML:
  change them in all four
- **`/` · home.** The whole screen: "Hey, I'm (my face in a bubble) Jeremy
  Lasne.", then three short paragraphs, CreatorMatch the only word in colour
  and the only link (creatormatch.app), a blinking caret, then x / youtube /
  hey@jeremylasne.com. The email links also copy the address. The old anchors
  (`/#creators`, `/#apps`, `/#personal`) send to the new pages
- **`/creators` · Wellness creators.** Written as me: what CreatorMatch is and
  what I do, then one phone per page of
  [creatormatch.app/work](https://www.creatormatch.app/work/), each with the
  app's name, the creator and one number. 2 across on phones, 3 from 640px, 4
  from 960px. Then the email, creatormatch.app and Instagram
  [@creatormatch.app](https://www.instagram.com/creatormatch.app/)
- **`/apps` · Mobile apps** (the founder journey, on X now and YouTube next).
  [Kaught](https://kaught.app), live, its logo on the card and by its name, its
  15-second reel playing in the card, then a "My stack · coming soon" box
- **`/personal` · Personal.** Holds on one screen, phone or computer, no
  scroll: [Wellness](/wellness/), [tasu](https://tasu.ai) (open source) and
  [wimi](https://www.claudeportfolio.com/) (World-Investment Management
  Intelligence), each a small preview, its icon, name, tag and one tagline.
  Three across on a computer, one under the other on a phone
- **A project** on /apps is a preview card, then its name, a tag, one line and
  a button to it
- **Videos** play muted and looping while they are on screen, rest once they
  leave, and load only when first seen; a visitor who asks for less motion
  keeps the stills (`site.js`)
- **Re-recording the work.** The videos and stills in `media/apps` are made by `media/apps/record.mjs`
  (`NODE_PATH=$(npm root -g) node media/apps/record.mjs [hannaheden] [dana] ...`, no name
  records all 11). It needs playwright and ffmpeg. Run it again when a page changes, and add
  the slug to `SLUGS` and a phone to `creators/index.html` when /work gets a new page. It opens the
  page at 390 x 844, like an iPhone, photographs it frame by frame, then speeds the video up
  where the page barely moves while the scroll goes on (up to 24x), so the recording never
  seems to stop. Each video is a loop whose end melts into its start, about 0.8 to 1.2 MB, and
  loads only when its phone comes into sight
- **The Kaught reel** (`media/apps/kaught.mp4`, 1.6 MB) is `assets/reel/reel.mp4` of
  [storinox/kaught-landing](https://github.com/storinox/kaught-landing) at 1280 x 720, 30 fps,
  no sound (`ffmpeg -i reel.mp4 -an -vf "scale=1280:-2,fps=30" -c:v libx264 -crf 28 -preset slow
  -pix_fmt yuv420p -movflags +faststart kaught.mp4`); `kaught.webp` is its frame at 7.4 s
- **Previews** in `media/previews` are screenshots of the live sites (1280 x 800 at 2x),
  saved as WebP at quality 74: about 145 KB for the three. Take them again when a site
  changes; `wimi.svg` in `media/logos` is the favicon of claudeportfolio.com

## The ocean

`ocean.js`, one canvas fixed behind the page. 4 animals on a computer (2
sharks, one a hammerhead, and 2 narwhals), 3 on a phone, seen from above and
laid every frame on a grid of square cells that grows with the screen (10px
on a phone, 14px at 1440px, 18px from 1840px), 30 frames a second. The
animals grow too, up to 1.5 times their size on a 2560px display. It runs
behind `/wellness` and `/wellness/details` as well.

- Each animal is a spine of 24 points that follows its head, so the body bends
  along its path; a wave runs down to the tail (the narwhal barely sways, its
  flukes beat instead). Body widths and fins are tables in `KINDS`
- A body cell gets a fill and a character that stays with the body: the
  narwhal's spots, the shark's gills and the blue ridge down its back. Fins are
  strokes (- \ | /) in the direction they point; the narwhal's tusk is ivory
  with its spiral in strokes; the eyes are an "o"
- Sharks come to the cursor and circle it; narwhals swim off. A tap on the
  water sends a ripple and scatters whoever is near
- Text marked `data-ocean` fades the cells under it; `data-ocean="avoid"` also
  steers the animals away (the home text and each page's heading)
- The animals cross from one page to the next: their places are kept for the
  tab on the way out and picked up by the next page, which also crossfades in
  browsers that can
- Dark by default, light on a click, remembered; the page fires `themechange`
  and the ocean takes the theme's colours. Less motion: one still frame

## Stack

Hand-written HTML, one page per folder (`index.html`, `creators/`, `apps/`,
`personal/`), with `site.css`, `site.js` and `ocean.js` shared. No build step,
no framework, no bundler. Open it and edit it.

- Geist Mono from Google Fonts for everything, dark ink, one blue accent, the
  greys of ice between, and CreatorMatch's green. `/wellness` keeps its system
  font and takes the ocean as its background; the ridge photo stays for
  `/wellness/exp0` only
- The CreatorMatch, tasu, Kaught and wimi logos are in `media/logos`, with my face in `media/avatar.webp`
- `og-image.png` is generated, not hand-drawn: the home page rendered at
  1200×630 with larger text and screenshotted. The source is not checked in,
  so redraw it to match if the copy changes, and bump `?v=` in the meta tags

## Pages

| Path | What it is |
| --- | --- |
| `/` | home, the whole screen (see above) |
| `/creators` | Wellness creators: CreatorMatch and the 11 apps |
| `/apps` | Mobile apps: Kaught and the stack to come |
| `/personal` | Personal: Wellness, tasu, wimi, on one screen |
| `/wealth` | **Moved** to [claudeportfolio.com/wealth](https://www.claudeportfolio.com/wealth). `/wealth` and every path under it redirect there (308, `vercel.json`, before the filesystem). Numbers saved in the browser here cannot cross domains: the old page and its backup tool are gone, so they stay in that browser's storage for jeremylasne.com |
| `/wellness` | **Wellness · Phase 0, normal** · my sleep and my sport, logged every day before any habit is tested. Starts from the Exp 0 nights and sessions of October, so normal has data from day one. **Night by night**: last night's **night score** as one big number (0 to 100: the average of sleep score, HRV, RHR, readiness and time asleep, each set against the last 30 days, 100 being the best of the month), then the night score of the last 30 nights as thin blocks, with the sport of the day before under each column. **Sport by day**: the load of each day (each session's minutes times its effort, all sports added up), stacked by sport. Effort mixes the average and peak heart rate as a share of the heart rate reserve (from the normal resting heart rate of the nights to the highest logged so far) with the effort level felt (1 to 5), weighted by the session's target (cardio 50/20/30, speed 20/50/30, strength 20/20/60). Then each sport's 30-day load, effort and form (runs scaled to 5 km, Gym exercises as an estimated 1RM each; swims are training sessions, with no form). The full sport log is on the details page. **What changes my nights**: the average night after a rest day, after a sport day, with my girlfriend, and cold and dark (window open all night, shutters closed), in four columns. The **Log** button top left opens the log in a panel centred over the page, nearly full screen on a phone with its title and close button kept in sight; one passphrase writes. Each night has two toggles in the log: with my girlfriend (`gf`) and cold and dark (`cold`). A Gym session holds any exercises, each with a name, reps and weight. Once unlocked, the log exports every day as a CSV (one row per session, the night beside it). A day the server cannot take (offline) is kept on the device and sent up the next time it answers. Its look: the ocean of the landing behind everything (the animals fade under each section), the system font, round buttons and chips, and rounded bars in the charts. Rules in `wellness/spec.js`, data and the scores in `wellness/data.js`, charts in `wellness/charts.js`, styles in `wellness/wellness.css`; days in the `days` table of wellness-api. Linked from /personal. A new field such as `cold` needs `cd wellness-api && npx convex deploy`; until then the page keeps those days on the device and sends them up once the server knows the field |
| `/wellness/details` | **Details** · each measure (night score, sleep score, HRV, RHR, readiness, time asleep, bedtime, wake-up): last night, the last 7 nights, normal, best and worst of 30 days. Then one measure at a time night by night, and the last 30 nights from bed to wake, each with its times, hours asleep and night score. Last, the full sport log: my max (the heaviest weight of each Gym exercise with its reps, and the fastest 1, 5 and 10 km from runs at least that long at their average pace, each with its day, found by themselves), a calendar of the days and every session with its measure, effort and form |
| `/wellness/exp0` | **Exp 0 · Learn and get better** · October 2026, 31 days: intake, sport, sleep and the watch logged daily, then two grids of what moved recovery, sleep, weight, HRV and resting HR. `/bio` redirects here. Not linked from the landing |
| `/games` | **Grid Tycoon** · a turn-based energy and compute business sim in pixel art: build plants, grid links and datacenters, sell to 5 client pools, and finish 40 rounds with the highest share price against 3 bots. The built game sits in `games/` (committed, no build step on the host); the source, spec and design are in `games/grid-tycoon/` (`npm run build` in `games/grid-tycoon/app` publishes to `games/`). Multiplayer code ships offline until a Supabase project is set (see `games/grid-tycoon/supabase/README.md`). `/games/grid-tycoon` redirects to `/games` |
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
