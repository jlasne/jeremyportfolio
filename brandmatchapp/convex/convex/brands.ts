import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { countFree } from './pool'
import { readSettings } from './settings'

// Brands, campaigns and the agents inside them.

function newKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The brand behind an api key, or null. Every guarded route starts here. */
export const byKey = internalQuery({
  args: { key: v.string() },
  returns: v.any(),
  handler: async (ctx, { key }) => {
    return await ctx.db.query('brands').withIndex('by_key', (q) => q.eq('apiKey', key)).first()
  },
})

export const me = internalQuery({
  args: { brandId: v.id('brands') },
  returns: v.any(),
  handler: async (ctx, { brandId }) => {
    const brand = await ctx.db.get(brandId)
    if (!brand) return null
    const { free, capped } = await countFree(ctx, brandId)
    const now = Date.now()
    return {
      id: brand._id,
      email: brand.email,
      credits: brand.credits,
      timezone: brand.timezone,
      plan: brand.plan ?? 'trial',
      trialEndsAt: brand.trialEndsAt,
      trialDaysLeft: trialLive(brand, now)
        ? Math.ceil(((brand.trialEndsAt ?? 0) - now) / 86_400_000)
        : 0,
      availableToYou: free,
      availableIsFloor: capped,
    }
  },
})


export const create = internalMutation({
  args: {
    email: v.string(),
    website: v.optional(v.string()),
    credits: v.optional(v.number()),
    plan: v.optional(v.union(v.literal('trial'), v.literal('paid'))),
  },
  returns: v.any(),
  handler: async (ctx, { email, website, credits, plan }) => {
    const clean = email.toLowerCase().trim()
    const already = await ctx.db.query('brands').withIndex('by_email', (q) => q.eq('email', clean)).first()
    if (already) return already

    // A trial reads the pool for three days and never crawls, so it costs
    // the Apify bill nothing. That is why it is the default.
    const { trialDays, trialCredits, includedPerDay } = await readSettings(ctx)
    const onTrial = plan !== 'paid'
    const id = await ctx.db.insert('brands', {
      email: clean,
      website,
      timezone: 'Europe/Paris',
      credits: credits ?? (onTrial ? trialCredits : includedPerDay * 30),
      apiKey: newKey(),
      onboarded: false,
      plan: onTrial ? 'trial' : 'paid',
      trialEndsAt: onTrial ? Date.now() + trialDays * 86_400_000 : undefined,
    })
    return await ctx.db.get(id)
  },
})

/** True while a trial is still inside its three days. */
export function trialLive(brand: { plan?: string; trialEndsAt?: number }, now = Date.now()): boolean {
  return brand.plan === 'trial' && (brand.trialEndsAt ?? 0) > now
}

/** A trial reads the pool. Only a paid brand may spend on a crawl. */
export function mayCrawl(brand: { plan?: string }): boolean {
  return brand.plan === 'paid'
}

export const joinWaitlist = internalMutation({
  args: { email: v.string(), website: v.optional(v.string()), source: v.optional(v.string()) },
  returns: v.boolean(),
  handler: async (ctx, { email, website, source }) => {
    const clean = email.toLowerCase().trim()
    const already = await ctx.db.query('waitlist').withIndex('by_email', (q) => q.eq('email', clean)).first()
    if (already) return true
    await ctx.db.insert('waitlist', { email: clean, website, source: source ?? 'landing' })
    return true
  },
})

// Campaigns ---------------------------------------------------------------

async function withAgents(ctx: { db: any }, campaign: Doc<'campaigns'>) {
  const agents = await ctx.db
    .query('agents')
    .withIndex('by_campaign', (q: any) => q.eq('campaignId', campaign._id))
    .collect()
  return { ...campaign, agents }
}

export const listCampaigns = internalQuery({
  args: { brandId: v.id('brands') },
  returns: v.any(),
  handler: async (ctx, { brandId }) => {
    const rows = await ctx.db
      .query('campaigns')
      .withIndex('by_brand', (q) => q.eq('brandId', brandId))
      .order('desc')
      .collect()
    return await Promise.all(rows.map((c) => withAgents(ctx, c)))
  },
})

export const createCampaign = internalMutation({
  args: {
    brandId: v.id('brands'),
    name: v.string(),
    website: v.optional(v.string()),
    brief: v.optional(v.any()),
    filters: v.optional(v.any()),
    leadsPerDay: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('campaigns', {
      brandId: args.brandId,
      name: args.name,
      website: args.website,
      brief: args.brief ?? {},
      filters: args.filters ?? {},
      leadsPerDay: args.leadsPerDay ?? 250,
      runAt: '07:00',
      active: true,
    })
    return await ctx.db.get(id)
  },
})

export const patchCampaign = internalMutation({
  args: { brandId: v.id('brands'), campaignId: v.id('campaigns'), patch: v.any() },
  returns: v.any(),
  handler: async (ctx, { brandId, campaignId, patch }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign || campaign.brandId !== brandId) return null
    const allowed: Record<string, unknown> = {}
    for (const k of ['name', 'website', 'brief', 'filters', 'leadsPerDay', 'runAt', 'active']) {
      if (k in patch) allowed[k] = patch[k]
    }
    await ctx.db.patch(campaignId, allowed)
    return await ctx.db.get(campaignId)
  },
})

// Agents ------------------------------------------------------------------

export const addAgent = internalMutation({
  args: {
    brandId: v.id('brands'),
    campaignId: v.id('campaigns'),
    name: v.string(),
    focus: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    leadsPerDay: v.optional(v.number()),
    status: v.optional(v.string()),
    proposedWhy: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.brandId !== args.brandId) return null
    const status = args.status === 'active' ? 'active' : 'proposed'
    const id = await ctx.db.insert('agents', {
      campaignId: args.campaignId,
      brandId: args.brandId,
      name: args.name,
      focus: args.focus ?? '',
      keywords: args.keywords ?? [],
      hashtags: args.hashtags ?? [],
      leadsPerDay: args.leadsPerDay ?? 80,
      status: status as 'proposed' | 'active',
      proposedWhy: args.proposedWhy,
    })
    return await ctx.db.get(id)
  },
})

/** The model proposes, a human approves. Nothing crawls before this. */
export const setAgentStatus = internalMutation({
  args: {
    brandId: v.id('brands'),
    agentId: v.id('agents'),
    status: v.union(v.literal('proposed'), v.literal('active'), v.literal('paused')),
    leadsPerDay: v.optional(v.number()),
    hashtags: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async (ctx, { brandId, agentId, status, leadsPerDay, hashtags }) => {
    const agent = await ctx.db.get(agentId)
    if (!agent || agent.brandId !== brandId) return null
    const patch: Record<string, unknown> = { status }
    if (typeof leadsPerDay === 'number') patch.leadsPerDay = leadsPerDay
    if (hashtags) patch.hashtags = hashtags
    await ctx.db.patch(agentId, patch)
    return await ctx.db.get(agentId)
  },
})

export const removeAgent = internalMutation({
  args: { brandId: v.id('brands'), agentId: v.id('agents') },
  returns: v.boolean(),
  handler: async (ctx, { brandId, agentId }) => {
    const agent = await ctx.db.get(agentId)
    if (!agent || agent.brandId !== brandId) return false
    await ctx.db.delete(agentId)
    return true
  },
})

/** Replaces an earlier proposal, leaving approved agents alone. */
export const clearProposed = internalMutation({
  args: { campaignId: v.id('campaigns') },
  returns: v.number(),
  handler: async (ctx, { campaignId }) => {
    const rows = await ctx.db
      .query('agents')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect()
    let n = 0
    for (const a of rows) {
      if (a.status !== 'proposed') continue
      await ctx.db.delete(a._id)
      n++
    }
    return n
  },
})

export const stats = internalQuery({
  args: { brandId: v.id('brands'), days: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, { brandId, days }) => {
    const since = new Date(Date.now() - (days ?? 30) * 86_400_000).toISOString().slice(0, 10)
    const campaigns = await ctx.db
      .query('campaigns')
      .withIndex('by_brand', (q) => q.eq('brandId', brandId))
      .collect()
    const out = []
    for (const c of campaigns) {
      const rows = await ctx.db
        .query('dailyStats')
        .withIndex('by_campaign_date', (q) => q.eq('campaignId', c._id))
        .collect()
      out.push(...rows.filter((r) => r.date >= since))
    }
    out.sort((a, b) => (a.date < b.date ? -1 : 1))
    return out
  },
})
