// The API, from the browser. Two surfaces, and they are separate on purpose.
//
//   api  — what a client account can read. Leads, gates, quota, deals.
//   ops  — what only the owner can read. Cost, analysed volume, fair use.
//
// They are separate objects here and separate routers on the server, so a cost
// figure has no path into a client screen. Rule one of the product: we sell
// delivered leads and the production side of it is invisible.

/**
 * The deployment, for anywhere that is not brandmatch.app.
 *
 * On the domain itself the two surfaces are same origin, proxied by the
 * rewrites in brandmatchapp/vercel.json. That file holds this address a second
 * time and the two have to move together: a stale rewrite answers 404 to every
 * call while this constant looks perfectly correct.
 */
const DIRECT = 'https://limitless-ladybug-747.eu-west-1.convex.site'

function built(): string {
  try {
    return window.location.hostname.endsWith('brandmatch.app') ? window.location.origin : DIRECT
  } catch {
    return DIRECT
  }
}

const KEY = 'brandmatch.key'
const BASE = 'brandmatch.api'

function root(): string {
  try {
    return window.localStorage.getItem(BASE) || built()
  } catch {
    return built()
  }
}

export const API = `${root()}/api`
export const OPS = `${root()}/ops`

/** Points this browser at another deployment, for a move or a staging one. */
export function setApi(url: string): void {
  try {
    if (url) window.localStorage.setItem(BASE, url.replace(/\/$/, ''))
    else window.localStorage.removeItem(BASE)
  } catch {
    /* a browser with storage off stays on the built-in address */
  }
}

export function getKey(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setKey(key: string): void {
  try {
    if (key) window.localStorage.setItem(KEY, key.trim())
    else window.localStorage.removeItem(KEY)
  } catch {
    /* a browser with storage off still runs on the sample data */
  }
}

/** A key is stored: this browser belongs to an account. */
export function hasKey(): boolean {
  return Boolean(getKey())
}

/**
 * The demo: the sample, exactly as a client with a full account sees it.
 * No bar, no way back, nothing that says it is a sample, because the point
 * is to look at the product and not at a notice. The flag lives in this tab
 * alone, so a tab opened on #/demo stays the demo and a new tab is the
 * account again, key kept.
 */
const DEMO = 'brandmatch.demo'

export function isDemo(): boolean {
  try {
    return window.sessionStorage.getItem(DEMO) === '1'
  } catch {
    return false
  }
}

export function setDemo(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(DEMO, '1')
    else window.sessionStorage.removeItem(DEMO)
  } catch {
    /* storage off: the sample is all there is anyway */
  }
}

/** The screens read the account's own data, not the sample. */
export function isLive(): boolean {
  return hasKey() && !isDemo()
}

async function call<T>(prefix: string, path: string, init: RequestInit = {}): Promise<T> {
  const key = getKey()
  const res = await fetch(`${root()}${prefix}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `The API replied ${res.status}`)
  return body as T
}

// ---------------------------------------------------------------------------
// Client surface
// ---------------------------------------------------------------------------

export const api = {
  /** The account, its plan and the month's balance. No volume, no cost. */
  me: () => call<ClientMe>('/api', '/me'),
  campaigns: () => call<{ campaigns: unknown[] }>('/api', '/campaigns'),
  createCampaign: (body: { name?: string; audience: string; offer: string; dailyCap?: number }) =>
    call<{ campaign: { id: string } }>('/api', '/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  campaign: (id: string) => call<{ campaign: unknown; gates: unknown }>('/api', `/campaigns/${id}`),
  /**
   * The two questions in, a full proposal out. The server picks the Gate 3
   * library and the model only edits inside it, so the answer is always one of
   * the three libraries and never seven invented criteria.
   */
  draftGates: (id: string, audience: string, offer: string) =>
    call<{ gates: unknown; name?: string; templateId?: string }>('/api', `/campaigns/${id}/gates/draft`, {
      method: 'POST',
      body: JSON.stringify({ audience, offer }),
    }),
  /** An edit writes a new gate version. Nothing is updated in place. */
  saveGates: (id: string, gates: unknown) =>
    call<{ gates: unknown }>('/api', `/campaigns/${id}/gates`, { method: 'POST', body: JSON.stringify(gates) }),
  feasibility: (id: string) => call<{ run: unknown }>('/api', `/campaigns/${id}/feasibility`, { method: 'POST' }),
  leads: (query = '') => call<{ leads: unknown[] }>('/api', `/leads${query}`),
  lead: (id: string) => call<{ lead: unknown }>('/api', `/leads/${id}`),
  /** The one click. Status in, event appended server side. */
  moveLead: (id: string, status: string, note?: string) =>
    call<{ ok: true }>('/api', `/leads/${id}/status`, { method: 'POST', body: JSON.stringify({ status, note }) }),
  /** One click back out of the last change. */
  undoLead: (id: string) => call<{ ok: true }>('/api', `/leads/${id}/undo`, { method: 'POST' }),
  /** Saved and notes. Plain fields, nothing to do with the deal. */
  markLead: (id: string, patch: { saved?: boolean; note?: string }) =>
    call<{ ok: true }>('/api', `/leads/${id}/mark`, { method: 'POST', body: JSON.stringify(patch) }),
  /** The client's own labels. Add and remove in one call. */
  tagLead: (id: string, patch: { add?: string[]; remove?: string[] }) =>
    call<{ ok: true; tags: string[] }>('/api', `/leads/${id}/tags`, { method: 'POST', body: JSON.stringify(patch) }),
  tags: () => call<{ tags: { name: string; leads: number }[] }>('/api', '/tags'),
  recordDeal: (id: string, amountCents: number, note?: string) =>
    call<{ ok: true }>('/api', `/leads/${id}/deal`, { method: 'POST', body: JSON.stringify({ amountCents, note }) }),
  waitlist: (email: string, website?: string) =>
    call<{ ok: true }>('/api', '/waitlist', { method: 'POST', body: JSON.stringify({ email, website }) }),
  /** A password in, the owner's key out. The one call that needs no key. */
  adminLogin: (password: string) =>
    call<{ key: string; email: string }>('/api', '/admin-login', { method: 'POST', body: JSON.stringify({ password }) }),
}

/** Everything a client account is allowed to know about itself. */
export interface ClientMe {
  account: { id: string; name: string; kind: 'brand' | 'agency'; email: string; timezone: string }
  role: 'owner' | 'client'
  subscription: { tier: number; priceCents: number; currency: string; status: string; period: string }
  quota: { entitled: number; delivered: number; carried: number; remaining: number }
}

// ---------------------------------------------------------------------------
// Internal surface. Owner only, and never imported by a client screen.
// ---------------------------------------------------------------------------

export const ops = {
  overview: () => call<OpsOverview>('/ops', '/overview'),
  runs: (limit = 30) => call<{ runs: OpsRun[] }>('/ops', `/runs?limit=${limit}`),
  setBudget: (accountId: string, analysisBudgetPerDay: number) =>
    call<{ ok: true }>('/ops', '/budget', { method: 'POST', body: JSON.stringify({ accountId, analysisBudgetPerDay }) }),
}

export interface OpsRun {
  id: string
  campaignId: string | null
  phase: string
  status: string
  profilesFetched: number
  profilesEvaluated: number
  qualified: number
  costCents: number
  startedAt: number
  finishedAt: number | null
}

/** One campaign, as the operator sees it. Cost and analysed volume included. */
export interface OpsCampaign {
  id: string
  name: string
  account: string
  status: string
  perDay: number
  /** Over the last thirty days. */
  analysed: number
  passedSize: number
  passedNiche: number
  passedBreakers: number
  qualified: number
  delivered: number
  costCents: number
  costPerQualifiedCents: number | null
  /** Found, qualified and not yet handed over. The part of the room we hold. */
  held: number
  daysHeld: number | null
  /** Each way of searching on its own line. Steers the sourcing work. */
  channels: OpsChannel[]
}

export interface OpsChannel {
  /** search, accounts, neighbour or seed. */
  channel: string
  analysed: number
  passedSize: number
  passedNiche: number
  qualified: number
  costCents: number
  costPerQualifiedCents: number | null
}

export interface OpsDay {
  date: string
  analysed: number
  qualified: number
  costCents: number
}

export interface OpsOverview {
  campaigns: OpsCampaign[]
  days: OpsDay[]
  accounts: {
    id: string
    name: string
    tier: number
    priceCents: number
    deliveredThisPeriod: number
    analysedToday: number
    analysisBudgetPerDay: number
    costCentsThisPeriod: number
  }[]
  totals: {
    revenueCentsPerMonth: number
    costCentsPerMonth: number
    marginPct: number | null
    profilesAnalysedToday: number
    leadsDeliveredToday: number
  }
}
