# jeremylasne.com

I build mobile apps with influencers. A creator brings the audience, I bring
the whole build and run it, and we split what it earns. This repository is
the site behind that, plus everything else I keep in public.

The landing page: a portrait, a name, social icons, the CreatorMatch bar, then
our work as a row of phones. Solid fills, no outlines, one line per row.

- **Socials.** YouTube [@jeremyfounder](https://www.youtube.com/@jeremyfounder),
  X [@jeremylasne](https://x.com/jeremylasne), Instagram
  [@creatormatch.app](https://www.instagram.com/creatormatch.app/) and email,
  as four icons under the name. The email icons also copy the address
- **Projects.** One centred bar: [CreatorMatch](https://creatormatch.app),
  I build mobile apps with influencers
- **Our work.** Under it, full width, one phone per page of
  [creatormatch.app/work](https://www.creatormatch.app/work/): 11 apps made for
  11 wellness creators. The phone in the middle is the largest; each step away
  it gets smaller and fainter. A click on a side phone, a swipe, a sideways
  trackpad scroll, the arrow keys or the two buttons bring the next one to the
  middle, round and round. A click on the middle phone opens its page. Under
  the phones: the app's name, the creator and one line of figures, plus the
  count (1 / 11)
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

## Stack

Single hand-written `index.html`. No build step, no framework, no bundler.
Open it and edit it.

- System font stack, dark ink, one blue accent, and the greys of ice
  between. `/wealth` shares the palette, the ridge and the snow
- The ridge photo (`wellness/bg.jpg`) blurred behind everything (9.5px); snow drawn on a
  canvas by `snow.js`; the wind looping from `media/wind.mp3` with one mute
  button top right. Mute once and it stays muted on the next visit
- The CreatorMatch logo is in `media/logos`, the same file as `favicon.svg` in [jlasne/creatormatch](https://github.com/jlasne/creatormatch). The still under each video is in `media/apps`: the first frame of its recording
- Rows reveal on load; `prefers-reduced-motion` turns that off
- `og-image.png` is generated, not hand-drawn: render the hero at 1200×630
  and screenshot it. The source is not checked in, so redraw it to match if
  the copy changes

## Pages

| Path | What it is |
| --- | --- |
| `/` | the landing |
| `/wealth` | **Wealth Layers** · map your wealth in three layers: a cash pillow held by you, one liquid fat layer in one broker, then the investments outside the strategy, with debts linked to an asset or to you. The map is the page: one bubble per holding, area = value, no arrows. A toggle swaps it for the cash flow, where bubbles are money a year: the income each bet pays (shown as a blue moon with its yield on the asset map), what lands in the bank, what moves on to the fat layer. Edit mode is the table. Dragging a bubble onto another layer simulates a sale or a move; a simulation bar shows net worth, fat layer share, debt, income and the largest country before and after, and nothing changes until it is applied. Tap the fat layer to open it: its lines as bubbles with dashed plan rings, colored by asset class or fragility, the four portfolio checks, a rebalance plan that uses new money first (no sale, no tax) or the fewest switches, Gave's square read per line in its own country, a fragility axis, movement against danger, and the correlation map. The crash ladder picks any country, region, continent or bloc you hold, plus energy and war, and shows the loss in money and in % of net worth, layer by layer, at an adjustable drop. Asset and country data read 2 Oct 2026; ECB rates of 14 Oct 2026; numbers stay in the browser with a copy and paste backup. Same palette, ridge and snow as the landing; D3 from cdnjs for the map. Not linked from the landing |
| `/wellness` | **Wellness** · experiments on my own body, one question each. Not linked from the landing |
| `/wellness/exp0` | **Exp 0 · Learn and get better** · October 2026, 31 days: intake, sport, sleep and the watch logged daily, then two grids of what moved recovery, sleep, weight, HRV and resting HR. `/bio` redirects here. Not linked from the landing |
| `/brandmatchapp` | **brandmatch** · a daily feed of Instagram creators ready for a brand deal, ranked by intent and match stars, live at [brandmatch.app](https://brandmatch.app). Apify crawls the profiles, OpenRouter reads them against the brief, and Convex holds a creator pool shared across every campaign. A second Vercel project builds this repo with `brandmatchapp` as its root directory, so the folder stays here even though nothing on the landing links to it. The source is Vite and React under `brandmatchapp/app`; `npm run build` there commits the built app to the folder that project serves. See [`brandmatchapp/README.md`](brandmatchapp/README.md) |

**Exp 0** keeps its numbers in the Overlap Convex deployment behind a
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
