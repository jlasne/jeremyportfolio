import type { Criterion, Knockout, TemplateId } from '../types'

// Three libraries, one per reason to go looking for a creator.
//
// Gate 3 is never written from nothing. The model picks the closest library and
// rewords it, which is both more predictable and safer than inventing seven
// criteria each time. Gate 2 comes from here too, and the model may add at most
// one question to it. Gate 1 is the only part generated freely, because it is
// only numbers.
//
// There is deliberately no generic fourth library. When the model is unsure it
// takes the nearest one and says so, and the client switches in one click. A
// vague library would weaken the three real ones.

export interface GateTemplate {
  id: TemplateId
  name: string
  /** One line, shown in the switcher, so a client can pick without reading. */
  when: string
  knockouts: Knockout[]
  criteria: Criterion[]
  passScore: number
  /** Gate 1 starting points, before the brief moves them. */
  defaults: {
    followersMin: number
    followersMax: number
    lastPostWithinDays: number
    postsPerMonthMin: number
    /** Median views floor, as a share of the follower floor. */
    viewsShare: number
  }
}

export const TEMPLATES: GateTemplate[] = [
  {
    id: 'recruit_partners',
    name: 'Recruiting creator partners',
    when: 'They build something with you. Revenue share, a co-branded product, a partnership.',
    knockouts: [
      {
        id: 'k_method',
        question: 'Do they teach a repeatable method rather than only show results?',
        why: 'A method can become a product. A highlight reel cannot.',
        pass: 'Teaches a how to, or breaks down how a result was reached.',
        fail: 'Pure entertainment, vlogs, outfit posts, reaction content.',
      },
      {
        id: 'k_product',
        question: 'Could the value they deliver live inside a product?',
        pass: 'A plan, a check in, a library, a community. Things software holds.',
        fail: 'Hands on work in a room. Software cannot carry it.',
      },
      {
        id: 'k_not_built',
        question: 'Have they not already built the thing you would build with them?',
        why: 'If they shipped it, there is nothing left to propose.',
        pass: 'Sells through a PDF, a spreadsheet, a third party tool.',
        fail: 'Already ships their own app, platform or branded product.',
      },
      {
        id: 'k_person',
        question: 'Is this a real person rather than a theme page?',
        why: 'A theme page has nobody to contact and nobody to sign.',
        pass: 'A named human, face or voice on the account, speaks as themselves.',
        fail: 'Aggregator, quote page, repost account, no named owner.',
      },
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
      {
        id: 'k_paid_offer',
        question: 'Do they have a paid offer live today?',
        why: 'No revenue, no budget.',
        pass: 'A programme, a course, a membership or a service with a price.',
        fail: 'Everything is free, or the only link is an affiliate page.',
      },
      {
        id: 'k_decides',
        question: 'Are they the one who decides?',
        why: 'An agency or a manager in the way doubles the sales cycle.',
        pass: 'Answers from their own account, no management in the bio.',
        fail: 'An agency, a label or a manager fronts the inbox.',
      },
      {
        id: 'k_no_rival',
        question: 'Are they free of a direct competitor to your offer?',
        pass: 'Nothing in the stack overlaps with what you sell.',
        fail: 'Already pays for something that does your job.',
      },
      {
        id: 'k_person',
        question: 'Is this a real person rather than a theme page?',
        why: 'A theme page has nobody to contact and nobody to sign.',
        pass: 'A named human, face or voice on the account, speaks as themselves.',
        fail: 'Aggregator, quote page, repost account, no named owner.',
      },
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
      {
        id: 'k_ran_paid',
        question: 'Have they run a paid partnership before?',
        why: 'A first timer costs you the learning.',
        pass: 'Tagged partnerships, a rate card, or a media kit in the bio.',
        fail: 'Nothing sponsored anywhere on the account.',
      },
      {
        id: 'k_market',
        question: 'Is their audience in your market, not only your topic?',
        pass: 'Comments and tags sit in the countries you sell to.',
        fail: 'Right subject, wrong continent or wrong spending power.',
      },
      {
        id: 'k_safe',
        question: 'Is there nothing on the account you cannot stand next to?',
        why: 'This one is a liability, not a preference.',
        pass: 'Tone and topics a brand can sit beside without a meeting.',
        fail: 'Recurring content that would need signing off by legal.',
      },
      {
        id: 'k_person',
        question: 'Is this a real person rather than a theme page?',
        why: 'A theme page has nobody to contact and nobody to sign.',
        pass: 'A named human, face or voice on the account, speaks as themselves.',
        fail: 'Aggregator, quote page, repost account, no named owner.',
      },
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

/**
 * The knockouts a client cannot switch off.
 *
 * One universal and one per library, and the rule for picking them is narrow:
 * a knockout is locked when turning it off would deliver something that is not
 * a lead, or would create a real liability. Never because we like the question.
 *
 * Locked ones stay on screen with a lock and their reason. Hiding them would
 * make the rules look shorter than they are.
 */
export const LOCKED: Record<TemplateId, string[]> = {
  recruit_partners: ['k_person', 'k_not_built'],
  sell_to_creators: ['k_person', 'k_paid_offer'],
  sponsorship: ['k_person', 'k_safe'],
}

export const LOCK_REASON: Record<string, string> = {
  k_person: 'Without it you get accounts with nobody to contact and nobody to sign.',
  k_not_built: 'Without it you pitch people who already shipped the thing.',
  k_paid_offer: 'No revenue means no budget. It is the best predictor of a wasted call.',
  k_safe: 'This one is a brand and legal risk, not a preference.',
}

export function isLocked(templateId: TemplateId, knockoutId: string): boolean {
  return LOCKED[templateId]?.includes(knockoutId) ?? false
}

export const templateById = new Map(TEMPLATES.map((t) => [t.id, t]))

export function template(id: TemplateId): GateTemplate {
  return templateById.get(id) ?? TEMPLATES[1]
}
