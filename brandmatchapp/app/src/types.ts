// The shapes every screen reads. One per table in the Convex schema, with ids
// as plain strings so the mock folder and the real backend produce the same
// objects and nothing in the UI knows which one it got.
//
// Dates are ISO strings here and epoch numbers in Convex. The adapter in
// data/remote.ts is the only place that converts.

export type AccountKind = 'brand' | 'agency'
export type MemberRole = 'owner' | 'admin' | 'member'
export type CampaignStatus = 'draft' | 'live' | 'paused' | 'archived'
export type Verdict = 'qualified' | 'hard_fail' | 'off_niche' | 'knockout_fail' | 'below_threshold'
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'call' | 'signed' | 'lost'

/**
 * Why a lead was dropped.
 *
 * Without this, "replied" quietly absorbs the silence and the bounces, and the
 * reply rate on the dashboard is a number nobody can trust. One extra click,
 * and only when giving up on someone.
 */
export type LostReason = 'no_answer' | 'wrong_person' | 'not_interested' | 'bad_timing'

/**
 * How a lead stands against the rules the client first agreed to.
 *
 * A client who opens a door to keep the flow going is owed the truth about
 * what came through it. Without this mark the widening is invisible: the list
 * looks the same, the reply rate quietly drops, and nobody can say why.
 */
export type Reach = 'core' | 'wider'
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
  /**
   * Handles the client already knows. Optional, and the highest value input
   * there is: the people around a good account look like that account.
   *
   * They are not taken on trust. Each one goes through the campaign's own
   * rules, and one that fails is never used to find others, because its
   * neighbours would be off target too.
   */
  seeds?: string[]
  writtenAt: string
}


/** What the model read out of the brief. Everything else is the client's text. */
export interface BriefExtract {
  countries: string[]
  languages: string[]
  /** The slices of the target we look in. Edited on the brief screen. */
  niches: Niche[]
  /** Which Gate 3 library the first proposal came from. */
  templateId: TemplateId
  extractedAt: string
}

/** One rule opened past the client's first ones, and when. */
export interface OpenDoor {
  id: string
  /** "Views on a typical post, lowered from 12k to 7.5k" */
  label: string
  openedAt: string
}

/**
 * What a campaign has opened up since it started.
 *
 * The rules it started from are kept whole, not as a diff, because every lead
 * delivered afterwards is measured against them. Niches are part of it: adding
 * a slice widens a campaign exactly as lowering a number does.
 */
export interface Widening {
  fromGateSetId: string
  fromNiches: Niche[]
  doors: OpenDoor[]
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
  /** Set the first time a door is opened. Absent while the rules never moved. */
  widened?: Widening
  createdAt: string
  updatedAt: string
}

/** The measured numbers. A missing one is simply not applied. */
export interface HardRules {
  followersMin?: number
  followersMax?: number
  lastPostWithinDays?: number
  medianViewsMin?: number
  medianCommentsMin?: number
  postsPerMonthMin?: number
  /** Views on a typical post as a percentage of the follower count. */
  viewRatioMin?: number
  /** Views across a month: what a typical post gets, times how many. */
  monthlyViewsMin?: number
  countries?: string[]
  languages?: string[]
}

/**
 * A choice, where every rule above is a demand.
 *
 * Reach is two different accounts wearing one number. Someone at 40k views on
 * ten percent of their followers and someone at 100k views on two percent are
 * both worth writing to, and a single threshold keeps one and loses the other.
 * Same for rhythm: a daily poster and a weekly one who does a million views a
 * month are both alive.
 *
 * So a group holds alternatives and the profile has to satisfy one of them.
 * The label is what the reason line says when none of them holds.
 */
export interface EitherGroup {
  label?: string
  options: HardRules[]
}

/**
 * A slice of the campaign's target. What these people actually talk about.
 *
 * Suggested from the brief, then the client's to edit. Switching one off stops
 * us looking there. Every delivered lead carries the niche it matched, which is
 * what lets the dashboard say which slice actually answers.
 */
export interface Niche {
  id: string
  label: string
  /** Off means we stop looking in it. The label stays, so it can come back. */
  enabled: boolean
  /**
   * Numbers that apply to this niche alone, over the campaign's own.
   *
   * What counts as big and active is not the same in every slice. A 20k
   * postnatal account can be worth more than a 200k general fitness one, so
   * one set of thresholds across a whole campaign is simply wrong.
   *
   * Only the measured numbers can be overridden. The deal breakers and the fit
   * score describe your offer, and your offer does not change by niche.
   */
  hard?: Partial<HardRules>
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

/**
 * Gate 3. One sentence about the ideal client, in the client's own words.
 *
 * The model reads each sentence against the profile and answers true, partly
 * or false, which is 2, 1 or 0. There is no library to stay inside any more:
 * the sentences a campaign starts with are a draft written from the brief,
 * and the client keeps, changes, adds or deletes them. Between one and twelve.
 */
export interface Criterion {
  id: string
  text: string
  /**
   * Turned into a deal breaker by the client. Three at most.
   *
   * It stops counting towards the brand fit, because a rule made non
   * negotiable is no longer a matter of degree. It removes nobody either: the
   * lead arrives carrying the breakers it missed, and the client decides.
   */
  breaker?: boolean
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
  /** Groups where one alternative is enough. */
  either?: EitherGroup[]
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
  /**
   * How we came across them.
   *
   * Without the parents, no channel can be measured, no candidate can be
   * ranked before we pay to look at them, and no stop rule can fire. It costs
   * nothing to write and everything to add later.
   */
  foundVia?: {
    channel: 'accounts' | 'search' | 'neighbour' | 'seed' | 'import' | 'google'
    /** The accounts that led us here. Their quality ranks this candidate. */
    parents?: string[]
    /** The handle the client gave us, when that is where it started. */
    seed?: string
  }
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
  /** What was asked. Carried because an either group's number is not in hard. */
  limit?: number
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
  /** Which of the campaign's niches this person works in. Null when none fit. */
  niche: string | null
  /** The rule that ended it: a measurement, a niche, a deal breaker, or null. */
  blockedBy: string | null
  hardChecks: HardCheck[]
  knockoutAnswers: KnockoutAnswer[]
  criteriaScores: CriterionResult[]
  score: number
  reason: string
  evaluatedAt: string
}

/**
 * A profile handed over is held against the offer it was sold for, not against
 * the world.
 *
 * Two clients selling the same thing never receive the same person. A client
 * selling an app build and a client selling a course platform can both receive
 * them, because that is true: one coach can buy both. A claim over every offer
 * at once would empty the pool a little more with every customer we sign.
 */
export interface CreatorClaim {
  creatorId: string
  accountId: string
  campaignId: string
  /** Which kind of offer holds them. Today that is the campaign's library. */
  offerKey: string
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
  /**
   * Inside the client's first rules, or past them. Written once, at delivery,
   * against the rules in force before any door was opened.
   */
  reach?: Reach
  /** When wider: the one line they miss. "7.9k views a post, you asked 12k" */
  beyond?: string
  ownerId: string | null
  /** Set when the status is lost. What actually happened. */
  lostReason?: LostReason
  /** Kept across campaigns, so a good one is not lost in a long list. */
  saved?: boolean
  /**
   * The client's own labels. Free text, theirs alone, and the one part of the
   * CRM we do not define for them: a status is our pipeline, a tag is their
   * filing. Written here or through the API, read by both.
   */
  tags?: string[]
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
  /** In a niche still switched on, and big enough for that niche's own bar. */
  inNiche: number
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
