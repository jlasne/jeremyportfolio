# jeremylasne.com

I build mobile apps with influencers. A creator brings the audience, I bring
the whole build and run it, and we split what it earns. This repository is
the site behind that, plus everything else I keep in public.

The landing page is one screen: a portrait, a name, three lists.

- **Projects.** [CreatorMatch](https://creatormatch.app) is the door in: I
  build mobile apps with influencers. [wlns.shop](https://wlns.shop) is the
  link-in-bio shop for wellness creators
- **Mobile app portfolio.** [i dare you](https://www.idareyou.lol) sends a
  dare: film it, or dare them back, built with
  [@ayade369](https://www.tiktok.com/@ayade369). [Kaught](https://kaught.app)
  names any wild animal with your camera, and its creator seat is open
- **Personal.** Three private equity positions (SaaS health, H100
  datacenters, an astronomy blog), Social folded away (YouTube
  [@jeremyfounder](https://www.youtube.com/@jeremyfounder), X
  [@jeremylasne](https://x.com/jeremylasne), email), the Bio tracker and
  [Brain](https://brain.jeremylasne.com)

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
| `/bio` | **Bio** — a fifteen-day daily log of five habits and sleep, then one number per training discipline, live |
| `/brain` | **brain**: a self-tidying knowledge brain in plain markdown, open source. How it works, the folder it makes, the full skill file, and the repo link |
| `/brandmatchapp` | **brandmatch** · a daily feed of Instagram creators ready for a brand deal, ranked by intent and match stars, live at [brandmatch.app](https://brandmatch.app). Apify crawls the profiles, OpenRouter reads them against the brief, and Convex holds a creator pool shared across every campaign. A second Vercel project builds this repo with `brandmatchapp` as its root directory, so the folder stays here even though nothing on the landing links to it. The source is Vite and React under `brandmatchapp/app`; `npm run build` there commits the built app to the folder that project serves. See [`brandmatchapp/README.md`](brandmatchapp/README.md) |
| `/brand` | **CreatorMatch** · the offer, live at [creatormatch.app](https://creatormatch.app). Same brand as the launch film: midnight ground, lime only where the money is, violet for feeling, coral for what blocks; Inter Display Black, Instrument Serif italic and JetBrains Mono, served from `brand/fonts`. The hero is the film's opening drawn live: the app icon turns into the phone and the monthly revenue rolls up. The whole page is midnight with the film's one cream page around the portal; the 33 second film (`media/film-16x9.mp4`, `media/film-9x16.mp4`) opens from See how it works, the cut picked by the screen's shape. A second Vercel project builds this repo with `brand` as its root directory, so the folder stays here even though nothing on the landing links to it |
| `/vid` | **Jeremy Lasne · Motion Reel 2026** · a 15 second film about this site, drawn live in the browser: 900 frames at 60 fps, 128 BPM, 1 canvas, 1 WebGL pass for the lens, 1 synth for the score. *Match Cut*: every transition is a shape matching into the next. wlns.shop opens on lime, the CreatorMatch mark opens into the four mobile apps (i dare you, Kaught and the two Soon slots), the personal projects run as the landing's own list, and the page scrolls back to the top and lands on the name. Copy is the landing's, verbatim; the icons are the real ones in `vid/assets`. Plays once and holds the end card; `G` shows guides, arrows step frames. `showreel.mp4` is the same film at 1080p60. Scenes in `vid/scenes`, score in `vid/score.js`, shared engine `vid/engine.js` and player `vid/player.js` |
| `/vid/set-in-motion` | **Set in Motion** · the first film, Claude's own reel: a 15 second piece punctuated by one red dot (type, timing, a 3D lock that bursts into particles, a live chart, product UI, liquid type, the end card). Same engine, its own scenes and score in `vid/set-in-motion` |
| `/x` | **the content manager**, live at [x.jeremylasne.com](https://x.jeremylasne.com), behind one passphrase. Jeremy logs his day; three mails at 10:00, 14:00 and 17:00 Paris ask nine questions and carry the whole day back, so the inbox is the archive. At 17:00 the log becomes three X posts and one 60 second video script, written by his own two system prompts. Drafts only: nothing is posted. Data and crons sit on the Overlap Convex deployment. A third Vercel project builds this repo with `x` as its root directory. See [`x/README.md`](x/README.md) |

**Bio** keeps its numbers in the Overlap Convex deployment behind a
passphrase; see [`bio/README.md`](bio/README.md).

**Wealth Architecture** is one page, and deliberately not linked from the
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
