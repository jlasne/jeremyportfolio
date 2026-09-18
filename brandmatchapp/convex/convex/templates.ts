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
  criteria: { id: string; label: string; guide?: string }[]
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
      { id: 'c_sells', label: 'Sells a product today', guide: 'A paid programme, coaching or course, priced in public.' },
      { id: 'c_stakes', label: 'The topic carries real stakes', guide: 'Money, body or career. Something the audience cannot shrug off.' },
      { id: 'c_method', label: 'Has a named method', guide: 'The method has a name and they repeat it.' },
      { id: 'c_demand', label: 'Demand shows in the comments', guide: 'People ask how to buy or where to start.' },
      { id: 'c_proof', label: 'Measurable progress in the posts', guide: 'Client numbers, before and after, with dates.' },
      { id: 'c_stable', label: 'Over two years old, stable or growing', guide: 'No long gap, and the reach is not sliding.' },
      { id: 'c_person', label: 'The audience follows the person', guide: 'Face on camera, first person, replies in the comments.' },
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
      { id: 'c_revenue', label: 'Sells something today', guide: 'A paid offer at a public price, so there is money to spend.' },
      { id: 'c_pain', label: 'The problem you solve is visible', guide: 'They show it, complain about it, or work around it in public.' },
      { id: 'c_solo', label: 'Runs the business themselves', guide: 'No agency or manager standing between you and them.' },
      { id: 'c_replies', label: 'Replies to people', guide: 'Answers comments and questions. It predicts they answer you.' },
      { id: 'c_tools', label: 'Already pays for tools', guide: 'Links to a stack you can plug into or replace.' },
      { id: 'c_fit', label: 'Audience size fits your price', guide: 'Big enough to afford you, small enough to still need you.' },
      { id: 'c_growing', label: 'Growing, not coasting', guide: 'Reach and cadence going up over the last year.' },
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
      { id: 'c_paid_posts', label: 'Already runs paid partnerships', guide: 'Tagged partnerships, a rate card, or a media kit.' },
      { id: 'c_buyer', label: 'The audience is your buyer', guide: 'Right country, right spending power, not only the right topic.' },
      { id: 'c_steady', label: 'Reach is steady, not one spike', guide: 'Median views hold across the last twelve posts.' },
      { id: 'c_trust', label: 'Comments show trust', guide: 'Questions and thanks, not only applause and emoji.' },
      { id: 'c_sells_well', label: 'Recommends without losing the room', guide: 'Past promotions kept the engagement up.' },
      { id: 'c_safe', label: 'Brand safe', guide: 'A tone and a set of topics you can stand next to.' },
      { id: 'c_budget', label: 'Rates likely inside your budget', guide: 'Size and category suggest a price you can pay.' },
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

  const criteria = same(ids(draft.criteria), lib.criteria.map((c) => c.id))
    ? draft.criteria!.map((c, i) => ({
        id: lib.criteria[i].id,
        label: String(c.label ?? lib.criteria[i].label),
        guide: String(c.guide ?? lib.criteria[i].guide ?? ''),
      }))
    : lib.criteria

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
  countries?: string[]
  languages?: string[]
}

/**
 * Pulls every dial inside its limits. Two kinds of limit do the work: a dial's
 * own floor and ceiling, and a dial bounded by another. Median views of 500,000
 * is not absurd on its own. It is absurd next to a follower floor of 15,000.
 *
 * The same numbers live in app/src/data/tuning.ts. They have to stay in step:
 * the screen promises a limit and this is where the promise is kept.
 */
export function settle(hard: HardRules): HardRules {
  const out: HardRules = { ...hard }
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))

  out.followersMin = clamp(out.followersMin ?? 15_000, 5_000, 500_000)
  out.followersMax = clamp(out.followersMax ?? 400_000, Math.max(25_000, out.followersMin * 3), 5_000_000)
  out.lastPostWithinDays = clamp(out.lastPostWithinDays ?? 14, 3, 90)
  out.postsPerMonthMin = clamp(out.postsPerMonthMin ?? 8, 2, 30)
  // Between 5% and 300% of the follower floor. Below it says nothing, above it
  // asks for a permanently viral account.
  out.medianViewsMin = clamp(
    out.medianViewsMin ?? Math.round(out.followersMin * 0.5),
    Math.max(500, Math.round(out.followersMin * 0.05)),
    Math.min(2_000_000, out.followersMin * 3),
  )
  // The cheapest signal to fake, so it can be off and it never passes 2% of the
  // views floor, which would kill the campaign quietly.
  out.medianCommentsMin = clamp(
    out.medianCommentsMin ?? 0,
    0,
    Math.max(10, Math.min(2_000, Math.round(out.medianViewsMin * 0.02))),
  )
  return out
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
  const max = criteriaCount * 2
  if (!Number.isFinite(passScore)) return Math.min(9, max)
  return Math.min(max, Math.max(5, Math.round(passScore)))
}
