// The one API, from the browser.
//
// The key lives in localStorage, never in the bundle. With a key the app reads
// the real pool; without one it falls back to the sample data it shipped with,
// so a stranger who types the URL sees the prototype and no real lead.

// On its own domain the app calls /api, which Vercel rewrites to the Convex
// deployment: same origin, no redirect, and the backend address never ships in
// the bundle. Anywhere else, a local preview included, it talks to production
// directly. Either way this browser can be pointed elsewhere with setApi.
const DIRECT = 'https://dashing-swan-386.eu-west-1.convex.site/api'

function built(): string {
  try {
    return window.location.hostname.endsWith('brandmatch.app')
      ? `${window.location.origin}/api`
      : DIRECT
  } catch {
    return DIRECT
  }
}

const KEY = 'brandmatch.key'
const BASE = 'brandmatch.api'

function base(): string {
  try {
    return window.localStorage.getItem(BASE) || built()
  } catch {
    return built()
  }
}

export const API = base()

/**
 * Where an AI connects. On the app's own domain the rewrite that carries the
 * API carries MCP too, at /api/mcp. Against a Convex deployment directly, MCP
 * sits at the site root.
 */
export const MCP = API.endsWith('.convex.site/api')
  ? API.replace(/\/api$/, '/mcp')
  : `${API}/mcp`

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
  // Campaigns and their agents. The model proposes, a human approves.
  createCampaign: (body: { name?: string; website?: string; brief?: unknown; leadsPerDay?: number; seed?: number }) =>
    call<{ campaign: ApiCampaign; seededFromPool: number }>('/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  patchCampaign: (id: string, patch: Record<string, unknown>) =>
    call<{ campaign: ApiCampaign }>(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  propose: (id: string, website?: string) =>
    call<{ agents?: ApiAgent[]; who?: string; summary?: string; readSite?: boolean; error?: string }>(
      `/campaigns/${id}/propose`, { method: 'POST', body: JSON.stringify({ website }) },
    ),
  addAgent: (campaignId: string, body: Record<string, unknown>) =>
    call<{ agent: ApiAgent }>(`/campaigns/${campaignId}/agents`, { method: 'POST', body: JSON.stringify(body) }),
  setAgent: (agentId: string, on: boolean, body: Record<string, unknown> = {}) =>
    call<{ agent: ApiAgent }>(`/agents/${agentId}/${on ? 'approve' : 'pause'}`, { method: 'POST', body: JSON.stringify(body) }),
  removeAgent: (agentId: string) => call<{ ok: true }>(`/agents/${agentId}`, { method: 'DELETE' }),
  removeCampaign: (id: string) => call<{ ok: true }>(`/campaigns/${id}`, { method: 'DELETE' }),
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
