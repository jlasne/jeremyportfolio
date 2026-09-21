// The three gates, server side. The same logic as app/src/data/gates.ts, on
// purpose: the simulator in the browser and the nightly run have to agree, or
// a client is promised one number and delivered another.
//
// Gate 1 reads numbers we measured and costs nothing. Only what survives it is
// worth a model call, and that ordering is the whole margin.

const DAY = 86_400_000

export type Verdict = 'qualified' | 'hard_fail' | 'off_niche' | 'knockout_fail' | 'below_threshold'

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

export interface Measured {
  followers: number
  medianViews?: number
  medianComments?: number
  postsPerMonth?: number
  lastPostAt?: number
  country?: string
  language?: string
}

export interface GateSetShape {
  hard: HardRules
  /** Groups where one alternative is enough. */
  either?: EitherGroup[]
  knockouts: {
    id: string
    question: string
    why?: string
    /** The disqualifying fact, written plainly. Present, it drops the profile. */
    fail?: string
    /**
     * The required fact. Absent, it drops the profile.
     *
     * Both are asked of the judge the same way, as something it has to find
     * and quote. An absence cannot be quoted: asked whether "no dog appears"
     * is true, a model finds no words saying so and answers no, which passes
     * every profile without a dog. So a rule about something that has to be
     * there is written as the thing, and the engine turns it round.
     */
    need?: string
    pass?: string
    enabled?: boolean
  }[]
  criteria: {
    id: string
    text: string
    evidence?: string
    trap?: string
    rubric?: string
    needs?: string[]
  }[]
  passScore: number
}

export interface Niche {
  id: string
  label: string
  enabled: boolean
  hard?: Partial<HardRules>
}

/**
 * The widest version of the numbers across every niche still switched on.
 *
 * Someone who fails this fails every niche, so they are dropped before a model
 * call is paid for. That is what keeps the first check free even though each
 * niche carries its own bar.
 */
export function loosest(hard: HardRules, niches: Niche[]): HardRules {
  const on = niches.filter((n) => n.enabled)
  if (!on.length) return hard
  const LOWER_IS_LOOSER = ['followersMin', 'medianViewsMin', 'medianCommentsMin', 'postsPerMonthMin']
  const out: HardRules = { ...hard }
  for (const key of [...LOWER_IS_LOOSER, 'followersMax', 'lastPostWithinDays'] as (keyof HardRules)[]) {
    const values = on
      .map((n) => n.hard?.[key] ?? hard[key])
      .filter((v): v is number => typeof v === 'number')
    if (!values.length) continue
    out[key] = (LOWER_IS_LOOSER.includes(key) ? Math.min(...values) : Math.max(...values)) as never
  }
  return out
}

/** The numbers that apply once we know which niche someone works in. */
export function forNiche(hard: HardRules, niche: Niche | undefined): HardRules {
  return niche?.hard ? { ...hard, ...niche.hard } : hard
}

export interface Judgement {
  /** Which niche this person works in, from the campaign's list, or null. */
  niche?: string | null
  /**
   * Where they live and what they post in, read off the bio and the posts
   * as two letter codes. The crawl never measures either, so without this
   * a campaign asking for the US receives a trainer in Bangkok, which the
   * first sourcing run did.
   */
  country?: string | null
  language?: string | null
  knockouts: Record<string, { pass: boolean; note?: string }>
  criteria: Record<string, { score: number; note?: string }>
  reason: string
}

export interface HardCheck { key: string; value: number; pass: boolean; limit?: number }

export interface GateResult {
  verdict: Verdict
  niche?: string
  blockedBy?: string
  hardChecks: HardCheck[]
  knockoutAnswers: { id: string; pass: boolean; note?: string }[]
  criteriaScores: { id: string; score: number; note?: string }[]
  score: number
  reason: string
}

const READS: { key: keyof HardRules; of: (m: Measured, now: number) => number | undefined; pass: (v: number, l: number) => boolean }[] = [
  { key: 'followersMin', of: (m) => m.followers, pass: (v, l) => v >= l },
  { key: 'followersMax', of: (m) => m.followers, pass: (v, l) => v <= l },
  { key: 'medianViewsMin', of: (m) => m.medianViews, pass: (v, l) => v >= l },
  { key: 'medianCommentsMin', of: (m) => m.medianComments, pass: (v, l) => v >= l },
  { key: 'postsPerMonthMin', of: (m) => m.postsPerMonth, pass: (v, l) => v >= l },
  {
    key: 'viewRatioMin',
    of: (m) => (m.followers > 0 && m.medianViews !== undefined
      ? Math.round((m.medianViews / m.followers) * 100)
      : undefined),
    pass: (v, l) => v >= l,
  },
  {
    key: 'monthlyViewsMin',
    of: (m) => (m.medianViews !== undefined && m.postsPerMonth !== undefined
      ? Math.round(m.medianViews * m.postsPerMonth)
      : undefined),
    pass: (v, l) => v >= l,
  },
  {
    key: 'lastPostWithinDays',
    of: (m, now) => (m.lastPostAt ? Math.floor((now - m.lastPostAt) / DAY) : undefined),
    pass: (v, l) => v <= l,
  },
]

/** Gate 1 alone. One row per threshold that is set, measured against the limit. */
export function runHard(m: Measured, hard: HardRules, now = Date.now()): HardCheck[] {
  const out: HardCheck[] = []
  for (const read of READS) {
    const limit = hard[read.key]
    if (typeof limit !== 'number') continue
    const value = read.of(m, now)
    // A number we never measured cannot pass a threshold on measured data.
    if (value === undefined) {
      out.push({ key: read.key, value: -1, pass: false, limit })
      continue
    }
    out.push({ key: read.key, value, pass: read.pass(value, limit), limit })
  }
  // Where they are and what they post in are not measured yet: the crawl
  // writes neither. An unknown is not a wrong answer, so it passes here and
  // the model reads the bio and the captions for it later. The day the crawl
  // fills these in, a null goes back to failing, like every other number.
  if (hard.countries?.length && m.country) {
    const ok = hard.countries.includes(m.country)
    out.push({ key: 'countries', value: ok ? 1 : 0, pass: ok })
  }
  if (hard.languages?.length && m.language) {
    const ok = hard.languages.includes(m.language)
    out.push({ key: 'languages', value: ok ? 1 : 0, pass: ok })
  }
  return out
}

export function passesHard(checks: HardCheck[]): boolean {
  return checks.every((c) => c.pass)
}

/**
 * The groups where one alternative is enough.
 *
 * A group that holds returns nothing: there is no row to show for a rule
 * nobody failed. A group that holds nowhere returns the closest attempt, so
 * the reason line names the number they came nearest to rather than the first
 * one in the list.
 */
export function runEither(m: Measured, groups: EitherGroup[] | undefined, now = Date.now()): HardCheck[] {
  if (!groups?.length) return []
  const out: HardCheck[] = []
  for (const group of groups) {
    const tries = (group.options ?? []).map((option) => runHard(m, option, now))
    if (!tries.length) continue
    if (tries.some((checks) => checks.length > 0 && passesHard(checks))) continue
    // Nothing held. Keep the attempt that failed on the fewest rows.
    const closest = tries
      .map((checks) => checks.filter((c) => !c.pass))
      .sort((a, b) => a.length - b.length)[0]
    out.push(...(closest ?? []))
  }
  return out
}

/** The full run. The judgement is the model's answer, or null before we ask. */
export function evaluate(
  m: Measured,
  gates: GateSetShape,
  niches: Niche[],
  judgement: Judgement | null,
  now = Date.now(),
): GateResult {
  // The widest bar first, so anyone too small for every niche costs nothing.
  const wide = loosest(gates.hard, niches)
  let hardChecks = [...runHard(m, wide, now), ...runEither(m, gates.either, now)]
  const blocker = hardChecks.find((c) => !c.pass)
  if (blocker) {
    return {
      verdict: 'hard_fail',
      blockedBy: blocker.key,
      hardChecks,
      knockoutAnswers: [],
      criteriaScores: [],
      score: 0,
      reason: `${blocker.key}: measured ${blocker.value} against ${wide[blocker.key as keyof HardRules]}`,
    }
  }
  if (!judgement) {
    return { verdict: 'hard_fail', hardChecks, knockoutAnswers: [], criteriaScores: [], score: 0, reason: 'Not evaluated yet' }
  }

  // Which slice they work in, and whether it is one we still want.
  const on = niches.filter((n) => n.enabled)
  const niche = on.find((n) => n.id === judgement.niche)
  if (on.length && !niche) {
    return {
      verdict: 'off_niche',
      blockedBy: 'niche',
      hardChecks,
      knockoutAnswers: [],
      criteriaScores: [],
      score: 0,
      reason: 'Works in something you are not looking for',
    }
  }

  // Now the niche is known, its own numbers apply.
  const own = forNiche(gates.hard, niche)
  hardChecks = [...runHard(m, own, now), ...runEither(m, gates.either, now)]
  const short = hardChecks.find((c) => !c.pass)
  if (short) {
    return {
      verdict: 'off_niche',
      niche: niche?.id,
      blockedBy: short.key,
      hardChecks,
      knockoutAnswers: [],
      criteriaScores: [],
      score: 0,
      reason: `${short.key}: measured ${short.value}, ${niche?.label ?? 'this niche'} asks for ${own[short.key as keyof HardRules]}`,
    }
  }

  // A knockout the client switched off is not asked at all. It is not asked
  // and answered yes: an unasked question has no answer to show on the lead.
  const knockoutAnswers = gates.knockouts
    .filter((k) => k.enabled !== false)
    .map((k) => ({
      id: k.id,
      pass: judgement.knockouts[k.id]?.pass ?? false,
      note: judgement.knockouts[k.id]?.note,
    }))
  const failed = knockoutAnswers.find((a) => !a.pass)
  if (failed) {
    const question = gates.knockouts.find((k) => k.id === failed.id)
    return {
      verdict: 'knockout_fail',
      niche: niche?.id,
      blockedBy: failed.id,
      hardChecks,
      knockoutAnswers,
      criteriaScores: [],
      score: 0,
      reason: failed.note ?? `No on: ${question?.question ?? failed.id}`,
    }
  }

  const criteriaScores = gates.criteria.map((c) => ({
    id: c.id,
    score: clamp(judgement.criteria[c.id]?.score ?? 0),
    note: judgement.criteria[c.id]?.note,
  }))
  // Every hard filter held, so this is a lead. The brand fit is measured and
  // carried, and it decides where they sit in the list, not whether they are
  // in it. Mirrors app/src/data/gates.ts on purpose.
  const score = criteriaScores.reduce((sum, c) => sum + c.score, 0)
  return {
    verdict: 'qualified',
    niche: niche?.id,
    blockedBy: undefined,
    hardChecks,
    knockoutAnswers,
    criteriaScores,
    score,
    reason: judgement.reason,
  }
}

function clamp(n: number): number {
  return n < 0 ? 0 : n > 2 ? 2 : Math.round(n)
}

// ---------------------------------------------------------------------------
// Widening: did this edit open anything, and what does a lead miss
// ---------------------------------------------------------------------------

/** Which way each number has to move for more people to come through. */
const LOOSER: Record<string, 'down' | 'up'> = {
  followersMin: 'down',
  followersMax: 'up',
  lastPostWithinDays: 'up',
  medianViewsMin: 'down',
  medianCommentsMin: 'down',
  postsPerMonthMin: 'down',
  viewRatioMin: 'down',
  monthlyViewsMin: 'down',
}

/**
 * True when the second set of rules lets in someone the first would turn away.
 *
 * Read structurally rather than by running the pool, because it runs on every
 * save. It errs towards saying yes, and saying yes only means the leads that
 * follow carry a mark, which costs a client nothing and tells them the truth.
 */
export function loosens(
  before: { hard: HardRules; passScore: number; niches: Niche[] },
  after: { hard: HardRules; passScore: number; niches: Niche[] },
): boolean {
  if (after.passScore < before.passScore) return true
  for (const key of Object.keys(LOOSER)) {
    const a = (before.hard as Record<string, unknown>)[key]
    const b = (after.hard as Record<string, unknown>)[key]
    if (typeof a !== 'number') continue
    if (typeof b !== 'number') return true
    if (LOOSER[key] === 'down' ? b < a : b > a) return true
  }
  for (const key of ['countries', 'languages'] as const) {
    const a = before.hard[key]
    const b = after.hard[key]
    if (!a?.length) continue
    if (!b?.length) return true
    if (b.some((v) => !a.includes(v))) return true
  }
  const on = new Set(before.niches.filter((n) => n.enabled).map((n) => n.id))
  if (after.niches.filter((n) => n.enabled).some((n) => !on.has(n.id))) return true
  return false
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`
  return String(n)
}

/** What a number reads as on one profile, in the client's own words. */
const SAYS: Record<string, (n: number) => string> = {
  followersMin: (n) => `${compact(n)} followers`,
  followersMax: (n) => `${compact(n)} followers`,
  medianViewsMin: (n) => `${compact(n)} views on a typical post`,
  medianCommentsMin: (n) => `${n} comments on a typical post`,
  postsPerMonthMin: (n) => `${n} posts a month`,
  lastPostWithinDays: (n) => `last posted ${n} days ago`,
  viewRatioMin: (n) => `${n}% of their followers watch a typical post`,
  monthlyViewsMin: (n) => `${compact(n)} views a month`,
}

/**
 * The one line a lead misses against the rules its campaign started with.
 *
 * Written at delivery and stored on the lead, so a row can explain itself a
 * year later without re-running anything.
 */
export function beyondLine(result: GateResult, gates: GateSetShape): string {
  const key = result.blockedBy
  if (key === 'score') return `Scored ${result.score}, your first rules asked ${gates.passScore}`
  if (key === 'niche') return 'Works in a slice you switched on later'
  if (key === 'countries') return 'Posts from outside the countries you first picked'
  if (key === 'languages') return 'Posts in a language outside the ones you first picked'
  const say = key ? SAYS[key] : undefined
  const check = result.hardChecks.find((c) => c.key === key)
  // The check carries what it was measured against. A row from an either group
  // was measured against a number that never appears in hard, so reading hard
  // for it would say nothing.
  const limit = check?.limit ?? (key ? (gates.hard as Record<string, unknown>)[key] : undefined)
  if (!say || typeof limit !== 'number' || !check) return 'Outside the rules you started with'
  const asked = key === 'lastPostWithinDays' ? `${limit} days` : compact(limit)
  return `${say(check.value)}, your first rules asked ${asked}`
}
