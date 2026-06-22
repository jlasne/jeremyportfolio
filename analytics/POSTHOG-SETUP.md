# Making the PostHog panels go live — step-by-step

A friendly checklist for a non-developer. Stripe data is already flowing
on the Vercel dashboard — this doc finishes the PostHog half.

**You are here:** the Vercel dashboard already shows live Stripe numbers
(MRR, plans, recent customers). The PostHog-driven panels (Visitors,
Conversion, Funnels, Click map, Top pages, Online) currently fall back
to demo. We'll fix that.

**You'll need three browser tabs open:**
1. **PostHog** → https://eu.posthog.com (you're on EU cloud)
2. **Vercel** → https://vercel.com/dashboard
3. **The diagnostic URL** → `https://jeremyportfolio-kappa.vercel.app/api/dashboard`

---

## Part 1 — Get the right PostHog key (≈ 5 min)

The dashboard needs a **Personal API key** from PostHog (`phx_…`), not a
*project* key (`phc_…`). They're different things — `phc_…` lets a
website *send* events, `phx_…` lets a server *read* them.

- [ ] Open PostHog → click your **avatar** (top-left) → **Settings**.
- [ ] In the left sidebar of Settings, scroll to find **"Personal API keys"**
      (it's under "Account" or "User" — *not* "Project").
- [ ] Click **+ Create personal API key**.
- [ ] Give it a label: `tasu dashboard` (anything helps you remember).
- [ ] **Scopes** — this is the important bit. Tick exactly these three:
  - `query:read`
  - `person:read`
  - `insight:read`
- [ ] **Scoped organizations / projects** — pick the org/project that
      contains **project 140963** (the one you saw at
      `eu.posthog.com/project/140963/...`). If unsure, leave it
      "All organizations / All projects" — it's read-only.
- [ ] Click **Create key**. **Copy the value immediately** — PostHog
      shows it once and then hides it forever. It starts with **`phx_`**.

> ⚠️ If your current `POSTHOG_PERSONAL_API_KEY` in Vercel starts with
> `phc_` instead of `phx_`, that's the bug — those keys can't read data.

---

## Part 2 — Put the key in Vercel (≈ 2 min)

- [ ] Open Vercel → click your project (`jeremyportfolio`).
- [ ] Top tabs: **Settings** → left sidebar: **Environment Variables**.
- [ ] Find **`POSTHOG_PERSONAL_API_KEY`** in the list.
  - If it exists → click the **`⋯`** → **Edit** → paste the new `phx_…` value → **Save**.
  - If it doesn't → click **Add Environment Variable** → key
    `POSTHOG_PERSONAL_API_KEY` → value `phx_…` → environments: tick
    **Production** *and* **Preview** → **Save**.
- [ ] While you're there, **double-check the other three** are exactly:
  - `POSTHOG_PROJECT_ID` = `140963`
  - `POSTHOG_HOST` = `https://eu.i.posthog.com` (yes, with the `i.`)
  - `STRIPE_KEY` = your `rk_live_…` (already working — don't touch)

---

## Part 3 — Redeploy (≈ 1 min, mandatory)

Env-var changes only take effect after a redeploy. There's no shortcut.

- [ ] Vercel → your project → top tab **Deployments**.
- [ ] Find the most recent deployment (top of the list, "Production").
- [ ] Click its **`⋯`** menu (right side) → **Redeploy**.
- [ ] A modal asks "Use existing Build Cache?" — leave it ticked, click
      **Redeploy**.
- [ ] Wait until the status dot turns **green ("Ready")** — usually
      30–60 seconds.

---

## Part 4 — Check if it worked (≈ 30 sec)

The dashboard's API returns a special **`_diag`** field that tells you
which queries worked and which failed (and why). You can read it
directly in your browser — no DevTools needed.

- [ ] Open this URL in a new tab:
      **`https://jeremyportfolio-kappa.vercel.app/api/dashboard`**
- [ ] You'll see a wall of JSON. Press **Ctrl-F** (Cmd-F on Mac) and
      search for **`_diag`**.
- [ ] You'll see something like:
      ```
      "_diag": {
        "subscriptions": "rows:42",
        "charges": "rows:312",
        "visitors": "ERR: posthog 401 ...",
        "online": "ERR: posthog 401 ..."
        ...
      }
      ```

**What you want to see:**
- `"rows:NN"` — that query is working ✅
- `"ok"` — that query worked (returned a single value) ✅
- `"ERR: posthog 401 …"` — the key is invalid or missing scope ❌
- `"ERR: posthog 403 …"` — the key doesn't have the scope ❌
- `"ERR: posthog 404 …"` — wrong `POSTHOG_PROJECT_ID` or `POSTHOG_HOST` ❌
- `"ERR: posthog 400 …"` — query syntax mismatch (event names) ❌

---

## Part 5 — Confirm on the dashboard

- [ ] Open `https://jeremyportfolio-kappa.vercel.app/analytics`.
- [ ] Password: `tasu-analytics-2026`.
- [ ] Top-bar badge should say **"live data"** (not "demo data").
- [ ] Visitors / Conversion / Bounce / Session KPIs should match what
      you see in PostHog itself.

---

## Troubleshooting — read the `_diag` from Part 4

### Most PostHog queries say `ERR: posthog 401`
The key is wrong or missing.
- The value in Vercel must start with **`phx_`** (Personal API key) —
  *not* `phc_` (Project token).
- Make sure you actually **redeployed** after saving (Part 3). Env
  changes don't apply to the running function automatically.

### `_diag` says `ERR: posthog 403`
The key exists but lacks scope.
- Back to PostHog → Settings → Personal API keys → click the key →
  Scopes — tick **`query:read`**, **`person:read`**, **`insight:read`**
  → Save → redeploy.

### `_diag` says `ERR: posthog 404`
Wrong project or host.
- `POSTHOG_PROJECT_ID` must be `140963`.
- `POSTHOG_HOST` must be `https://eu.i.posthog.com` (EU cloud, with
  the `i.`). US cloud users would have `https://us.i.posthog.com`.

### Some PostHog queries work, others say `ERR: posthog 400`
The query references an event/property your PostHog project doesn't
have under that exact name. Tell me which queries failed (the `_diag`
key) and I'll adapt them to your real event names.

### `_diag` shows `"rows:0"` for everything PostHog
The key works, but project 140963 has no events for those queries.
Either the project ID is wrong, or your site simply isn't sending those
events (e.g. `signed_in`, `hero_cta_clicked`).

### I redeployed but the badge still says "demo data"
- **Hard-refresh** the dashboard tab: Ctrl-Shift-R (Cmd-Shift-R on Mac).
  Browsers cache aggressively.
- Open DevTools → Console (F12). My code logs `[analytics] live diag:
  { ... }` on every load — paste me what that line shows.

---

## When in doubt — send me

If you're stuck, paste me the **`_diag`** object from Part 4. It has
the exact error message PostHog returned, and I can tell you the fix
in one sentence. Don't worry about sharing it — it contains no
secrets, just diagnostic strings.

---

## After it's working — a few good-hygiene things

- [ ] **Privacy:** the dashboard now shows real revenue. Turn on
      Vercel → Settings → **Deployment Protection** → **Vercel
      Authentication** so only your Vercel-logged-in self can view
      the production URL. (The page password alone is just a soft
      gate, not real security.)
- [ ] **Custom domain** (optional): right now `jeremylasne.com/analytics`
      only shows demo (GitHub Pages can't run the API). If you want
      the custom domain to show live data too, tell me and I'll point
      it at your Vercel URL via the `API_BASE` constant in the page.
