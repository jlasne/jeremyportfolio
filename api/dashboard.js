// api/dashboard.js — Vercel serverless function.
//
// Returns the analytics dashboard as aggregated JSON from Stripe + PostHog,
// using the project's env vars. NO secrets live in this file (keys come from
// process.env at runtime on Vercel), so it's fine that GitHub Pages serves its
// source — it just never runs there.
//
// Env (Vercel → Project → Settings → Environment Variables):
//   STRIPE_KEY                 restricted, read-only
//   POSTHOG_PROJECT_ID         e.g. 140963
//   POSTHOG_PERSONAL_API_KEY   scopes: query:read, person:read, insight:read
//   POSTHOG_HOST               https://eu.i.posthog.com
//   REQUIRE_TOKEN=1            optional — only then is DASHBOARD_TOKEN enforced
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

  // Token gate is OPT-IN (set REQUIRE_TOKEN=1). Off by default so a token
  // mismatch can't silently break the dashboard. For real privacy use
  // Vercel → Settings → Deployment Protection.
  if (process.env.REQUIRE_TOKEN === '1' && process.env.DASHBOARD_TOKEN &&
      req.headers['x-dashboard-token'] !== process.env.DASHBOARD_TOKEN) {
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
    return res.status(200).json({ error: String((e && e.message) || e) });
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
async function stripeAll(path, maxPages) {
  let out = [], after = '', guard = 0; maxPages = maxPages || 40;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const page = await stripe(path + sep + 'limit=100' + (after ? '&starting_after=' + after : ''));
    out = out.concat(page.data || []);
    if (page.has_more && page.data && page.data.length) after = page.data[page.data.length - 1].id;
    else break;
  } while (++guard < maxPages);
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
// resolve to null on failure so one bad query never sinks the response
const safe = async (fn) => { try { return await fn(); } catch (e) { return null; } };
const tag = (v) => v == null ? 'ERR' : (Array.isArray(v) ? 'rows:' + v.length : 'ok');

// ─── build (everything in parallel, fully resilient) ──────────────────────
async function build() {
  const out = { _diag: {} }, D = out._diag;
  const axis90 = dayAxis(90);
  const since90 = Math.floor((Date.now() - 90 * MS_DAY) / 1000);

  const errs = {};
  const run = (name, fn) => fn().then((v) => v, (e) => { errs[name] = String((e && e.message) || e).slice(0, 200); return null; });

  const [subs, charges, vis, sig, chan, sigChan, feat, clicks, pgs, sd, fc, fo, on] = await Promise.all([
    run('subscriptions', () => stripeAll('subscriptions?status=active&expand[]=data.items.data.price')),
    run('charges', () => stripeAll('charges?created[gte]=' + since90, 25)),
    run('visitors', () => hogql("SELECT toDate(timestamp) AS d, uniq(person_id) FROM events WHERE event='$pageview' AND timestamp > now() - INTERVAL 90 DAY GROUP BY d ORDER BY d")),
    run('signups', () => hogql("SELECT toDate(timestamp) AS d, uniq(person_id) FROM events WHERE event='signed_in' AND timestamp > now() - INTERVAL 90 DAY GROUP BY d ORDER BY d")),
    run('channels', () => hogql("SELECT properties.$channel_type, uniq(person_id), count() FROM events WHERE event='$pageview' AND timestamp > now() - INTERVAL 30 DAY GROUP BY 1 ORDER BY 2 DESC LIMIT 12")),
    run('signupsByChannel', () => hogql("SELECT person.properties.$initial_channel_type, uniq(person_id) FROM events WHERE event='signed_in' AND timestamp > now() - INTERVAL 90 DAY GROUP BY 1 ORDER BY 2 DESC LIMIT 20")),
    run('features', () => hogql("SELECT event, count(), uniq(person_id) FROM events WHERE event IN ('smartlink_created','issue_viewed','issue_fix_clicked','scan_completed','settings_updated') AND timestamp > now() - INTERVAL 30 DAY GROUP BY event ORDER BY 2 DESC")),
    run('clickmap', () => hogql("SELECT properties.$pathname, properties.$el_text, count() FROM events WHERE event='$autocapture' AND properties.$event_type='click' AND timestamp > now() - INTERVAL 7 DAY GROUP BY 1,2 HAVING count() > 2 ORDER BY 3 DESC LIMIT 12")),
    run('pages', () => hogql("SELECT properties.$pathname, count(), uniq(person_id) FROM events WHERE event='$pageview' AND timestamp > now() - INTERVAL 30 DAY GROUP BY 1 ORDER BY 2 DESC LIMIT 8")),
    run('scroll', () => hogql("SELECT properties.depth, uniq(person_id) FROM events WHERE event='scroll_depth_reached' AND timestamp > now() - INTERVAL 30 DAY GROUP BY 1 ORDER BY 1")),
    run('funnelConv', () => funnel(['hero_cta_clicked', 'signed_in', 'paywall_viewed', 'checkout_started', 'checkout_completed'], 30)),
    run('funnelOnb', () => funnel(['onboarding_started', 'app_added', 'paywall_viewed', 'checkout_completed', 'onboarding_completed'], 30)),
    run('online', () => hogql("SELECT uniq(person_id) FROM events WHERE timestamp > now() - INTERVAL 5 MINUTE")),
  ]);
  const vals = { subscriptions: subs, charges, visitors: vis, signups: sig, channels: chan, signupsByChannel: sigChan, features: feat, clickmap: clicks, pages: pgs, scroll: sd, funnelConv: fc, funnelOnb: fo, online: on };
  for (const k in vals) D[k] = errs[k] ? ('ERR: ' + errs[k]) : tag(vals[k]);

  const S = subs || [];
  const mrr = S.reduce((a, s) => a + mrrOf(s), 0);
  const monthly = S.filter((s) => (s.metadata || {}).tier === 'monthly');
  const annual = S.filter((s) => (s.metadata || {}).tier === 'annual');
  const paid = (charges || []).filter((c) => c.paid && c.status === 'succeeded' && !c.refunded);
  const revByDay = {}; axis90.forEach((a) => (revByDay[a.key] = 0));
  paid.forEach((c) => { const k = new Date(c.created * 1000).toISOString().slice(0, 10); if (k in revByDay) revByDay[k] += (c.amount || 0) / 100; });
  const scans = paid.filter((c) => (c.metadata || {}).tier === 'scan');
  const scan30 = scans.filter((c) => c.created * 1000 >= Date.now() - 30 * MS_DAY);

  out.kpi = {
    mrr: Math.round(mrr), subs: S.length,
    scanRev30: Math.round(scan30.reduce((a, c) => a + (c.amount || 0) / 100, 0)),
    trial2paid: 0, newMrr: 0, churnMrr: 0,
    mrrDelta: 0, subsDelta: 0, arpuDelta: 0, scanDelta: 0, trialDelta: 0,
  };
  out.plans = [
    { key: 'scan', name: 'Scan', price: 'one-time', customers: scans.length, mrr: 0, total: Math.round(scans.reduce((a, c) => a + (c.amount || 0) / 100, 0)) },
    { key: 'monthly', name: 'Monthly', price: '/ mo', customers: monthly.length, mrr: Math.round(monthly.reduce((a, s) => a + mrrOf(s), 0)), total: 0 },
    { key: 'annual', name: 'Annual', price: '/ yr', customers: annual.length, mrr: Math.round(annual.reduce((a, s) => a + mrrOf(s), 0)), total: 0 },
  ];
  out.recent = paid.sort((a, b) => b.created - a.created).slice(0, 8).map((c) => ({
    email: maskEmail((c.billing_details && c.billing_details.email) || c.receipt_email || ''),
    plan: (c.metadata && c.metadata.tier) || 'payment',
    planKey: { scan: 'scan', monthly: 'monthly', annual: 'annual' }[(c.metadata || {}).tier] || 'scan',
    source: '—', country: (c.billing_details && c.billing_details.address && c.billing_details.address.country) || '—',
    flag: '', amount: Math.round((c.amount || 0) / 100), when: ago(c.created * 1000),
  }));

  out.metricsData = { revenue: { series: axis90.map((a) => ({ d: a.d, full: a.full, v: Math.round(revByDay[a.key]) })), dlt: 0 } };
  if (vis) out.metricsData.visitors = { series: fillSeries(vis, axis90), dlt: 0 };
  if (sig) out.metricsData.signups = { series: fillSeries(sig, axis90), dlt: 0 };
  if (feat && feat.length) out.features = feat.map((r) => ({ event: r[0], events: Number(r[1]), users: Number(r[2]) }));
  if (clicks && clicks.length) out.clickmap = clicks.map((r) => ({ page: r[0] || '/', element: r[1] || '(unnamed)', clicks: Number(r[2]) }));
  if (pgs && pgs.length) out.pages = pgs.map((r) => ({ path: r[0] || '/', views: Number(r[1]), visitors: Number(r[2]) }));
  if (sd && sd.length) { const max = Math.max.apply(null, sd.map((r) => Number(r[1]))) || 1; out.scroll = sd.map((r) => ({ depth: Number(r[0]) || 0, pct: Math.round((Number(r[1]) / max) * 100) })); }
  if (fc && fc.length) out.funnelConv = fc;
  if (fo && fo.length) out.funnelOnb = fo;
  if (on && on[0]) out.online = Number(on[0][0]) || 0;

  // The headline join: Stripe subs → convexUserId → PostHog $initial_*
  const sources = await run('sources', async () => {
    const ids = S.map((s) => (s.metadata || {}).convexUserId).filter(Boolean).slice(0, 200);
    const byId = {};
    if (ids.length) {
      const inList = ids.map((id) => "'" + String(id).replace(/'/g, '') + "'").join(',');
      const attr = await hogql("SELECT id, properties.$initial_channel_type, properties.$initial_utm_source, properties.$initial_geoip_country_name FROM persons WHERE id IN (" + inList + ")");
      attr.forEach((r) => (byId[r[0]] = { channel: r[1], source: r[2], country: r[3] }));
    }
    const agg = {};
    S.forEach((s) => {
      const a = byId[(s.metadata || {}).convexUserId] || {};
      const key = a.channel || 'Direct';
      agg[key] = agg[key] || { name: key, channel: key, source: a.source || '', campaign: '', referrer: '', visitors: 0, signups: 0, customers: 0, mrr: 0, total: 0 };
      agg[key].customers += 1; agg[key].mrr += mrrOf(s);
    });
    const visMap = {}; (chan || []).forEach((r) => (visMap[r[0]] = Number(r[1]) || 0));
    const sigMap = {}; (sigChan || []).forEach((r) => (sigMap[r[0]] = Number(r[1]) || 0));
    return Object.values(agg).map((s) => ({ ...s, visitors: visMap[s.channel] || 0, signups: sigMap[s.channel] || 0, mrr: Math.round(s.mrr), total: Math.round(s.mrr * 12) })).sort((a, b) => b.mrr - a.mrr);
  });
  D.sources = errs.sources ? ('ERR: ' + errs.sources) : tag(sources);
  if (sources && sources.length) out.sources = sources;

  // If literally nothing came back, tell the page to stay on demo.
  if (subs == null && charges == null && vis == null && on == null) {
    out.error = 'no data — check STRIPE_KEY and the PostHog key/scopes (see _diag)';
  }
  return out;
}
