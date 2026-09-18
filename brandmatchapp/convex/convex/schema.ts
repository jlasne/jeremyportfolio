import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// brandmatch, the whole model in one file.
//
// Three ideas hold it together.
//
// 1. We sell delivered leads. Everything about what a lead costs to produce
//    lives in the ops block at the bottom and is never joined into a client
//    read. The client API projects rows field by field, so a cost can only
//    reach a screen if someone types it in.
//
// 2. A profile becomes a lead by passing three gates: measured thresholds,
//    binary knockouts, then a 0 to 2 score on seven criteria. The gates belong
//    to the campaign and are versioned, so a lead delivered on Monday can be
//    explained against the rules that were live on Monday.
//
// 3. The money is a journal. `quotaEntries` is append only and is the truth.
//    `quotaPeriods` is a cache of it and can be rebuilt at any time.

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/** Gate 1. Measured thresholds. Absent means the threshold is not applied. */
const hardRules = v.object({
  followersMin: v.optional(v.number()),
  followersMax: v.optional(v.number()),
  /** Last post must be newer than this many days. */
  lastPostWithinDays: v.optional(v.number()),
  /** Median views over the posts we actually read. Never a declared figure. */
  medianViewsMin: v.optional(v.number()),
  medianCommentsMin: v.optional(v.number()),
  postsPerMonthMin: v.optional(v.number()),
  countries: v.optional(v.array(v.string())),
  languages: v.optional(v.array(v.string())),
})

/** Gate 2. One no ends it. */
const knockout = v.object({
  id: v.string(),
  /** Asked as a yes or no question about the profile. */
  question: v.string(),
  /** What the client is protecting by asking. Shown under the question. */
  why: v.optional(v.string()),
  /** What a yes looks like, and what a no looks like. One line each. */
  pass: v.optional(v.string()),
  fail: v.optional(v.string()),
  /** Off means the question is not asked. Locked ones can never be off. */
  enabled: v.optional(v.boolean()),
})

/** Gate 3. Seven of these, each worth 0, 1 or 2. */
const criterion = v.object({
  id: v.string(),
  label: v.string(),
  /** What a 2 looks like, in one line. Steers the model and the human editor. */
  guide: v.optional(v.string()),
})

export default defineSchema({
  // -------------------------------------------------------------------------
  // Account and money
  // -------------------------------------------------------------------------

  accounts: defineTable({
    name: v.string(),
    /** A brand runs its own campaigns. An agency runs campaigns for clients. */
    kind: v.union(v.literal('brand'), v.literal('agency')),
    email: v.string(),
    timezone: v.string(),
    apiKey: v.string(),
    role: v.union(v.literal('owner'), v.literal('client')),
    /**
     * Fair use. How many profiles a day we are willing to analyse for this
     * account. Internal only: it never leaves the ops API.
     */
    analysisBudgetPerDay: v.number(),
    createdAt: v.number(),
  })
    .index('by_key', ['apiKey'])
    .index('by_email', ['email']),

  /** A person on an account. Structured now so roles cost nothing later. */
  members: defineTable({
    accountId: v.id('accounts'),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
    createdAt: v.number(),
  })
    .index('by_account', ['accountId'])
    .index('by_email', ['email']),

  subscriptions: defineTable({
    accountId: v.id('accounts'),
    /** Qualified leads a day the plan covers: 15, 30 or 50. */
    tier: v.number(),
    priceCents: v.number(),
    currency: v.string(),
    status: v.union(v.literal('active'), v.literal('past_due'), v.literal('canceled')),
    /** Current billing period, as timestamps, plus its calendar key. */
    period: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
    startedAt: v.number(),
  })
    .index('by_account', ['accountId'])
    .index('by_account_period', ['accountId', 'period']),

  /**
   * The journal. Append only, never edited. A month's entitlement lands as one
   * positive line, every delivered lead as one negative line. Unused leads stay
   * in the balance until the period closes, which is what carry over means.
   */
  quotaEntries: defineTable({
    accountId: v.id('accounts'),
    /** Calendar month, "2026-09". */
    period: v.string(),
    kind: v.union(
      v.literal('entitlement'),
      v.literal('delivery'),
      v.literal('topup'),
      v.literal('adjustment'),
    ),
    /** Positive adds leads to the balance. Negative spends them. */
    delta: v.number(),
    campaignId: v.optional(v.id('campaigns')),
    leadId: v.optional(v.id('leads')),
    topupId: v.optional(v.id('topups')),
    note: v.optional(v.string()),
    at: v.number(),
  })
    .index('by_account_period', ['accountId', 'period'])
    .index('by_lead', ['leadId']),

  /** The journal, summed. Rebuildable from quotaEntries at any time. */
  quotaPeriods: defineTable({
    accountId: v.id('accounts'),
    period: v.string(),
    /** tier x days in the period, plus any top up bought inside it. */
    entitled: v.number(),
    delivered: v.number(),
    /** Left over from the previous period and still spendable. */
    carried: v.number(),
    remaining: v.number(),
    computedAt: v.number(),
  }).index('by_account_period', ['accountId', 'period']),

  topups: defineTable({
    accountId: v.id('accounts'),
    leads: v.number(),
    priceCents: v.number(),
    currency: v.string(),
    remaining: v.number(),
    purchasedAt: v.number(),
  }).index('by_account', ['accountId']),

  // -------------------------------------------------------------------------
  // Campaign and gates
  // -------------------------------------------------------------------------

  campaigns: defineTable({
    accountId: v.id('accounts'),
    name: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('live'),
      v.literal('paused'),
      v.literal('archived'),
    ),
    /** Optional ceiling on the account quota this campaign may take per day. */
    dailyCap: v.optional(v.number()),
    /**
     * The two questions, kept word for word. Two fields and not one blob: the
     * target and the offer answer different things and the screens read them
     * apart.
     */
    brief: v.object({
      audience: v.string(),
      offer: v.string(),
      writtenAt: v.optional(v.number()),
    }),
    /** What the model read out of them. Edited by the client, never overwritten. */
    extracted: v.object({
      countries: v.optional(v.array(v.string())),
      languages: v.optional(v.array(v.string())),
      /** Which Gate 3 library the first proposal came from. */
      templateId: v.optional(v.string()),
      extractedAt: v.optional(v.number()),
    }),
    /** The gate version leads are judged against right now. */
    gateSetId: v.optional(v.id('gateSets')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_account', ['accountId'])
    .index('by_account_status', ['accountId', 'status']),

  /**
   * One version of a campaign's three gates. Never updated in place: an edit
   * writes version n + 1 and the campaign points at it. Old versions stay so a
   * past delivery still has its rules.
   */
  gateSets: defineTable({
    campaignId: v.id('campaigns'),
    accountId: v.id('accounts'),
    version: v.number(),
    origin: v.union(v.literal('generated'), v.literal('edited')),
    /** The library this version grew from. Kept so the source stays readable. */
    templateId: v.optional(v.string()),
    hard: hardRules,
    knockouts: v.array(knockout),
    criteria: v.array(criterion),
    /** Out of 14. A profile at or above this is qualified. */
    passScore: v.number(),
    /** The preset this version sits on: strict, balanced, broad or custom. */
    preset: v.optional(v.string()),
    /** Who wrote it. A member id, or "system". */
    by: v.optional(v.string()),
    /** What moved since the previous version, in plain lines. */
    changes: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index('by_campaign', ['campaignId'])
    .index('by_campaign_version', ['campaignId', 'version']),

  // -------------------------------------------------------------------------
  // Profile and evaluation
  // -------------------------------------------------------------------------

  /** Measured facts only. No judgement lives here. */
  creators: defineTable({
    platform: v.string(),
    handle: v.string(),
    name: v.string(),
    bio: v.string(),
    avatar: v.optional(v.string()),
    email: v.optional(v.string()),
    followers: v.number(),
    /** Median over the posts in creatorPosts, not a declared number. */
    medianViews: v.optional(v.number()),
    medianComments: v.optional(v.number()),
    postsPerMonth: v.optional(v.number()),
    lastPostAt: v.optional(v.number()),
    country: v.optional(v.string()),
    language: v.optional(v.string()),
    links: v.array(v.string()),
    /** When the numbers above were last read. Stale data is visible as stale. */
    measuredAt: v.number(),
    firstSeenAt: v.number(),
  })
    .index('by_handle', ['platform', 'handle'])
    .index('by_followers', ['followers'])
    .index('by_measured', ['measuredAt']),

  /** The posts the medians were computed from. The proof behind the reach. */
  creatorPosts: defineTable({
    creatorId: v.id('creators'),
    kind: v.string(),
    url: v.string(),
    thumbnail: v.optional(v.string()),
    caption: v.optional(v.string()),
    views: v.number(),
    likes: v.number(),
    comments: v.number(),
    postedAt: v.number(),
  })
    .index('by_creator', ['creatorId'])
    .index('by_creator_url', ['creatorId', 'url']),

  /**
   * One profile's run through one campaign's gates. The audit trail: which
   * gate it died at, what each knockout answered, what each criterion scored.
   */
  evaluations: defineTable({
    creatorId: v.id('creators'),
    campaignId: v.id('campaigns'),
    accountId: v.id('accounts'),
    gateSetId: v.id('gateSets'),
    gateSetVersion: v.number(),
    verdict: v.union(
      v.literal('qualified'),
      v.literal('hard_fail'),
      v.literal('knockout_fail'),
      v.literal('below_threshold'),
    ),
    /** The rule that ended it: a hard key, a knockout id, or absent. */
    blockedBy: v.optional(v.string()),
    hardChecks: v.array(
      v.object({ key: v.string(), value: v.number(), pass: v.boolean() }),
    ),
    knockoutAnswers: v.array(
      v.object({ id: v.string(), pass: v.boolean(), note: v.optional(v.string()) }),
    ),
    criteriaScores: v.array(
      v.object({ id: v.string(), score: v.number(), note: v.optional(v.string()) }),
    ),
    score: v.number(),
    /** One sentence, written at evaluation time. Shown on the lead row. */
    reason: v.string(),
    model: v.optional(v.string()),
    evaluatedAt: v.number(),
  })
    .index('by_campaign', ['campaignId'])
    .index('by_campaign_creator', ['campaignId', 'creatorId'])
    .index('by_campaign_verdict', ['campaignId', 'verdict'])
    .index('by_creator', ['creatorId']),

  /**
   * Exclusivity. A profile delivered to one account is never evaluated for
   * another. There is no expiry: the claim is permanent.
   */
  creatorClaims: defineTable({
    creatorId: v.id('creators'),
    accountId: v.id('accounts'),
    campaignId: v.id('campaigns'),
    claimedAt: v.number(),
  })
    .index('by_creator', ['creatorId'])
    .index('by_account', ['accountId']),

  // -------------------------------------------------------------------------
  // Commercial proof
  // -------------------------------------------------------------------------

  /** A qualified creator, delivered. This is the thing we bill. */
  leads: defineTable({
    accountId: v.id('accounts'),
    campaignId: v.id('campaigns'),
    creatorId: v.id('creators'),
    evaluationId: v.id('evaluations'),
    score: v.number(),
    status: v.union(
      v.literal('new'),
      v.literal('contacted'),
      v.literal('replied'),
      v.literal('call'),
      v.literal('signed'),
      v.literal('lost'),
    ),
    /** Which member is on it. Absent means nobody has taken it. */
    ownerId: v.optional(v.id('members')),
    deliveredAt: v.number(),
    statusAt: v.number(),
  })
    .index('by_account', ['accountId'])
    .index('by_account_status', ['accountId', 'status'])
    .index('by_campaign', ['campaignId'])
    .index('by_campaign_delivered', ['campaignId', 'deliveredAt'])
    .index('by_creator', ['creatorId']),

  /**
   * Every status change, append only. This is the raw material for the scoring
   * feedback loop later: which gate reads actually turned into replies.
   */
  leadEvents: defineTable({
    leadId: v.id('leads'),
    accountId: v.id('accounts'),
    campaignId: v.id('campaigns'),
    from: v.optional(v.string()),
    to: v.string(),
    /** A member id, or "system" when we wrote it. */
    by: v.string(),
    note: v.optional(v.string()),
    at: v.number(),
  })
    .index('by_lead', ['leadId'])
    .index('by_account_at', ['accountId', 'at']),

  /**
   * Its own table rather than a field on the lead, because one lead can sign
   * twice and because the amounts will feed a price benchmark later.
   */
  deals: defineTable({
    leadId: v.id('leads'),
    accountId: v.id('accounts'),
    campaignId: v.id('campaigns'),
    amountCents: v.number(),
    currency: v.string(),
    signedAt: v.number(),
    note: v.optional(v.string()),
  })
    .index('by_lead', ['leadId'])
    .index('by_account', ['accountId'])
    .index('by_campaign', ['campaignId']),

  // -------------------------------------------------------------------------
  // Operations. Nothing below this line is ever readable by a client.
  // -------------------------------------------------------------------------

  crawlRuns: defineTable({
    accountId: v.optional(v.id('accounts')),
    campaignId: v.optional(v.id('campaigns')),
    source: v.string(),
    externalRunId: v.optional(v.string()),
    phase: v.string(),
    status: v.string(),
    profilesFetched: v.number(),
    profilesEvaluated: v.number(),
    qualified: v.number(),
    costCents: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index('by_external', ['externalRunId'])
    .index('by_campaign', ['campaignId'])
    .index('by_status', ['status']),

  /** One simulation of a gate version against a sample. Drives the simulator. */
  feasibilityRuns: defineTable({
    campaignId: v.id('campaigns'),
    accountId: v.id('accounts'),
    gateSetId: v.id('gateSets'),
    gateSetVersion: v.number(),
    sampleSize: v.number(),
    passedHard: v.number(),
    passedKnockouts: v.number(),
    /** How many profiles landed on each score from 0 to 14. */
    scoreHistogram: v.array(v.object({ score: v.number(), count: v.number() })),
    /** What this version would deliver in a day at the current crawl rate. */
    estimatedPerDay: v.number(),
    ranAt: v.number(),
  })
    .index('by_campaign', ['campaignId']),

  /** Per day and per campaign. The only thing the dashboard chart reads. */
  dailyDeliveries: defineTable({
    accountId: v.id('accounts'),
    campaignId: v.id('campaigns'),
    /** "2026-09-18" */
    date: v.string(),
    delivered: v.number(),
    target: v.number(),
  })
    .index('by_account_date', ['accountId', 'date'])
    .index('by_campaign_date', ['campaignId', 'date']),

  waitlist: defineTable({
    email: v.string(),
    website: v.optional(v.string()),
    source: v.string(),
  }).index('by_email', ['email']),
})
