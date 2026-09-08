import type { Creator, Score, Signal, Stars } from '../types'
import { daysSince } from '../lib/format'

// One scoring rule for the whole app. Change it here and every screen follows.
//
// One star each, added up:
//   Niche    content and audience fit the brief
//   Selling  sells a program, coaching, an ebook, an app, or runs a link hub
//   Signal   a brand signal fired in the last 30 days
//
// The three are independent. A creator selling with a fresh signal but outside
// the niche still scores 2.

export const CRITERIA = [
  { key: 'niche', label: 'Niche', means: 'Content and audience fit the brief' },
  { key: 'active', label: 'Selling', means: 'Sells a program, coaching, an ebook or an app' },
  { key: 'intent', label: 'Signal', means: 'A brand signal fired in the last 30 days' },
] as const

export const SIGNAL_WINDOW_DAYS = 30

export function latestSignal(c: Creator): Signal | null {
  return c.signals.length ? c.signals[0] : null
}

export function scoreOf(c: Creator, now = new Date()): Score {
  const signal = latestSignal(c)
  const niche = c.niche
  const active = c.sells !== ''
  const intent = signal !== null && daysSince(signal.date, now) <= SIGNAL_WINDOW_DAYS
  const stars = ((niche ? 1 : 0) + (active ? 1 : 0) + (intent ? 1 : 0)) as Stars
  const earned = [niche && 'Niche', active && 'Selling', intent && 'Signal'].filter((x): x is string => typeof x === 'string')
  return { stars, niche, active, intent, earned, why: explain(c, niche, active, intent, signal, now) }
}

function explain(c: Creator, niche: boolean, active: boolean, intent: boolean, signal: Signal | null, now: Date): string {
  const parts: string[] = []
  parts.push(niche ? 'Fits the brief' : 'Sits outside the brief')
  if (active) parts.push(`sells ${c.sells}`)
  if (intent && signal) parts.push(`${lower(signal.label)} ${daysSince(signal.date, now)} days ago`)
  if (!active && !intent) parts.push(`posts ${c.postsPerMonth} times a month with nothing on sale`)
  else if (!active) parts.push('sells nothing of its own yet')
  else if (!intent) parts.push(signal ? `last brand signal ${daysSince(signal.date, now)} days ago` : 'no brand signal on record')
  return join(parts) + '.'
}

function join(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
