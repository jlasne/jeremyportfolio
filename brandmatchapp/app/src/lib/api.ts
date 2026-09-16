// The one API, from the browser.
//
// The key lives in localStorage, never in the bundle. With a key the app reads
// the real pool; without one it falls back to the sample data it shipped with,
// so a stranger who types the URL sees the prototype and no real lead.

// The Convex deployment serving the API. Set once the backend is deployed,
// and overridable from this browser while a deployment is being moved.
const DEFAULT_API = 'https://canny-mandrill-528.eu-west-1.convex.site/api'

const KEY = 'brandmatch.key'
const BASE = 'brandmatch.api'

function base(): string {
  try {
    return window.localStorage.getItem(BASE) || DEFAULT_API
  } catch {
    return DEFAULT_API
  }
}

export const API = base()

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

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = getKey()
  const res = await fetch(`${base()}${path}`, {
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

export const api = {
  me: () => call<{ id: string; email: string; credits: number; plan: string; role: 'owner' | 'brand'; availableToYou: number }>('/me'),
  contacts: (campaign?: string | null, limit = 500, offset = 0) =>
    call<{ contacts: FeedRow[]; counts: { total: number; today: number; qualified: number } }>(
      `/contacts?limit=${limit}&offset=${offset}${campaign ? `&campaign=${campaign}` : ''}`,
    ),
  campaigns: () => call<{ campaigns: ApiCampaign[] }>('/campaigns'),
  stats: (days = 30) => call<{ daily: ApiDaily[] }>(`/stats?days=${days}`),
  creator: (id: string) => call<{ creator: FeedRow; posts: ApiPost[] }>(`/creators/${id}`),
  act: (creatorId: string, action: string, value?: string) =>
    call<{ ok: true }>('/actions', { method: 'POST', body: JSON.stringify({ creatorId, action, value }) }),
  run: (campaignId: string) => call<{ started: number }>(`/campaigns/${campaignId}/run`, { method: 'POST' }),
  waitlist: (email: string, website?: string) =>
    call<{ ok: true }>('/waitlist', { method: 'POST', body: JSON.stringify({ email, website }) }),
  admin: () => call<AdminOverview>('/admin'),
  setSettings: (patch: Partial<AdminSettings>) =>
    call<{ settings: AdminSettings }>('/admin/settings', { method: 'POST', body: JSON.stringify(patch) }),
}

export interface AdminSettings {
  freshFloor: number
  includedPerDay: number
  claimDays: number
  trialDays: number
  trialCredits: number
}

export interface AdminOverview {
  settings: AdminSettings
  pool: { size: number; free: number; sustainablePerDay: number }
  demand: { paidAccounts: number; leadsPerDay: number }
  recommendation: { floor: number; ceiling: number; current: number; verdict: 'pool runs dry' | 'margin too thin' | 'in range' }
  cost: { apifyPerDay: number; scoringPerDay: number; perMonth: number; revenuePerMonth: number; marginPct: number | null }
  accounts: {
    id: string; email: string; plan: 'trial' | 'paid'; role: 'owner' | 'brand'; credits: number
    trialDaysLeft: number; quota: number; today: number; freshToday: number; poolToday: number; costPerDay: number
  }[]
}

// What the API sends back -------------------------------------------------
// Convex shapes: camelCase, ids under _id where the row is a document, and
// every date as milliseconds since the epoch.

export interface FeedRow {
  id: string
  handle: string
  name: string
  bio: string
  avatar?: string
  followers: number
  engagementRate?: number
  medianReelViews?: number
  postsPerMonth?: number
  lastPostAt?: number
  country?: string
  language?: string
  email?: string
  externalLinks: string[]
  sells: string
  signals: { type: string; label: string; strength: 'strong' | 'soft'; date: string }[]
  niche: number
  nicheWhy: string
  selling: number
  signal: number
  stars: number
  campaignId: string
  campaignName: string
  agentId?: string
  discoveredAt: number
  fresh: boolean
  note?: string
  tags: string[]
  rejected: boolean
  done: boolean
}

export interface ApiAgent {
  _id: string
  campaignId: string
  name: string
  focus: string
  keywords: string[]
  hashtags: string[]
  leadsPerDay: number
  status: 'proposed' | 'active' | 'paused'
  proposedWhy?: string
  lastRunAt?: number
}

export interface ApiCampaign {
  _id: string
  _creationTime: number
  name: string
  website?: string
  brief: { who?: string; summary?: string; answers?: { questionId: string; value: string | null }[] }
  filters: Record<string, unknown>
  leadsPerDay: number
  runAt: string
  active: boolean
  agents: ApiAgent[]
}

export interface ApiDaily {
  date: string
  campaignId: string
  agentId?: string
  gathered: number
  leads: number
  qualified: number
}

export interface ApiPost {
  _id: string
  creatorId: string
  kind: string
  url: string
  thumbnail?: string
  views: number
  likes: number
  comments: number
  postedAt?: number
}
