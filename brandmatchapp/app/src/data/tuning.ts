import type { EitherGroup, HardRules, PresetId } from '../types'
import { compact } from '../lib/format'
import type { GateTemplate } from './templates'

// Bounded personalisation.
//
// A client tunes inside limits and cannot break the product with a filter that
// makes no sense. Two kinds of limit do that work:
//
//   fixed     a dial's own floor and ceiling. Followers under 5,000 are too
//             noisy to trust. A last post older than 90 days is not an active
//             account by anyone's definition.
//   coupled   a dial bounded by another dial. Views only mean something next to
//             the follower minimum, so they are held between 5% and 300% of it.
//   stepped   a dial with three settings and nothing between them. Comments are
//             too easy to fake and too uneven by niche to be worth a slider.
//
// The coupled ones matter more than the fixed ones. 500,000 views is not absurd
// on its own. It is absurd next to a follower minimum of 15,000.
//
// Every label here is read by a client, so none of it says median, floor,
// ceiling or threshold. A median is "a typical post". A floor is "at least".

export type DialKey =
  | 'followersMin' | 'followersMax' | 'lastPostWithinDays'
  | 'medianViewsMin' | 'postsPerMonthMin' | 'medianCommentsMin'

export interface Dial {
  key: DialKey
  label: string
  /** Log for anything spanning orders of magnitude, linear for the rest. */
  scale: 'log' | 'linear'
  /** A dial with steps is a choice between them rather than a slide. */
  steps?: number[]
  /** Live floor and ceiling. Some depend on the other dials. */
  range: (hard: HardRules) => { min: number; max: number }
  format: (value: number) => string
  /** Why this dial cannot go further, in one line. */
  limit: string
}

const floorOf = (hard: HardRules) => hard.followersMin ?? 15_000

/** Off, a light floor, a real one. Nothing between them means anything. */
export const COMMENT_STEPS = [0, 5, 15]

// In the order a client reads them: how big, how often, how far they reach.
export const DIALS: Dial[] = [
  {
    key: 'followersMin',
    label: 'Followers, from',
    scale: 'log',
    range: () => ({ min: 5_000, max: 500_000 }),
    format: compact,
    limit: 'Below 5,000 followers the numbers swing too much to trust.',
  },
  {
    key: 'followersMax',
    label: 'Followers, up to',
    scale: 'log',
    // Always at least three times the minimum, or the band holds nobody.
    range: (h) => ({ min: Math.max(25_000, floorOf(h) * 3), max: 5_000_000 }),
    format: (v) => (v >= 5_000_000 ? 'no limit' : compact(v)),
    limit: 'Above 5M people almost never answer a message.',
  },
  {
    key: 'lastPostWithinDays',
    label: 'Posted in the last',
    scale: 'linear',
    range: () => ({ min: 3, max: 90 }),
    format: (v) => `${v} days`,
    limit: 'Under 3 days you are filtering on luck. Past 90 days the account is asleep.',
  },
  {
    key: 'postsPerMonthMin',
    label: 'Posts a month, at least',
    scale: 'linear',
    range: () => ({ min: 2, max: 30 }),
    format: (v) => String(v),
    limit: 'Under 2 a month is not really posting. Over 30 rules out anyone who posts in bursts.',
  },
  {
    key: 'medianViewsMin',
    label: 'Views on a typical post, at least',
    scale: 'log',
    // 5% to 300% of the follower minimum. Below, the filter says nothing.
    // Above, you are asking for a permanently viral account.
    range: (h) => ({
      min: Math.max(500, Math.round(floorOf(h) * 0.05)),
      max: Math.min(2_000_000, Math.round(floorOf(h) * 3)),
    }),
    format: compact,
    limit: 'Tied to your follower minimum, between 5% and 300% of it.',
  },
  {
    key: 'medianCommentsMin',
    label: 'Comments on a typical post, at least',
    scale: 'linear',
    // The cheapest signal to fake and the most variable by niche, so it is
    // three settings and not a slider: off, a light floor, a real one. A
    // number a client picks off a dial here reads as precision we do not have.
    steps: COMMENT_STEPS,
    range: () => ({ min: 0, max: 15 }),
    format: (v) => (v <= 0 ? 'off' : String(v)),
    limit: 'Above 15 it quietly empties your list.',
  },
]

export const dialByKey = new Map(DIALS.map((d) => [d.key, d]))

// ---------------------------------------------------------------------------
// Slider positions
// ---------------------------------------------------------------------------

const STEPS = 1000

/** The nearest setting a stepped dial holds. */
export function snap(dial: Dial, value: number): number {
  if (!dial.steps?.length) return value
  return dial.steps.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best)
}

export function toPosition(dial: Dial, hard: HardRules, value: number): number {
  const { min, max } = dial.range(hard)
  const v = Math.min(max, Math.max(min, value))
  if (dial.scale === 'linear' || min <= 0) return Math.round(((v - min) / (max - min)) * STEPS)
  return Math.round((Math.log(v / min) / Math.log(max / min)) * STEPS)
}

export function fromPosition(dial: Dial, hard: HardRules, position: number): number {
  const { min, max } = dial.range(hard)
  const t = Math.min(1, Math.max(0, position / STEPS))
  const raw = dial.scale === 'linear' || min <= 0 ? min + t * (max - min) : min * Math.pow(max / min, t)
  return tidy(raw)
}

/** Rounds to a figure a human would have typed. */
function tidy(n: number): number {
  if (n >= 100_000) return Math.round(n / 10_000) * 10_000
  if (n >= 10_000) return Math.round(n / 1_000) * 1_000
  if (n >= 1_000) return Math.round(n / 100) * 100
  if (n >= 100) return Math.round(n / 10) * 10
  return Math.round(n)
}

/**
 * Pulls every dial back inside its range after one of them moved. Moving the
 * follower floor moves what the views floor is allowed to be, so this runs on
 * every change and not only on save.
 */
export function settle(hard: HardRules): HardRules {
  const out: HardRules = { ...hard }
  for (const dial of DIALS) {
    const { min, max } = dial.range(out)
    const value = out[dial.key]
    if (typeof value !== 'number') continue
    out[dial.key] = snap(dial, Math.min(max, Math.max(min, value))) as never
  }
  return out
}

// ---------------------------------------------------------------------------
// The three presets
// ---------------------------------------------------------------------------

/**
 * Everything here is relative to the library's own defaults, so Strict means
 * the same thing in a sponsorship campaign as in a sales campaign.
 *
 * Presets never touch Gate 2. A knockout is a business rule, not a dial.
 */
const PRESETS: Record<Exclude<PresetId, 'custom'>, {
  label: string
  blurb: string
  followersFloor: number
  followersCeiling: number
  recency: number
  viewsShare: number
  cadence: number
  /** One of the three comment settings, not a share of anything. */
  comments: number
  /** Brand fit needed, as a share of the ceiling. Works for any number of sentences. */
  passShare: number
}> = {
  strict: {
    label: 'Strict',
    blurb: 'Fewer people, better ones. Only accounts already doing well.',
    followersFloor: 2, followersCeiling: 1, recency: 0.5, viewsShare: 1, cadence: 1.5,
    comments: 15, passShare: 0.86,
  },
  balanced: {
    label: 'Balanced',
    blurb: 'Where most people start. Decent reach, posting regularly.',
    followersFloor: 1, followersCeiling: 1, recency: 1, viewsShare: 0.5, cadence: 1,
    comments: 5, passShare: 0.64,
  },
  broad: {
    label: 'Broad',
    blurb: 'More people every day. You do more of the sorting.',
    followersFloor: 0.5, followersCeiling: 1.5, recency: 2, viewsShare: 0.25, cadence: 0.5,
    comments: 0, passShare: 0.5,
  },
}

export const PRESET_LIST = (['strict', 'balanced', 'broad'] as const).map((id) => ({
  id,
  label: PRESETS[id].label,
  blurb: PRESETS[id].blurb,
}))

export interface Tuned {
  hard: HardRules
  passScore: number
}

/**
 * The dials set under each niche rather than once for the campaign.
 *
 * A dial lives in exactly one place. Either the campaign carries the number
 * and every niche follows it, or the campaign carries nothing for it and each
 * niche carries its own. Never both, because a number with an override is a
 * number nobody can be sure of.
 */
export function perNicheKeys(hard: HardRules, niches: { hard?: Partial<HardRules> }[]): DialKey[] {
  return DIALS.map((d) => d.key).filter(
    (key) => typeof hard[key] !== 'number' && niches.some((n) => typeof n.hard?.[key] === 'number'),
  )
}

/** A share of brand fit as points, for a given number of sentences. */
export function pointsFor(share: number, sentences: number): number {
  return Math.max(1, Math.min(sentences * 2, Math.round(share * sentences * 2)))
}

/** Points as a share of brand fit, for a given number of sentences. */
export function shareOf(points: number, sentences: number): number {
  return sentences > 0 ? Math.round((points / (sentences * 2)) * 100) : 0
}

export function preset(id: Exclude<PresetId, 'custom'>, lib: GateTemplate, keep: HardRules = {}): Tuned {
  const p = PRESETS[id]
  const d = lib.defaults
  const followersMin = tidy(d.followersMin * p.followersFloor)
  const medianViewsMin = tidy(followersMin * p.viewsShare)
  const hard: HardRules = {
    followersMin,
    followersMax: tidy(d.followersMax * p.followersCeiling),
    lastPostWithinDays: Math.round(d.lastPostWithinDays * p.recency),
    medianViewsMin,
    postsPerMonthMin: Math.round(d.postsPerMonthMin * p.cadence),
    medianCommentsMin: p.comments,
    // A preset moves the numbers. Where the client sells stays where it was.
    ...(keep.countries ? { countries: keep.countries } : {}),
    ...(keep.languages ? { languages: keep.languages } : {}),
  }
  return { hard: settle(hard), passScore: pointsFor(p.passShare, lib.criteria.length) }
}

/** Which preset a set of rules sits on, or custom once anything drifted. */
export function presetOf(hard: HardRules, passScore: number, lib: GateTemplate): PresetId {
  for (const id of ['strict', 'balanced', 'broad'] as const) {
    const at = preset(id, lib, hard)
    if (at.passScore !== passScore) continue
    const same = DIALS.every((dial) => at.hard[dial.key] === hard[dial.key])
    if (same) return id
  }
  return 'custom'
}

// ---------------------------------------------------------------------------
// The hardness gauge
// ---------------------------------------------------------------------------

/**
 * Where the campaign sits between Broad and Strict, on 0 to 1.
 *
 * Each dial is read against that library's own three presets rather than
 * against its absolute range, so applying Balanced always lands on the middle
 * and applying Strict always lands at the end. A raw range would not: most of
 * the recency range is dead account territory nobody ever uses.
 *
 * Gate 2 is not in here. Turning a knockout off is a discrete business call,
 * not a dial, and the Gate 2 card says how many are on.
 */
const WEIGHTS: Record<DialKey | 'passScore', number> = {
  followersMin: 0.1,
  followersMax: 0.05,
  lastPostWithinDays: 0.15,
  medianViewsMin: 0.25,
  postsPerMonthMin: 0.15,
  medianCommentsMin: 0.05,
  passScore: 0.25,
}

export function hardness(hard: HardRules, passScore: number, lib: GateTemplate): number {
  const broad = preset('broad', lib)
  const mid = preset('balanced', lib)
  const strict = preset('strict', lib)

  let total = 0
  for (const dial of DIALS) {
    const value = hard[dial.key]
    if (typeof value !== 'number') continue
    total += WEIGHTS[dial.key] * between(
      value,
      broad.hard[dial.key] as number,
      mid.hard[dial.key] as number,
      strict.hard[dial.key] as number,
    )
  }
  total += WEIGHTS.passScore * between(passScore, broad.passScore, mid.passScore, strict.passScore)
  return Math.min(1, Math.max(0, total))
}

/** 0 at the broad end, 0.5 at balanced, 1 at strict, piecewise and clamped. */
function between(value: number, low: number, mid: number, high: number): number {
  // Recency runs the other way: fewer days is stricter.
  const flip = low > high
  const [a, b, c] = flip ? [high, mid, low] : [low, mid, high]
  const v = value
  if (b === a || c === b) return 0.5
  const t = v <= b ? 0.5 * ((v - a) / (b - a)) : 0.5 + 0.5 * ((v - b) / (c - b))
  const clamped = Math.min(1, Math.max(0, t))
  return flip ? 1 - clamped : clamped
}

export const BANDS = [
  { at: 0.34, label: 'Broad' },
  { at: 0.67, label: 'Balanced' },
  { at: 1, label: 'Strict' },
]

export function bandOf(score: number): string {
  return BANDS.find((b) => score <= b.at)?.label ?? 'Strict'
}

// ---------------------------------------------------------------------------
// What changed, in plain lines
// ---------------------------------------------------------------------------

/** The history line for one save. Reads as a sentence, not as a diff. */
export function describeChanges(
  before: { hard: HardRules; passScore: number; knockouts: { id: string; enabled?: boolean }[] },
  after: { hard: HardRules; passScore: number; knockouts: { id: string; question: string; enabled?: boolean }[] },
  criteria: { before: { id: string; text: string }[]; after: { id: string; text: string }[] },
): string[] {
  const lines: string[] = []
  for (const dial of DIALS) {
    const a = before.hard[dial.key]
    const b = after.hard[dial.key]
    if (a === b) continue
    if (typeof b !== 'number') {
      if (typeof a === 'number') lines.push(`${dial.label}: now set per niche`)
      continue
    }
    lines.push(`${dial.label}: ${typeof a === 'number' ? dial.format(a) : 'per niche'} to ${dial.format(b)}`)
  }
  if (before.passScore !== after.passScore) {
    lines.push(`Pass mark: ${before.passScore} to ${after.passScore}`)
  }
  for (const k of after.knockouts) {
    const was = before.knockouts.find((x) => x.id === k.id)
    const on = k.enabled !== false
    if (was && (was.enabled !== false) !== on) {
      lines.push(`${on ? 'Now checking' : 'Stopped checking'}: ${k.question}`)
    }
  }
  for (const c of criteria.after) {
    const was = criteria.before.find((x) => x.id === c.id)
    if (!was) lines.push(`Added: ${c.text}`)
    else if (was.text !== c.text) lines.push(`Reworded: ${was.text} to ${c.text}`)
  }
  for (const c of criteria.before) {
    if (!criteria.after.some((x) => x.id === c.id)) lines.push(`Removed: ${c.text}`)
  }
  return lines
}

// A choice, said out loud.
//
// Once reach and rhythm are alternatives rather than demands, the panel has to
// say so. "50k views on a typical post" is a rule a client can argue with.
// "50k views on a typical post, or 100k views across a month" is the same rule
// with the door the alternative opens, and it reads as one sentence.

/** One number, named the way a client reads it rather than the way it is stored. */
export function saysRule(key: keyof HardRules, n: number): string {
  switch (key) {
    case 'followersMin': return `${compact(n)} followers or more`
    case 'followersMax': return `up to ${compact(n)} followers`
    case 'medianViewsMin': return `${compact(n)} views on a typical post`
    case 'medianCommentsMin': return `${n} comments on a typical post`
    case 'postsPerMonthMin': return cadence(n)
    case 'viewRatioMin': return `${n}% of their followers watching a post`
    case 'monthlyViewsMin': return `${compact(n)} views across a month`
    case 'lastPostWithinDays': return `a post in the last ${n} days`
    default: return ''
  }
}

export function cadence(perMonth: number): string {
  if (perMonth >= 26) return 'posting daily'
  if (perMonth >= 12) return 'posting several times a week'
  if (perMonth >= 7) return 'posting at least twice a week'
  if (perMonth >= 4) return 'posting at least weekly'
  return `posting at least ${perMonth} times a month`
}

/** Every way through one group, joined by the word that makes it a choice. */
export function eitherLine(group: EitherGroup): string {
  const ways = (group.options ?? [])
    .map((option) =>
      (Object.keys(option) as (keyof HardRules)[])
        .map((key) => (typeof option[key] === 'number' ? saysRule(key, option[key] as number) : ''))
        .filter(Boolean)
        .join(' and '),
    )
    .filter(Boolean)
  return ways.join(', or ')
}
