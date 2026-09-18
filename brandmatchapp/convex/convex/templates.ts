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
  knockouts: { id: string; question: string; why?: string }[]
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
      { id: 'k_method', question: 'Do they teach a repeatable method rather than only show results?', why: 'A method can become a product. A highlight reel cannot.' },
      { id: 'k_product', question: 'Could the value they deliver live inside a product?' },
      { id: 'k_not_built', question: 'Have they not already built the thing you would build with them?', why: 'If they shipped it, there is nothing left to propose.' },
      { id: 'k_person', question: 'Is this a real person rather than a theme page?', why: 'A theme page has no method and nobody to sign.' },
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
      { id: 'k_paid_offer', question: 'Do they have a paid offer live today?', why: 'No revenue, no budget.' },
      { id: 'k_decides', question: 'Are they the one who decides?', why: 'An agency or a manager in the way doubles the sales cycle.' },
      { id: 'k_no_rival', question: 'Are they free of a direct competitor to your offer?' },
      { id: 'k_person', question: 'Is this a real person rather than a theme page?' },
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
      { id: 'k_ran_paid', question: 'Have they run a paid partnership before?', why: 'A first timer costs you the learning.' },
      { id: 'k_market', question: 'Is their audience in your market, not only your topic?' },
      { id: 'k_safe', question: 'Is there nothing on the account you cannot stand next to?' },
      { id: 'k_person', question: 'Is this a real person rather than a theme page?' },
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
    ? draft.knockouts!.map((k) => ({
        id: String(k.id),
        question: String(k.question ?? ''),
        why: k.why ? String(k.why) : undefined,
      })).filter((k) => k.question)
    : lib.knockouts

  const bar = Number(draft.passScore)
  const passScore = Number.isFinite(bar) && bar >= 0 && bar <= criteria.length * 2 ? Math.round(bar) : lib.passScore

  return { knockouts, criteria, passScore }
}
