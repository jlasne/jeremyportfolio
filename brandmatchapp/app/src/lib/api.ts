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
  contacts: (campaign?: string | null, limit = 500) =>
    call<{ contacts: FeedRow[]; counts: { total: number; today: number; qualified: number } }>(
      `/contacts?limit=${limit}${campaign ? `&campaign=${campaign}` : ''}`,
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

export interface FeedRow {
  id: string
  handle: string
  name: string
  bio: string
  avatar: string | null
  followers: number
  engagement_rate: number | null
  median_reel_views: number | null
  posts_per_month: number | null
  last_post_at: string | null
  country: string | null
  language: string | null
  email: string | null
  external_links: string[]
  sells: string
  signals: { type: string; label: string; strength: 'strong' | 'soft'; date: string }[]
  niche: number
  niche_why: string
  selling: number
  signal: number
  stars: number
  campaign_id: string
  campaign_name: string
  agent_id: string | null
  discovered_at: string
  fresh: boolean
  note: string | null
  tags: string[]
  rejected: boolean
  done: boolean
}

export interface ApiCampaign {
  id: string
  name: string
  website: string | null
  brief: { who?: string; summary?: string; answers?: { questionId: string; value: string | null }[] }
  filters: Record<string, unknown>
  leads_per_day: number
  run_at: string
  active: boolean
  created_at: string
  agents: { id: string; name: string; focus: string; leads_per_day: number; active: boolean }[]
}

export interface ApiDaily {
  date: string
  campaign_id: string
  agent_id: string | null
  gathered: number
  leads: number
  qualified: number
}

export interface ApiPost {
  id: string
  creator_id: string
  kind: string
  url: string | null
  thumbnail: string | null
  views: number
  comments: number
  posted_at: string | null
}
