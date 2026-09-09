import type { Creator, Level, Score, Signal, Stars } from '../types'
import { daysSince } from '../lib/format'

// One scoring rule for the whole app. Change it here and every screen follows.
//
// Three criteria, one star each, added up. Every criterion pays a half star
// when it half fits and a full star when it fits, so the score runs 0 to 3 in
// half steps. The three are independent: a creator selling with a fresh signal
// scores 2 even outside the niche.
//
//   Niche    1 content, audience and follower band fit the brief
//            0.5 the right discipline, a different audience
//   Selling  1 actively doing business, an own product on sale
//            0.5 a few collabs already done
//   Signal   1 a brand signal in the last 4 days
//            0.5 a brand signal in the last 10 days

export const CRITERIA = [
  { key: 'niche', label: 'Niche', full: 'Content and audience fit the brief', half: 'The right discipline, a different audience' },
  { key: 'active', label: 'Selling', full: 'Actively doing business, an own product on sale', half: 'A few collabs already done' },
  { key: 'intent', label: 'Signal', full: 'A brand signal in the last 4 days', half: 'A brand signal in the last 10 days' },
] as const

export const SIGNAL_STRONG_DAYS = 4
export const SIGNAL_SOFT_DAYS = 10

export function latestSignal(c: Creator): Signal | null {
  return c.signals.length ? c.signals[0] : null
}

/** An own product means business today. A download or a past collab is half. */
export function sellingLevel(sells: string, signals: Signal[]): Level {
  if (/program|coaching|app|membership/.test(sells)) return 1
  if (/ebook|merch|affiliate/.test(sells) || signals.length > 0) return 0.5
  return 0
}

/** How hot the intent is, by how recently a signal fired. */
export function signalLevel(signals: Signal[], now = new Date()): Level {
  let best: Level = 0
  for (const s of signals) {
    const age = daysSince(s.date, now)
    const level: Level = age <= SIGNAL_STRONG_DAYS ? 1 : age <= SIGNAL_SOFT_DAYS ? 0.5 : 0
    if (level > best) best = level
  }
  return best
}

export function scoreOf(c: Creator, now = new Date()): Score {
  const niche = c.niche
  const active = sellingLevel(c.sells, c.signals)
  const intent = signalLevel(c.signals, now)
  const stars = (niche + active + intent) as Stars
  const earned = [
    { label: 'Niche', level: niche, note: nicheNote(c, niche) },
    { label: 'Selling', level: active, note: sellingNote(c, active) },
    { label: 'Signal', level: intent, note: signalNote(c, intent, now) },
  ]
  const said = earned.filter((e) => e.level > 0).map((e) => e.note)
  return { stars, niche, active, intent, earned, why: said.length ? said.join('. ') + '.' : c.nicheWhy }
}

function nicheNote(c: Creator, level: Level): string {
  if (level === 1) return 'Content and audience fit the brief'
  if (level === 0.5) return `Half a fit: ${lower(c.nicheWhy)}`
  return c.nicheWhy
}

function sellingNote(c: Creator, level: Level): string {
  if (level === 1) return `Sells ${c.sells}, so it is doing business today`
  if (level === 0.5) return c.sells ? `Sells ${c.sells}` : `${c.signals.length} collab${c.signals.length === 1 ? '' : 's'} already done`
  return 'Sells nothing and has run no collab'
}

function signalNote(c: Creator, level: Level, now: Date): string {
  const s = latestSignal(c)
  if (!s) return 'No brand signal on record'
  const age = daysSince(s.date, now)
  if (level === 1) return `${s.label} ${age === 0 ? 'today' : `${age} days ago`}`
  if (level === 0.5) return `${s.label} ${age} days ago`
  return `Last brand signal ${age} days ago, past the 10 day window`
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, '')
}

/** A lead counts as qualified above 1.5 stars. */
export const QUALIFIED_MIN = 1.5

/** Where a score sits, for the split under the chart. */
export const BUCKETS = [
  { label: '3 stars', min: 3 },
  { label: '2 to 2.5', min: 2 },
  { label: '1 to 1.5', min: 1 },
  { label: 'under 1', min: 0 },
]
