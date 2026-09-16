import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { QUALIFIED_MIN, STAGES, passes, sellingLevel, signalLevel, type Filters } from './scoring'

// The feed, and what the brand does to it.
//
// A brand only ever sees the leads attributed to it: every read starts from
// its own discoveries, so a handle another brand holds is not merely hidden,
// it is unreachable. Postgres enforced that with a join. Here it is the
// starting index, which is the same promise with less to get wrong.

export interface Row {
  id: Id<'creators'>
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
  signals: Doc<'creators'>['signals']
  niche: number
  nicheWhy: string
  selling: number
  signal: number
  stars: number
  campaignId: Id<'campaigns'>
  campaignName: string
  agentId?: Id<'agents'>
  discoveredAt: number
  fresh: boolean
  note?: string
  tags: string[]
  rejected: boolean
  done: boolean
}

/** Builds one row: the pooled creator, the campaign's score, the brand's marks. */
async function toRow(
  ctx: QueryCtx,
  d: Doc<'discoveries'>,
  creator: Doc<'creators'>,
  campaign: Doc<'campaigns'>,
  now: number,
): Promise<Row> {
  const score = await ctx.db
    .query('scores')
    .withIndex('by_campaign_creator', (q) => q.eq('campaignId', d.campaignId).eq('creatorId', d.creatorId))
    .first()

  const marks = await ctx.db
    .query('marks')
    .withIndex('by_brand_creator', (q) => q.eq('brandId', d.brandId).eq('creatorId', d.creatorId))
    .collect()

  const niche = score?.niche ?? 0
  const selling = sellingLevel(creator.sells, creator.signals)
  const signal = signalLevel(creator.lastSignalAt, now)

  return {
    id: creator._id,
    handle: creator.handle,
    name: creator.name,
    bio: creator.bio,
    avatar: creator.avatar,
    followers: creator.followers,
    engagementRate: creator.engagementRate,
    medianReelViews: creator.medianReelViews,
    postsPerMonth: creator.postsPerMonth,
    lastPostAt: creator.lastPostAt,
    country: creator.country,
    language: creator.language,
    email: creator.email,
    externalLinks: creator.externalLinks,
    sells: creator.sells,
    signals: creator.signals,
    niche,
    nicheWhy: score?.nicheWhy ?? '',
    selling,
    signal,
    stars: niche + selling + signal,
    campaignId: campaign._id,
    campaignName: campaign.name,
    agentId: d.agentId,
    discoveredAt: d.discoveredAt,
    fresh: d.fresh,
    note: marks.find((m) => m.kind === 'note')?.value,
    tags: marks.filter((m) => m.kind === 'tag').map((m) => m.value ?? '').filter(Boolean),
    rejected: marks.some((m) => m.kind === 'reject'),
    done: marks.some((m) => m.kind === 'done'),
  }
}

/** Filters cut the volume. Stars set the order. Filters never change a score. */
export async function readFeed(
  ctx: QueryCtx,
  args: { brandId: Id<'brands'>; campaignId?: Id<'campaigns'>; scope?: string; tag?: string; limit?: number; offset?: number },
): Promise<{ rows: Row[]; counts: { total: number; today: number; qualified: number } }> {
  const now = Date.now()
  const midnight = new Date().setHours(0, 0, 0, 0)
  const scope = args.scope ?? 'all'
  const campaigns = new Map<string, Doc<'campaigns'>>()

  const all: Row[] = []
  for await (const d of ctx.db
    .query('discoveries')
    .withIndex('by_brand', (q) => q.eq('brandId', args.brandId))
    .order('desc')) {
    if (args.campaignId && d.campaignId !== args.campaignId) continue

    let campaign = campaigns.get(d.campaignId)
    if (!campaign) {
      const found = await ctx.db.get(d.campaignId)
      if (!found) continue
      campaign = found
      campaigns.set(d.campaignId, found)
    }

    const creator = await ctx.db.get(d.creatorId)
    if (!creator) continue
    if (!passes(creator, (campaign.filters ?? {}) as Filters, now)) continue

    const row = await toRow(ctx, d, creator, campaign, now)
    if (scope === 'rejected' && !row.rejected) continue
    if (scope !== 'rejected' && row.rejected) continue
    if (scope === 'open' && row.done) continue
    if (args.tag && !row.tags.includes(args.tag)) continue
    all.push(row)
  }

  all.sort((a, b) => b.stars - a.stars || b.discoveredAt - a.discoveredAt || b.followers - a.followers)

  const counts = {
    total: all.length,
    today: all.filter((r) => r.discoveredAt >= midnight).length,
    qualified: all.filter((r) => r.stars >= QUALIFIED_MIN).length,
  }

  const offset = args.offset ?? 0
  return { rows: all.slice(offset, offset + (args.limit ?? 60)), counts }
}

export const feed = internalQuery({
  args: {
    brandId: v.id('brands'),
    campaignId: v.optional(v.id('campaigns')),
    scope: v.optional(v.string()),
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.any(),
  handler: (ctx, args) => readFeed(ctx, args),
})

/** One creator in full, and only where this brand holds the lead. */
export const detail = internalQuery({
  args: { brandId: v.id('brands'), creatorId: v.id('creators') },
  returns: v.any(),
  handler: async (ctx, { brandId, creatorId }) => {
    const mine = await ctx.db
      .query('discoveries')
      .withIndex('by_brand_creator', (q) => q.eq('brandId', brandId).eq('creatorId', creatorId))
      .first()
    if (!mine) return null

    const creator = await ctx.db.get(creatorId)
    if (!creator) return null
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_creator', (q) => q.eq('creatorId', creatorId))
      .collect()
    posts.sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0))
    return { creator, posts: posts.slice(0, 12) }
  },
})

/**
 * Tag, note, tick off or reject. Refused on a handle the brand does not hold,
 * so an API key or an AI cannot write against someone else's lead.
 */
export const mark = internalMutation({
  args: {
    brandId: v.id('brands'),
    creatorId: v.id('creators'),
    action: v.string(),
    value: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, { brandId, creatorId, action, value }) => {
    const mine = await ctx.db
      .query('discoveries')
      .withIndex('by_brand_creator', (q) => q.eq('brandId', brandId).eq('creatorId', creatorId))
      .first()
    if (!mine) return false

    const existing = await ctx.db
      .query('marks')
      .withIndex('by_brand_creator', (q) => q.eq('brandId', brandId).eq('creatorId', creatorId))
      .collect()

    const drop = async (kind: string, matchValue?: string) => {
      for (const m of existing) {
        if (m.kind !== kind) continue
        if (matchValue !== undefined && m.value !== matchValue) continue
        await ctx.db.delete(m._id)
      }
    }

    switch (action) {
      case 'note': {
        await drop('note')
        if (value?.trim()) await ctx.db.insert('marks', { brandId, creatorId, kind: 'note', value })
        break
      }
      case 'tag': {
        if (!value) return false
        if (existing.some((m) => m.kind === 'tag' && m.value === value)) break
        // A stage replaces the earlier stage. Any other tag simply adds.
        if ((STAGES as readonly string[]).includes(value)) {
          for (const m of existing) {
            if (m.kind === 'tag' && m.value && (STAGES as readonly string[]).includes(m.value)) await ctx.db.delete(m._id)
          }
        }
        await ctx.db.insert('marks', { brandId, creatorId, kind: 'tag', value })
        break
      }
      case 'untag':   await drop('tag', value); break
      case 'done':    if (!existing.some((m) => m.kind === 'done')) await ctx.db.insert('marks', { brandId, creatorId, kind: 'done' }); break
      case 'undone':  await drop('done'); break
      case 'reject':  if (!existing.some((m) => m.kind === 'reject')) await ctx.db.insert('marks', { brandId, creatorId, kind: 'reject' }); break
      case 'unreject':await drop('reject'); break
      default: return false
    }
    return true
  },
})
