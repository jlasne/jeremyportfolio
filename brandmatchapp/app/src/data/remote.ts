import type { Campaign, Country, Creator, DailyStat, Filters, Language, Level, Note, Signal } from '../types'
import { api, type ApiCampaign, type ApiDaily, type FeedRow } from '../lib/api'
import { defaultFilters } from '../mock/filters'

// Turns what the API sends into the shapes every screen already reads.
// The star rule stays in data/score.ts: the API hands over niche, sells and
// the dated signals, and the front end adds them up the same way it always has.
//
// Convex speaks camelCase and hands dates over as milliseconds. The app's
// types carry ISO strings, so every date crosses here and nowhere else.

const iso = (ms: number | undefined | null): string => (ms ? new Date(ms).toISOString() : new Date().toISOString())

function level(n: number | null | undefined): Level {
  return n === 1 ? 1 : n === 0.5 ? 0.5 : 0
}

function toCreator(r: FeedRow): Creator {
  return {
    id: r.id,
    handle: r.handle,
    name: r.name || r.handle,
    bio: r.bio ?? '',
    followers: r.followers ?? 0,
    engagementRate: r.engagementRate ?? 0,
    medianReelViews: r.medianReelViews ?? 0,
    postsPerMonth: r.postsPerMonth ?? 0,
    lastPostAt: iso(r.lastPostAt),
    country: (r.country as Country) ?? 'US',
    language: (r.language as Language) ?? 'en',
    email: r.email ?? null,
    signals: (r.signals ?? []) as Signal[],
    niche: level(r.niche),
    nicheWhy: r.nicheWhy || 'Not read against the brief yet',
    sells: r.sells ?? '',
    campaignId: r.campaignId,
    agentId: r.agentId ?? '',
    firstSeenAt: iso(r.discoveredAt),
    lastCrawlAt: iso(r.discoveredAt),
  }
}

/**
 * What the API assumes when a campaign leaves a filter unset. The sample data
 * ships stricter defaults for a fuller demo; live, the list must show what the
 * API returned, so the gaps are filled the way the API fills them.
 */
const API_DEFAULTS: Filters = {
  ...defaultFilters,
  followersMin: 0,
  followersMax: 2_000_000_000,
  engagementMin: 0,
  reelViewsMin: null,
  emailInBio: 'any',
  lastPostWithin: 90,
  postsPerMonthMin: 0,
  countries: [],
  languages: [],
}

function toFilters(f: Record<string, unknown>): Filters {
  return {
    ...API_DEFAULTS,
    ...(f as Partial<Filters>),
    countries: (f.countries as Country[]) ?? [],
    languages: (f.languages as Language[]) ?? [],
  }
}

function toCampaign(c: ApiCampaign): Campaign {
  return {
    id: c._id,
    name: c.name,
    website: c.website ?? '',
    brief: {
      who: c.brief?.who ?? '',
      answers: c.brief?.answers ?? [],
      summary: c.brief?.summary ?? '',
    },
    filters: toFilters(c.filters ?? {}),
    agents: (c.agents ?? []).map((a) => ({
      id: a._id,
      name: a.name,
      focus: a.focus,
      leadsPerDay: a.leadsPerDay,
      active: a.status === 'active',
      status: a.status ?? 'active',
      hashtags: a.hashtags ?? [],
      why: a.proposedWhy,
    })),
    leadsPerDay: c.leadsPerDay,
    runAt: c.runAt,
    active: c.active,
    createdAt: iso(c._creationTime),
  }
}

function toDaily(d: ApiDaily): DailyStat {
  return {
    date: d.date,
    gathered: d.gathered,
    campaignId: d.campaignId,
    agentId: d.agentId ?? '',
    leads: d.leads,
    qualified: d.qualified,
  }
}

export interface Remote {
  creators: Creator[]
  campaigns: Campaign[]
  daily: DailyStat[]
  notes: Record<string, Note>
  tags: Record<string, string[]>
  rejections: { creatorId: string; date: string }[]
  done: string[]
  filters: Filters
}

/** Every page of the list, then campaigns and stats. Throws when the key is wrong. */
async function allContacts(): Promise<FeedRow[]> {
  const rows: FeedRow[] = []
  const PAGE = 2000
  for (let offset = 0; ; offset += PAGE) {
    const { contacts, counts } = await api.contacts(null, PAGE, offset)
    rows.push(...contacts)
    if (contacts.length < PAGE || rows.length >= counts.total) break
  }
  return rows
}

export async function fetchAll(): Promise<Remote> {
  const [contacts, camps, stats] = await Promise.all([allContacts(), api.campaigns(), api.stats(60)])

  const notes: Record<string, Note> = {}
  const tags: Record<string, string[]> = {}
  const rejections: { creatorId: string; date: string }[] = []
  const done: string[] = []

  for (const r of contacts) {
    if (r.note) notes[r.id] = { creatorId: r.id, text: r.note, updatedAt: iso(r.discoveredAt) }
    if (r.tags?.length) tags[r.id] = r.tags
    if (r.rejected) rejections.push({ creatorId: r.id, date: iso(r.discoveredAt) })
    if (r.done) done.push(r.id)
  }

  const campaigns = camps.campaigns.map(toCampaign)
  return {
    creators: contacts.map(toCreator),
    campaigns,
    daily: stats.daily.map(toDaily),
    notes,
    tags,
    rejections,
    done,
    filters: campaigns[0]?.filters ?? API_DEFAULTS,
  }
}
