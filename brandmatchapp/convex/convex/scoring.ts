// The one scoring rule, shared by every function here and mirrored in the
// front end at app/src/data/score.ts.
//
// Three criteria, one star each, added up. Each pays half a star when it half
// fits and a full star when it fits, so the score runs 0 to 3 in half steps.
// The three are independent: a creator selling with a fresh signal scores 2
// even outside the niche.

export const SIGNAL_STRONG_DAYS = 4
export const SIGNAL_SOFT_DAYS = 10
export const DAY = 86_400_000

/** How long a lead stays exclusive to the brand it was handed to. */
export const CLAIM_WINDOW = 14 * DAY

export type Level = 0 | 0.5 | 1
export interface Signal { type: string; label: string; strength: string; date: string }

/** An own product means business today. A download or a past collab is half. */
export function sellingLevel(sells: string, signals: Signal[]): Level {
  if (/program|coaching|app|membership|shop/i.test(sells)) return 1
  if (/ebook|merch|affiliate|link hub|own site/i.test(sells) || signals.length > 0) return 0.5
  return 0
}

/** How hot the intent is, by how recently a signal fired. */
export function signalLevel(lastSignalAt: number | undefined, now = Date.now()): Level {
  if (!lastSignalAt) return 0
  const age = (now - lastSignalAt) / DAY
  if (age <= SIGNAL_STRONG_DAYS) return 1
  if (age <= SIGNAL_SOFT_DAYS) return 0.5
  return 0
}

/** Niche comes from the model. The other two are read off the pool. */
export function starsFor(
  niche: number,
  sells: string,
  signals: Signal[],
  lastSignalAt: number | undefined,
  now = Date.now(),
): number {
  return niche + sellingLevel(sells, signals) + signalLevel(lastSignalAt, now)
}

/** The newest dated signal, as a timestamp, or undefined when there is none. */
export function newestSignal(signals: Signal[]): number | undefined {
  let best: number | undefined
  for (const s of signals) {
    const t = Date.parse(s.date)
    if (!Number.isNaN(t) && (best === undefined || t > best)) best = t
  }
  return best
}

/** A lead counts as qualified at a full star or more, whichever star fired. */
export const QUALIFIED_MIN = 1

// Filters cut the volume. Stars set the order. Filters never change a score.

export interface Filters {
  followersMin?: number
  followersMax?: number
  engagementMin?: number
  reelViewsMin?: number | null
  emailInBio?: 'any' | 'yes'
  lastPostWithin?: number
  postsPerMonthMin?: number
  countries?: string[]
  languages?: string[]
}

export interface Creatorish {
  followers: number
  engagementRate?: number
  medianReelViews?: number
  postsPerMonth?: number
  lastPostAt?: number
  email?: string
  country?: string
  language?: string
}

export function passes(c: Creatorish, f: Filters, now = Date.now()): boolean {
  if (c.followers < (f.followersMin ?? 0)) return false
  if (c.followers > (f.followersMax ?? Number.MAX_SAFE_INTEGER)) return false
  if ((c.engagementRate ?? 1) < (f.engagementMin ?? 0)) return false
  if ((c.medianReelViews ?? Number.MAX_SAFE_INTEGER) < (f.reelViewsMin ?? 0)) return false
  if (f.emailInBio === 'yes' && !c.email) return false
  if (c.lastPostAt && now - c.lastPostAt > (f.lastPostWithin ?? 90) * DAY) return false
  if ((c.postsPerMonth ?? 999) < (f.postsPerMonthMin ?? 0)) return false
  if (f.countries?.length && (!c.country || !f.countries.includes(c.country))) return false
  if (f.languages?.length && (!c.language || !f.languages.includes(c.language))) return false
  return true
}

/**
 * The CRM, in six words. A tag is a stage, and these are the stages, so an
 * API or an AI moves a lead along them without inventing its own.
 */
export const STAGES = ['to contact', 'contacted', 'replied', 'in talks', 'deal', 'passed'] as const
