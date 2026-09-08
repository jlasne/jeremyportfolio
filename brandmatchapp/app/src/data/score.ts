import type { Creator, Score, Signal, Stars } from '../types'
import { daysSince } from '../lib/format'

// One scoring rule for the whole app. Change it here and every screen follows.
//
// 3  niche, sells something, and a brand signal in the last 30 days
// 2  niche and sells something
// 1  niche
// 0  outside the niche

export const RUNGS: Record<Stars, string> = {
  0: 'Outside',
  1: 'Niche fit',
  2: 'Selling',
  3: 'Ready now',
}

export const SIGNAL_WINDOW_DAYS = 30

export function latestSignal(c: Creator): Signal | null {
  return c.signals.length ? c.signals[0] : null
}

export function scoreOf(c: Creator, now = new Date()): Score {
  const signal = latestSignal(c)
  const niche = c.niche
  const active = c.sells !== ''
  const intent = signal !== null && daysSince(signal.date, now) <= SIGNAL_WINDOW_DAYS
  const stars: Stars = !niche ? 0 : intent && active ? 3 : active ? 2 : 1
  return { stars, niche, active, intent, rung: RUNGS[stars], why: explain(c, stars, signal, now) }
}

function explain(c: Creator, stars: Stars, signal: Signal | null, now: Date): string {
  const cadence = `posts ${c.postsPerMonth} times a month`
  switch (stars) {
    case 3:
      return `Fits the brief, sells ${c.sells}, and ${lower(signal!.label)} ${daysSince(signal!.date, now)} days ago.`
    case 2:
      return signal
        ? `Fits the brief and sells ${c.sells}. Last brand signal ${daysSince(signal.date, now)} days ago.`
        : `Fits the brief, sells ${c.sells}, and ${cadence}.`
    case 1:
      return `Fits the brief and ${cadence}. Sells nothing yet, so a deal starts from zero.`
    default:
      return c.nicheWhy
  }
}

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1)
}
