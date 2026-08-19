# Overlap

Find the hour that works for a team spread across timezones, then hand it to
Google Calendar. Three steps, no dashboard:

1. **Team** — who's in it, their hours in their own timezone, and the overlap
   drawn the WorldTimeBuddy way: one row per person, hours running left to
   right, every column the same instant on a different clock. White is
   possible, black is not, grey means only some of them.
2. **Plan** — name, length, days; ranked hours, each showing the time in every
   timezone at once; then Google Calendar, `.ics`, or a copyable list.
3. **Next** — what would you like to see. That answer decides what gets built.

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
| `OVERLAP_DEV_CODES` | `1` returns the sign-in code in the API response so you can log in before wiring email. **Never set this once real people can reach the deployment — it hands anyone a login for any address.** |

## How auth works

Email → six-digit code (ten minutes, five tries, single use) → an opaque
session token, stored in `localStorage` and passed as an argument on every
call. Server-side, `whoIs()` resolves that token before anything else happens,
and every team mutation checks that you share a team with the row you're
touching. There are no passwords and no third-party auth provider.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | the whole app — markup, styles, logic |
| `config.js` | one line: your Convex URL |
| `convex/schema.ts` | users, sessions, codes, teams, members, meetings, feedback |
| `convex/auth.ts` | request a code, verify it, mint a session |
| `convex/teams.ts` | `me`, create, join, add/update/remove member, book |
| `convex/feedback.ts` | store what people ask for |
| `convex/http.ts` | the single CORS endpoint the page talks to |

## Still to build

- Real calendar sync (read busy times, not just working hours)
- Recurring meetings
- Leaving a team, transferring ownership
- Rate limiting on `auth.requestCode`
