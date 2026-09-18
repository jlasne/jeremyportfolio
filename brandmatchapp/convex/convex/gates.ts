// The three gates, server side. The same logic as app/src/data/gates.ts, on
// purpose: the simulator in the browser and the nightly run have to agree, or
// a client is promised one number and delivered another.
//
// Gate 1 reads numbers we measured and costs nothing. Only what survives it is
// worth a model call, and that ordering is the whole margin.

const DAY = 86_400_000

export type Verdict = 'qualified' | 'hard_fail' | 'knockout_fail' | 'below_threshold'

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
  knockouts: { id: string; question: string; why?: string }[]
  criteria: { id: string; label: string; guide?: string }[]
  passScore: number
}

export interface Judgement {
  knockouts: Record<string, { pass: boolean; note?: string }>
  criteria: Record<string, { score: number; note?: string }>
  reason: string
}

export interface HardCheck { key: string; value: number; pass: boolean }

export interface GateResult {
  verdict: Verdict
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
      out.push({ key: read.key, value: -1, pass: false })
      continue
    }
    out.push({ key: read.key, value, pass: read.pass(value, limit) })
  }
  if (hard.countries?.length) {
    const ok = Boolean(m.country && hard.countries.includes(m.country))
    out.push({ key: 'countries', value: ok ? 1 : 0, pass: ok })
  }
  if (hard.languages?.length) {
    const ok = Boolean(m.language && hard.languages.includes(m.language))
    out.push({ key: 'languages', value: ok ? 1 : 0, pass: ok })
  }
  return out
}

export function passesHard(checks: HardCheck[]): boolean {
  return checks.every((c) => c.pass)
}

/** The full run. The judgement is the model's answer, or null before we ask. */
export function evaluate(m: Measured, gates: GateSetShape, judgement: Judgement | null, now = Date.now()): GateResult {
  const hardChecks = runHard(m, gates.hard, now)
  const blocker = hardChecks.find((c) => !c.pass)
  if (blocker) {
    return {
      verdict: 'hard_fail',
      blockedBy: blocker.key,
      hardChecks,
      knockoutAnswers: [],
      criteriaScores: [],
      score: 0,
      reason: `${blocker.key}: measured ${blocker.value} against ${gates.hard[blocker.key as keyof HardRules]}`,
    }
  }
  if (!judgement) {
    return { verdict: 'hard_fail', hardChecks, knockoutAnswers: [], criteriaScores: [], score: 0, reason: 'Not evaluated yet' }
  }

  const knockoutAnswers = gates.knockouts.map((k) => ({
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

  const criteriaScores = gates.criteria.map((c) => ({
    id: c.id,
    score: clamp(judgement.criteria[c.id]?.score ?? 0),
    note: judgement.criteria[c.id]?.note,
  }))
  const score = criteriaScores.reduce((sum, c) => sum + c.score, 0)
  const qualified = score >= gates.passScore
  return {
    verdict: qualified ? 'qualified' : 'below_threshold',
    blockedBy: qualified ? undefined : 'score',
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
