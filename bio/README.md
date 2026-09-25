# jeremylasne.com/bio

October 2026, 31 days. Intake, sport, sleep and what the watch observes,
measured every day, then what actually moved my recovery, sleep score,
sleep duration, weight, HRV and resting heart rate. Everyone reads it. One
passphrase writes it.

## The shape of it

| Group | Fields | Goal |
| --- | --- | --- |
| 🍽️ Intake | coffee (start → end per cup), water, meals (start → end + kcal each) | coffee **max 2 cups**, water **4 L** (8 × 50cl) |
| 🏃 Sport | sessions (sport, intensity light / moderate / high, start → end, kcal burned), steps | |
| 😴 Sleep | sleep score, hours slept, bedtime, wake-up | |
| 📊 Observing | weight, HRV, resting HR, recovery | |
| 🌿 Levers | sun | |

A goal points one way: coffee is a ceiling, met by staying under it, water
is a floor, met by reaching it. The card shows each goal beside its row and
the day's count of goals met in its corner.

Anything that takes time (a cup, a meal, a session) is a **span**: when it
started and when it finished, kept as minutes after midnight, with its
length shown beside it. A span may run past midnight; its end is then read
as the next day. On today, one **Now** button fills the first empty end:
tapping + on coffee starts the cup, *End now* closes it. A new meal today
starts now; a session starts empty, since it is logged after. A bedtime
after midnight is kept past 24:00 (00:40 is 1480).

A **session** is a sport, how hard it was (light, moderate, high, kept as
1–3), its span and the calories it burned. Up to four a day. The sport field
suggests every sport already typed and takes a new name as it is, so the
list grows by using it. A session without a sport stays on screen as a draft
and is left out of the save until it has one.

**Practice days.** The 14 days before 1 October can be filled in to learn
the page. They are saved like any day, marked *Practice · not counted*, and
never read by the matrix or shown in the month.

The four things the body answers with are read **the morning after** the
day that caused them, because a night is what answers a day.

## Stack

- **`index.html`** — the page, hand-written, no build step. Bebas Neue for
  headings and the big numbers, Inter for body, JetBrains Mono for labels,
  all from Google Fonts. The background is `bg.jpg`, fixed, blurred and
  darkened by CSS, and the page darkens it further as it scrolls; without
  that file a gradient stands in.
- **`spec.js`** — the single source of truth: the field list, the ranges a
  number may take, what a save may contain, and the correlation itself. The
  page imports it and so does the server
  ([`overlap/convex/bio.ts`](../overlap/convex/bio.ts)), so the two agree on
  which fields exist and what a day may hold. `spec.d.ts` is its types for
  `tsc`.
- **Data** — one document in the Overlap Convex deployment (table `bio`, key
  `oct26`), through the same `/overlap` door Founder City uses. Three
  operations: `bio.get`, `bio.unlock`, `bio.save`.
- **Auth** — a passphrase, `BIO_PASSPHRASE` on the Convex deployment.
  *Log* asks for it once per device (kept in `localStorage`), then every tap
  saves itself about a second after the last change. There is no Save
  button. A failed save keeps the change on screen and retries. The bar says
  why a day cannot be filled in (not come yet, still loading), and *Lock*
  forgets the passphrase on that device.

## The correlations

One grid: **every measure against every result**. A row is one thing
measured, a column one thing looked for (recovery, sleep score, sleep
duration, weight, HRV, resting HR), and each cell the impact on five steps:

| Very bad | Bad | Neutral | Good | Very good |
| --- | --- | --- | --- | --- |
| a finding, large gap, the wrong way | a finding, the wrong way | not a finding | a finding, the right way | a finding, large gap, the right way |

"Right way" follows what the result counts as better, so a falling resting
HR is good, and so is a lower weight (a heavier morning after more water is
water, not fat). "Large" is Cohen's d of 0.8 or more. The move
in the result's own unit sits under the word, and tapping a cell spells the
link out above the grid: "Last coffee → Sleep score: Very bad. −5 pts after
a later last coffee (over 13:23), 15 of 30 days. Clear of luck (q 0.005)."
A dash is a measure against itself.

**The grid shows from the start**, empty, and fills in as the days add up. A cell still
gathering data shows how far it has come ("2/6": two comparable days of the
six it needs); a dot has the days but fewer than 3 on one side. Until day 21
a line above the grid says it is early. A neutral cell with a medium gap that
would pass on its own (p < 0.05) shows a faint dashed **lean**, "Leaning bad"
or "Leaning good": it has not cleared the luck check, and on simulated
months with no real effect about 7 of 150 cells lean by chance, so it is
something to watch, never a verdict.

Measured on 20 simulated months, cut at each point in the month:

| Day | False impacts, no real effect | Real impacts, planted effects | Cells readable |
| --- | --- | --- | --- |
| 2 | 0 | 0 | 0% |
| 7 | 0.05 | 0 | 62% |
| 14 | 0.30 | 1.6 | 85% |
| 21 | 0.20 | 4.3 | 87% |
| 31 | 0.40 | 8.7 | 86% |

**Everything logged is a row**, 26 measures plus one line per sport:

| From | Factors |
| --- | --- |
| Coffee | cups, first cup start, last cup end, any cup after 14:00 |
| Meals | calories eaten, first meal start, last meal end, eating window, time at the table |
| Sport | training day vs rest day; then, against my other sessions: sport, intensity, length, start, finish, kcal burned |
| Day | water, steps, sun |
| Night | bedtime, wake-up, hours slept, sleep score |
| Morning | weight, HRV, resting HR, recovery |

- A day's doings are read against the night and morning **after** them. The
  night and the morning's own numbers are read against that same morning.
- An on/off factor splits on itself; a count or a clock time splits at its
  **own median**, and the line says where: "over 17:10".
- Sport is read one dimension at a time, so "a harder session" means harder
  than my usual session, not harder than resting.

**The luck check.** Over a hundred links are tested each month, so some look
real by chance, and the more that is tracked the more of them there are.
Each link gets a Welch t-test p-value, then a Benjamini-Hochberg q-value
across every link tested together. A cell leaves neutral only with q ≤ 0.1
(at most 1 in 10 coloured cells is luck) and at least a medium gap.

Measured on 20 simulated months with no real effect in them: the old
strength-only rule showed 17.2 false findings a month, the luck check 0.55.
On 20 months with planted effects it found 6.3 of them a month.

**Linked things move together.** A late third meal is also more calories, so
two rows can claim the same kilo. When two rows tell one story, change one
of them alone for a week.

A cell needs 6 comparable days with at least 3 on each side.

## Filling the body numbers

Typed each morning until the sync lands, then written by the sync and left
alone. Sleep takes `7:20`, `7h20`, `720` or `7.5` and stores minutes.

The sync is **not built yet**. The Fitbit Web API closed to new developer
registrations and is turned down in September 2026; its replacement is the
Google Health API, a cloud REST API registered through the Google Cloud
console. That work is separate from this page: the fields already exist, so
a sync only has to write them.

## Editing the copy

Everything readable lives in `spec.js`: field names, units, the line under
each group, and the ranges. Changing the month means changing `start` and
`end` there, and nothing else.

## Deploy

The page ships with the main site: it lives at `/bio` on the
`jeremyportfolio` Vercel project, and Vercel serves the folder as is.

The server side needs one deploy and one setting:

1. `cd overlap && npx convex deploy` from a checkout that has this code.
2. In the Convex dashboard (Settings → Environment Variables) set
   `BIO_PASSPHRASE`. If `OVERLAP_ALLOW_ORIGIN` is set, list every origin the
   page is served from, comma-separated.

The document key moved to `oct26` for this shape, so the habit log from
before it sits untouched under `v2` rather than being half-read as this one.

**Deploy the server before the page** whenever the day's shape changes. The
server's validator is a superset of what older pages send, so a new server
with an old page is safe; a new page with an old server has its saves
refused.

## Safety

- The page is the author's copy of the month. A save's reply only dates it,
  so a tap made while a save is in flight is kept and goes out on the next
  beat.
- Logging stays shut until the stored log has loaded. A save sends the whole
  month, so writing on top of a failed load would replace October with
  whatever one screen holds.

## Run locally

```bash
python -m http.server 8000
# → http://localhost:8000/bio/
```

Serve from the repository root: the page imports `/bio/spec.js` by absolute
path, the way Vercel serves it.
