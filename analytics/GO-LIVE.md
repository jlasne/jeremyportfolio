# Making `/analytics` live (Stripe + PostHog)

Right now `/analytics` ships **illustrative demo data**. This doc is the recipe to
wire it to real numbers.

## Why this isn't just "paste the keys"

Your portfolio is a **static site on GitHub Pages — there is no server**. Stripe
and PostHog keys must stay **server-side**. If you put them in the page's
JavaScript, they ship to every visitor: anyone could read your live Stripe key
and your revenue. The spec says it too — *"Secrets server-side only… the browser
only sees aggregated JSON."*

So going live = adding a **tiny server layer** that holds the keys and returns
only aggregated JSON. You never commit keys to this repo and never put them in
the page.

---

## The keys you'll need (all read-only)

```bash
POSTHOG_PROJECT_ID=140963
POSTHOG_PERSONAL_API_KEY=phx_xxx        # scopes: query:read, person:read, insight:read
POSTHOG_HOST=https://eu.i.posthog.com   # API host derived: eu.i.posthog.com -> eu.posthog.com
STRIPE_SECRET_KEY=rk_live_xxx           # RESTRICTED key, read-only: Charges, Invoices, Subscriptions, Customers
DASHBOARD_TOKEN=<long-random-string>    # shared secret so only your dashboard can call the API
```

- **Stripe key — yes, read-only.** There is no Stripe *publishable* key that can
  read revenue (`pk_…` only creates payment tokens). To read it you create a
  **restricted key** (`rk_live_…`): Stripe → Developers → API keys → *Create
  restricted key* → set everything to **None** except **Read** on Charges,
  Invoices, Subscriptions, Customers. That key can't charge, refund, or change
  anything — it *is* "reading access". Never use `sk_live_…`.
- **PostHog personal key:** PostHog → Settings → Personal API keys → scopes
  `query:read`, `person:read`, `insight:read`.
- **POSTHOG_HOST:** the value above — `https://eu.i.posthog.com` — because your
  project (140963) is on PostHog **EU** cloud. It's the host you log in to / send
  events to; confirm under PostHog → Settings → Project. (US cloud would be
  `https://us.i.posthog.com`.)
- **DASHBOARD_TOKEN:** you make this one up — it isn't issued by anyone. It's a
  random string you set as the API's env var and send from the dashboard so only
  you can call the endpoint. Generate one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  (or `openssl rand -hex 32`) and use the same value in both places.

---

## Recommended path — host the data API on Vercel (~15 min)

GitHub Pages can't run code, so put a serverless function on **Vercel** (free
tier is fine). It can live in this same repo or a tiny separate one.

1. **Create the function** `api/dashboard.js` (see skeleton below).
2. **Push** to a repo and **import it into Vercel** (vercel.com → Add New →
   Project).
3. **Add the keys:** Vercel → your Project → **Settings → Environment
   Variables**. Add each `NAME=value` from the list above, scope **Production**
   (and Preview if you want). This is the answer to *"where do I drop the
   keys"* — here, never in the repo.
4. **Redeploy.** Your API is now at `https://<your-project>.vercel.app/api/dashboard`.
5. **Point the page at it** (one change, below).

> Local dev: create `analytics/.env.local` (or repo-root `.env.local`) with the
> same vars. `.env*` should be gitignored — double-check before committing.

### `api/dashboard.js` (Vercel serverless skeleton)

```js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PH_API = process.env.POSTHOG_HOST.replace('://eu.i.posthog.com', '://eu.posthog.com');
const PROJECT = process.env.POSTHOG_PROJECT_ID;

let cache = { at: 0, data: null };           // 15-min in-memory cache

async function hogql(query) {
  const r = await fetch(`${PH_API}/api/projects/${PROJECT}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!r.ok) throw new Error('posthog ' + r.status);
  return (await r.json()).results;
}

export default async function handler(req, res) {
  // gate: only your dashboard may call this
  if (req.headers['x-dashboard-token'] !== process.env.DASHBOARD_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (Date.now() - cache.at < 15 * 60 * 1000) return res.json(cache.data);

  // 1) Stripe — MRR, subs, charges (paginate in real impl)
  const subs = await stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.items.data.price'] });
  let mrr = 0;
  for (const s of subs.data) for (const it of s.items.data) {
    const amt = (it.price.unit_amount || 0) / 100, iv = it.price.recurring?.interval;
    mrr += iv === 'year' ? amt / 12 : iv === 'week' ? amt * 52 / 12 : amt;
  }

  // 2) The join — Stripe userIds -> PostHog $initial_* first-touch (spec §8)
  const userIds = subs.data.map(s => s.metadata?.convexUserId).filter(Boolean);
  const attr = userIds.length ? await hogql(
    `SELECT id, properties.$initial_channel_type AS channel,
            properties.$initial_utm_source AS source,
            properties.$initial_geoip_country_name AS country
     FROM persons WHERE id IN (${userIds.map(id => `'${id}'`).join(',')})`
  ) : [];

  // 3) Top-of-funnel (visitors/signups by channel) — see spec §8 for the queries
  // ... build channels, sources, funnels, features, clickmap, retention ...

  const data = { kpi: { mrr: Math.round(mrr), subs: subs.data.length /* ... */ },
                 /* sources, plans, countries, funnels, features, clickmap, ... */ };
  cache = { at: Date.now(), data };
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jeremylasne.com');
  res.json(data);
}
```

Fill in the rest from the spec: §4 (Stripe MRR/revenue), §6/§7 (cards), §8 (the
exact HogQL + FunnelsQuery), §10 (gotchas: cents, timezone, caching). The page
already renders everything from a single object — your job server-side is to
produce that object as **plain JSON** (numbers + arrays, no functions).

---

## Point the page at the API (one change)

In [`analytics/index.html`](./index.html), the whole dashboard is fed by one
function near the bottom:

```js
function buildApp(){
  DATA = makeData();   // <-- demo data
  ...
}
```

To go live, fetch instead and map the JSON into the same shape (keep the chart
formatters client-side):

```js
async function buildApp(){
  DATA = await loadData();
  ...
}
async function loadData(){
  const API = '';   // e.g. 'https://your-project.vercel.app/api/dashboard'
  if(!API) return makeData();                 // still demo if unset
  try{
    const r = await fetch(API, { headers: { 'x-dashboard-token': 'PASTE_DASHBOARD_TOKEN' } });
    if(r.ok) return adaptApi(await r.json());  // adaptApi mirrors makeData() but fills from API numbers
  }catch(e){ console.warn('analytics api failed, showing demo', e); }
  return makeData();
}
```

> Note: putting `DASHBOARD_TOKEN` in the page makes it readable to anyone who
> loads the page. That's acceptable only because the API is **read-only and
> aggregated**. For real privacy, gate the dashboard at the host level
> (Cloudflare Access / Vercel password) instead of relying on the client token.

Ping me when you've got the Vercel URL + token and I'll wire `adaptApi()` to the
exact spec queries so it's plug-and-play.

---

## Alternative: move the whole dashboard to Vercel

If you'd rather not keep it on GitHub Pages, the cleanest long-term option is to
build the dashboard as the spec describes — a small **Next.js app on Vercel**
(or `analytics.jeremylasne.com`) with the API routes and the UI together. Then
keys, auth (Vercel password / Cloudflare Access), and data all live in one place
and nothing sensitive is ever in this static repo. This static page works as the
design/preview in the meantime.

---

## Security checklist

- [ ] Stripe key is **restricted + read-only** (`rk_live_…`), not `sk_live_…`.
- [ ] Keys live in the host's env vars, **never** in this repo or the page.
- [ ] `.env*` is gitignored.
- [ ] API requires `DASHBOARD_TOKEN` and sets a tight CORS origin.
- [ ] Responses cached 15–60 min (both APIs rate-limit).
- [ ] Real privacy for real numbers → host-level auth, not just the client gate.
- [ ] Rotate any key that ever touches the browser or a commit.
