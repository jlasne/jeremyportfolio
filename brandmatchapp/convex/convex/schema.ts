import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// brandmatch, in one file.
//
// The profile row is shared. The lead is not. A creator is crawled once and
// every campaign after that reads the same document, while being handed to a
// brand claims it for 14 days. Postgres carried that claim in a join over the
// discovery log; here it sits on the creator as two fields, so deciding
// whether a handle is free is a read of the document rather than a scan.

/** A dated brand signal: a paid post, a rate card, collab wording in the bio. */
const signal = v.object({
  type: v.string(),
  label: v.string(),
  strength: v.string(),
  date: v.string(),
})

export default defineSchema({
  brands: defineTable({
    email: v.string(),
    website: v.optional(v.string()),
    timezone: v.string(),
    /** One credit, one lead, wherever the lead came from. */
    credits: v.number(),
    apiKey: v.string(),
    onboarded: v.boolean(),
    /**
     * `trial` reads the shared pool and never starts a crawl, so three days
     * of it costs the Apify bill nothing. `paid` unlocks the crawl.
     */
    plan: v.optional(v.union(v.literal('trial'), v.literal('paid'))),
    trialEndsAt: v.optional(v.number()),
  })
    .index('by_key', ['apiKey'])
    .index('by_email', ['email']),

  campaigns: defineTable({
    brandId: v.id('brands'),
    name: v.string(),
    website: v.optional(v.string()),
    brief: v.object({
      who: v.optional(v.string()),
      summary: v.optional(v.string()),
      answers: v.optional(v.array(v.object({ questionId: v.string(), value: v.union(v.string(), v.null()) }))),
    }),
    filters: v.any(),
    leadsPerDay: v.number(),
    runAt: v.string(),
    active: v.boolean(),
  }).index('by_brand', ['brandId']),

  agents: defineTable({
    campaignId: v.id('campaigns'),
    brandId: v.id('brands'),
    name: v.string(),
    focus: v.string(),
    keywords: v.array(v.string()),
    hashtags: v.array(v.string()),
    leadsPerDay: v.number(),
    /** Written by the model as `proposed`. A human turns it to `active`. */
    status: v.union(v.literal('proposed'), v.literal('active'), v.literal('paused')),
    proposedWhy: v.optional(v.string()),
    lastRunAt: v.optional(v.number()),
  })
    .index('by_campaign', ['campaignId'])
    .index('by_status', ['status']),

  // The shared pool -------------------------------------------------------
  creators: defineTable({
    platform: v.string(),
    handle: v.string(),
    name: v.string(),
    bio: v.string(),
    avatar: v.optional(v.string()),
    followers: v.number(),
    /** 0.034 means 3.4%. Computed from the posts we crawl, never an aggregator field. */
    engagementRate: v.optional(v.number()),
    medianReelViews: v.optional(v.number()),
    postsPerMonth: v.optional(v.number()),
    lastPostAt: v.optional(v.number()),
    country: v.optional(v.string()),
    language: v.optional(v.string()),
    email: v.optional(v.string()),
    externalLinks: v.array(v.string()),
    linkType: v.optional(v.string()),
    /** What the creator sells today, in plain words. Drives the Selling star. */
    sells: v.string(),
    signals: v.array(signal),
    /** The newest signal date, so the pool can be walked freshest first. */
    lastSignalAt: v.optional(v.number()),
    firstSeenAt: v.number(),
    lastCrawlAt: v.number(),
    /** Who holds this lead, and until when. Absent means free to anyone. */
    claimedBy: v.optional(v.id('brands')),
    claimedUntil: v.optional(v.number()),
  })
    .index('by_handle', ['platform', 'handle'])
    .index('by_signal', ['lastSignalAt'])
    .index('by_claim', ['claimedUntil'])
    .index('by_followers', ['followers']),

  posts: defineTable({
    creatorId: v.id('creators'),
    kind: v.string(),
    url: v.string(),
    thumbnail: v.optional(v.string()),
    caption: v.optional(v.string()),
    views: v.number(),
    likes: v.number(),
    comments: v.number(),
    postedAt: v.optional(v.number()),
  })
    .index('by_creator', ['creatorId'])
    .index('by_creator_url', ['creatorId', 'url']),

  /** Who was handed whom. One row per campaign and creator. */
  discoveries: defineTable({
    creatorId: v.id('creators'),
    campaignId: v.id('campaigns'),
    agentId: v.optional(v.id('agents')),
    brandId: v.id('brands'),
    /** True when this crawl is what first put the creator in the pool. */
    fresh: v.boolean(),
    discoveredAt: v.number(),
  })
    .index('by_brand', ['brandId'])
    .index('by_campaign', ['campaignId'])
    .index('by_campaign_creator', ['campaignId', 'creatorId'])
    .index('by_brand_creator', ['brandId', 'creatorId']),

  /** The per campaign read of a pooled creator, written by the model. */
  scores: defineTable({
    creatorId: v.id('creators'),
    campaignId: v.id('campaigns'),
    brandId: v.id('brands'),
    niche: v.number(),
    nicheWhy: v.string(),
    stars: v.number(),
    model: v.optional(v.string()),
  })
    .index('by_campaign', ['campaignId'])
    .index('by_campaign_creator', ['campaignId', 'creatorId']),

  /**
   * Everything the brand types or ticks. One table rather than four, because
   * every screen reads them together and a document store makes that cheap.
   */
  marks: defineTable({
    brandId: v.id('brands'),
    creatorId: v.id('creators'),
    kind: v.union(v.literal('note'), v.literal('tag'), v.literal('reject'), v.literal('done')),
    value: v.optional(v.string()),
  })
    .index('by_brand_creator', ['brandId', 'creatorId'])
    .index('by_brand_kind', ['brandId', 'kind']),

  runs: defineTable({
    runId: v.optional(v.string()),
    actor: v.string(),
    phase: v.string(),
    campaignId: v.optional(v.id('campaigns')),
    agentId: v.optional(v.id('agents')),
    status: v.string(),
    input: v.optional(v.any()),
    items: v.number(),
    fresh: v.number(),
    error: v.optional(v.string()),
    finishedAt: v.optional(v.number()),
  })
    .index('by_runId', ['runId'])
    .index('by_status', ['status']),

  dailyStats: defineTable({
    date: v.string(),
    campaignId: v.id('campaigns'),
    agentId: v.optional(v.id('agents')),
    gathered: v.number(),
    leads: v.number(),
    qualified: v.number(),
  })
    .index('by_campaign_date', ['campaignId', 'date'])
    .index('by_date', ['date']),

  ledger: defineTable({
    brandId: v.id('brands'),
    delta: v.number(),
    reason: v.string(),
    campaignId: v.optional(v.id('campaigns')),
  }).index('by_brand', ['brandId']),

  waitlist: defineTable({
    email: v.string(),
    website: v.optional(v.string()),
    source: v.string(),
  }).index('by_email', ['email']),
})
