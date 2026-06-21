// api/dashboard.js — Vercel serverless function.
//
// Returns the analytics dashboard as aggregated JSON, read from Stripe + PostHog
// using the project's env vars. NB: this file contains NO secrets (keys come
// from process.env at runtime on Vercel), so it's safe that GitHub Pages serves
// its source — it just never runs there.
//
// Env (set in Vercel → Project → Settings → Environment Variables):
//   STRIPE_KEY                 restricted, read-only
//   POSTHOG_PROJECT_ID         e.g. 140963
//   POSTHOG_PERSONAL_API_KEY   scopes: query:read, person:read, insight:read
//   POSTHOG_HOST               https://eu.i.posthog.com
//   DASHBOARD_TOKEN            optional; if set, callers must send x-dashboard-token
//
// No external dependencies — uses global fetch (Node 18+ on Vercel).

const CACHE = { at: 0, data: null };
const TTL = 15 * 60 * 1000;
const MS_DAY = 86400000;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'x-dashboard-token, content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const need = process.env.DASHBOARD_TOKEN;
  if (need && req.headers['x-dashboard-token'] !== need) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (CACHE.data && Date.now() - CACHE.at < TTL) {
    res.setHeader('x-cache', 'hit');
    return res.status(200).json(CACHE.data);
  }
  try {
    const data = await build();
    CACHE.at = Date.now(); CACHE.data = data;
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};

// ─── Stripe (REST via fetch) ──────────────────────────────────────────────
async function stripe(path) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_KEY },
  });
  if (!r.ok) throw new Error('stripe ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return r.json();
}
async function stripeAll(path) {
  let out = [], after = '', guard = 0;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const page = await stripe(path + sep + 'limit=100' + (after ? '&starting_after=' + after : ''));
    out = out.concat(page.data || []);
    if (page.has_more && page.data && page.data.length) after = page.data[page.data.length - 1].id;
    else break;
  } while (++guard < 40);
  return out;
}
function mrrOf(sub) {
  let m = 0;
  for (const it of (sub.items && sub.items.data) || []) {
    const p = it.price || {}, amt = (p.unit_amount || 0) / 100, q = it.quantity || 1;
    const iv = p.recurring && p.recurring.interval;
    m += (iv === 'year' ? amt / 12 : iv === 'week' ? amt * 52 / 12 : iv === 'day' ? amt * 365 / 12 : amt) * q;
  }
  return m;
}

// ─── PostHog (Query API) ──────────────────────────────────────────────────
function phHost() {
  return (process.env.POSTHOG_HOST || 'https://eu.i.posthog.com')
    .replace('://eu.i.posthog.com', '://eu.posthog.com')
    .replace('://us.i.posthog.com', '://us.posthog.com');
}
async function phQuery(query) {
  const r = await fetch(phHost() + '/api/projects/' + process.env.POSTHOG_PROJECT_ID + '/query/', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.POSTHOG_PERSONAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error('posthog ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return r.json();
}
const hogql = (q) => phQuery({ kind: 'HogQLQuery', query: q }).then((j) => j.results || []);
async function funnel(events, days) {
  const j = await phQuery({
    kind: 'FunnelsQuery', dateRange: { date_from: '-' + days + 'd' },
    series: events.map((e) => ({ kind: 'EventsNode', event: e })),
  });
  const steps = Array.isArray(j.results && j.results[0]) ? j.results[0] : j.results;
  return (steps || []).map((s, i) => ({
    name: s.name || s.custom_name || events[i] || ('Step ' + (i + 1)),
    count: Number(s.count || 0),
  }));
}

// ─── helpers ──────────────────────────────────────────────────────────────
function dayAxis(n) {
  const out = [], today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * MS_DAY);
    out.push({
      key: d.toISOString().slice(0, 10),
      d: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      full: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    });
  }
  return out;
}
function fillSeries(rows, axis) {
  const m = {};
  (rows || []).forEach((r) => { m[String(r[0]).slice(0, 10)] = Number(r[1]) || 0; });
  return axis.map((a) => ({ d: a.d, full: a.full, v: m[a.key] || 0 }));
}
const maskEmail = (e) => (!e || e.indexOf('@') < 0 ? '—' : (e[0] || '') + '•••@' + e.split('@')[1]);
function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago';
  if (s < MS_DAY / 1000) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}
// run a section, but never let one failed query sink the whole response
const safe = async (fn) => { try { return await fn(); } catch (e) { return null; } };

// ─── build ────────────────────────────────────────────────────────────────
async function build() {
  const out = {};
  const axis90 = dayAxis(90);

  // Stripe: active subscriptions → MRR / subs / plans
  const subs = await stripeAll('subscriptions?status=active&expand[]=data.items.data.price');
  const mrr = subs.reduce((a, s) => a + mrrOf(s), 0);
  const monthly = subs.filter((s) => (s.metadata || {}).tier === 'monthly');
  const annual = subs.filter((s) => (s.metadata || {}).tier === 'annual');

  // Stripe: charges (90d) → revenue series + one-time scans
  const since90 = Math.floor((Date.now() - 90 * MS_DAY) / 1000);
  const charges = (await safe(() => stripeAll('charges?created[gte]=' + since90))) || [];
  const paid = charges.filter((c) => c.paid && c.status === 'succeeded' && !c.refunded);
  const revByDay = {}; axis90.forEach((a) => (revByDay[a.key] = 0));
  paid.forEach((c) => {
    const k = new Date(c.created * 1000).toISOString().slice(0, 10);
    if (k in revByDay) revByDay[k] += (c.amount || 0) / 100;
  });
  const scans = paid.filter((c) => (c.metadata || {}).tier === 'scan');
  const scan30 = scans.filter((c) => c.created * 1000 >= Date.now() - 30 * MS_DAY);

  out.kpi = {
    mrr: Math.round(mrr),
    subs: subs.length,
    scanRev30: Math.round(scan30.reduce((a, c) => a + (c.amount || 0) / 100, 0)),
    trial2paid: 0, newMrr: 0, churnMrr: 0,
    mrrDelta: 0, subsDelta: 0, arpuDelta: 0, scanDelta: 0, trialDelta: 0,
  };
  out.plans = [
    { key: 'scan', name: 'Scan', price: 'one-time', customers: scans.length, mrr: 0,
      total: Math.round(scans.reduce((a, c) => a + (c.amount || 0) / 100, 0)) },
    { key: 'monthly', name: 'Monthly', price: '/ mo', customers: monthly.length,
      mrr: Math.round(monthly.reduce((a, s) => a + mrrOf(s), 0)), total: 0 },
    { key: 'annual', name: 'Annual', price: '/ yr', customers: annual.length,
      mrr: Math.round(annual.reduce((a, s) => a + mrrOf(s), 0)), total: 0 },
  ];
  out.recent = paid.sort((a, b) => b.created - a.created).slice(0, 8).map((c) => ({
    email: maskEmail((c.billing_details && c.billing_details.email) || c.receipt_email || ''),
    plan: (c.metadata && c.metadata.tier) || 'payment',
    planKey: { scan: 'scan', monthly: 'monthly', annual: 'annual' }[(c.metadata || {}).tier] || 'scan',
    source: '—',
    country: (c.billing_details && c.billing_details.address && c.billing_details.address.country) || '—',
    flag: '', amount: Math.round((c.amount || 0) / 100), when: ago(c.created * 1000),
  }));

  out.metricsData = { revenue: { series: axis90.map((a) => ({ d: a.d, full: a.full, v: Math.round(revByDay[a.key]) })), dlt: 0 } };

  // PostHog: visitor / signup daily series
  const vis = await safe(() => hogql(
    "SELECT toDate(timestamp) AS d, uniq(person_id) FROM events WHERE event='$pageview' AND timestamp > now() - INTERVAL 90 DAY GROUP BY d ORDER BY d"));
  if (vis) out.metricsData.visitors = { series: fillSeries(vis, axis90), dlt: 0 };
  const sig = await safe(() => hogql(
    "SELECT toDate(timestamp) AS d, uniq(person_id) FROM events WHERE event='signed_in' AND timestamp > now() - INTERVAL 90 DAY GROUP BY d ORDER BY d"));
  if (sig) out.metricsData.signups = { series: fillSeries(sig, axis90), dlt: 0 };

  // PostHog: visitors + signups by channel (for the source table)
  const chan = await safe(() => hogql(
    "SELECT properties.$channel_type, uniq(person_id), count() FROM events WHERE event='$pageview' AND timestamp > now() - INTERVAL 30 DAY GROUP BY 1 ORDER BY 2 DESC LIMIT 12"));
  const sigChan = await safe(() => hogql(
    "SELECT person.properties.$initial_channel_type, uniq(person_id) FROM events WHERE event='signed_in' AND timestamp > now() - INTERVAL 90 DAY GROUP BY 1 ORDER BY 2 DESC LIMIT 20"));

  // The headline join: Stripe subs → convexUserId → PostHog $initial_*
  const sources = await safe(async () => {
    const ids = subs.map((s) => (s.metadata || {}).convexUserId).filter(Boolean);
    const byId = {};
    if (ids.length) {
      const inList = ids.map((id) => "'" + String(id).replace(/'/g, '') + "'").join(',');
      const attr = await hogql(
        "SELECT id, properties.$initial_channel_type, properties.$initial_utm_source, properties.$initial_geoip_country_name FROM persons WHERE id IN (" + inList + ")");
      attr.forEach((r) => (byId[r[0]] = { channel: r[1], source: r[2], country: r[3] }));
    }
    const agg = {};
    subs.forEach((s) => {
      const a = byId[(s.metadata || {}).convexUserId] || {};
      const key = a.channel || 'Direct';
      agg[key] = agg[key] || { name: key, channel: key, source: a.source || '', campaign: '', referrer: '', visitors: 0, signups: 0, customers: 0, mrr: 0, total: 0 };
      agg[key].customers += 1; agg[key].mrr += mrrOf(s);
    });
    const visMap = {}; (chan || []).forEach((r) => (visMap[r[0]] = Number(r[1]) || 0));
    const sigMap = {}; (sigChan || []).forEach((r) => (sigMap[r[0]] = Number(r[1]) || 0));
    return Object.values(agg).map((s) => ({
      ...s, visitors: visMap[s.channel] || 0, signups: sigMap[s.channel] || 0,
      mrr: Math.round(s.mrr), total: Math.round(s.mrr * 12),
    })).sort((a, b) => b.mrr - a.mrr);
  });
  if (sources && sources.length) out.sources = sources;

  // Feature usage
  const feat = await safe(() => hogql(
    "SELECT event, count(), uniq(person_id) FROM events WHERE event IN ('smartlink_created','issue_viewed','issue_fix_clicked','scan_completed','settings_updated') AND timestamp > now() - INTERVAL 30 DAY GROUP BY event ORDER BY 2 DESC"));
  if (feat && feat.length) out.features = feat.map((r) => ({ event: r[0], events: Number(r[1]), users: Number(r[2]) }));

  // Click map
  const clicks = await safe(() => hogql(
    "SELECT properties.$pathname, properties.$el_text, count() FROM events WHERE event='$autocapture' AND properties.$event_type='click' AND timestamp > now() - INTERVAL 7 DAY GROUP BY 1,2 HAVING count() > 2 ORDER BY 3 DESC LIMIT 12"));
  if (clicks && clicks.length) out.clickmap = clicks.map((r) => ({ page: r[0] || '/', element: r[1] || '(unnamed)', clicks: Number(r[2]) }));

  // Top pages
  const pgs = await safe(() => hogql(
    "SELECT properties.$pathname, count(), uniq(person_id) FROM events WHERE event='$pageview' AND timestamp > now() - INTERVAL 30 DAY GROUP BY 1 ORDER BY 2 DESC LIMIT 8"));
  if (pgs && pgs.length) out.pages = pgs.map((r) => ({ path: r[0] || '/', views: Number(r[1]), visitors: Number(r[2]) }));

  // Scroll depth
  const sd = await safe(() => hogql(
    "SELECT properties.depth, uniq(person_id) FROM events WHERE event='scroll_depth_reached' AND timestamp > now() - INTERVAL 30 DAY GROUP BY 1 ORDER BY 1"));
  if (sd && sd.length) {
    const max = Math.max.apply(null, sd.map((r) => Number(r[1]))) || 1;
    out.scroll = sd.map((r) => ({ depth: Number(r[0]) || 0, pct: Math.round((Number(r[1]) / max) * 100) }));
  }

  // Funnels
  const fc = await safe(() => funnel(['hero_cta_clicked', 'signed_in', 'paywall_viewed', 'checkout_started', 'checkout_completed'], 30));
  if (fc && fc.length) out.funnelConv = fc;
  const fo = await safe(() => funnel(['onboarding_started', 'app_added', 'paywall_viewed', 'checkout_completed', 'onboarding_completed'], 30));
  if (fo && fo.length) out.funnelOnb = fo;

  // Live now (unique persons in last 5 min)
  const on = await safe(() => hogql("SELECT uniq(person_id) FROM events WHERE timestamp > now() - INTERVAL 5 MINUTE"));
  if (on && on[0]) out.online = Number(on[0][0]) || 0;

  return out;
}
