# Overlap

Find the hour that works for a team spread across timezones, then hand it to
Google Calendar. Three steps, no dashboard:

The three app pages sit behind a sign-in at `/overlap/login`, which also
offers **Continue as guest** — the whole app works, it simply stays in that
browser: no shared teams, nothing that follows you to another device. Signing
in later keeps whatever the guest built. Without a backend connected there is
nothing to sign in to at all, so the app runs locally and lets everyone
through.

1. **Team** — who's in it, their hours in their own timezone, and the overlap
   drawn the WorldTimeBuddy way: one row per person, hours running left to
   right, every column the same instant on a different clock. White is
   possible, black is not, grey means only some of them.
2. **Plan** — name, length, days; ranked hours, each showing the time in every
   timezone at once; then Google Calendar, `.ics`, or a copyable list.
3. **Next** — the last look. What is about to be created, in every timezone,
   and a box for what you wish it did. The box is optional; passing through
   this screen is not, because **the event is created here**.

The page is one hand-written `index.html`: no framework, no build step. It runs
completely without a backend — the team lives in `localStorage` and travels in
a `#p=` link. Connecting Convex adds accounts, shared teams and invite links.

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
production deployment too — they do not carry over from dev. The account card switches from `LOCAL` to a sign-in, and any feedback
queued while offline flushes on the next successful call.

### Environment variables

Set these in the Convex dashboard (Settings → Environment Variables):

| Variable | What it does |
| --- | --- |
| `RESEND_API_KEY` | Sends the six-digit sign-in code. Without it the code is only written to the Convex logs. |
| `OVERLAP_FROM_EMAIL` | Sender for those emails, e.g. `Overlap <hi@yourdomain.com>`. Defaults to Resend's onboarding sender. |
| `OVERLAP_ALLOW_ORIGIN` | Locks the endpoint to one origin, e.g. `https://jeremylasne.com`. Defaults to `*`. **Set this before launch.** |
| `OVERLAP_GOOGLE_CLIENT_ID` | Your Google OAuth client ID. Must match the one in `config.js` exactly, or every Google sign-in is refused. |
| `OVERLAP_DEV_CODES` | `1` returns the sign-in code in the API response so you can log in before wiring email. **Never set this once real people can reach the deployment — it hands anyone a login for any address.** |

## Sign in with Google

1. [Google Cloud console → Credentials](https://console.cloud.google.com/apis/credentials)
   → **Create credentials** → **OAuth client ID** → **Web application**.
2. Under *Authorized JavaScript origins* add every origin the page is served
   from — `https://jeremylasne.com` and, for local work, `http://localhost:8000`.
   No redirect URIs are needed; this is the Google Identity Services flow,
   which hands the page an ID token in the browser.
3. Paste the client ID into `config.js` **and** set `OVERLAP_GOOGLE_CLIENT_ID`
   to the same value on the Convex deployment. Then `python3 overlap/build.py`.

Leave the client ID empty and the login page quietly falls back to the
six-digit email code — nothing breaks, the Google button simply is not drawn.

The page never sees a secret. It receives an ID token, posts it to Convex, and
Convex asks Google whether the token is real and **who it was minted for**: a
token issued for a different app is refused, which is the check that makes
this flow safe.

## How auth works

Email → six-digit code (ten minutes, five tries, single use) → an opaque
session token, stored in `localStorage` and passed as an argument on every
call. Server-side, `whoIs()` resolves that token before anything else happens,
and every team mutation checks that you share a team with the row you're
touching. There are no passwords and no third-party auth provider.

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
| `clock.js` | **source** — the landing page's live world clock |
| `landing.src.html` | **source** — the landing page |
| `config.js` | **source** — one line: your Convex URL |
| `build.py` | inlines the four above into the pages below |
| `index.html` | generated — the landing page |
| `team/`, `plan/`, `next/` | generated — the three app pages |
| `convex/schema.ts` | users, sessions, codes, teams, members, meetings, feedback |
| `convex/auth.ts` | request a code, verify it, mint a session |
| `convex/teams.ts` | `me`, create, join, rename, leave, add/update/remove member |
| `convex/feedback.ts` | store what people ask for |
| `convex/http.ts` | the single CORS endpoint the pages talk to |

Do not edit a generated `index.html` by hand — the next build overwrites it.

The three app pages are real addresses — a link to `/overlap/plan/` opens on
Plan — but moving between them in the browser is a `pushState`, so nothing
reloads and the team you are building survives the trip.

Colour means two different things on purpose. On the **landing clock** it is
the time of day: white is the working day (8am–5pm), black is night
(10pm–5am), grey the edges. Inside the **app** it is availability: white is
possible, black is not, grey means only some of the team.

## Several teams

A person can keep as many teams as they like — one per client, one per
project — and switch between them from the team row on the Team screen.
Signed out, they live side by side in `localStorage`; signed in, they are real
teams on the server and you can be a member of several at once. `me` takes an
optional `teamId` and answers with every team you are in plus the members of
the one you asked for.

## Still to build

- Real calendar sync (read busy times, not just working hours)
- Recurring meetings
- Transferring team ownership
- Rate limiting on `auth.requestCode`
