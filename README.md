# jeremylasne.com

I build mobile apps with influencers. A creator brings the audience, I bring
the whole build and run it, and we split what it earns. This repository is
the site behind that, plus everything else I keep in public.

The landing page is one screen: a portrait, a name, social icons, then two
blocks with no titles. Solid fills, no outlines, one line per row.

- **Socials.** YouTube [@jeremyfounder](https://www.youtube.com/@jeremyfounder),
  X [@jeremylasne](https://x.com/jeremylasne), Instagram
  [@creatormatch.app](https://www.instagram.com/creatormatch.app/) and email,
  as four icons under the name. The email icons also copy the address
- **Projects.** Two centred bars: [CreatorMatch](https://creatormatch.app),
  I build mobile apps with influencers, and [wlns.shop](https://wlns.shop),
  the shop for wellness creators
- **Mobile app portfolio.** A bento of five live pages and a contact bar,
  staggered over four rows: three tall tiles zigzag with two wide ones.
  [Dr. Dana](https://www.creatormatch.app/dana/) (The best health class for
  women) is tall top left, [Ruff Diesel](https://www.creatormatch.app/terrence/)
  (IFBB Pro, classic physique) tall in the middle right, [Lenny](https://www.creatormatch.app/lenny/)
  (Fitness & mobility coach) tall bottom left; [Kaught](https://www.kaught.app/vid)
  (Animal Identifier) sits top right and [Kivenro](https://www.creatormatch.app/kivenro/)
  (Flexibility, in French) bottom right. The full-width bar closes the bento:
  *You're a wellness creator? Contact me* and the address, hey@jeremylasne.com.
  On a phone the tiles stack
- **Autoplay.** The five tiles play by themselves as soon as they are on
  screen, muted and looping, on phones too. Dr. Dana, Ruff Diesel, Lenny and Kivenro show a
  recording of their page scrolling by itself, eased in and out; Kaught shows
  its reel. A tile rests when it leaves the screen, and a visitor who asks for
  less motion keeps the still image. Under a mouse a tile pops out larger and
  keeps playing
- **Re-recording.** The videos in `media/apps` are made by `media/apps/record.mjs`
  (`NODE_PATH=$(npm root -g) node media/apps/record.mjs [dana] [kivenro] [terrence] [lenny] [kaught]`).
  It needs playwright and ffmpeg. Run it again when a page changes. It
  photographs the page frame by frame, then speeds the video up where the page
  barely moves while the scroll goes on (up to 24x), so the recording never
  seems to stop. Each video is a loop whose end melts into its start. Together
  the five weigh about 5 MB and load only when their tile comes into view
- **The climb so far.** At the bottom, full width: a pixel goat walks up a 2D
  mountain by itself, one flag per checkpoint of my life, from 2001 to 2026.
  At each flag a card gives the year, my age and one line; a tap makes the goat
  hop and hurry, and the years under the scene jump to any flag. At the top
  the camera pulls back and the hill is the foot of a range far taller. The
  sky is left empty so the ridge and the snow show through. The checkpoints
  are the list inside `#climb` in `index.html`; `climb.js` draws the rest. It
  runs only while on screen, and a visitor who asks for less motion gets a
  start button instead of autoplay

## Stack

Single hand-written `index.html`. No build step, no framework, no bundler.
Open it and edit it.

- System font stack, dark ink, one blue accent, and the greys of ice
  between. `/wealth` shares the palette, the ridge and the snow
- The ridge photo (`wellness/bg.jpg`) blurred behind everything (9.5px); snow drawn on a
  canvas by `snow.js`; the wind looping from `media/wind.mp3` with one mute
  button top right. Mute once and it stays muted on the next visit
- The CreatorMatch logo is in `media/logos`, the same file as `favicon.svg` in [jlasne/creatormatch](https://github.com/jlasne/creatormatch). The still images under the videos are in `media/apps`: the share cards of Kaught and Kivenro, and the first frame of the Dr. Dana, Ruff Diesel and Lenny recordings
- Rows reveal on load; `prefers-reduced-motion` turns that off
- `og-image.png` is generated, not hand-drawn: render the hero at 1200×630
  and screenshot it. The source is not checked in, so redraw it to match if
  the copy changes

## Pages

| Path | What it is |
| --- | --- |
| `/` | the landing |
| `/wealth` | **Wealth Layers** · map your wealth in three layers: a cash pillow held by you, one liquid fat layer in one broker, then the investments outside the strategy, with debts linked to an asset or to you. The map is the page: one bubble per holding, area = value, no arrows. A toggle swaps it for the cash flow, where bubbles are money a year: the income each bet pays (shown as a blue moon with its yield on the asset map), what lands in the bank, what moves on to the fat layer. Edit mode is the table. Dragging a bubble onto another layer simulates a sale or a move; a simulation bar shows net worth, fat layer share, debt, income and the largest country before and after, and nothing changes until it is applied. Tap the fat layer to open it: its lines as bubbles with dashed plan rings, colored by asset class or fragility, the /invest checks, a rebalance plan that uses new money first (no sale, no tax) or the fewest switches, Gave's square read per line in its own country, a fragility axis, movement against danger, and the correlation map. The crash ladder picks any country, region, continent or bloc you hold, plus energy and war, and shows the loss in money and in % of net worth, layer by layer, at an adjustable drop. Data from /invest (read 2 Oct 2026); ECB rates of 14 Oct 2026; numbers stay in the browser with a copy and paste backup. Same palette, ridge and snow as the landing; D3 from cdnjs for the map. Not linked from the landing |
| `/wealth/principles` | **Wealth Architecture** — *Era, Season, Compass*: a research note on holding money when the world order turns, the principles on one page, and the country map, thirty-two countries read three ways |
| `/wellness` | **Wellness** · experiments on my own body, one question each. Not linked from the landing |
| `/wellness/exp0` | **Exp 0 · Learn and get better** · October 2026, 31 days: intake, sport, sleep and the watch logged daily, then two grids of what moved recovery, sleep, weight, HRV and resting HR. `/bio` redirects here. Not linked from the landing |
| `/invest` | **Invest** · *compose the portfolio, see what breaks it*. One loop in 3 steps: compose a mix from 102 assets (stocks, bonds and currency for 32 countries, plus 6 sectors), read the 4 portfolio checks live while the weights move, then save it or share it. The allocation bar has draggable dividers and 5 lenses (weight, danger, fragility, square fit, season test); Gave's square tests the mix in each season and names the 3 assets least tied to the mix for any season left uncovered; the correlation heatmap flags pairs at 0.70 or more. Explore plots the 32 countries on the square and lists every asset. The mix lives in the link (`#m=id.weight,…`); notes, verdicts and saved mixes stay in the browser. Data inline in `invest/index.html`, read 2 Oct 2026. Styled as a market terminal: black ground, one monospace face (IBM Plex Mono), amber labels, white figures, square corners, ISO codes instead of flags, correlation from blue (apart) to red (together). Not linked from the landing |
| `/brain` | **brain**: a self-tidying knowledge brain in plain markdown, open source. How it works, the folder it makes, the full skill file, and the repo link. Not linked from the landing |
| `/brandmatchapp` | **brandmatch** · a daily feed of Instagram creators ready for a brand deal, ranked by intent and match stars, live at [brandmatch.app](https://brandmatch.app). Apify crawls the profiles, OpenRouter reads them against the brief, and Convex holds a creator pool shared across every campaign. A second Vercel project builds this repo with `brandmatchapp` as its root directory, so the folder stays here even though nothing on the landing links to it. The source is Vite and React under `brandmatchapp/app`; `npm run build` there commits the built app to the folder that project serves. See [`brandmatchapp/README.md`](brandmatchapp/README.md) |
| `/vid` | **Jeremy Lasne · Motion Reel 2026** · a 15 second film about this site, drawn live in the browser: 900 frames at 60 fps, 128 BPM, 1 canvas, 1 WebGL pass for the lens, 1 synth for the score. *Match Cut*: every transition is a shape matching into the next. wlns.shop opens on lime, the CreatorMatch mark opens into the four mobile apps (i dare you, Kaught and the two Soon slots), the personal projects run as the landing's own list, and the page scrolls back to the top and lands on the name. Copy is the landing's, verbatim; the icons are the real ones in `vid/assets`. Plays once and holds the end card; `G` shows guides, arrows step frames. `showreel.mp4` is the same film at 1080p60. Scenes in `vid/scenes`, score in `vid/score.js`, shared engine `vid/engine.js` and player `vid/player.js` |
| `/vid/set-in-motion` | **Set in Motion** · the first film, Claude's own reel: a 15 second piece punctuated by one red dot (type, timing, a 3D lock that bursts into particles, a live chart, product UI, liquid type, the end card). Same engine, its own scenes and score in `vid/set-in-motion` |
| `/x` | **the content manager**, live at [x.jeremylasne.com](https://x.jeremylasne.com), behind one passphrase. Jeremy logs his day; three mails at 10:00, 14:00 and 17:00 Paris ask nine questions and carry the whole day back, so the inbox is the archive. At 17:00 the log becomes three X posts and one 60 second video script, written by his own two system prompts. Drafts only: nothing is posted. Data and crons sit on the Overlap Convex deployment. A third Vercel project builds this repo with `x` as its root directory. See [`x/README.md`](x/README.md) |

**Exp 0** keeps its numbers in the Overlap Convex deployment behind a
passphrase; see [`wellness/exp0/README.md`](wellness/exp0/README.md).

**Wealth Architecture** (`/wealth/principles`) is one page, and deliberately not linked from the
landing: a different audience and a different voice. The note is set in
Source Serif and Instrument Serif over the same ridge and snow as the
landing; every figure is inline SVG, and the country map at the end is my
own reading of thirty-two countries, refreshed by hand.

## Run locally

Open `index.html` in a browser, or:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Deploy

Static. Drop the folder on any host — GitHub Pages, Vercel, Netlify, Cloudflare
Pages.
