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
//   Selling  1 own program, coaching, app or membership
//            0.5 an ebook, merch or affiliate links
//   Signal   1 a paid post or a public rate card in the last 30 days
//            0.5 bio wording, a media kit or a launch in the last 30 days,
//                or a paid post 31 to 90 days old

export const CRITERIA = [
  { key: 'niche', label: 'Niche', full: 'Content and audience fit the brief', half: 'The right discipline, a different audience' },
  { key: 'active', label: 'Selling', full: 'Sells a program, coaching, an app or a membership', half: 'Sells an ebook, merch or affiliate links' },
  { key: 'intent', label: 'Signal', full: 'A paid post or a rate card in the last 30 days', half: 'A softer signal, or a paid post 31 to 90 days old' },
] as const

export const SIGNAL_WINDOW_DAYS = 30

export function latestSignal(c: Creator): Signal | null {
  return c.signals.length ? c.signals[0] : null
}

/** What a creator sells, weighed. Its own product beats a download. */
export function sellingLevel(sells: string): Level {
  if (/program|coaching|app|membership/.test(sells)) return 1
  if (/ebook|merch|affiliate/.test(sells)) return 0.5
  return 0
}

/** The best signal on record, weighed by strength and by age. */
export function signalLevel(signals: Signal[], now = new Date()): Level {
  let best: Level = 0
  for (const s of signals) {
    const age = daysSince(s.date, now)
    let level: Level = 0
    if (age <= SIGNAL_WINDOW_DAYS) level = s.strength === 'strong' ? 1 : 0.5
    else if (age <= 90 && s.strength === 'strong') level = 0.5
    if (level > best) best = level
  }
  return best
}

export function scoreOf(c: Creator, now = new Date()): Score {
  const niche = c.niche
  const active = sellingLevel(c.sells)
  const intent = signalLevel(c.signals, now)
  const stars = (niche + active + intent) as Stars
  const earned = [
    { label: 'Niche', level: niche, note: nicheNote(c, niche) },
    { label: 'Selling', level: active, note: c.sells ? `Sells ${c.sells}` : 'Sells nothing of its own yet' },
    { label: 'Signal', level: intent, note: signalNote(c, intent, now) },
  ]
  return { stars, niche, active, intent, earned, why: earned.filter((e) => e.level > 0).map((e) => e.note).join('. ') + '.' || c.nicheWhy }
}

function nicheNote(c: Creator, level: Level): string {
  if (level === 1) return 'Content and audience fit the brief'
  if (level === 0.5) return `Half a fit: ${lower(c.nicheWhy)}`
  return c.nicheWhy
}

function signalNote(c: Creator, level: Level, now: Date): string {
  const s = latestSignal(c)
  if (!s) return 'No brand signal on record'
  const age = daysSince(s.date, now)
  if (level === 1) return `${s.label} ${age} days ago`
  if (level === 0.5) return `${s.label} ${age} days ago, a softer signal`
  return `Last brand signal ${age} days ago`
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, '')
}

/** Where a score sits, for the dashboard split. */
export const BUCKETS = [
  { label: '3 stars', min: 3 },
  { label: '2 to 2.5', min: 2 },
  { label: '1 to 1.5', min: 1 },
  { label: 'under 1', min: 0 },
]
