import type { Creator, GateSet, HardRules, Niche } from '../types'
import { built } from '../mock/creators'
import { judge } from '../mock/judge'
import { evaluate, loosest, passesHard, runHard, type Judgement } from './gates'
import { DIALS, settle, type DialKey } from './tuning'

// The simulator's engine.
//
// This is the server's job. It runs here while the backend is not wired, and
// convex/feasibility.ts does the same work on the real pool. Keeping it in its
// own file matters for one reason: the scan rate below is an internal number,
// and nothing in data/index.ts is allowed to touch it.
//
// What leaves this file is a rate and an estimate. What never leaves it is how
// many profiles we are willing to read to produce them.

/**
 * How many profiles a day we are willing to read for an account, by tier.
 * Internal. It shapes the estimate and is never named, shown or hinted at.
 */
function scanRate(tier: number): number {
  return tier * 40
}

export interface Funnel {
  scanned: number
  pastHard: number
  /** In a niche still switched on, and big enough for that niche's own bar. */
  inNiche: number
  pastKnockouts: number
  qualified: number
}

/** Which threshold sent a profile home, and whether it did so alone. */
export interface Blame {
  key: DialKey
  /** Failed this and nothing else. Relaxing it alone recovers exactly these. */
  sole: number
  /** Failed this and something else too. Relaxing it alone recovers none. */
  shared: number
}

export interface SimResult {
  funnel: Funnel
  histogram: { score: number; count: number }[]
  blame: Blame[]
  /** Qualified a day at the rate we are willing to read for this account. */
  estimatedPerDay: number
}

interface Sample {
  index: number
  creator: Creator
  band: string
}

const SAMPLE: Sample[] = built.map((b, index) => ({ index, creator: b.creator, band: b.band }))

/**
 * The model's answers for one gate version, computed once.
 *
 * Relaxing a threshold changes who reaches the model, never what the model
 * would say, so the answers are reused across every relaxation run. On the
 * server this is the evaluations table doing the same job.
 */
function judgements(gates: GateSet, niches: Niche[]): Judgement[] {
  return SAMPLE.map((s) => judge(s.index, s.band, gates, niches))
}

function walk(gates: GateSet, niches: Niche[], answers: Judgement[], now: number): SimResult {
  const blame = new Map<DialKey, { sole: number; shared: number }>()
  const histogram = new Map<number, number>()
  let pastHard = 0
  let inNiche = 0
  let pastKnockouts = 0
  let qualified = 0

  SAMPLE.forEach((s, i) => {
    const checks = runHard(s.creator, loosest(gates.hard, niches), now)
    if (!passesHard(checks)) {
      const failed = checks.filter((c) => !c.pass).map((c) => c.key as DialKey)
      for (const key of failed) {
        const at = blame.get(key) ?? { sole: 0, shared: 0 }
        if (failed.length === 1) at.sole++
        else at.shared++
        blame.set(key, at)
      }
      return
    }
    pastHard++
    const result = evaluate(s.creator, gates, niches, answers[i], now)
    if (result.verdict === 'off_niche') return
    inNiche++
    if (result.verdict === 'knockout_fail') return
    pastKnockouts++
    histogram.set(result.score, (histogram.get(result.score) ?? 0) + 1)
    if (result.verdict === 'qualified') qualified++
  })

  return {
    funnel: { scanned: SAMPLE.length, pastHard, inNiche, pastKnockouts, qualified },
    // Every score from 0 to the ceiling, so the spread reads as a spread.
    histogram: Array.from({ length: gates.criteria.length * 2 + 1 }, (_, score) => ({
      score,
      count: histogram.get(score) ?? 0,
    })),
    blame: [...blame.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.sole - a.sole),
    estimatedPerDay: 0,
  }
}

/**
 * Everyone in the sample these rules would hand over, by position.
 *
 * The room screen reads this rather than a count, because the difference
 * between two rule versions is a set of people, and what those people look like
 * is the honest cost of widening.
 */
export function qualifiedSet(
  gates: GateSet, niches: Niche[], answers?: Judgement[], now = Date.now(),
): Set<number> {
  const ans = answers ?? judgements(gates, niches)
  const out = new Set<number>()
  SAMPLE.forEach((s, i) => {
    if (evaluate(s.creator, gates, niches, ans[i], now).verdict === 'qualified') out.add(i)
  })
  return out
}

/** The model's answers for one gate version, so a caller can reuse them. */
export function answersFor(gates: GateSet, niches: Niche[]): Judgement[] {
  return judgements(gates, niches)
}

/** One profile of the shared sample, by position. */
export function creatorAt(index: number): Creator {
  return SAMPLE[index].creator
}

export const SAMPLE_SIZE = SAMPLE.length

/** What a qualified count in the sample means a day, at this account's pace. */
export function perDayOf(qualified: number, tier: number): number {
  return Math.round((qualified / Math.max(1, SAMPLE_SIZE)) * scanRate(tier))
}

export function simulate(gates: GateSet, niches: Niche[], tier: number): SimResult {
  const out = walk(gates, niches, judgements(gates, niches), Date.now())
  out.estimatedPerDay = Math.round((out.funnel.qualified / Math.max(1, out.funnel.scanned)) * scanRate(tier))
  return out
}

// ---------------------------------------------------------------------------
// Levers
// ---------------------------------------------------------------------------

/** One notch looser, per dial. Enough to move the needle, not enough to surprise. */
const NOTCH: Record<DialKey, (v: number) => number> = {
  followersMin: (v) => Math.round(v * 0.67),
  followersMax: (v) => Math.round(v * 1.5),
  lastPostWithinDays: (v) => Math.round(v * 2),
  medianViewsMin: (v) => Math.round(v * 0.6),
  postsPerMonthMin: (v) => Math.round(v * 0.67),
  medianCommentsMin: () => 0,
}

export interface Lever {
  id: string
  /** "Median views, 40k" */
  label: string
  /** "Lowering it to 25k roughly doubles your volume." */
  action: string
  /** The multiple on today's volume. 2.1 means roughly double. */
  gain: number
  /** The rules this lever would write. */
  next: { hard: HardRules; passScore: number }
  /** The history line, if the client applies it. */
  change: string
}

/**
 * The two moves worth a click.
 *
 * Each candidate is measured by re-running the whole sample with that one
 * change, which is the only honest way to answer "what do I get if I move this
 * and nothing else". Sole blame decides ties: a threshold that turns profiles
 * away on its own is the one worth relaxing.
 *
 * Gate 2 is never a candidate. Suggesting a client stop asking whether a
 * creator has a paid offer, so that a quota is met, is selling them worse
 * leads. Volume is negotiated on the numbers, never on the questions.
 */
export function levers(gates: GateSet, niches: Niche[]): Lever[] {
  const answers = judgements(gates, niches)
  const now = Date.now()
  const base = walk(gates, niches, answers, now)
  const from = Math.max(1, base.funnel.qualified)
  const blameOf = (key: DialKey) => base.blame.find((b) => b.key === key)?.sole ?? 0

  const candidates: Lever[] = []

  for (const dial of DIALS) {
    const value = gates.hard[dial.key]
    if (typeof value !== 'number') continue
    const loosened = settle({ ...gates.hard, [dial.key]: NOTCH[dial.key](value) })
    const after = loosened[dial.key]
    if (after === value) continue
    const run = walk({ ...gates, hard: loosened }, niches, answers, now)
    const gain = run.funnel.qualified / from
    candidates.push({
      id: dial.key,
      label: `${dial.label}, ${dial.format(value)}`,
      action: `${verb(dial.key)} it to ${dial.format(after as number)} ${phrase(gain)}.`,
      gain,
      next: { hard: loosened, passScore: gates.passScore },
      change: `${dial.label}: ${dial.format(value)} to ${dial.format(after as number)}`,
      // Sole blame breaks a tie between two levers with the same gain.
      ...({ sole: blameOf(dial.key) } as object),
    })
  }

  // The score is a candidate like any other, and its gain is exact rather than
  // estimated: lowering the bar by one admits exactly one bucket.
  if (gates.passScore > 5) {
    const next = gates.passScore - 1
    const admitted = base.histogram.find((h) => h.score === next)?.count ?? 0
    const gain = (base.funnel.qualified + admitted) / from
    candidates.push({
      id: 'passScore',
      label: `Pass mark, ${gates.passScore} of ${gates.criteria.length * 2}`,
      action: `Lowering it to ${next} ${phrase(gain)}.`,
      gain,
      next: { hard: gates.hard, passScore: next },
      change: `Pass mark: ${gates.passScore} to ${next}`,
    })
  }

  return candidates
    // Under a fifth more, it is not worth a click.
    .filter((c) => c.gain >= 1.2)
    .sort((a, b) => b.gain - a.gain || ((b as any).sole ?? 0) - ((a as any).sole ?? 0))
    .slice(0, 2)
}

function verb(key: DialKey): string {
  if (key === 'followersMax') return 'Raising'
  if (key === 'lastPostWithinDays') return 'Allowing'
  if (key === 'medianCommentsMin') return 'Dropping'
  return 'Lowering'
}

/** Estimates, said as estimates. Never a guarantee. */
function phrase(gain: number): string {
  if (gain >= 2.8) return 'gets you roughly three times as many'
  if (gain >= 1.8) return 'gets you roughly twice as many'
  return `gets you about ${Math.max(10, Math.round(((gain - 1) * 100) / 10) * 10)}% more`
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

export type Verdict = 'feasible' | 'short' | 'too_narrow'

/**
 * Three answers, and the client only ever hears the first half of the third.
 * "Too narrow for a daily feed" is what they read. That it also means the scan
 * needed would run past what we are willing to read is ours to know.
 */
export function verdictOf(estimatedPerDay: number, want: number): Verdict {
  if (estimatedPerDay < 3 || estimatedPerDay < want * 0.25) return 'too_narrow'
  if (estimatedPerDay < want) return 'short'
  return 'feasible'
}

/** Two significant figures, so the client reads a size and not a measurement. */
export function about(n: number): string {
  if (n < 100) return String(Math.round(n))
  const digits = Math.floor(Math.log10(n)) - 1
  const unit = Math.pow(10, digits)
  return (Math.round(n / unit) * unit).toLocaleString('en-GB')
}
