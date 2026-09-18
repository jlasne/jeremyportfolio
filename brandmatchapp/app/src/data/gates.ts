import type {
  Creator,
  CriterionResult,
  CriterionScore,
  GateSet,
  HardCheck,
  HardRules,
  KnockoutAnswer,
  Verdict,
} from '../types'

// The three gates, as one function.
//
// Gate 1 reads measured numbers and costs nothing. Gate 2 and Gate 3 need a
// model read, which is the expensive part, so Gate 1 runs first and a profile
// that fails it never reaches the model. That ordering is the whole margin.
//
// This file is shared with the backend on purpose. The judgement comes in as an
// argument, so the same code runs against a mocked judgement here and against
// the model's answer in production.

const DAY = 86_400_000

/** What the model answers about one profile, for one gate version. */
export interface Judgement {
  /** Keyed by knockout id. */
  knockouts: Record<string, { pass: boolean; note?: string }>
  /** Keyed by criterion id. */
  criteria: Record<string, { score: CriterionScore; note?: string }>
  /** One sentence explaining the call. */
  reason: string
}

export interface GateResult {
  verdict: Verdict
  /** The hard key or the knockout id that ended it. Null when nothing blocked. */
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
      out.push({ key: read.key, value: -1, pass: false })
      continue
    }
    out.push({ key: read.key, value, pass: read.pass(value, limit) })
  }
  if (hard.countries?.length) {
    const ok = creator.country !== null && hard.countries.includes(creator.country)
    out.push({ key: 'countries', value: ok ? 1 : 0, pass: ok })
  }
  if (hard.languages?.length) {
    const ok = creator.language !== null && hard.languages.includes(creator.language)
    out.push({ key: 'languages', value: ok ? 1 : 0, pass: ok })
  }
  return out
}

/** True while Gate 1 still allows a model read. */
export function passesHard(checks: HardCheck[]): boolean {
  return checks.every((c) => c.pass)
}

/**
 * The full run. Hand it a judgement and it returns the verdict plus every
 * intermediate answer, which is what the evaluation row stores.
 */
export function evaluate(creator: Creator, gates: GateSet, judgement: Judgement | null, now = Date.now()): GateResult {
  const hardChecks = runHard(creator, gates.hard, now)
  const blocker = hardChecks.find((c) => !c.pass)
  if (blocker) {
    return {
      verdict: 'hard_fail',
      blockedBy: blocker.key,
      hardChecks,
      knockoutAnswers: [],
      criteriaScores: [],
      score: 0,
      reason: hardReason(blocker, gates.hard),
    }
  }

  // Gate 1 held, so the model read is worth paying for.
  if (!judgement) {
    return { verdict: 'hard_fail', blockedBy: null, hardChecks, knockoutAnswers: [], criteriaScores: [], score: 0, reason: 'Not evaluated yet' }
  }

  const knockoutAnswers: KnockoutAnswer[] = gates.knockouts.map((k) => ({
    id: k.id,
    pass: judgement.knockouts[k.id]?.pass ?? false,
    note: judgement.knockouts[k.id]?.note,
  }))
  const failed = knockoutAnswers.find((a) => !a.pass)
  if (failed) {
    const asked = gates.knockouts.find((k) => k.id === failed.id)
    return {
      verdict: 'knockout_fail',
      blockedBy: failed.id,
      hardChecks,
      knockoutAnswers,
      criteriaScores: [],
      score: 0,
      reason: failed.note ?? `No on: ${asked?.question ?? failed.id}`,
    }
  }

  const criteriaScores: CriterionResult[] = gates.criteria.map((c) => ({
    id: c.id,
    score: judgement.criteria[c.id]?.score ?? 0,
    note: judgement.criteria[c.id]?.note,
  }))
  const score = criteriaScores.reduce((sum, c) => sum + c.score, 0)
  const verdict: Verdict = score >= gates.passScore ? 'qualified' : 'below_threshold'
  return {
    verdict,
    blockedBy: verdict === 'qualified' ? null : 'score',
    hardChecks,
    knockoutAnswers,
    criteriaScores,
    score,
    reason: judgement.reason,
  }
}

/** The ceiling of a gate version. Seven criteria at 2 each. */
export function maxScore(gates: GateSet): number {
  return gates.criteria.length * 2
}

const HARD_LABELS: Record<string, string> = {
  followersMin: 'Followers below the floor',
  followersMax: 'Followers above the ceiling',
  medianViewsMin: 'Median views below the floor',
  medianCommentsMin: 'Median comments below the floor',
  postsPerMonthMin: 'Posts a month below the floor',
  lastPostWithinDays: 'Last post too old',
  countries: 'Outside the country list',
  languages: 'Outside the language list',
}

export function hardLabel(key: string): string {
  return HARD_LABELS[key] ?? key
}

function hardReason(check: HardCheck, hard: HardRules): string {
  const limit = hard[check.key]
  if (check.value < 0) return `${hardLabel(check.key)}, and we have no measurement`
  if (typeof limit === 'number') return `${hardLabel(check.key)}: ${check.value} against ${limit}`
  return hardLabel(check.key)
}

/**
 * The same rules, named for the editor rather than for a rejection. On a lead
 * panel a failed check reads "Followers below the floor". In the gates editor
 * the row is the threshold itself, so it reads "Followers, floor".
 */
const RULE_LABELS: Record<string, string> = {
  followersMin: 'Followers, floor',
  followersMax: 'Followers, ceiling',
  medianViewsMin: 'Median views, floor',
  medianCommentsMin: 'Median comments, floor',
  postsPerMonthMin: 'Posts a month, floor',
  lastPostWithinDays: 'Last post, no older than',
  countries: 'Countries',
  languages: 'Languages',
}

export function ruleLabel(key: string): string {
  return RULE_LABELS[key] ?? key
}
