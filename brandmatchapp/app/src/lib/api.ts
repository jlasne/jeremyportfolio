// The API, from the browser. Two surfaces, and they are separate on purpose.
//
//   api  — what a client account can read. Leads, gates, quota, deals.
//   ops  — what only the owner can read. Cost, analysed volume, fair use.
//
// They are separate objects here and separate routers on the server, so a cost
// figure has no path into a client screen. Rule one of the product: we sell
// delivered leads and the production side of it is invisible.

const DIRECT = 'https://dashing-swan-386.eu-west-1.convex.site'

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

export function isLive(): boolean {
  return Boolean(getKey())
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
  campaign: (id: string) => call<{ campaign: unknown; gates: unknown }>('/api', `/campaigns/${id}`),
  /** Rewrites the brief and asks for a fresh gate proposal. */
  draftGates: (id: string, brief: string) =>
    call<{ gates: unknown }>('/api', `/campaigns/${id}/gates/draft`, { method: 'POST', body: JSON.stringify({ brief }) }),
  /** An edit writes a new gate version. Nothing is updated in place. */
  saveGates: (id: string, gates: unknown) =>
    call<{ gates: unknown }>('/api', `/campaigns/${id}/gates`, { method: 'POST', body: JSON.stringify(gates) }),
  feasibility: (id: string) => call<{ run: unknown }>('/api', `/campaigns/${id}/feasibility`, { method: 'POST' }),
  leads: (query = '') => call<{ leads: unknown[] }>('/api', `/leads${query}`),
  lead: (id: string) => call<{ lead: unknown }>('/api', `/leads/${id}`),
  /** The one click. Status in, event appended server side. */
  moveLead: (id: string, status: string, note?: string) =>
    call<{ ok: true }>('/api', `/leads/${id}/status`, { method: 'POST', body: JSON.stringify({ status, note }) }),
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

export interface OpsOverview {
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
