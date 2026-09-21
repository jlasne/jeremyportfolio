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
//    binary knockouts, then a 0 to 2 answer per sentence about the ideal client. The gates belong
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
  /** Views on a typical post as a percentage of the follower count. */
  viewRatioMin: v.optional(v.number()),
  /** Views across a month: a typical post times how many they publish. */
  monthlyViewsMin: v.optional(v.number()),
  countries: v.optional(v.array(v.string())),
  languages: v.optional(v.array(v.string())),
})

/**
 * A group where one alternative is enough, against the demands above.
 *
 * Reach is two different accounts wearing one number: 40k views on a tenth of
 * their followers, or 100k views on a fiftieth. Both are worth writing to and
 * a single threshold loses one of them.
 */
const eitherGroup = v.object({
  label: v.optional(v.string()),
  options: v.array(hardRules),
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
  /** The fact that has to be there. Absent, it drops the profile. */
  need: v.optional(v.string()),
  /** What the judge needs to answer it. Naming comments makes them a cost. */
  needs: v.optional(v.array(v.string())),
  /** Off means the question is not asked. Locked ones can never be off. */
  enabled: v.optional(v.boolean()),
})

/**
 * Gate 3. One sentence about the ideal client, in the client's own words.
 * The model answers each one true, partly or false: 2, 1 or 0. Between one
 * and twelve of them, and the score is read as a share of the ceiling.
 */
const criterion = v.object({
  id: v.string(),
  text: v.string(),
  /**
   * What would settle it, and what nearly settles it and should not.
   *
   * A sentence alone leaves the judge to guess what counts as proof, and a
   * guess is how "they already have their own app" passed a creator whose
   * link page opens on a recipe app: nobody had told it that a subscription
   * on a website is not the same thing as one in a store.
   *
   * Written once, by the model, at the same time as the sentence. The client
   * edits it like anything else, and it is a far better thing to edit than a
   * sentence, because it is where the argument actually is.
   */
  evidence: v.optional(v.string()),
  /** The near miss that must not count. */
  trap: v.optional(v.string()),
  /** What a 2, a 1 and a 0 look like. Without it the model invents a scale. */
  rubric: v.optional(v.string()),
  /**
   * What the judge needs in front of it to answer: profile, posts, links,
   * images, comments, web. Only what is named here is fetched, so a campaign
   * pays for the questions it asked and for nothing else.
   */
  needs: v.optional(v.array(v.string())),
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
      /**
       * Handles the client already knows. The highest value input there is,
       * and the least trustworthy: a client naming accounts off the top of
       * their head is not running their own rules while they do it. Each one
       * goes through the campaign's rules, and one that fails is never used to
       * find others, because its neighbours would be off target too.
       */
      seeds: v.optional(v.array(v.string())),
      writtenAt: v.optional(v.number()),
    }),
    /** What the model read out of them. Edited by the client, never overwritten. */
    extracted: v.object({
      countries: v.optional(v.array(v.string())),
      languages: v.optional(v.array(v.string())),
      /** Which Gate 3 library the first proposal came from. */
      templateId: v.optional(v.string()),
      /**
       * The slices of the target we look in.
       *
       * Each one can carry its own measured numbers, because what counts as
       * big is not the same in every slice: a 20k postnatal account can be
       * worth more than a 200k general one. Switching one off stops us looking
       * there, and every delivered lead records which slice it matched.
       */
      niches: v.optional(v.array(v.object({
        id: v.string(),
        label: v.string(),
        enabled: v.boolean(),
        hard: v.optional(hardRules),
      }))),
      extractedAt: v.optional(v.number()),
    }),
    /** The gate version leads are judged against right now. */
    gateSetId: v.optional(v.id('gateSets')),
    /**
     * What this campaign has opened up since it started.
     *
     * Set the first time a rule is moved so that more people come through.
     * The rules it started from are kept whole rather than as a diff, because
     * every lead handed over afterwards is measured against them and marked.
     * Niches are part of it: adding a slice widens a campaign exactly as
     * lowering a number does.
     */
    widened: v.optional(v.object({
      fromGateSetId: v.id('gateSets'),
      fromNiches: v.array(v.object({
        id: v.string(),
        label: v.string(),
        enabled: v.boolean(),
        hard: v.optional(hardRules),
      })),
      doors: v.array(v.object({
        id: v.string(),
        label: v.string(),
        openedAt: v.number(),
      })),
    })),
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
    either: v.optional(v.array(eitherGroup)),
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
    /**
     * How we came across them: the channel, the accounts that led us here, and
     * the client handle it started from.
     *
     * Without the parents no channel can be measured, no candidate can be
     * ranked before we pay to look at them, and no stop rule can fire. It costs
     * nothing to write and everything to add later.
     */
    foundVia: v.optional(v.object({
      channel: v.string(),
      parents: v.optional(v.array(v.string())),
      seed: v.optional(v.string()),
    })),
    /**
     * The handles Instagram shows next to this one. Kept for the record and
     * not drawn from: measured on the first real run, three profiles in 168
     * carried any, and those pointed at brands.
     */
    related: v.optional(v.array(v.string())),
    /**
     * The words on the page their bio links to, read once and kept.
     *
     * A linktree is where a creator lists what they actually sell, and it is
     * the only place an app of their own is named when the bio does not name
     * it. Without it the judge was passing a creator whose link page opens on
     * "Try my recipe app free for 7 days".
     */
    linkText: v.optional(v.string()),
    linkReadAt: v.optional(v.number()),
    /**
     * What the profile says about itself, beyond the bio.
     *
     * Apify hands all of this back with every fetch and it was being dropped.
     * Each line answers a question a client writes and the judge was scoring
     * zero on for lack of anything to read.
     */
    verified: v.optional(v.boolean()),
    category: v.optional(v.string()),
    follows: v.optional(v.number()),
    postsLifetime: v.optional(v.number()),
    highlights: v.optional(v.number()),
    /** Share of the last twelve posts marked as a paid partnership. */
    paidPosts: v.optional(v.number()),
    /**
     * When the comments were bought, and what came back.
     *
     * Comments are the most expensive thing we fetch, six times a profile,
     * and they were being bought again on every run because nothing recorded
     * that we already had them. The stamp is written whether or not anything
     * came back: a profile with no comments to read is still a profile we
     * have already paid to look at.
     */
    commentsReadAt: v.optional(v.number()),
    topComments: v.optional(v.array(v.object({ by: v.string(), text: v.string() }))),
    /** How many of the last twelve are reels rather than photos. */
    reelShare: v.optional(v.number()),
    /**
     * The handles this person mentions and tags in their posts. The neighbour
     * channel reads this list, and only from people the gates let through:
     * a coach's posts cite other coaches, and a bikini brand's posts cite
     * bikini models, which is what the first neighbour run found when it read
     * every big account instead. Written at measure time, free.
     */
    cited: v.optional(v.array(v.string())),
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
    /** Marked by Instagram as a paid partnership. They take brand money. */
    paid: v.optional(v.boolean()),
    /**
     * The first comments under the post, the creator's own among them.
     *
     * The one place that answers whether they talk back, and what their
     * audience actually asks for. Received on every fetch, dropped until now,
     * and two criteria were being scored zero for want of it.
     */
    topComments: v.optional(v.array(v.object({
      by: v.string(),
      text: v.string(),
      /** True when the account that posted is the one commenting. */
      mine: v.optional(v.boolean()),
    }))),
    caption: v.optional(v.string()),
    views: v.number(),
    likes: v.number(),
    comments: v.number(),
    postedAt: v.number(),
    /**
     * Pinned by the owner. A pinned post is a chosen highlight, often years
     * old, and it sits first in the list Instagram returns. Counted as a
     * typical post it makes a daily poster look like one who posts twice a
     * year, which is what the first real run reported for every big account.
     */
    pinned: v.optional(v.boolean()),
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
      v.literal('off_niche'),
      v.literal('knockout_fail'),
      v.literal('below_threshold'),
    ),
    /** Which of the campaign's niches this person works in, when one fit. */
    niche: v.optional(v.string()),
    /** The rule that ended it: a hard key, a knockout id, or absent. */
    blockedBy: v.optional(v.string()),
    hardChecks: v.array(
      // limit is what was asked. It is carried because a row from an either
      // group is measured against a number that is not in hard, so the reason
      // line has nowhere else to read it from.
      v.object({ key: v.string(), value: v.number(), pass: v.boolean(), limit: v.optional(v.number()) }),
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
    /**
     * Which kind of offer holds them. Two clients selling the same thing never
     * receive the same person. A client selling an app build and a client
     * selling a course platform can both receive them, because one coach can
     * buy both. A claim over every offer at once would empty the pool a little
     * more with every customer we sign.
     */
    offerKey: v.string(),
    claimedAt: v.number(),
  })
    .index('by_creator', ['creatorId'])
    .index('by_creator_offer', ['creatorId', 'offerKey'])
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
    /**
     * Inside the rules the client first agreed to, or past them. Written once,
     * at delivery, against the rules in force before any door was opened.
     *
     * A client who widens their rules to keep the flow going is owed the truth
     * about what came through. Without this the widening is invisible: the
     * list looks unchanged while the reply rate quietly falls.
     */
    reach: v.optional(v.union(v.literal('core'), v.literal('wider'))),
    /** When wider: the one line they miss. "7.9k followers, you asked 15k" */
    beyond: v.optional(v.string()),
    /** Which member is on it. Absent means nobody has taken it. */
    ownerId: v.optional(v.id('members')),
    /**
     * Why a lead was dropped: no_answer, wrong_person, not_interested,
     * bad_timing. Without it, silence hides inside the reply rate, which is
     * how a real pipeline reported 1.9% as something much healthier.
     */
    lostReason: v.optional(v.string()),
    /** Kept across campaigns, so a good one is not lost in a long list. */
    saved: v.optional(v.boolean()),
    /**
     * The client's own labels, beside our pipeline. A status says where
     * someone is in the conversation and is ours; a tag says what the client
     * thinks of them and is theirs. Written from the list or from the API,
     * read by both, and never used by anything we decide.
     */
    tags: v.optional(v.array(v.string())),
    /** Whatever the client typed about them. Free text, theirs alone. */
    note: v.optional(v.string()),
    deliveredAt: v.number(),
    /**
     * When we last re-measured this person. A re-measure refreshes the row and
     * sends it back to the top. It never costs a second lead.
     */
    refreshedAt: v.optional(v.number()),
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
    /** Which way of searching this run served: search, accounts, neighbour, seed. */
    channel: v.optional(v.string()),
    /**
     * The handles a detail run was asked for, each with the accounts that
     * pointed at it. Apify sends the run id back and nothing else, so this is
     * where the parents wait until the profiles land.
     */
    sources: v.optional(v.array(v.object({ handle: v.string(), parents: v.optional(v.array(v.string())) }))),
    status: v.string(),
    profilesFetched: v.number(),
    /**
     * How many of them we had never seen before.
     *
     * The same query returns the same accounts. One campaign asked for 504
     * profiles across seven queries it had already run and 135 were new, so
     * a run reported by what it fetched reads as five times the discovery it
     * actually did.
     */
    profilesFresh: v.optional(v.number()),
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
    /** In a niche still switched on, and big enough for that niche's own bar. */
    inNiche: v.optional(v.number()),
    passedKnockouts: v.number(),
    qualified: v.number(),
    /** Which threshold sent profiles home, and whether it did so on its own. */
    blame: v.optional(v.array(v.object({ key: v.string(), sole: v.number(), shared: v.number() }))),
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
