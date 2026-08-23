# Overlap

Find the hour that works for a group spread across timezones, then hand it to
Google Calendar. One meeting, one link, one page.

## How it goes

1. **Sign in with Google.** There is no other door and no guest mode — a link
   that has to survive being sent to someone else needs an account behind it.
2. **Say what your day looks like — once.** Timezone (already detected),
   working hours, and when you are asleep, all preselected so the honest
   answer for most people is to press Save. One tap connects your Google
   Calendar, which lays your busy hours on top of your working ones.
   This answer lives on your account: every meeting after this starts with it
   already filled in.
3. **Name a meeting and press Create.** You get a link.
4. **Send the link.** Whoever opens it signs in, gets the same preselected
   card, and lands on the same calendar you are looking at. They answer for
   themselves — you never type anybody else's hours again.
5. **Wait, or book it.** The overlap redraws as each person arrives. When an
   hour suits, press it and then **Add to Google Calendar** — everyone in the
   meeting comes along as a guest.

Sending the link again is how you invite more people; there is nothing else to
press.

## The page

The **side** is everything you set: the meeting's name and length, who is in
it, and the one button that acts on it. The **page** is what you read, in two
screens you reach by scrolling:

1. **Calendar** — the whole window, near enough. Names down the side, the day
   across the top, one column per hour. A column is one instant: the ruler
   reads it on your clock, every row reads the same instant on a different
   one, and the offset next to each name is the arithmetic you no longer have
   to do.

   Under the ruler sits the loudest thing on the screen: **the whole group as
   one band**, ruled off in ink, with the number who can make each hour
   written across it. Paper white where all of them can, darkening as more
   drop out, solid ink where nobody can. Below that, one row each: bars for
   the hours they can't, hatched for awake-but-off-hours, and the line of the
   current moment running down through all of it.
2. **Best times** — the ranked hours, each written out in every timezone at
   once, with a `+1` where an hour lands on somebody's tomorrow.

Unticking someone takes their hours out of the overlap as well as their name
off the invitation — both screens recompute, and their row stays on the
calendar, greyed, so you can see what you chose to ignore.

Only ever your own row is editable. Everyone answers for themselves.

**What next?** is not a screen. It comes up as a sheet the moment you create
an event — the one point where the app has done its job and you know what it
was missing — and it stops coming up once you answer it.

`/team/` and `/plan/` are still real addresses — they scroll to their screen
rather than swapping the page.

On a phone there is no room for a column, so the two control folds sit shut
above the calendar and open on a tap; the create button becomes the bar at
the bottom of the screen. What is on screen when it loads is the calendar.

## There are no teams

There used to be. A team was a thing you named, joined, renamed, switched
between and left — and all it ever meant was *the people I keep meeting*.
That is a question the meetings can already answer, so the table is gone and
the Share sheet just shows you who you have met with before.

The page is one hand-written `index.html`: no framework, no build step beyond
a script that inlines the sources. It needs a Convex backend — without one it
falls back to running against this browser alone, which is a workbench for
development, not a product: no accounts, no links, nothing shared.

## People you have met

There is no address book to fill in and nothing to keep tidy. Anyone you have
shared a meeting with — whoever did the inviting — is in **People**, reachable
from the rail, with how many meetings you have had and whether they are in the
one on screen. Tapping one opens a mail to them with the link already in it.

It is derived, not stored: `contacts` reads it back out of the meetings you
are both in, so it cannot drift from the truth and there is no third table to
keep in step.

## Connecting Convex

There is nothing to create in the dashboard first — the CLI does it:

```bash
cd overlap
npm install
npx convex dev
```

`convex dev` opens a browser to log in, asks whether to create a new project
(say yes, name it `overlap`), provisions the deployment, pushes everything in
`convex/`, and then watches for changes. It writes the deployment name into
`.env.local` and prints two URLs.

Take the **HTTP Actions** URL — the `.convex.site` one, not `.convex.cloud` —
and paste it into `config.js`:

```js
window.OVERLAP_CONVEX_URL = "https://your-deployment.convex.site";
```

Reload.

### Dev and production are two different deployments

`convex dev` gives you a **dev** deployment — fine for testing, and it stops
being pushed to the moment you close the terminal. For the version people
actually use:

```bash
npx convex deploy
```

That creates the production deployment, which has its **own** `.convex.site`
URL and its **own** environment variables. Put the production URL in
`config.js` before the page goes out, and set the variables below on the
production deployment too — they do not carry over from dev.

Two ways this bites, both of which look like the app is simply broken:

- **`convex deploy` prints the `.convex.cloud` URL**, which is for the
  websocket client. `config.js` wants the same subdomain with `.convex.site`
  — that is where the HTTP endpoint lives.
- **The dashboard opens on whichever deployment you last used.** Setting
  `OVERLAP_GOOGLE_CLIENT_ID` on dev does nothing for the site, which talks
  to prod. Check the deployment name at the top of the page before trusting
  a variable you just set. The account card switches from `LOCAL` to a sign-in, and any feedback
queued while offline flushes on the next successful call.

### Environment variables

Set these in the Convex dashboard (Settings → Environment Variables):

| Variable | What it does |
| --- | --- |
| `OVERLAP_GOOGLE_CLIENT_ID` | Your Google OAuth client ID. Must match the one in `config.js` exactly, or every sign-in is refused. **Without it nobody can sign in at all**, and since Google is the only door, nobody can use Overlap. |
| `OVERLAP_ALLOW_ORIGIN` | Locks the endpoint to one origin, e.g. `https://jeremylasne.com`. Defaults to `*`. **Set this before launch.** |

## Google: sign-in and busy times

One OAuth client ID drives two separate things, and each needs something the
other does not:

| What | Where | Needs |
| --- | --- | --- |
| **Add to Google Calendar** | a plain `calendar/render?action=TEMPLATE` URL | nothing — it works with none of this set up |
| **Sign in with Google** | `login.js` → ID token → Convex `auth.google` | client ID in `config.js` **and** `OVERLAP_GOOGLE_CLIENT_ID` on Convex |
| **Read my busy times** | the person sheet → `calendar/v3/freeBusy` | client ID in `config.js`, the Calendar API enabled, the `freebusy` scope on the consent screen. Never touches Convex. |

They are two separate consents. Signing in with Google does not grant calendar
access, and reading busy times works for someone who never signed in at all.

### Setting it up

1. **Enable the API.** [Google Cloud console → Library](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)
   → *Google Calendar API* → **Enable**. Skip this and sign-in still works
   perfectly while `freeBusy` answers `Calendar refused` — the confusing
   failure, so do it first.
2. **Consent screen** (*Google Auth Platform*, once *OAuth consent screen*).
   Under **Data Access** add `https://www.googleapis.com/auth/calendar.freebusy`
   — the narrowest calendar scope there is: blocks of time, never event titles.
   Under **Audience**, *Testing* lets up to 100 named test users through with
   no review; opening it to everyone means Google's verification.
3. **Create the client.** [Credentials](https://console.cloud.google.com/apis/credentials)
   → **Create credentials** → **OAuth client ID** → **Web application**.
   Under *Authorized JavaScript origins* add every origin the page is served
   from — `https://jeremylasne.com` and, for local work, `http://localhost:8000`.
   Origins match exactly: scheme, host and port, no path, no trailing slash,
   and `http://localhost` is not `http://localhost:8000`. Leave *redirect
   URIs* empty; both flows are browser-side Google Identity Services, which
   never redirects.
4. **Paste it in two places, byte for byte.** The client ID goes into
   `config.js`, and `OVERLAP_GOOGLE_CLIENT_ID` on the Convex deployment gets
   the same string. `auth.google` compares the token's audience against it and
   refuses a mismatch with *"That sign-in was meant for another app"* — a
   stray space is enough. Dev and production are separate deployments with
   separate variables; set it on both.
5. **Rebuild.** `python3 overlap/build.py`. `config.js` is inlined into the
   generated pages, so editing it alone changes nothing that ships.

The client ID is not a secret — it is served in the page. The page never sees
one. It receives an ID token, posts it to Convex, and Convex asks Google
whether the token is real and **who it was minted for**: a token issued for a
different app is refused, which is the check that makes this flow safe.

Leave the client ID empty and the login page quietly falls back to the
six-digit email code — nothing breaks, the Google button simply is not drawn.

### What busy times actually read

`syncCalendar` asks for `items:[{id:"primary"}]` — the primary calendar of
whoever consents *in that browser*. Editing a colleague's row and tapping
**Read my busy times** writes your own hours onto their row. It is built for
each person to open the shared link and do their own.

What comes back is stored: `localStorage`, the `#p=` share link, and the
member row on the server. So it travels, but it does not refresh itself —
that is *Real calendar sync*, still to build.

## How auth works

Google ID token → Convex checks it with Google and checks the audience is us →
an opaque session token, stored in `localStorage` and passed as an argument on
every call. Server-side, `whoIs()` resolves that token before anything else
happens, and every mutation checks you actually hold a seat in the meeting you
are touching. Your own row is the only row you can write.

There are no passwords, no codes, and no second provider to keep working.

## Files

Every page here is **self-contained** — its CSS and JS live inside the HTML.
Static hosts only have to serve one file correctly, and there is no window
where new markup meets a cached old stylesheet. The sources stay single-copy;
a small script assembles the pages.

```bash
python3 overlap/build.py     # after editing any source below
```

| Path | What it is |
| --- | --- |
| `app.css` | **source** — the design system for the app and the landing page |
| `app.js` | **source** — the app: markup template, timezone maths, backend calls |
| `landing.src.html` | **source** — the landing page: one hero, nothing else |
| `login.js` | **source** — the door: one Google button |
| `config.js` | **source** — your Convex URL and Google client ID |
| `build.py` | inlines the sources above into the pages below |
| `index.html` | generated — the landing page |
| `team/`, `plan/`, `next/` | generated — the three app pages |
| `login/` | generated — the sign-in page |
| `convex/schema.ts` | users (with your saved day), sessions, meetings, participants, feedback |
| `convex/auth.ts` | verify a Google token, mint a session |
| `convex/meet.ts` | `me` (you, the meeting, everyone in it, everyone you have met), profile, create, peek, join, hours, rename, leave, book |
| `convex/feedback.ts` | store what people ask for |
| `convex/http.ts` | the single CORS endpoint the pages talk to |

Do not edit a generated `index.html` by hand — the next build overwrites it.

The three app addresses still resolve — `/overlap/plan/` lands on Best times,
`/overlap/next/` opens the question — but they are one page now, so a link
scrolls rather than switches, and moving between the screens is a `pushState`.

Colour means one thing: availability. White is possible, ink is not, and
hatching is the hour someone is awake for but not working. On the group band
the grey is a quantity — how many are out — not a third state.

## Several meetings

A person can be in as many meetings as they like, and switches between them
from the meeting row at the foot of the rail. `me` takes an optional
`meetingId` and answers with every meeting you are in plus the people in the
one you asked for. Leaving takes your row with you; the last person out closes
the meeting.

## Still to build

- Re-reading the calendar when the week moves, rather than only on connect
- Recurring meetings
- Telling people their meeting got booked, without them having to look
- Rate limiting on `meet.join`
