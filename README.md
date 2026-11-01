# jeremylasne.com

I'm building a mobile app portfolio, and I share what I learn growing it twice
a week. This repository is the site behind that, plus everything else I keep
in public.

The site is three pages, laid out after [joncphillips.com](https://joncphillips.com/):
a 900px column with hairline sides over the ocean, Figtree for the words and
Geist Mono for the small labels. Dark by default, light on a click, remembered.
Every page has the nav: Mobile-Apps, Personal, Wellness-Creators
(creatormatch.app) on the left, JEREMY·LASNE (home) on the right (on a phone,
the name on top and the three pages on a line under it), and a one-line foot with the theme
switch.

- **`/` · home.** One screen, as before but cleaner: "Hey, I'm (my face)
  Jeremy Lasne.", the mobile app portfolio and the newsletter (links to
  `/apps/#newsletter`), CreatorMatch for wellness creators in its green, my
  hobbies, a blinking caret, x / YouTube / email. A tap on the email copies it and opens
  a popup: "Copied", the address, and "Write an email" for the mail app
- **`/apps` · Mobile apps and the newsletter.** The hello fills the screen
  under the nav, so the portfolio waits one scroll below ("Mobile app
  portfolio ↓" at its foot). "Hey, I’m Jeremy. I’m building a mobile app
  portfolio." (34px on a phone, up to 54px), the subheadline ("I share what I learn growing my apps."
  highlighted in blue; "design with taste", "decide with data" and "shared by
  creators" underlined), the email field "Your email", the
  button "Get the next issue", "Two emails a week. Leave anytime." Then the
  portfolio: the Kaught reel as the card (a tap opens kaught.app), and
  HealthClass: a big card of question marks, "HealthClass?", a redacted line,
  coming soon, stealth
- **`/personal` · Personal.** Wellness (`/wellness`), tasu (tasu.ai) and
  Claude Portfolio (claudeportfolio.com, "World-Investment Management
  Intelligence."), three cells
- `/creators` redirects (308) to creatormatch.app

### The newsletter

The form in `apps/index.html` carries `data-endpoint=""`. Put the mailcheap.ai
sign-up URL there and `site.js` posts the address as the form field `email`,
then shows "You're in." Until it is set, the button opens a mail to
hey@jeremylasne.com with the address inside, so no sign-up is lost.

### The Kaught reel

`media/apps/kaught.mp4` (1.6 MB) is `assets/reel/reel.mp4` of
[storinox/kaught-landing](https://github.com/storinox/kaught-landing) at 1280 x 720, 30 fps,
no sound (`ffmpeg -i reel.mp4 -an -vf "scale=1280:-2,fps=30" -c:v libx264 -crf 28 -preset slow
-pix_fmt yuv420p -movflags +faststart kaught.mp4`); `kaught.webp` is its frame at 7.4 s.
A visitor who asks for less motion keeps the still.

## The ocean

`ocean.js`, one canvas fixed behind the page. 4 animals on a computer (2
sharks, one a hammerhead, and 2 narwhals), 3 on a phone, seen from above and
laid every frame on a grid of square cells that grows with the screen (6px
on a phone, 8px at 1440px, 11px from 1980px), 30 frames a second. They stay
small and faint in the background: half their old size, at 50% opacity in
the dark theme and 45% in the light one. It runs
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
- Text marked `data-ocean` fades the cells under it (to `data-fade`, 0 hides
  them; the home text uses 0); `data-ocean="avoid"` also steers the animals
  away (the home text and each page's heading)
- The animals cross from one page to the next: their places are kept for the
  tab on the way out and picked up by the next page, which also crossfades in
  browsers that can
- Dark by default, light on a click, remembered; the page fires `themechange`
  and the ocean takes the theme's colours. Less motion: one still frame

## Stack

Hand-written HTML, one page per folder (`index.html`, `apps/`, `personal/`),
with `site.css`, `site.js` and `ocean.js` shared. The nav and the foot are
written out in each page: change them in all three. No build step,
no framework, no bundler. Open it and edit it.

- Figtree (a free look-alike of Soleil, the font of joncphillips.com) and Geist
  Mono from Google Fonts, dark ink, one blue accent, the greys of ice between. `/wellness` keeps its system
  font and takes the ocean as its background; the ridge photo stays for
  `/wellness/exp0` only
- The CreatorMatch, tasu, Kaught and Claude Portfolio logos are in `media/logos`, with my face in `media/avatar.webp`
- `og-image.png` is generated, not hand-drawn: the home page rendered at
  1200×630 with larger text and screenshotted. The source is not checked in,
  so redraw it to match if the copy changes, and bump `?v=` in the meta tags

## Pages

| Path | What it is |
| --- | --- |
| `/` | home, one screen (see above) |
| `/apps` | Mobile apps and the newsletter |
| `/personal` | Personal: Wellness, tasu, Claude Portfolio |
| `/wealth` | **Moved** to [claudeportfolio.com/wealth](https://www.claudeportfolio.com/wealth). `/wealth` and every path under it redirect there (308, `vercel.json`, before the filesystem). Numbers saved in the browser here cannot cross domains: the old page and its backup tool are gone, so they stay in that browser's storage for jeremylasne.com |
| `/wellness` | **Wellness** · the charts and as little text as possible: my sleep and my sport, logged every day since 1 October 2026 (Phase 0, normal, before any habit is tested; the Exp 0 nights of October count from day one). **Night by night**: last night's **night score** as one big number with the normal under it and a meter (0 to 100: the average of sleep score, HRV, RHR, readiness and time asleep, each set against the last 30 days, 100 being the best of the month), then the score of the last 30 nights as columns, the sport of the day before under each. **Sport by day**: the last session's load as one big number with the average under it, then the load of each day stacked by sport (each session's minutes times its effort; effort mixes the average and peak heart rate as a share of the heart rate reserve with the level felt, 1 to 5, weighted by the session's target: cardio 50/20/30, speed 20/50/30, strength 20/20/60). A line over each chart reads the column under the finger or the cursor. **What changes my nights**: the average night after a rest day, after a sport day, with my girlfriend, cold (window open all night) and dark (shutters closed), in five columns, a column needing 3 nights. Links to the details page; the footer links Exp 0. The **Log** button top left opens the log in a panel centred over the page, nearly full screen on a phone; one passphrase writes. Each night has three toggles in the log: with my girlfriend (`gf`), cold (`cold`) and dark (`dark`). A Gym session holds any exercises, each with a name, reps and weight. Once unlocked, the log exports every day as a CSV (one row per session, the night beside it). A day the server cannot take (offline) is kept on the device and sent up the next time it answers. Its look: the landing's shell (the 900px column with hairline sides, the same nav and one-line foot, Figtree and Geist Mono), the headline "Wellness. My sleep and my sport, logged every day since 1 October 2026.", the ocean behind, round buttons and chips, and rounded bars in the charts. Rules in `wellness/spec.js`, data and the scores in `wellness/data.js`, charts in `wellness/charts.js`, styles in `wellness/wellness.css`; days in the `days` table of wellness-api. Linked from /personal. A new field such as `dark` needs `cd wellness-api && npx convex deploy`; until then the page keeps those days on the device and sends them up once the server knows the field |
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
