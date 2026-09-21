// The Gate 3 libraries, server side. Same three as the browser copy in
// app/src/data/templates.ts, and they have to stay in step: the proposal a
// client accepts on screen is the one this file has to reproduce.
//
// Gate 3 is never written from nothing. The model picks the closest library and
// rewords it. Gate 2 comes from here too. Gate 1 is the only part generated
// freely, because it is only numbers.

export type TemplateId = 'recruit_partners' | 'sell_to_creators' | 'sponsorship'

export interface GateTemplate {
  id: TemplateId
  name: string
  when: string
  knockouts: { id: string; question: string; why?: string; pass?: string; fail?: string; enabled?: boolean }[]
  criteria: { id: string; text: string }[]
  passScore: number
  defaults: {
    followersMin: number
    followersMax: number
    lastPostWithinDays: number
    postsPerMonthMin: number
    viewsShare: number
  }
}

export const TEMPLATES: GateTemplate[] = [
  {
    id: 'recruit_partners',
    name: 'Recruiting creator partners',
    when: 'They build something with you. Revenue share, a co-branded product, a partnership.',
    knockouts: [
      { id: 'k_method', question: 'Do they teach a repeatable method rather than only show results?', why: 'A method can become a product. A highlight reel cannot.' , pass: 'Teaches a how to, or breaks down how a result was reached.', fail: 'Pure entertainment, vlogs, outfit posts, reaction content.' },
      { id: 'k_product', question: 'Could the value they deliver live inside a product?' , pass: 'A plan, a check in, a library, a community. Things software holds.', fail: 'Hands on work in a room. Software cannot carry it.' },
      { id: 'k_not_built', question: 'Have they not already built the thing you would build with them?', why: 'If they shipped it, there is nothing left to propose.' , pass: 'Sells through a PDF, a spreadsheet, a third party tool.', fail: 'Already ships their own app, platform or branded product.' },
      { id: 'k_person', question: 'Is this a real person rather than a theme page?', why: 'A theme page has no method and nobody to sign.' , pass: 'A named human, face or voice on the account, speaks as themselves.', fail: 'Aggregator, quote page, repost account, no named owner.' },
    ],
    criteria: [
      { id: 'c_sells', text: 'They sell a paid programme, coaching or course today, at a price shown in public.' },
      { id: 'c_stakes', text: 'Their topic carries real stakes: money, body or career.' },
      { id: 'c_method', text: 'They teach a method with a name, and they repeat it.' },
      { id: 'c_demand', text: 'People in the comments ask how to buy or where to start.' },
      { id: 'c_proof', text: 'Their posts show measurable client progress, with dates.' },
      { id: 'c_stable', text: 'The account is over two years old and its reach is stable or growing.' },
      { id: 'c_person', text: 'The audience follows the person: face on camera, first person, replies in the comments.' },
    ],
    passScore: 9,
    defaults: { followersMin: 15_000, followersMax: 400_000, lastPostWithinDays: 14, postsPerMonthMin: 8, viewsShare: 0.5 },
  },
  {
    id: 'sell_to_creators',
    name: 'Selling to creators',
    when: 'The creator is the buyer. Software, a service, an app build, a platform.',
    knockouts: [
      { id: 'k_paid_offer', question: 'Do they have a paid offer live today?', why: 'No revenue, no budget.' , pass: 'A programme, a course, a membership or a service with a price.', fail: 'Everything is free, or the only link is an affiliate page.' },
      { id: 'k_decides', question: 'Are they the one who decides?', why: 'An agency or a manager in the way doubles the sales cycle.' , pass: 'Answers from their own account, no management in the bio.', fail: 'An agency, a label or a manager fronts the inbox.' },
      { id: 'k_no_rival', question: 'Are they free of a direct competitor to your offer?' , pass: 'Nothing in the stack overlaps with what you sell.', fail: 'Already pays for something that does your job.' },
      { id: 'k_person', question: 'Is this a real person rather than a theme page?' , pass: 'A named human, face or voice on the account, speaks as themselves.', fail: 'Aggregator, quote page, repost account, no named owner.' },
    ],
    criteria: [
      { id: 'c_revenue', text: 'They sell something today: a paid offer at a public price.' },
      { id: 'c_pain', text: 'The problem you solve is visible: they show it, complain about it or work around it in public.' },
      { id: 'c_solo', text: 'They run the business themselves, with no agency or manager in between.' },
      { id: 'c_replies', text: 'They answer comments and questions.' },
      { id: 'c_tools', text: 'They already pay for tools, and link to them from the bio.' },
      { id: 'c_fit', text: 'Their audience is big enough to afford you and small enough to still need you.' },
      { id: 'c_growing', text: 'Their reach and posting rhythm went up over the last year.' },
    ],
    passScore: 9,
    defaults: { followersMin: 15_000, followersMax: 400_000, lastPostWithinDays: 14, postsPerMonthMin: 8, viewsShare: 0.5 },
  },
  {
    id: 'sponsorship',
    name: 'Sponsoring creators',
    when: 'You pay them to put your product in front of their audience.',
    knockouts: [
      { id: 'k_ran_paid', question: 'Have they run a paid partnership before?', why: 'A first timer costs you the learning.' , pass: 'Tagged partnerships, a rate card, or a media kit in the bio.', fail: 'Nothing sponsored anywhere on the account.' },
      { id: 'k_market', question: 'Is their audience in your market, not only your topic?' , pass: 'Comments and tags sit in the countries you sell to.', fail: 'Right subject, wrong continent or wrong spending power.' },
      { id: 'k_safe', question: 'Is there nothing on the account you cannot stand next to?' , pass: 'Tone and topics a brand can sit beside without a meeting.', fail: 'Recurring content that would need signing off by legal.' },
      { id: 'k_person', question: 'Is this a real person rather than a theme page?' , pass: 'A named human, face or voice on the account, speaks as themselves.', fail: 'Aggregator, quote page, repost account, no named owner.' },
    ],
    criteria: [
      { id: 'c_paid_posts', text: 'They already run paid partnerships: tagged posts, a rate card or a media kit.' },
      { id: 'c_buyer', text: 'Their audience is your buyer: right country and right spending power, not only the right topic.' },
      { id: 'c_steady', text: 'Their reach is steady across the last twelve posts, with no single spike.' },
      { id: 'c_trust', text: 'The comments show trust: questions and thanks, not only applause.' },
      { id: 'c_sells_well', text: 'Their past promotions kept the engagement up.' },
      { id: 'c_safe', text: 'Their tone and topics are ones you can stand next to.' },
      { id: 'c_budget', text: 'Their size and category suggest a rate inside your budget.' },
    ],
    passScore: 9,
    defaults: { followersMin: 20_000, followersMax: 1_000_000, lastPostWithinDays: 10, postsPerMonthMin: 12, viewsShare: 0.6 },
  },
]

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id)

export function template(id: string): GateTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[1]
}

/**
 * Keeps the model inside the library.
 *
 * It may reword a criterion and move the bar. It may not add one, drop one or
 * rename an id. Anything that does not line up falls back to the library as
 * written, which is the whole point of having libraries.
 */
export function withinTemplate(
  lib: GateTemplate,
  draft: { knockouts?: any[]; criteria?: any[]; passScore?: number },
): { knockouts: GateTemplate['knockouts']; criteria: GateTemplate['criteria']; passScore: number } {
  const ids = (rows: any[] | undefined) => (Array.isArray(rows) ? rows.map((r) => String(r?.id ?? '')) : [])
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])

  // The sentences are free. The model rewrites the library's for this offer
  // and may write its own; the only rule is one to twelve of them, each a
  // sentence. When nothing usable comes back, the library stands in.
  const criteria = cleanSentences(draft.criteria) ?? lib.criteria

  // The model may add one knockout, never drop the library's own.
  const asked = ids(draft.knockouts)
  const keepsAll = lib.knockouts.every((k) => asked.includes(k.id))
  const knockouts = keepsAll && asked.length <= lib.knockouts.length + 1
    ? draft.knockouts!.map((k) => {
        // The pass and fail lines are the library's, not the model's. It is
        // never asked for them, so a reworded question keeps its definition.
        const original = lib.knockouts.find((x) => x.id === String(k.id))
        return {
          id: String(k.id),
          question: String(k.question ?? original?.question ?? ''),
          why: k.why ? String(k.why) : original?.why,
          pass: original?.pass,
          fail: original?.fail,
          enabled: true,
        }
      }).filter((k) => k.question)
    : lib.knockouts.map((k) => ({ ...k, enabled: true }))

  const bar = Number(draft.passScore)
  const passScore = Number.isFinite(bar) && bar >= 0 && bar <= criteria.length * 2 ? Math.round(bar) : lib.passScore

  return { knockouts, criteria, passScore }
}

// ---------------------------------------------------------------------------
// Bounded personalisation, enforced here
// ---------------------------------------------------------------------------

/**
 * The knockouts a client cannot switch off.
 *
 * One universal and one per library. A knockout is locked when turning it off
 * would deliver something that is not a lead, or would create a real liability.
 * Never because we like the question.
 *
 * The browser greys the switch. This file is what makes it true: a request that
 * turns one off is corrected on the way in, so the API cannot be used to get
 * around the screen.
 */
export const LOCKED: Record<string, string[]> = {
  recruit_partners: ['k_person', 'k_not_built'],
  sell_to_creators: ['k_person', 'k_paid_offer'],
  sponsorship: ['k_person', 'k_safe'],
}

export function isLocked(templateId: string, knockoutId: string): boolean {
  return LOCKED[templateId]?.includes(knockoutId) ?? false
}

export interface HardRules {
  followersMin?: number
  followersMax?: number
  lastPostWithinDays?: number
  medianViewsMin?: number
  medianCommentsMin?: number
  postsPerMonthMin?: number
  /** Views on a typical post as a percentage of the follower count. */
  viewRatioMin?: number
  /** Views across a month: what a typical post gets, times how many. */
  monthlyViewsMin?: number
  countries?: string[]
  languages?: string[]
}

/** A choice, where every rule above is a demand. One option holding is enough. */
export interface EitherGroup {
  label?: string
  options: HardRules[]
}

/**
 * Pulls every dial inside its limits. Two kinds of limit do the work: a dial's
 * own floor and ceiling, and a dial bounded by another. Median views of 500,000
 * is not absurd on its own. It is absurd next to a follower floor of 15,000.
 *
 * The same numbers live in app/src/data/tuning.ts. They have to stay in step:
 * the screen promises a limit and this is where the promise is kept.
 */
export function settle(hard: HardRules, either?: EitherGroup[]): HardRules {
  const out: HardRules = { ...hard }
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))

  // A number a group decides is not filled in here as a demand as well. Filled
  // in both places the demand always fires first, and the choice the client was
  // shown never gets to matter.
  const decided = new Set<string>()
  for (const g of either ?? []) for (const o of g.options ?? []) for (const k of Object.keys(o ?? {})) decided.add(k)

  out.followersMin = clamp(out.followersMin ?? 15_000, 5_000, 500_000)
  out.followersMax = clamp(out.followersMax ?? 400_000, Math.max(25_000, out.followersMin * 3), 5_000_000)
  const floor = out.followersMin
  const viewBounds: [number, number] = [Math.max(500, Math.round(floor * 0.05)), Math.min(2_000_000, floor * 3)]

  for (const key of decided) delete (out as Record<string, unknown>)[key]
  if (!decided.has('lastPostWithinDays')) out.lastPostWithinDays = clamp(out.lastPostWithinDays ?? 14, 3, 90)
  if (!decided.has('postsPerMonthMin')) out.postsPerMonthMin = clamp(out.postsPerMonthMin ?? 8, 2, 30)
  // Between 5% and 300% of the follower floor. Below it says nothing, above it
  // asks for a permanently viral account.
  if (!decided.has('medianViewsMin')) {
    out.medianViewsMin = clamp(out.medianViewsMin ?? Math.round(floor * 0.5), ...viewBounds)
  }
  // The cheapest signal to fake, so it can be off and it never passes 2% of the
  // views floor, which would kill the campaign quietly. With reach decided by a
  // group there is no floor here to read, so the loosest way through the group
  // stands in for it.
  if (!decided.has('medianCommentsMin')) {
    const viewsFloor = out.medianViewsMin ?? loosestViews(either) ?? Math.round(floor * 0.5)
    out.medianCommentsMin = clamp(
      out.medianCommentsMin ?? 0,
      0,
      Math.max(10, Math.min(2_000, Math.round(viewsFloor * 0.02))),
    )
  }
  return out
}

/** The smallest views figure any way through the groups will accept. */
function loosestViews(either?: EitherGroup[]): number | undefined {
  const seen: number[] = []
  for (const g of either ?? []) {
    for (const o of g.options ?? []) {
      if (typeof o?.medianViewsMin === 'number') seen.push(o.medianViewsMin)
    }
  }
  return seen.length ? Math.min(...seen) : undefined
}

/**
 * The same limits, applied inside a choice.
 *
 * A group is written by a model and edited by a client, so its numbers need the
 * same bounds the dials have. An option left with nothing usable is dropped,
 * and a group down to one option is not a choice any more, so it goes too.
 */
export function settleEither(either: unknown, followersMin: number): EitherGroup[] {
  const bound: Record<string, [number, number]> = {
    medianViewsMin: [Math.max(500, Math.round(followersMin * 0.05)), Math.min(2_000_000, followersMin * 3)],
    medianCommentsMin: [1, 2_000],
    postsPerMonthMin: [1, 30],
    viewRatioMin: [1, 300],
    monthlyViewsMin: [Math.max(1_000, Math.round(followersMin * 0.1)), 50_000_000],
    lastPostWithinDays: [3, 90],
  }
  const out: EitherGroup[] = []
  for (const g of Array.isArray(either) ? either : []) {
    const options: HardRules[] = []
    for (const o of Array.isArray((g as any)?.options) ? (g as any).options : []) {
      const clean: Record<string, number> = {}
      for (const [k, raw] of Object.entries(o ?? {})) {
        const limits = bound[k]
        const n = Number(raw)
        if (!limits || !Number.isFinite(n) || n <= 0) continue
        clean[k] = Math.min(limits[1], Math.max(limits[0], Math.round(n)))
      }
      if (Object.keys(clean).length) options.push(clean as HardRules)
    }
    if (options.length < 2) continue
    out.push({ label: String((g as any)?.label ?? 'Either').slice(0, 40), options })
  }
  return out.slice(0, 4)
}

/** Locked knockouts come back on, whatever the request said. */
export function enforceLocks(templateId: string, knockouts: any[]): any[] {
  const lib = template(templateId)
  const rows = Array.isArray(knockouts) && knockouts.length ? knockouts : lib.knockouts
  const out = rows.map((k) => ({
    ...k,
    enabled: isLocked(templateId, String(k.id)) ? true : k.enabled !== false,
  }))
  // A locked question that was dropped from the list is put back.
  for (const locked of LOCKED[templateId] ?? []) {
    if (out.some((k) => String(k.id) === locked)) continue
    const original = lib.knockouts.find((k) => k.id === locked)
    if (original) out.push({ ...original, enabled: true })
  }
  return out
}

/** Under 5 out of 14 the score stops deciding anything. */
export function settleScore(passScore: number, criteriaCount: number): number {
  const max = Math.max(2, criteriaCount * 2)
  if (!Number.isFinite(passScore)) return Math.max(1, Math.round(max * 0.64))
  return Math.min(max, Math.max(1, Math.round(passScore)))
}

export const SENTENCES_MAX = 12

/**
 * The client's sentences, made safe: one to twelve, each a line of text with
 * an id that is a plain word. Null when nothing usable was sent.
 */
/** The words a model reaches for when it answers the shape of the task. */
const NOT_A_SENTENCE = new Set([
  'thresholds', 'knockouts', 'criteria', 'niches', 'ideal_profile', 'gate1', 'gate2', 'gate3',
  'hard', 'summary', 'profile', 'rules', 'filters',
])

/**
 * The sentences, or nothing.
 *
 * A weak model answers a schema by summarising the task into it: one row
 * called "thresholds" holding the numbers, one called "knockouts" holding the
 * questions, one called "niches" holding the list. Every one of those is a
 * paragraph, and every one scores at random against a person.
 *
 * So a row is kept only when it reads as one statement about somebody: short,
 * no question mark, no ids carried in from another section. Fewer than four
 * survive and the caller falls back to the library, which is at least made of
 * sentences.
 */
/** What a sentence may ask to have in front of the judge. */
export const EVIDENCE = ['profile', 'posts', 'links', 'images', 'comments', 'web']

export function cleanSentences(rows: unknown): {
  id: string
  text: string
  evidence?: string
  trap?: string
  rubric?: string
  needs?: string[]
}[] | null {
  if (!Array.isArray(rows)) return null
  const seen = new Set<string>()
  const out: { id: string; text: string }[] = []
  for (const row of rows) {
    // A dash the model reached for is a dash the client did not write. House
    // rule, and it is cheaper to enforce here than to ask for it every time.
    const text = String((row as any)?.text ?? (row as any)?.label ?? '')
      .replace(/\s*[\u2013\u2014]\s*/g, ', ')
      .replace(/\u2011/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/,\s*,/g, ',')
      .trim()
    if (!text) continue
    const rawId = String((row as any)?.id ?? '').replace(/[^a-z0-9_]/gi, '').slice(0, 40)
    // A statement, not a section: one idea, no question, nothing carried in.
    if (text.length > 180) continue
    if (NOT_A_SENTENCE.has(rawId.toLowerCase())) continue
    if (text.includes('?')) continue
    if (/\b[ckn]_[a-z0-9_]+\s*:/i.test(text)) continue
    if (/\([ckn]_[a-z0-9_]+\)/i.test(text)) continue
    if ((text.match(/:/g) ?? []).length > 1) continue
    let id = rawId || `c_${out.length + 1}`
    while (seen.has(id)) id = `${id}_`
    seen.add(id)
    // The method rides with the sentence. A sentence whose evidence was
    // dropped on the way in is a sentence the judge has to guess about.
    const line = (k: string) => {
      const v = String((row as Record<string, unknown>)?.[k] ?? '').replace(/\s+/g, ' ').trim()
      return v ? v.slice(0, 400) : undefined
    }
    const needs = Array.isArray((row as Record<string, unknown>)?.needs)
      ? ((row as Record<string, unknown>).needs as unknown[])
          .map((n) => String(n))
          .filter((n) => EVIDENCE.includes(n))
      : undefined
    out.push({
      id,
      text,
      ...(line('evidence') ? { evidence: line('evidence') } : {}),
      ...(line('trap') ? { trap: line('trap') } : {}),
      ...(line('rubric') ? { rubric: line('rubric') } : {}),
      ...(needs?.length ? { needs } : {}),
    })
    if (out.length >= SENTENCES_MAX) break
  }
  return out.length >= 4 ? out : null
}
