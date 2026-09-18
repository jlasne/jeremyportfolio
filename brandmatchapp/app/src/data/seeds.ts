import type { GateSet, HardRules, Niche } from '../types'
import { built, creators } from '../mock/creators'
import { judge } from '../mock/judge'
import { evaluate, hardLabel, loosest, runHard } from './gates'
import { compact } from '../lib/format'

// The accounts a client already knows.
//
// They are the best starting point there is, because the people around a good
// account look like that account. They are also the least trustworthy input in
// the product, because a client naming six accounts off the top of their head
// is not running their own rules while they do it.
//
// So a seed is never taken on trust. It goes through the campaign's own rules
// like anything else, the client is told what we found, and a seed that fails
// is not used to find others: its neighbours would be off target too.

export type SeedState = 'fits' | 'fails' | 'unknown'

export interface SeedVerdict {
  handle: string
  state: SeedState
  /** One line saying what we found. */
  note: string
  followers: number | null
}

export function cleanHandles(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((word) => word.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, ''))
        .map((word) => word.replace(/\/.*$/, ''))
        .filter((word) => /^[a-z0-9._]{2,30}$/.test(word)),
    ),
  ].slice(0, 12)
}

/** What each one is, against the rules the client just accepted. */
export function checkSeeds(handles: string[], gates: GateSet | null, niches: Niche[]): SeedVerdict[] {
  return handles.map((handle) => {
    const at = creators.findIndex((c) => c.handle === handle)
    if (at < 0 || !gates) {
      return {
        handle,
        state: 'unknown',
        note: 'New to us. We will measure them before anything else.',
        followers: null,
      }
    }
    const creator = creators[at]
    const checks = runHard(creator, loosest(gates.hard, niches))
    const missed = checks.find((c) => !c.pass)
    if (missed) {
      return {
        handle,
        state: 'fails',
        note: `${hardLabel(missed.key)}, ${fmt(missed.key, missed.value)}.`,
        followers: creator.followers,
      }
    }
    const band = built[at].band
    const result = evaluate(creator, gates, niches, judge(at, band, gates, niches))
    if (result.verdict === 'qualified' || result.verdict === 'below_threshold') {
      return {
        handle,
        state: 'fits',
        note: `${compact(creator.followers)} followers, scores ${result.score} of 14.`,
        followers: creator.followers,
      }
    }
    return {
      handle,
      state: 'fails',
      note: result.verdict === 'off_niche'
        ? 'Works in something outside the slices you picked.'
        : `Fails a deal breaker: ${lower(result.reason)}`,
      followers: creator.followers,
    }
  })
}

function lower(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1)
}

function fmt(key: string, value: number): string {
  if (key === 'lastPostWithinDays') return `${value} days ago`
  return value >= 1_000 ? compact(value) : String(value)
}

/**
 * The seeds against the brief.
 *
 * This is the part worth having. When someone names six accounts at 30k while
 * their rules start at 100k, one of the two is wrong, and it is usually the
 * rules: people describe the audience they think they should want and then name
 * the people they actually want.
 */
export function seedMismatch(verdicts: SeedVerdict[], hard: HardRules): string | null {
  const known = verdicts.map((v) => v.followers).filter((n): n is number => n !== null)
  if (known.length < 3) return null
  const sorted = [...known].sort((a, b) => a - b)
  const middle = sorted[Math.floor(sorted.length / 2)]
  const floor = hard.followersMin ?? 0
  const ceiling = hard.followersMax ?? Infinity

  if (floor > 0 && middle < floor * 0.6) {
    return `The accounts you gave us are around ${compact(middle)} followers, and your rules start at ${compact(floor)}. Did you mean to aim smaller?`
  }
  if (Number.isFinite(ceiling) && middle > ceiling * 1.4) {
    return `The accounts you gave us are around ${compact(middle)} followers, above the ${compact(ceiling)} ceiling in your rules. Did you mean to aim bigger?`
  }
  return null
}

/** Only the ones that hold up are worth following. */
export function usableSeeds(verdicts: SeedVerdict[]): string[] {
  return verdicts.filter((v) => v.state !== 'fails').map((v) => v.handle)
}
