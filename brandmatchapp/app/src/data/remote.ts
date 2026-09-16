import type { Campaign, Country, Creator, DailyStat, Filters, Language, Level, Note, Signal } from '../types'
import { api, type ApiCampaign, type ApiDaily, type FeedRow } from '../lib/api'
import { defaultFilters } from '../mock/filters'

// Turns what the API sends into the shapes every screen already reads.
// The star rule stays in data/score.ts: the API hands over niche, sells and
// the dated signals, and the front end adds them up the same way it always has.

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
    engagementRate: r.engagement_rate ?? 0,
    medianReelViews: r.median_reel_views ?? 0,
    postsPerMonth: r.posts_per_month ?? 0,
    lastPostAt: r.last_post_at ?? new Date().toISOString(),
    country: (r.country as Country) ?? 'US',
    language: (r.language as Language) ?? 'en',
    email: r.email,
    signals: (r.signals ?? []) as Signal[],
    niche: level(r.niche),
    nicheWhy: r.niche_why || 'Not read against the brief yet',
    sells: r.sells ?? '',
    campaignId: r.campaign_id,
    agentId: r.agent_id ?? '',
    firstSeenAt: r.discovered_at,
    lastCrawlAt: r.discovered_at,
  }
}

function toFilters(f: Record<string, unknown>): Filters {
  return {
    ...defaultFilters,
    ...(f as Partial<Filters>),
    countries: (f.countries as Country[]) ?? [],
    languages: (f.languages as Language[]) ?? [],
  }
}

function toCampaign(c: ApiCampaign): Campaign {
  return {
    id: c.id,
    name: c.name,
    website: c.website ?? '',
    brief: {
      who: c.brief?.who ?? '',
      answers: c.brief?.answers ?? [],
      summary: c.brief?.summary ?? '',
    },
    filters: toFilters(c.filters ?? {}),
    agents: (c.agents ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      focus: a.focus,
      leadsPerDay: a.leads_per_day,
      active: a.active,
    })),
    leadsPerDay: c.leads_per_day,
    runAt: c.run_at,
    active: c.active,
    createdAt: c.created_at,
  }
}

function toDaily(d: ApiDaily): DailyStat {
  return {
    date: d.date,
    gathered: d.gathered,
    campaignId: d.campaign_id,
    agentId: d.agent_id ?? '',
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

/** Everything the app needs, in three calls. Throws when the key is wrong. */
export async function fetchAll(): Promise<Remote> {
  const [feed, camps, stats] = await Promise.all([api.contacts(), api.campaigns(), api.stats(60)])

  const notes: Record<string, Note> = {}
  const tags: Record<string, string[]> = {}
  const rejections: { creatorId: string; date: string }[] = []
  const done: string[] = []

  for (const r of feed.contacts) {
    if (r.note) notes[r.id] = { creatorId: r.id, text: r.note, updatedAt: r.discovered_at }
    if (r.tags?.length) tags[r.id] = r.tags
    if (r.rejected) rejections.push({ creatorId: r.id, date: r.discovered_at })
    if (r.done) done.push(r.id)
  }

  const campaigns = camps.campaigns.map(toCampaign)
  return {
    creators: feed.contacts.map(toCreator),
    campaigns,
    daily: stats.daily.map(toDaily),
    notes,
    tags,
    rejections,
    done,
    filters: campaigns[0]?.filters ?? { ...defaultFilters, countries: [], languages: [] },
  }
}
