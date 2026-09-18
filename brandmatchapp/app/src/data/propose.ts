import type { CampaignBrief, Criterion, HardRules, Knockout, TemplateId } from '../types'
import { compact } from '../lib/format'
import { template, TEMPLATES } from './templates'

// The brief becomes a proposal.
//
// This runs in the browser today and returns exactly what the API will return
// tomorrow. The real path is already written and waiting:
//
//   api.createCampaign({ audience, offer })  then  api.draftGates(id, audience, offer)
//
// Swapping is a change to NewCampaign's one call to propose(). The shapes below
// are the contract between the two, and convex/templates.ts holds the same
// three libraries so the server cannot answer with anything this file could not
// have produced.
//
// What is generated and what is not:
//
//   Gate 1  generated. Only numbers, so the risk is low and the brief has to
//           move them or the thresholds would be the same for everyone.
//   Gate 2  the library's questions, reworded. At most one added.
//   Gate 3  the library, never invented. The model picks the closest one and
//           tunes the wording and the bar.

export interface Proposal {
  name: string
  templateId: TemplateId
  hard: HardRules
  knockouts: Knockout[]
  criteria: Criterion[]
  passScore: number
  countries: string[]
  languages: string[]
  /** One plain sentence per gate, for the card headers. */
  summaries: { gate1: string; gate2: string; gate3: string }
}

/** A question worth asking. Never more than two, and always skippable. */
export interface Clarification {
  id: 'role' | 'size'
  question: string
  options: { label: string; value: string }[]
}

export type Answers = Partial<Record<Clarification['id'], string>>

// ---------------------------------------------------------------------------
// Reading the brief
// ---------------------------------------------------------------------------

const ROLE_WORDS: { id: TemplateId; test: RegExp }[] = [
  { id: 'sponsorship', test: /\bsponsor|sponsorship|paid post|paid partnership|promote (our|my)|ugc|influencer marketing|ambassador|shout ?out\b/ },
  { id: 'recruit_partners', test: /\brevenue.?share|rev.?share|partner with|build with|co.?brand|joint venture|white ?label with|recruit|equity|launch (a|their) (product|app|course) with\b/ },
  { id: 'sell_to_creators', test: /\bwe sell|we build|saas|software|our tool|our app|our platform|agency|our service|subscription|we offer|sell (a|our)\b/ },
]

const COUNTRY_WORDS: Record<string, string> = {
  us: 'US', usa: 'US', 'united states': 'US', american: 'US',
  uk: 'UK', 'united kingdom': 'UK', british: 'UK',
  canada: 'CA', canadian: 'CA',
  australia: 'AU', australian: 'AU',
  ireland: 'IE', france: 'FR', french: 'FR',
  germany: 'DE', german: 'DE', spain: 'ES', spanish: 'ES',
}

const LANGUAGE_WORDS: Record<string, string> = {
  english: 'en', french: 'fr', german: 'de', spanish: 'es', italian: 'it', portuguese: 'pt',
}

const STOP = new Set([
  'a', 'an', 'the', 'we', 'i', 'our', 'my', 'who', 'that', 'with', 'for', 'to', 'and', 'or', 'of',
  'in', 'on', 'at', 'is', 'are', 'sell', 'sells', 'selling', 'build', 'building', 'want', 'wants',
  'looking', 'between', 'from', 'their', 'them', 'they', 'make', 'making', 'help', 'helps',
  'handle', 'handles', 'run', 'runs', 'give', 'gives', 'offer', 'offers', 'provide', 'provides',
  'turn', 'turns', 'let', 'lets', 'does', 'have', 'has', 'get', 'gets', 'use', 'uses', 'over',
  // Words that describe the metric rather than the person or the product.
  'followers', 'subscribers', 'audience', 'audiences', 'accounts', 'profiles', 'pages', 'people',
])

/** Acronyms a title case pass would otherwise flatten. */
const ACRONYMS: Record<string, string> = {
  saas: 'SaaS', ugc: 'UGC', crm: 'CRM', seo: 'SEO', app: 'app', diy: 'DIY', b2b: 'B2B', b2c: 'B2C',
  us: 'US', uk: 'UK', eu: 'EU', ai: 'AI',
}

/** "50k and 500k", "50,000-500,000", "over 100k", "under 50k", "100k+". */
function followerRange(text: string): { min?: number; max?: number } {
  const n = (raw: string): number => {
    const clean = raw.replace(/[, ]/g, '').toLowerCase()
    if (clean.endsWith('m')) return Math.round(parseFloat(clean) * 1_000_000)
    if (clean.endsWith('k')) return Math.round(parseFloat(clean) * 1_000)
    return Math.round(Number(clean))
  }
  const num = '(\\d[\\d,. ]*[km]?)'
  const span = new RegExp(`${num}\\s*(?:to|and|[-–])\\s*${num}`, 'i').exec(text)
  if (span) {
    const a = n(span[1])
    const b = n(span[2])
    if (a > 0 && b > a) return { min: a, max: b }
  }
  const over = new RegExp(`(?:over|above|more than|at least|\\bmin\\b)\\s*${num}`, 'i').exec(text)
  if (over) return { min: n(over[1]) }
  const under = new RegExp(`(?:under|below|less than|up to|\\bmax\\b)\\s*${num}`, 'i').exec(text)
  if (under) return { max: n(under[1]) }
  const plus = new RegExp(`${num}\\s*\\+`, 'i').exec(text)
  if (plus) return { min: n(plus[1]) }
  return {}
}

function pickTemplate(brief: CampaignBrief, answers: Answers): { id: TemplateId; sure: boolean } {
  if (answers.role) return { id: answers.role as TemplateId, sure: true }
  const text = `${brief.offer} ${brief.audience}`.toLowerCase()
  for (const role of ROLE_WORDS) {
    if (role.test.test(text)) return { id: role.id, sure: true }
  }
  // Nothing said which side of the table the creator sits on. Selling is the
  // commonest, so it is the fallback, and the card says where it came from.
  return { id: 'sell_to_creators', sure: false }
}

function listFrom(text: string, words: Record<string, string>): string[] {
  const lower = ` ${text.toLowerCase()} `
  const out = new Set<string>()
  for (const [word, code] of Object.entries(words)) {
    if (new RegExp(`[^a-z]${word}[^a-z]`).test(lower)) out.add(code)
  }
  return [...out]
}

/** The content words of a sentence, in order, with the filler dropped. */
function content(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d/.test(w) && !/^\d+[km]$/.test(w))
}

function say(words: string[]): string {
  return words.map((w) => ACRONYMS[w] ?? w).join(' ')
}

/**
 * "Skincare creators, brand deals". The audience gives the opening words, the
 * offer gives its last ones, which is where the thing being sold usually sits.
 */
function nameFrom(brief: CampaignBrief): string {
  const who = content(brief.audience).slice(0, 3)
  const offerWords = content(brief.offer)
  const what = offerWords.slice(-2)
  if (!who.length) return 'New campaign'
  const left = say(who)
  const opened = left[0].toUpperCase() + left.slice(1)
  return what.length ? `${opened}, ${say(what)}` : opened
}

// ---------------------------------------------------------------------------
// The two questions worth asking
// ---------------------------------------------------------------------------

/**
 * At most two, and only when the answer changes the proposal. Anything else is
 * an interrogation, and the client is here to correct a proposal, not fill a
 * form.
 */
export function clarifications(brief: CampaignBrief): Clarification[] {
  const out: Clarification[] = []

  // Which side of the table the creator sits on decides the whole library.
  if (!pickTemplate(brief, {}).sure) {
    out.push({
      id: 'role',
      question: 'Quick one. What do you want from these creators?',
      options: [
        { label: 'Sell them something', value: 'sell_to_creators' },
        { label: 'Build something with them', value: 'recruit_partners' },
        { label: 'Pay them to promote us', value: 'sponsorship' },
      ],
    })
  }

  // No size, no country, and barely a noun. Nothing to hang a threshold on.
  const anchored =
    Object.keys(followerRange(brief.audience)).length > 0 ||
    listFrom(brief.audience, COUNTRY_WORDS).length > 0 ||
    content(brief.audience).length > 1
  if (!anchored) {
    out.push({
      id: 'size',
      question: 'Any size range in mind?',
      options: [
        { label: '10k to 100k', value: '10000-100000' },
        { label: '50k to 500k', value: '50000-500000' },
        { label: '200k and up', value: '200000-2000000' },
        { label: 'No preference', value: '' },
      ],
    })
  }

  return out.slice(0, 2)
}

// ---------------------------------------------------------------------------
// The proposal
// ---------------------------------------------------------------------------

export function propose(brief: CampaignBrief, answers: Answers = {}): Proposal {
  const chosen = pickTemplate(brief, answers)
  const lib = template(chosen.id)
  const d = lib.defaults

  let { min, max } = followerRange(brief.audience)
  if (!min && !max && answers.size) {
    const [a, b] = answers.size.split('-').map(Number)
    min = a
    max = b
  }
  const followersMin = min ?? d.followersMin
  const followersMax = max ?? Math.max(d.followersMax, followersMin * 8)

  // Reach is read off real posts, so the floor hangs off the follower floor and
  // not off anything the profile declares.
  const medianViewsMin = round(followersMin * d.viewsShare)
  const medianCommentsMin = Math.max(10, round(medianViewsMin * 0.002))

  const countries = listFrom(`${brief.audience} ${brief.offer}`, COUNTRY_WORDS)
  const languages = listFrom(`${brief.audience} ${brief.offer}`, LANGUAGE_WORDS)
  if (!languages.length && countries.every((c) => ['US', 'UK', 'CA', 'AU', 'IE'].includes(c))) {
    languages.push('en')
  }

  const hard: HardRules = {
    followersMin,
    followersMax,
    lastPostWithinDays: d.lastPostWithinDays,
    medianViewsMin,
    medianCommentsMin,
    postsPerMonthMin: d.postsPerMonthMin,
    ...(countries.length ? { countries } : {}),
    ...(languages.length ? { languages } : {}),
  }

  return {
    name: nameFrom(brief),
    templateId: lib.id,
    hard,
    knockouts: lib.knockouts,
    criteria: lib.criteria,
    passScore: lib.passScore,
    countries,
    languages,
    summaries: {
      gate1: `We keep people with ${compact(followersMin)} to ${compact(followersMax)} followers, who posted in the last ${d.lastPostWithinDays} days and get about ${compact(medianViewsMin)} views on a typical post.`,
      gate2: `${count(lib.knockouts.length)} yes or no questions about each person. One no and we drop them.`,
      gate3: `Seven things we rate out of 2. Someone needs ${lib.passScore} out of ${lib.criteria.length * 2} to reach you.`,
    },
  }
}

/** Rebuilds a proposal on another library, keeping the numbers already set. */
export function switchTemplate(proposal: Proposal, id: TemplateId): Proposal {
  const lib = template(id)
  return {
    ...proposal,
    templateId: id,
    knockouts: lib.knockouts,
    criteria: lib.criteria,
    passScore: lib.passScore,
    summaries: {
      ...proposal.summaries,
      gate2: `${count(lib.knockouts.length)} yes or no questions about each person. One no and we drop them.`,
      gate3: `Seven things we rate out of 2. Someone needs ${lib.passScore} out of ${lib.criteria.length * 2} to reach you.`,
    },
  }
}

export const LIBRARIES = TEMPLATES

function round(n: number): number {
  if (n >= 10_000) return Math.round(n / 1_000) * 1_000
  if (n >= 1_000) return Math.round(n / 100) * 100
  return Math.max(1, Math.round(n / 10) * 10)
}

function count(n: number): string {
  return ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][n] ?? String(n)
}
