import type { Campaign, LeadStatus, Niche, Subscription } from '../types'
import type { LeadRow } from './index'
import { rank, WALK } from './status'
import { compact } from '../lib/format'

// Everything the dashboard shows, and the rules about when it may show it.
//
// The dashboard is built from statuses and amounts the client typed. When those
// are thin, a percentage is a lie dressed as a fact. So three kinds of figure
// get three different rules, and nothing here ever rounds a small sample into
// a confident number.

/**
 * A rate needs 20 in the denominator.
 *
 * One more lead moves a rate by about 100/n points. Under 20 that is more than
 * five points, which is noise wearing the clothes of a trend. The client can
 * check this rule themselves, which is the point of having one.
 */
export const RATE_MIN = 20

/** A comparison needs 12 in the smaller group, or one outlier moves the median. */
export const GROUP_MIN = 12

/** And a gap under a quarter is not a finding at this sample size. */
export const GAP_MIN = 0.25

export type Period = 7 | 30 | 0

export function inPeriod(rows: LeadRow[], days: Period): LeadRow[] {
  if (!days) return rows
  const from = Date.now() - days * 86_400_000
  // Scoped by when the lead was delivered, never by when something happened to
  // it. A reply from a lead delivered six weeks ago does not belong in a seven
  // day reply rate: the denominator would not contain it.
  return rows.filter((r) => new Date(r.lead.deliveredAt).getTime() >= from)
}

/** The same length of time, just before the window being looked at. */
export function previousPeriod(rows: LeadRow[], days: Period): LeadRow[] {
  if (!days) return []
  const end = Date.now() - days * 86_400_000
  const start = end - days * 86_400_000
  return rows.filter((r) => {
    const at = new Date(r.lead.deliveredAt).getTime()
    return at >= start && at < end
  })
}

// ---------------------------------------------------------------------------
// Block one: who replies
// ---------------------------------------------------------------------------

export interface Comparison {
  label: string
  all: number
  replied: number
  /** The gap as a share, or null when one side has nothing to compare. */
  gap: number | null
  format: (n: number) => string
}

const median = (values: number[]): number => {
  const sorted = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function repliedRows(rows: LeadRow[]): LeadRow[] {
  return rows.filter((r) => rank(r.lead.status) >= rank('replied'))
}

export function compare(rows: LeadRow[]): Comparison[] {
  const replied = repliedRows(rows)
  const of = (list: LeadRow[], pick: (r: LeadRow) => number) => median(list.map(pick))
  const build = (label: string, pick: (r: LeadRow) => number, format: (n: number) => string): Comparison => {
    const a = of(rows, pick)
    const b = of(replied, pick)
    return { label, all: a, replied: b, gap: a > 0 ? (b - a) / a : null, format }
  }
  return [
    build('Followers', (r) => r.creator.followers, compact),
    build('Views on a typical post', (r) => r.creator.medianViews ?? 0, compact),
    build('Comments on a typical post', (r) => r.creator.medianComments ?? 0, (n) => String(n)),
    build('Fit score', (r) => r.lead.score, (n) => `${n} of 14`),
  ]
}

/**
 * What the comparison adds up to, in a sentence anyone can act on.
 *
 * When nothing separates the two groups that is a finding too, and a useful
 * one: it means size is not what decides, so stop tuning it.
 */
export function readTable(table: Comparison[], replied: number, patternBelow: boolean): string {
  if (replied < GROUP_MIN) {
    return `Once about ${GROUP_MIN} people have replied we can tell you what they have in common.`
  }
  const moved = table.filter((t) => t.gap !== null && Math.abs(t.gap) >= GAP_MIN)
  if (!moved.length) {
    // A middle value cannot see a pattern that lives at both ends. When the
    // charts below have found one, say where to look instead of saying nothing
    // is happening, which would read as a contradiction.
    return patternBelow
      ? 'Side by side the two look alike, because what decides is not being bigger or smaller but landing in the right band. The charts below show where.'
      : 'The people who reply look much like everyone else you were sent. Size and score are not what decides here, so what you send is doing the work.'
  }
  const said = moved
    .map((t) => `${t.label.toLowerCase()} ${t.gap! > 0 ? 'higher' : 'lower'} by ${Math.abs(Math.round(t.gap! * 100))}%`)
    .join(', and ')
  return `The people who reply have ${said}.`
}

export interface Band {
  label: string
  delivered: number
  replied: number
  /** Null until the band has enough delivered leads to carry a rate. */
  rate: number | null
}

function band(rows: LeadRow[], label: string, keep: (r: LeadRow) => boolean): Band {
  const inside = rows.filter(keep)
  const replied = repliedRows(inside).length
  return {
    label,
    delivered: inside.length,
    replied,
    rate: inside.length >= RATE_MIN ? replied / inside.length : null,
  }
}

export function sizeBands(rows: LeadRow[]): Band[] {
  return [
    band(rows, 'Under 25k', (r) => r.creator.followers < 25_000),
    band(rows, '25k to 100k', (r) => r.creator.followers >= 25_000 && r.creator.followers < 100_000),
    band(rows, '100k to 250k', (r) => r.creator.followers >= 100_000 && r.creator.followers < 250_000),
    band(rows, '250k and up', (r) => r.creator.followers >= 250_000),
  ]
}

export function scoreBands(rows: LeadRow[]): Band[] {
  return [
    band(rows, 'Scored 9 or 10', (r) => r.lead.score <= 10),
    band(rows, 'Scored 11 or 12', (r) => r.lead.score === 11 || r.lead.score === 12),
    band(rows, 'Scored 13 or 14', (r) => r.lead.score >= 13),
  ]
}

export function nicheBands(rows: LeadRow[], niches: Niche[]): Band[] {
  const named = niches.map((n) => band(rows, n.label, (r) => r.evaluation.niche === n.id))
  const other = band(rows, 'Something else', (r) => !r.evaluation.niche)
  return [...named, ...(other.delivered ? [other] : [])].filter((b) => b.delivered > 0)
}

/**
 * One sentence, and only when it is earned.
 *
 * It names the band that replies best against the one that replies worst, and
 * it only speaks when both bands carry a rate and the gap is worth saying out
 * loud. Silence is the right answer more often than people think.
 */
export function insight(rows: LeadRow[], niches: Niche[]): string | null {
  if (repliedRows(rows).length < GROUP_MIN) return null

  const pick = (bands: Band[]) => {
    const rated = bands.filter((b) => b.rate !== null)
    if (rated.length < 2) return null
    const best = rated.reduce((a, b) => (b.rate! > a.rate! ? b : a))
    const worst = rated.reduce((a, b) => (b.rate! < a.rate! ? b : a))
    if (best.label === worst.label) return null
    if (worst.rate! <= 0) return { best, worst }
    return best.rate! / worst.rate! - 1 >= GAP_MIN ? { best, worst } : null
  }

  const size = pick(sizeBands(rows))
  const score = pick(scoreBands(rows))
  const niche = pick(nicheBands(rows, niches))

  const parts: string[] = []
  if (size) {
    parts.push(`${size.best.label} followers reply ${compared(size.best.rate!, size.worst.rate!, size.worst.label.toLowerCase())}`)
  }
  if (niche) {
    parts.push(`${niche.best.label.toLowerCase()} replies ${compared(niche.best.rate!, niche.worst.rate!, niche.worst.label.toLowerCase())}`)
  } else if (score) {
    parts.push(`people scoring ${score.best.label.replace('Scored ', '')} reply ${compared(score.best.rate!, score.worst.rate!, score.worst.label.replace('Scored ', '').toLowerCase())}`)
  }
  if (!parts.length) return null

  const sentence = parts.join(', and ')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.'
}

/** The whole comparative clause, so the sentence reads as English. */
function compared(best: number, worst: number, worstLabel: string): string {
  if (worst <= 0) return `far more often than ${worstLabel}`
  const ratio = best / worst
  if (ratio >= 2.6) return `three times as often as ${worstLabel}`
  if (ratio >= 1.7) return `twice as often as ${worstLabel}`
  return `${Math.round((ratio - 1) * 100)}% more often than ${worstLabel}`
}

// ---------------------------------------------------------------------------
// Block two: the funnel
// ---------------------------------------------------------------------------

export interface Step {
  status: LeadStatus
  count: number
  /** The share that got here from the step before, or null when too thin. */
  rate: number | null
  /** What the rate was computed on, so the figure can be checked. */
  base: number
  /** The same rate over the period before this one, when there was one. */
  was: number | null
}

export function funnelOf(rows: LeadRow[], before: LeadRow[] = []): Step[] {
  const rateAt = (list: LeadRow[], i: number): number | null => {
    if (i === 0) return null
    const reached = list.filter((r) => rank(r.lead.status) >= rank(WALK[i])).length
    const from = list.filter((r) => rank(r.lead.status) >= rank(WALK[i - 1])).length
    return from >= RATE_MIN ? reached / from : null
  }
  return WALK.map((status, i) => {
    const count = rows.filter((r) => rank(r.lead.status) >= rank(status)).length
    const from = i === 0 ? rows.length : rows.filter((r) => rank(r.lead.status) >= rank(WALK[i - 1])).length
    return {
      status,
      count,
      base: from,
      rate: rateAt(rows, i),
      was: before.length ? rateAt(before, i) : null,
    }
  })
}

export interface Week { start: string; delivered: number; replied: number; rate: number | null }

export function byWeek(rows: LeadRow[], weeks = 6): Week[] {
  const out: Week[] = []
  const now = new Date()
  for (let back = weeks - 1; back >= 0; back--) {
    const end = new Date(now.getTime() - back * 7 * 86_400_000)
    const start = new Date(end.getTime() - 7 * 86_400_000)
    const inside = rows.filter((r) => {
      const at = new Date(r.lead.deliveredAt).getTime()
      return at >= start.getTime() && at < end.getTime()
    })
    const replied = repliedRows(inside).length
    out.push({
      start: start.toISOString().slice(0, 10),
      delivered: inside.length,
      replied,
      rate: inside.length >= RATE_MIN ? replied / inside.length : null,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Block three: the return
// ---------------------------------------------------------------------------

export interface Economics {
  /** What this campaign's share of the plan costs, in cents. */
  costCents: number
  /** Written out so the client can check the split themselves. */
  basis: string
  replies: number
  deals: number
  wonCents: number
  costPerReplyCents: number | null
  costPerDealCents: number | null
  /** Money won over money spent. Null until there is a deal. */
  multiple: number | null
  /** True while the figures rest on fewer than three deals. */
  early: boolean
}

/**
 * The cost side comes from the client's own subscription and nothing else.
 * What a lead costs us to produce has no business being on this screen, or on
 * any other screen a client can reach.
 */
export function economics(
  rows: LeadRow[],
  subscription: Subscription,
  campaigns: Campaign[],
  campaignId: string | null,
): Economics {
  const share = campaigns.reduce((sum, c) => sum + (c.dailyCap ?? subscription.tier), 0)
  const mine = campaignId
    ? campaigns.find((c) => c.id === campaignId)?.dailyCap ?? subscription.tier
    : share
  const costCents = share > 0 ? Math.round(subscription.priceCents * (mine / share)) : subscription.priceCents

  const replies = repliedRows(rows).length
  const deals = rows.filter((r) => r.deal).length
  const wonCents = rows.reduce((sum, r) => sum + (r.deal?.amountCents ?? 0), 0)

  return {
    costCents,
    basis: campaignId
      ? `Your plan, split across campaigns by their daily limit. This one takes ${mine} of ${share}.`
      : 'Your whole plan, across every campaign.',
    replies,
    deals,
    wonCents,
    costPerReplyCents: replies > 0 ? Math.round(costCents / replies) : null,
    costPerDealCents: deals > 0 ? Math.round(costCents / deals) : null,
    multiple: deals > 0 && costCents > 0 ? wonCents / costCents : null,
    early: deals < 3,
  }
}

// ---------------------------------------------------------------------------
// What to do about it
// ---------------------------------------------------------------------------

export interface Advice {
  id: string
  /** What the numbers say, and what to change because of it. */
  text: string
  action?: string
  href?: string
}

/**
 * A dashboard that only reports leaves the work to the reader. These are the
 * few things the numbers say clearly enough to act on, and nothing is offered
 * unless the sample behind it clears the same bars as everything else here.
 */
export function advice(
  rows: LeadRow[],
  niches: Niche[],
  funnel: Step[],
  campaignId: string | null,
  followersFrom: number | null,
): Advice[] {
  const out: Advice[] = []
  const rated = (bands: Band[]) => bands.filter((b) => b.rate !== null)

  // The size band that answers best, against what the rules currently ask for.
  const sizes = rated(sizeBands(rows))
  if (sizes.length >= 2) {
    const best = sizes.reduce((a, b) => (b.rate! > a.rate! ? b : a))
    const worst = sizes.reduce((a, b) => (b.rate! < a.rate! ? b : a))
    if (best.rate! >= worst.rate! * (1 + GAP_MIN) && worst.label === 'Under 25k' && (followersFrom ?? 0) < 25_000) {
      out.push({
        id: 'raise-floor',
        text: `People under 25k followers reply least, and your rules still let them in. Starting at 25k would spend your daily leads on the sizes that answer.`,
        action: 'Raise my minimum',
        href: campaignId ? `#/campaign/${campaignId}/gates` : '#/campaigns',
      })
    }
  }

  // A niche that costs leads and returns nothing.
  const niched = rated(nicheBands(rows, niches))
  if (niched.length >= 3) {
    const best = niched.reduce((a, b) => (b.rate! > a.rate! ? b : a))
    const worst = niched.reduce((a, b) => (b.rate! < a.rate! ? b : a))
    if (worst.rate! > 0 && best.rate! >= worst.rate! * 2) {
      out.push({
        id: 'drop-niche',
        text: `${worst.label} takes ${worst.delivered} of your leads and replies half as often as ${best.label.toLowerCase()}. Switching it off would move those leads to the slices that answer.`,
        action: 'Edit my niches',
        href: campaignId ? `#/campaign/${campaignId}/gates` : '#/campaigns',
      })
    }
  }

  // People answer, then stop. That is a message problem, not a lead problem.
  const replied = funnel.find((s) => s.status === 'replied')
  const call = funnel.find((s) => s.status === 'call')
  if (replied?.rate !== null && replied?.rate !== undefined && call?.rate !== null && call?.rate !== undefined) {
    if (replied.rate >= 0.25 && call.rate < 0.2) {
      out.push({
        id: 'after-reply',
        text: `${Math.round(replied.rate * 100)}% of the people you contact reply, but only ${Math.round(call.rate * 100)}% of those book a call. The leads are working. What you send after the reply is where it stalls.`,
      })
    }
  }

  return out.slice(0, 2)
}

// ---------------------------------------------------------------------------
// The two reminders
// ---------------------------------------------------------------------------

export interface Nudge {
  id: 'stale' | 'amounts'
  text: string
  action: string
  href: string
}

/**
 * Said once, factually, with the way to fix it. Never a colour, never a
 * reproach: the client is not late, they are busy.
 */
export function nudges(rows: LeadRow[]): Nudge[] {
  const week = Date.now() - 7 * 86_400_000
  const out: Nudge[] = []

  const stale = rows.filter(
    (r) => r.lead.status === 'contacted' && new Date(r.lead.statusAt).getTime() < week,
  ).length
  if (stale >= 3) {
    out.push({
      id: 'stale',
      text: `${stale} leads were contacted over a week ago and have not moved.`,
      action: 'Update them',
      href: '#/leads?waiting=1',
    })
  }

  const missing = rows.filter((r) => r.lead.status === 'signed' && !r.deal).length
  if (missing > 0) {
    out.push({
      id: 'amounts',
      text: `${missing} signed ${missing === 1 ? 'deal has' : 'deals have'} no amount yet.`,
      action: 'Add them',
      href: '#/leads?status=signed',
    })
  }

  return out.slice(0, 2)
}
