import type { Campaign, Creator, GateSet, HardRules, Niche, Reach } from '../types'
import { built } from '../mock/creators'
import { evaluate, type GateResult, type Judgement } from './gates'
import { activeNiches } from './niches'
import { checkSeeds, usableSeeds } from './seeds'
import { answersFor, creatorAt, perDayOf, qualifiedSet, SAMPLE_SIZE } from './simulate'
import { DIALS, settle, type DialKey } from './tuning'
import { compact, COUNTRY_NAMES, daysSince, LANGUAGE_NAMES } from '../lib/format'

// How much room a campaign has left, and what to do when it runs out.
//
// The honest version of a hard question. A set of rules does not search an
// infinite world: Instagram publishes no list of everyone, so what we can reach
// is what four ways of searching can turn up, and each of them runs down.
//
// Three rules hold this file together.
//
//   One way running dry is not the end. We say so, calmly, and carry on with
//   the others. The gauge only reads empty when every one of them is spent.
//
//   Nothing is ever "exhausted". It is exhausted under the rules in force
//   today, which is a different sentence and the only true one.
//
//   Every way out is priced. A client asked to widen their rules is told what
//   it buys, in people and in days, and what it costs, in the numbers of the
//   people it lets in. Never "slightly lower quality". 18k views against 41k.
//
// And what comes through a door is marked for good, on every lead. A widening
// nobody can see is a reply rate quietly falling with no explanation on screen.

export type ChannelId = 'accounts' | 'search' | 'neighbour' | 'seed' | 'import'

/** In the order they matter. Measured on the first real runs, September 2026. */
const CHANNELS: ChannelId[] = ['accounts', 'search', 'neighbour', 'seed']

const CHANNEL_LABEL: Record<ChannelId, string> = {
  accounts: 'Searching Instagram for your niches',
  search: 'Posts under your niches\' hashtags',
  neighbour: 'People your best leads mention',
  seed: 'The handles you gave us',
  import: 'Your own list',
}

const CHANNEL_NOTE: Record<ChannelId, string> = {
  accounts: 'We ask Instagram for the accounts named for each of your niches.',
  search: 'The people posting under the tags your niches use. Mostly small.',
  neighbour: 'Every lead that fits points at the people they mention.',
  seed: 'One step out from the accounts you named yourself.',
  import: 'The people you brought with you.',
}

// The numbers this file rests on. They are measured, not chosen, and every
// real run replaces them with its own.

/**
 * Accounts one niche turns up through Instagram's own account search. One
 * wording of a niche returns 40 to 50 accounts, and a niche has about a dozen
 * wordings: the job title, its specialities, the words people put in a name.
 * Two in three of what comes back are above 10k followers.
 */
const ACCOUNTS_PER_NICHE = 600

/**
 * New accounts one hashtag turns up before it starts handing back people we
 * already have. Measured at around 260, and one in a hundred is above the
 * size a client asks for.
 */
const PER_QUERY = 260

/** People one good lead mentions in their last posts. Measured at 5. */
const BRANCH = 5

/** A way of searching is spent once under a tenth of its reach is left. */
const SPENT_UNDER = 0.1

/** How far each way of searching has already been taken, across the sample. */
const LOOKED: Record<ChannelId, number> = { accounts: 0, search: 0, neighbour: 0, seed: 0, import: 0 }
for (const b of built) {
  LOOKED[(b.creator.foundVia?.channel ?? 'accounts') as ChannelId]++
}

export interface Channel {
  id: ChannelId
  label: string
  note: string
  /** Profiles this way has already turned up. */
  looked: number
  /** What it can still turn up before it only repeats itself. */
  frontier: number
  capacity: number
  spent: boolean
}

export type RoomState = 'wide' | 'thin' | 'dry'

export interface Room {
  /** People who still fit these rules and have not been handed over. */
  left: number
  /** Days of delivery that buys, at this campaign's own pace. */
  days: number
  perDay: number
  /** How many have already been handed over. */
  found: number
  channels: Channel[]
  /** Every way of searching has stopped turning up new people. */
  allSpent: boolean
  state: RoomState
}

/**
 * What each way of searching can still reach.
 *
 * The two searches are bounded by the query space: one query per niche per
 * country, and each query has a floor past which it repeats itself.
 * Neighbours compound instead, because every lead that fits opens its own
 * branch, so that ceiling grows every time the rules let someone through.
 * Seeds are finite by definition: the client gave us a list and it has an end.
 */
function capacityOf(campaign: Campaign, gates: GateSet, qualified: number): Record<ChannelId, number> {
  const slices = Math.max(1, activeNiches(campaign.extracted.niches).length)
  const places = Math.max(1, gates.hard.countries?.length ?? 0)
  const handles = campaign.brief.seeds ?? []
  const usable = handles.length
    ? usableSeeds(checkSeeds(handles, gates, campaign.extracted.niches)).length
    : 0
  return {
    accounts: slices * places * ACCOUNTS_PER_NICHE,
    search: slices * places * PER_QUERY,
    neighbour: qualified * BRANCH,
    seed: usable * BRANCH,
    import: 0,
  }
}

function channelsOf(campaign: Campaign, gates: GateSet, qualified: number): Channel[] {
  const capacity = capacityOf(campaign, gates, qualified)
  return CHANNELS.filter((id) => capacity[id] > 0 || LOOKED[id] > 0).map((id) => {
    const cap = capacity[id]
    const frontier = Math.max(0, cap - LOOKED[id])
    return {
      id,
      label: CHANNEL_LABEL[id],
      note: CHANNEL_NOTE[id],
      looked: LOOKED[id],
      capacity: cap,
      frontier,
      spent: cap <= 0 || frontier < cap * SPENT_UNDER,
    }
  })
}

/**
 * How much room one set of rules has left.
 *
 * Two parts, and both are needed. People who already fit and have not been
 * handed over yet, plus what the ways of searching can still turn up, taken at
 * the rate these rules let people through. A gauge built on the first part
 * alone would read empty the day we caught up with ourselves.
 */
export function room(
  campaign: Campaign,
  gates: GateSet,
  niches: Niche[],
  delivered: number,
  perDay: number,
  answers?: Judgement[],
): Room {
  const qualified = qualifiedSet(gates, niches, answers).size
  const rate = qualified / SAMPLE_SIZE
  const channels = channelsOf(campaign, gates, qualified)
  const ahead = channels.reduce((sum, c) => sum + c.frontier, 0)
  const held = Math.max(0, qualified - delivered)
  const left = Math.round(held + ahead * rate)
  const days = perDay > 0 ? Math.floor(left / perDay) : 0
  const allSpent = channels.every((c) => c.spent)
  return {
    left,
    days,
    perDay,
    found: delivered,
    channels,
    allSpent,
    state: allSpent || days < 10 ? 'dry' : days < 28 ? 'thin' : 'wide',
  }
}

// ---------------------------------------------------------------------------
// The ways out
// ---------------------------------------------------------------------------

export interface Door {
  id: string
  /** The rule being opened, named as the client knows it. */
  title: string
  /** What the move is. "Lower it from 12k to 7.5k" */
  move: string
  /** Extra people it reaches. Measured by running the whole sample again. */
  people: number
  /** Extra days of delivery that buys. */
  days: number
  /** Extra leads a day, at the account's pace. */
  perDay: number
  /** What it costs, in the numbers of the people it lets in. */
  cost: string
  /** The rules it writes. */
  next: { hard: HardRules; niches: Niche[] }
  /** The line the campaign keeps, so a lead can be explained a month later. */
  label: string
}

/** One notch out, per dial. Enough to move the flow, small enough to undo. */
const NOTCH: Record<DialKey, (v: number) => number> = {
  followersMin: (v) => Math.round(v * 0.6),
  followersMax: (v) => Math.round(v * 1.6),
  lastPostWithinDays: (v) => Math.round(v * 2),
  medianViewsMin: (v) => Math.round(v * 0.6),
  postsPerMonthMin: (v) => Math.round(v * 0.6),
  medianCommentsMin: () => 0,
}

/** How a dial's own number reads on one profile. */
const METRIC: Record<DialKey, { of: (c: Creator) => number; say: (n: number) => string }> = {
  followersMin: { of: (c) => c.followers, say: (n) => `${compact(n)} followers` },
  followersMax: { of: (c) => c.followers, say: (n) => `${compact(n)} followers` },
  medianViewsMin: { of: (c) => c.medianViews ?? 0, say: (n) => `${compact(n)} views on a typical post` },
  medianCommentsMin: { of: (c) => c.medianComments ?? 0, say: (n) => `${n} comments on a typical post` },
  postsPerMonthMin: { of: (c) => c.postsPerMonth ?? 0, say: (n) => `${n} posts a month` },
  lastPostWithinDays: {
    of: (c) => (c.lastPostAt ? daysSince(c.lastPostAt) : 90),
    say: (n) => `last posted ${n} days ago`,
  },
}

const median = (values: number[]): number => {
  const sorted = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export interface Survey {
  room: Room
  doors: Door[]
}

/**
 * The room left and the ways out, measured together.
 *
 * One entry point, because the doors are priced against the room and running
 * both separately would judge the whole sample twice for the same answer.
 */
export function survey(campaign: Campaign, gates: GateSet, delivered: number, perDay: number, tier = 15): Survey {
  const niches = campaign.extracted.niches
  const answers = answersFor(gates, niches)
  const base = room(campaign, gates, niches, delivered, perDay, answers)
  return { room: base, doors: doors(campaign, gates, delivered, perDay, base, answers, tier) }
}

/**
 * The ways out, each one priced.
 *
 * Every candidate is measured the only honest way: run the whole sample again
 * with that one change and see who else comes through. What they buy is said
 * in people and in days. What they cost is said in the numbers of the people
 * they let in, which is the part a client cannot work out alone.
 *
 * The deal breakers are never a candidate. Telling a client to stop asking
 * whether someone can pay, so that a quota is met, is selling them a worse
 * list at the same price.
 */
export function doors(
  campaign: Campaign,
  gates: GateSet,
  delivered: number,
  perDay: number,
  base?: Room,
  answers?: Judgement[],
  tier = 15,
): Door[] {
  const niches = campaign.extracted.niches
  const said = answers ?? answersFor(gates, niches)
  const from = base ?? room(campaign, gates, niches, delivered, perDay, said)
  const baseSet = qualifiedSet(gates, niches, said)
  const todayTypical = (key: DialKey) => median([...baseSet].map((i) => METRIC[key].of(creatorAt(i))))

  const out: Door[] = []

  const price = (
    id: string,
    title: string,
    move: string,
    label: string,
    next: { hard: HardRules; niches: Niche[] },
    cost: (extra: number[]) => string,
    ownAnswers?: Judgement[],
  ) => {
    const nextGates = { ...gates, hard: next.hard }
    const set = qualifiedSet(nextGates, next.niches, ownAnswers ?? said)
    const extra = [...set].filter((i) => !baseSet.has(i))
    if (!extra.length) return
    const after = room(campaign, nextGates, next.niches, delivered, perDay, ownAnswers ?? said)
    const people = after.left - from.left
    const days = after.days - from.days
    if (people <= 0) return
    const more = perDayOf(set.size, tier) - perDayOf(baseSet.size, tier)
    out.push({ id, title, move, label, people, days, perDay: more, cost: cost(extra), next })
  }

  // One number at a time, so the client can see exactly what each one is worth.
  for (const dial of DIALS) {
    const value = gates.hard[dial.key]
    if (typeof value !== 'number') continue
    const hard = settle({ ...gates.hard, [dial.key]: NOTCH[dial.key](value) })
    const after = hard[dial.key]
    if (after === value || typeof after !== 'number') continue
    const looser = after < value
    price(
      dial.key,
      dial.label,
      `${looser ? 'Lower' : 'Raise'} it from ${dial.format(value)} to ${dial.format(after)}`,
      `${dial.label.replace(/,.*$/, '')} ${looser ? 'lowered' : 'raised'} from ${dial.format(value)} to ${dial.format(after)}`,
      { hard, niches },
      (extra) => {
        const theirs = median(extra.map((i) => METRIC[dial.key].of(creatorAt(i))))
        const mine = todayTypical(dial.key)
        return `The extra people have ${METRIC[dial.key].say(theirs)}. The ones you get today have ${METRIC[dial.key].say(mine)}.`
      },
    )
  }

  // Where they are. The same rules, applied somewhere else.
  const places = gates.hard.countries ?? []
  if (places.length) {
    const more = [...new Set(built.map((b) => b.creator.country).filter((c): c is string => Boolean(c)))]
      .filter((c) => !places.includes(c))
    if (more.length) {
      const names = more.map((c) => COUNTRY_NAMES[c] ?? c)
      price(
        'countries',
        'Where they are',
        `Search ${listed(names)} as well`,
        `${listed(names)} added to where you search`,
        { hard: { ...gates.hard, countries: [...places, ...more] }, niches },
        (extra) =>
          `${sameSize(extra, baseSet)} What changes is where they are, and whether your pricing travels.`,
      )
    }
  }

  // The language they post in.
  const tongues = gates.hard.languages ?? []
  if (tongues.length) {
    const more = [...new Set(built.map((b) => b.creator.language).filter((l): l is string => Boolean(l)))]
      .filter((l) => !tongues.includes(l))
    if (more.length) {
      const names = more.map((l) => LANGUAGE_NAMES[l] ?? l)
      price(
        'languages',
        'The language they post in',
        `Accept ${listed(names)} too`,
        `${listed(names)} added to the languages you accept`,
        { hard: { ...gates.hard, languages: [...tongues, ...more] }, niches },
        (extra) =>
          `${sameSize(extra, baseSet)} You would be writing to them in ${listed(names)}, and reading their replies in it.`,
      )
    }
  }

  // A slice switched off, put back. The model reads the brief again, so this
  // one carries its own answers.
  const off = campaign.extracted.niches.filter((n) => !n.enabled)
  for (const slice of off.slice(0, 2)) {
    const next = campaign.extracted.niches.map((n) => (n.id === slice.id ? { ...n, enabled: true } : n))
    price(
      `niche_${slice.id}`,
      'A niche you switched off',
      `Look in ${slice.label.toLowerCase()} again`,
      `${slice.label} switched back on`,
      { hard: gates.hard, niches: next },
      (extra) => `${sameSize(extra, baseSet)} A different audience, and whether they want what you sell is the open question.`,
      answersFor(gates, next),
    )
  }

  return out
    // Under a week of extra room is rarely worth what a widening costs. A
    // campaign already out of room is the exception: there, three days is the
    // difference between a flow and a stop.
    .filter((d) => d.days >= (from.state === 'dry' ? 3 : 7))
    .sort((a, b) => b.days - a.days)
    .slice(0, 3)
}

/**
 * A door that moves no number still has to be priced, so it is priced on the
 * people it lets in: how big they are next to the ones arriving today.
 */
function sameSize(extra: number[], baseSet: Set<number>): string {
  const theirs = median(extra.map((i) => creatorAt(i).followers))
  const mine = median([...baseSet].map((i) => creatorAt(i).followers))
  const gap = mine > 0 ? Math.abs(theirs - mine) / mine : 1
  if (gap < 0.25) return `Accounts of about the same size, ${compact(theirs)} followers against ${compact(mine)} today.`
  return `${compact(theirs)} followers on a typical account, against ${compact(mine)} today.`
}

function listed(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// ---------------------------------------------------------------------------
// Where one lead stands
// ---------------------------------------------------------------------------

export interface Standing {
  reach: Reach
  /** When wider: the one line they miss. "7.9k views a post, you asked 12k" */
  beyond?: string
}

/** The rules a campaign agreed to before it opened anything. */
export interface FirstRules {
  gates: GateSet
  niches: Niche[]
}

/**
 * Is this person inside the rules the client first agreed to, or past them.
 *
 * Measured against those rules rather than against the door that let them in,
 * because a client who opens three doors over a quarter still has one question:
 * is this one of the people I asked for at the start.
 */
export function standing(
  creator: Creator,
  judgement: Judgement,
  from: FirstRules | null,
  now = Date.now(),
): Standing {
  if (!from) return { reach: 'core' }
  const result = evaluate(creator, from.gates, from.niches, judgement, now)
  if (result.verdict === 'qualified') return { reach: 'core' }
  return { reach: 'wider', beyond: missed(result, from.gates, creator, now) }
}

/** What they miss, in the client's own words and their own numbers. */
function missed(result: GateResult, gates: GateSet, creator: Creator, now: number): string {
  const key = result.blockedBy
  if (key === 'score') return `Scored ${result.score}, your first rules asked ${gates.passScore}`
  if (key === 'niche') return 'Works in a niche you switched on later'
  if (key === 'countries') return `Posts from ${COUNTRY_NAMES[creator.country ?? ''] ?? 'somewhere else'}, outside your first list`
  if (key === 'languages') return `Posts in ${LANGUAGE_NAMES[creator.language ?? ''] ?? 'another language'}, outside your first list`
  const dial = DIALS.find((d) => d.key === key)
  if (!dial) return 'Outside the rules you started with'
  const limit = gates.hard[dial.key]
  const value = key === 'lastPostWithinDays'
    ? (creator.lastPostAt ? daysSince(creator.lastPostAt, new Date(now)) : 90)
    : METRIC[dial.key].of(creator)
  return `${METRIC[dial.key].say(value)}, your first rules asked ${dial.format(limit as number)}`
}

// ---------------------------------------------------------------------------
// Did this edit open anything
// ---------------------------------------------------------------------------

/** Which way each number has to move for more people to come through. */
const LOOSER: Record<DialKey, 'down' | 'up'> = {
  followersMin: 'down',
  followersMax: 'up',
  lastPostWithinDays: 'up',
  medianViewsMin: 'down',
  medianCommentsMin: 'down',
  postsPerMonthMin: 'down',
}

/**
 * True when the second set of rules lets in someone the first would turn away.
 *
 * Read structurally rather than by running the sample, because this runs on
 * every save. It errs towards saying yes, and saying yes only means the leads
 * that follow carry a mark, which costs a client nothing and tells them the
 * truth.
 */
export function loosens(
  before: { hard: HardRules; passScore: number; niches: Niche[] },
  after: { hard: HardRules; passScore: number; niches: Niche[] },
): boolean {
  if (after.passScore < before.passScore) return true
  for (const key of Object.keys(LOOSER) as DialKey[]) {
    const a = before.hard[key]
    const b = after.hard[key]
    if (typeof a !== 'number') continue
    if (typeof b !== 'number') return true
    if (LOOSER[key] === 'down' ? b < a : b > a) return true
  }
  for (const key of ['countries', 'languages'] as const) {
    const a = before.hard[key]
    const b = after.hard[key]
    if (!a?.length) continue
    if (!b?.length) return true
    if (b.some((v) => !a.includes(v))) return true
  }
  const on = new Set(activeNiches(before.niches).map((n) => n.id))
  if (activeNiches(after.niches).some((n) => !on.has(n.id))) return true
  return false
}
