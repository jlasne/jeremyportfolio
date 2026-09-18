// The shapes every screen reads. One per table in the Convex schema, with ids
// as plain strings so the mock folder and the real backend produce the same
// objects and nothing in the UI knows which one it got.
//
// Dates are ISO strings here and epoch numbers in Convex. The adapter in
// data/remote.ts is the only place that converts.

export type AccountKind = 'brand' | 'agency'
export type MemberRole = 'owner' | 'admin' | 'member'
export type CampaignStatus = 'draft' | 'live' | 'paused' | 'archived'
export type Verdict = 'qualified' | 'hard_fail' | 'knockout_fail' | 'below_threshold'
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'call' | 'signed' | 'lost'
/** A Gate 3 criterion is worth 0, 1 or 2. Seven of them, so 14 is the ceiling. */
export type CriterionScore = 0 | 1 | 2

// ---------------------------------------------------------------------------
// Account and money
// ---------------------------------------------------------------------------

export interface Account {
  id: string
  name: string
  kind: AccountKind
  email: string
  timezone: string
  createdAt: string
}

export interface Member {
  id: string
  accountId: string
  email: string
  name: string
  role: MemberRole
}

/** 15, 30 or 50 qualified leads a day. Prices are placeholders until checkout. */
export interface Subscription {
  id: string
  accountId: string
  tier: 15 | 30 | 50
  priceCents: number
  currency: string
  status: 'active' | 'past_due' | 'canceled'
  /** "2026-09" */
  period: string
  periodStart: string
  periodEnd: string
}

export type QuotaKind = 'entitlement' | 'delivery' | 'topup' | 'adjustment'

/** One line of the journal. Nothing edits these, everything appends. */
export interface QuotaEntry {
  id: string
  accountId: string
  period: string
  kind: QuotaKind
  delta: number
  campaignId?: string
  leadId?: string
  note?: string
  at: string
}

/**
 * The journal summed for one month. `remaining` is what the client sees, and
 * it carries within the month: a thin Tuesday is spendable on Wednesday.
 */
export interface QuotaPeriod {
  accountId: string
  period: string
  entitled: number
  delivered: number
  carried: number
  remaining: number
}

export interface Topup {
  id: string
  accountId: string
  leads: number
  priceCents: number
  currency: string
  remaining: number
  purchasedAt: string
}

// ---------------------------------------------------------------------------
// Campaign and gates
// ---------------------------------------------------------------------------

/** The Gate 3 libraries a proposal can be built from. */
export type TemplateId = 'recruit_partners' | 'sell_to_creators' | 'sponsorship'

/** How hard the dials sit. A client starts from one of these and then tunes. */
export type PresetId = 'strict' | 'balanced' | 'broad' | 'custom'

/**
 * The two questions, kept in the client's own words. Two fields and not one
 * blob, because the target and the offer answer different things and the
 * screens read them apart.
 */
export interface CampaignBrief {
  audience: string
  offer: string
  writtenAt: string
}

/** What the model read out of the brief. Everything else is the client's text. */
export interface BriefExtract {
  countries: string[]
  languages: string[]
  /** Which Gate 3 library the first proposal came from. */
  templateId: TemplateId
  extractedAt: string
}

export interface Campaign {
  id: string
  accountId: string
  name: string
  status: CampaignStatus
  /** Ceiling on the account quota this campaign may take in a day. */
  dailyCap: number | null
  /** What the client wrote, word for word, in two answers. */
  brief: CampaignBrief
  extracted: BriefExtract
  gateSetId: string
  createdAt: string
  updatedAt: string
}

/** Gate 1. A missing threshold is simply not applied. */
export interface HardRules {
  followersMin?: number
  followersMax?: number
  lastPostWithinDays?: number
  medianViewsMin?: number
  medianCommentsMin?: number
  postsPerMonthMin?: number
  countries?: string[]
  languages?: string[]
}

/** Gate 2. One no ends it. */
export interface Knockout {
  id: string
  question: string
  why?: string
  /** What a yes looks like, in one line. */
  pass?: string
  /** What a no looks like, in one line. */
  fail?: string
  /** Off means the question is not asked. Locked ones cannot be turned off. */
  enabled?: boolean
}

/** Gate 3. What a 2 looks like is written in the guide. */
export interface Criterion {
  id: string
  label: string
  guide?: string
}

/** One version of a campaign's three gates. Edits write a new version. */
export interface GateSet {
  id: string
  campaignId: string
  accountId: string
  version: number
  origin: 'generated' | 'edited'
  /** The library this version grew from. Kept so the source stays readable. */
  templateId: TemplateId
  hard: HardRules
  knockouts: Knockout[]
  criteria: Criterion[]
  /** Out of 14. At or above is qualified. */
  passScore: number
  /** The preset this version sits on, or custom once a dial is moved alone. */
  preset: PresetId
  /** Who wrote it. A member id, or "system". */
  by: string
  /** What moved since the previous version, in plain lines. */
  changes: string[]
  createdAt: string
}

// ---------------------------------------------------------------------------
// Profile and evaluation
// ---------------------------------------------------------------------------

/** Measured facts only. Every number here came off real posts. */
export interface Creator {
  id: string
  platform: 'instagram'
  handle: string
  name: string
  bio: string
  avatar?: string
  email: string | null
  followers: number
  medianViews: number | null
  medianComments: number | null
  postsPerMonth: number | null
  lastPostAt: string | null
  country: string | null
  language: string | null
  links: string[]
  measuredAt: string
  firstSeenAt: string
}

export interface CreatorPost {
  id: string
  creatorId: string
  kind: 'reel' | 'post'
  url: string
  thumbnail?: string
  caption?: string
  views: number
  likes: number
  comments: number
  postedAt: string
}

export interface HardCheck {
  key: keyof HardRules
  value: number
  pass: boolean
}

export interface KnockoutAnswer {
  id: string
  pass: boolean
  note?: string
}

export interface CriterionResult {
  id: string
  score: CriterionScore
  note?: string
}

/** The audit trail. Why this profile did or did not become a lead. */
export interface Evaluation {
  id: string
  creatorId: string
  campaignId: string
  accountId: string
  gateSetId: string
  gateSetVersion: number
  verdict: Verdict
  /** The hard key or knockout id that ended it. Null when nothing blocked. */
  blockedBy: string | null
  hardChecks: HardCheck[]
  knockoutAnswers: KnockoutAnswer[]
  criteriaScores: CriterionResult[]
  score: number
  reason: string
  evaluatedAt: string
}

/** Permanent. A profile handed to one account is never offered to another. */
export interface CreatorClaim {
  creatorId: string
  accountId: string
  campaignId: string
  claimedAt: string
}

// ---------------------------------------------------------------------------
// Commercial proof
// ---------------------------------------------------------------------------

/** The billed object. One qualified creator, delivered. */
export interface Lead {
  id: string
  accountId: string
  campaignId: string
  creatorId: string
  evaluationId: string
  score: number
  status: LeadStatus
  ownerId: string | null
  /** Kept across campaigns, so a good one is not lost in a long list. */
  saved?: boolean
  /** Whatever the client typed about them. Free text, theirs alone. */
  note?: string
  deliveredAt: string
  /**
   * When we last re-measured this person. A re-measure refreshes the row and
   * sends it back to the top. It never costs a second lead.
   */
  refreshedAt?: string
  statusAt: string
}

export interface LeadEvent {
  id: string
  leadId: string
  accountId: string
  campaignId: string
  from: LeadStatus | null
  to: LeadStatus
  /** A member id, or "system". */
  by: string
  note?: string
  at: string
}

/** Separate from the lead because one lead can sign more than once. */
export interface Deal {
  id: string
  leadId: string
  accountId: string
  campaignId: string
  amountCents: number
  currency: string
  signedAt: string
  note?: string
}

// ---------------------------------------------------------------------------
// Operations. None of this crosses into a client read.
// ---------------------------------------------------------------------------

/** Internal only. Cost lives here and nowhere a client can reach. */
export interface CrawlRun {
  id: string
  campaignId: string | null
  source: string
  phase: string
  status: string
  profilesFetched: number
  profilesEvaluated: number
  qualified: number
  costCents: number
  startedAt: string
  finishedAt: string | null
}

/** The simulator's output. Client safe: it carries no cost and no volume sold. */
export interface FeasibilityRun {
  id: string
  campaignId: string
  gateSetId: string
  gateSetVersion: number
  sampleSize: number
  passedHard: number
  passedKnockouts: number
  qualified: number
  /** Which threshold sent profiles home, and whether it did so on its own. */
  blame: { key: string; sole: number; shared: number }[]
  scoreHistogram: { score: number; count: number }[]
  estimatedPerDay: number
  ranAt: string
}

/** One day of one campaign. What the dashboard chart reads. */
export interface DailyDelivery {
  accountId: string
  campaignId: string
  /** "2026-09-18" */
  date: string
  delivered: number
  target: number
}
