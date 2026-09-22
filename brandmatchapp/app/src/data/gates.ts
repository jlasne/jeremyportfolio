import type {
  Creator,
  Niche,
  CriterionResult,
  CriterionScore,
  EitherGroup,
  GateSet,
  HardCheck,
  HardRules,
  KnockoutAnswer,
  Verdict,
} from '../types'

// The rules, as one function.
//
// Three of them decide, and one describes. Size and activity, the niche, and
// the deal breakers are hard filters: pass all three and you are a qualified
// lead. Brand fit is then a score on that lead, from 0 to 100, and it sorts
// the list. It never turns anyone away.
//
// That split is the product. A client who sets a pass mark on a score they
// have not seen yet is guessing, and the guess costs them people they would
// have wanted. The hard filters are facts they can state; the score is a
// ranking they can read.
//
// Size and activity runs first because it reads measured numbers and costs
// nothing. The niche and the deal breakers need a model read, which is the
// expensive part, so a profile that fails the numbers never reaches the model.
// That ordering is the whole margin.
//
// This file is shared with the backend on purpose. The judgement comes in as an
// argument, so the same code runs against a mocked judgement here and against
// the model's answer in production.

const DAY = 86_400_000

/**
 * The widest version of the numbers across every niche still switched on.
 *
 * Someone who fails this fails every niche, so they can be dropped before a
 * single model call is paid for. That is what keeps the first check free even
 * though each niche carries its own bar.
 */
export function loosest(hard: HardRules, niches: Niche[]): HardRules {
  const on = niches.filter((n) => n.enabled)
  if (!on.length) return hard
  // Higher is stricter on these, lower is stricter on the other two.
  const LOWER_IS_LOOSER: (keyof HardRules)[] = [
    'followersMin', 'medianViewsMin', 'medianCommentsMin', 'postsPerMonthMin',
    'viewRatioMin', 'monthlyViewsMin',
  ]
  const out: HardRules = { ...hard }
  for (const key of [...LOWER_IS_LOOSER, 'followersMax', 'lastPostWithinDays'] as (keyof HardRules)[]) {
    const values = on
      .map((n) => (n.hard?.[key] ?? hard[key]))
      .filter((v): v is number => typeof v === 'number')
    if (!values.length) continue
    const loose = LOWER_IS_LOOSER.includes(key) ? Math.min(...values) : Math.max(...values)
    out[key] = loose as never
  }
  return out
}

/** The numbers that apply once we know which niche someone works in. */
export function forNiche(hard: HardRules, niche: Niche | undefined): HardRules {
  return niche?.hard ? { ...hard, ...niche.hard } : hard
}

/** What the model answers about one profile, for one gate version. */
export interface Judgement {
  /** Which niche this person works in, from the campaign's list, or null. */
  niche?: string | null
  /** Keyed by knockout id. */
  knockouts: Record<string, { pass: boolean; note?: string }>
  /** Keyed by criterion id. */
  criteria: Record<string, { score: CriterionScore; note?: string }>
  /** One sentence explaining the call. */
  reason: string
}

export interface GateResult {
  verdict: Verdict
  /** Ids of the deal breaker sentences this profile missed. */
  flags?: string[]
  /** The niche this person matched, once we know it. */
  niche: string | null
  /** The rule that ended it. Null when nothing blocked. */
  blockedBy: string | null
  hardChecks: HardCheck[]
  knockoutAnswers: KnockoutAnswer[]
  criteriaScores: CriterionResult[]
  score: number
  reason: string
}

/** The rules that read a number off the profile, and how to read it. */
const READS: { key: keyof HardRules; of: (c: Creator) => number | null; pass: (value: number, limit: number) => boolean }[] = [
  { key: 'followersMin', of: (c) => c.followers, pass: (v, l) => v >= l },
  { key: 'followersMax', of: (c) => c.followers, pass: (v, l) => v <= l },
  { key: 'medianViewsMin', of: (c) => c.medianViews, pass: (v, l) => v >= l },
  { key: 'medianCommentsMin', of: (c) => c.medianComments, pass: (v, l) => v >= l },
  { key: 'postsPerMonthMin', of: (c) => c.postsPerMonth, pass: (v, l) => v >= l },
  // Two numbers nobody measures directly. They are the ratio and the month,
  // and they exist so a group can offer reach on proportion as an alternative
  // to reach in absolute terms.
  {
    key: 'viewRatioMin',
    of: (c) => (c.followers > 0 && c.medianViews !== null
      ? Math.round((c.medianViews / c.followers) * 100)
      : null),
    pass: (v, l) => v >= l,
  },
  {
    key: 'monthlyViewsMin',
    of: (c) => (c.medianViews !== null && c.postsPerMonth !== null
      ? Math.round(c.medianViews * c.postsPerMonth)
      : null),
    pass: (v, l) => v >= l,
  },
  { key: 'lastPostWithinDays', of: daysSinceLastPost, pass: (v, l) => v <= l },
]

function daysSinceLastPost(c: Creator, now = Date.now()): number | null {
  if (!c.lastPostAt) return null
  return Math.floor((now - new Date(c.lastPostAt).getTime()) / DAY)
}

/**
 * Gate 1 on its own. Returns one row per threshold that is set, so the lead
 * panel can show what was measured next to what was asked.
 */
export function runHard(creator: Creator, hard: HardRules, now = Date.now()): HardCheck[] {
  const out: HardCheck[] = []
  for (const read of READS) {
    const limit = hard[read.key]
    if (typeof limit !== 'number') continue
    const value = read.key === 'lastPostWithinDays' ? daysSinceLastPost(creator, now) : read.of(creator)
    // A number we never measured cannot pass a threshold on measured data.
    if (value === null) {
      out.push({ key: read.key, value: -1, pass: false, limit })
      continue
    }
    out.push({ key: read.key, value, pass: read.pass(value, limit), limit })
  }
  // Where they are and what they post in are not measured by the crawl yet.
  // An unknown is not a wrong answer, so a null passes here; the server does
  // the same, and both go back to failing the day the crawl fills these in.
  if (hard.countries?.length && creator.country !== null) {
    const ok = hard.countries.includes(creator.country)
    out.push({ key: 'countries', value: ok ? 1 : 0, pass: ok })
  }
  if (hard.languages?.length && creator.language !== null) {
    const ok = hard.languages.includes(creator.language)
    out.push({ key: 'languages', value: ok ? 1 : 0, pass: ok })
  }
  return out
}

/** True while Gate 1 still allows a model read. */
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
export function runEither(creator: Creator, groups: EitherGroup[] | undefined, now = Date.now()): HardCheck[] {
  if (!groups?.length) return []
  const out: HardCheck[] = []
  for (const group of groups) {
    const tries = (group.options ?? []).map((option) => runHard(creator, option, now))
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

/**
 * The full run. Hand it a judgement and it returns the verdict plus every
 * intermediate answer, which is what the evaluation row stores.
 */
export function evaluate(
  creator: Creator,
  gates: GateSet,
  niches: Niche[],
  judgement: Judgement | null,
  now = Date.now(),
): GateResult {
  // The widest bar first, so anyone too small for every niche costs nothing.
  const wide = loosest(gates.hard, niches)
  let hardChecks = [...runHard(creator, wide, now), ...runEither(creator, gates.either, now)]
  const blocker = hardChecks.find((c) => !c.pass)
  if (blocker) {
    return {
      verdict: 'hard_fail',
      niche: null,
      blockedBy: blocker.key,
      hardChecks,
      knockoutAnswers: [],
      criteriaScores: [],
      score: 0,
      reason: hardReason(blocker, wide),
    }
  }

  // It held, so the model read is worth paying for.
  if (!judgement) {
    return { verdict: 'hard_fail', niche: null, blockedBy: null, hardChecks, knockoutAnswers: [], criteriaScores: [], score: 0, reason: 'Not evaluated yet' }
  }

  // Which slice they work in, and whether that slice is one we still want.
  const on = niches.filter((n) => n.enabled)
  const niche = on.find((n) => n.id === judgement.niche)
  if (on.length && !niche) {
    return {
      verdict: 'off_niche',
      niche: null,
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
  hardChecks = [...runHard(creator, own, now), ...runEither(creator, gates.either, now)]
  const short = hardChecks.find((c) => !c.pass)
  if (short) {
    return {
      verdict: 'off_niche',
      niche: niche?.id ?? null,
      blockedBy: short.key,
      hardChecks,
      knockoutAnswers: [],
      criteriaScores: [],
      score: 0,
      reason: `${hardReason(short, own)}, for ${niche?.label ?? 'this niche'}`,
    }
  }

  const criteriaScores: CriterionResult[] = gates.criteria.map((c) => ({
    id: c.id,
    score: judgement.criteria[c.id]?.score ?? 0,
    note: judgement.criteria[c.id]?.note,
  }))

  // Every hard filter held, so this is a lead.
  //
  // Two things happen to the sentences. The ones the client left alone are
  // the brand fit: they score, they order the list, and they turn nobody
  // away. The ones they marked as deal breakers are out of that score, and a
  // profile that plainly fails one is flagged rather than dropped.
  //
  // Flagged means the sentence came back false, a zero. One means partly
  // true, and a rule partly met is not a rule that was broken, so it shows
  // and does not flag. Mirrors convex/convex/gates.ts on purpose.
  const breakers = new Set(gates.criteria.filter((c) => c.breaker).map((c) => c.id))
  const flags = criteriaScores.filter((c) => breakers.has(c.id) && c.score === 0).map((c) => c.id)
  const score = criteriaScores.filter((c) => !breakers.has(c.id)).reduce((sum, c) => sum + c.score, 0)
  return {
    verdict: 'qualified',
    niche: niche?.id ?? null,
    blockedBy: null,
    flags,
    hardChecks,
    knockoutAnswers: [],
    criteriaScores,
    score,
    reason: judgement.reason,
  }
}

/**
 * The ceiling of a gate version. Each sentence is worth 2.
 *
 * A sentence the client turned into a deal breaker is out of the score, so it
 * is out of the ceiling too. Eight sentences with two marked are read out of
 * twelve, and a lead that scores nine is at three quarters, not at half.
 */
export function maxScore(gates: GateSet): number {
  return gates.criteria.filter((c) => !c.breaker).length * 2
}

// Three ways to name the same rule, because a rule reads differently depending
// on why it is on screen. None of them says median, floor or threshold.
//
//   why it failed   "Not enough views on a typical post"
//   the setting     "Views on a typical post, at least"   (data/tuning.ts)
//   what we found   "Views on a typical post"

const HARD_LABELS: Record<string, string> = {
  followersMin: 'Not enough followers',
  followersMax: 'Too many followers',
  medianViewsMin: 'Not enough views on a typical post',
  medianCommentsMin: 'Not enough comments on a typical post',
  postsPerMonthMin: 'Not posting often enough',
  viewRatioMin: 'Too few of their followers watch a typical post',
  monthlyViewsMin: 'Not enough views across a month',
  lastPostWithinDays: 'Has not posted recently enough',
  countries: 'Not in a country you picked',
  languages: 'Not in a language you picked',
}

export function hardLabel(key: string): string {
  return HARD_LABELS[key] ?? key
}

const FOUND_LABELS: Record<string, string> = {
  followersMin: 'Followers',
  followersMax: 'Followers',
  medianViewsMin: 'Views on a typical post',
  medianCommentsMin: 'Comments on a typical post',
  postsPerMonthMin: 'Posts a month',
  viewRatioMin: 'Share of their followers who watch a post',
  monthlyViewsMin: 'Views across a month',
  lastPostWithinDays: 'Days since their last post',
  countries: 'Country',
  languages: 'Language',
}

/** What we measured, named for a panel that is showing the measurement. */
export function foundLabel(key: string): string {
  return FOUND_LABELS[key] ?? key
}

function hardReason(check: HardCheck, hard: HardRules): string {
  const limit = check.limit ?? hard[check.key]
  if (check.value < 0) return `${hardLabel(check.key)}, and we could not measure it`
  if (typeof limit === 'number') return `${hardLabel(check.key)}: ${check.value}, you asked for ${limit}`
  return hardLabel(check.key)
}

/** The same rules, named as the settings a client is looking at. */
const RULE_LABELS: Record<string, string> = {
  followersMin: 'Followers, from',
  followersMax: 'Followers, up to',
  medianViewsMin: 'Views on a typical post, at least',
  medianCommentsMin: 'Comments on a typical post, at least',
  postsPerMonthMin: 'Posts a month, at least',
  viewRatioMin: 'Share of their followers watching a post, at least',
  monthlyViewsMin: 'Views across a month, at least',
  lastPostWithinDays: 'Posted in the last',
  countries: 'Countries',
  languages: 'Language',
}

export function ruleLabel(key: string): string {
  return RULE_LABELS[key] ?? key
}
