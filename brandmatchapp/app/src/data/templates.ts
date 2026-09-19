import type { Criterion, Knockout, TemplateId } from '../types'

// Three libraries, one per reason to go looking for a creator.
//
// Gate 3 starts from here and then belongs to the client. The library gives
// seven sentences about the ideal client, the model rewords them to the brief,
// and from then on the client keeps, changes, adds or deletes them freely.
// Gate 2 comes from here too, and the model may add at most one question to
// it. Gate 1 is generated freely, because it is only numbers.
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
        why: 'A method can be turned into a product. A highlight reel cannot.',
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
        question: 'Is this a real person rather than a theme or AI page?',
        why: 'A page with no owner has nobody to write to and nobody to sign.',
        pass: 'A named human, face or voice on the account, speaks as themselves.',
        fail: 'Aggregator, quote page, repost account, no named owner.',
      },
    ],
    criteria: [
      { id: 'c_sells', text: 'They sell a paid programme, coaching or course today, at a price shown in public.' },
      { id: 'c_stakes', text: 'Their topic carries real stakes: money, body or career.' },
      { id: 'c_method', text: 'They teach a method with a name, and they repeat it.' },
      { id: 'c_demand', text: 'People in the comments ask how to buy or where to start.' },
      { id: 'c_proof', text: 'Their posts show measurable client progress, with dates.' },
      { id: 'c_stable', text: 'The account is over two years old and its reach is stable or growing.' },
      { id: 'c_person', text: 'The audience follows the person: face on camera, first person, replies in the comments.' },
      { id: 'c_buys', text: 'Their audience buys from them: launches fill up, or they mention a waiting list.' },
      { id: 'c_full', text: 'They are short on time rather than on demand: they turn work away or say they are full.' },
    ],
    passScore: 11,
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
        why: 'If they earn nothing today, they have nothing to spend on you.',
        pass: 'A programme, a course, a membership or a service with a price.',
        fail: 'Everything is free, or the only link is an affiliate page.',
      },
      {
        id: 'k_decides',
        question: 'Are they the one who decides?',
        why: 'An agency or a manager in the way makes every deal twice as slow.',
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
        question: 'Is this a real person rather than a theme or AI page?',
        why: 'A page with no owner has nobody to write to and nobody to sign.',
        pass: 'A named human, face or voice on the account, speaks as themselves.',
        fail: 'Aggregator, quote page, repost account, no named owner.',
      },
    ],
    criteria: [
      { id: 'c_revenue', text: 'They sell something today: a paid offer at a public price.' },
      { id: 'c_pain', text: 'The problem you solve is visible: they show it, complain about it or work around it in public.' },
      { id: 'c_solo', text: 'They run the business themselves, with no agency or manager in between.' },
      { id: 'c_replies', text: 'They answer comments and questions.' },
      { id: 'c_tools', text: 'They already pay for tools, and link to them from the bio.' },
      { id: 'c_fit', text: 'Their audience is big enough to afford you and small enough to still need you.' },
      { id: 'c_growing', text: 'Their reach and posting rhythm went up over the last year.' },
      { id: 'c_alone', text: 'They do the unglamorous work themselves: editing, invoicing, answering every message.' },
      { id: 'c_shipped', text: 'They have put something new out in the last three months.' },
    ],
    passScore: 11,
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
        why: 'Someone doing their first one will cost you the time to teach them.',
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
        why: 'This one protects you legally. It is not a matter of taste.',
        pass: 'Tone and topics a brand can sit beside without a meeting.',
        fail: 'Recurring content that would need signing off by legal.',
      },
      {
        id: 'k_person',
        question: 'Is this a real person rather than a theme or AI page?',
        why: 'A page with no owner has nobody to write to and nobody to sign.',
        pass: 'A named human, face or voice on the account, speaks as themselves.',
        fail: 'Aggregator, quote page, repost account, no named owner.',
      },
    ],
    criteria: [
      { id: 'c_paid_posts', text: 'They already run paid partnerships: tagged posts, a rate card or a media kit.' },
      { id: 'c_buyer', text: 'Their audience is your buyer: right country and right spending power, not only the right topic.' },
      { id: 'c_steady', text: 'Their reach is steady across the last twelve posts, with no single spike.' },
      { id: 'c_trust', text: 'The comments show trust: questions and thanks, not only applause.' },
      { id: 'c_sells_well', text: 'Their past promotions kept the engagement up.' },
      { id: 'c_safe', text: 'Their tone and topics are ones you can stand next to.' },
      { id: 'c_budget', text: 'Their size and category suggest a rate inside your budget.' },
      { id: 'c_repeat', text: 'Brands come back to them: the same partner shows up more than once.' },
      { id: 'c_clean', text: 'They mark paid posts properly, so a campaign with them is clean.' },
    ],
    passScore: 11,
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
/**
 * The questions a library switches on for you. Not locked: a client who knows
 * their market can switch any of them off, and one that cannot be switched off
 * is a rule the client never agreed to.
 */
export const DEFAULT_ON: Record<TemplateId, string[]> = {
  recruit_partners: ['k_person', 'k_not_built'],
  sell_to_creators: ['k_person', 'k_paid_offer'],
  sponsorship: ['k_person', 'k_safe'],
}

export const LOCK_REASON: Record<string, string> = {
  k_person: 'Without it you get pages with nobody to write to and nobody to sign a contract.',
  k_not_built: 'Without it you end up pitching people who already built it themselves.',
  k_paid_offer: 'If they earn nothing today, they have nothing to spend. It is the clearest sign of a wasted call.',
  k_safe: 'This one protects your brand and your legal team. It is not a matter of taste.',
}

export function isLocked(_templateId: TemplateId, _knockoutId: string): boolean {
  // Nothing is locked any more. Kept so older callers keep compiling.
  return false
}

export function isDefaultOn(templateId: TemplateId, knockoutId: string): boolean {
  return DEFAULT_ON[templateId]?.includes(knockoutId) ?? false
}

export const templateById = new Map(TEMPLATES.map((t) => [t.id, t]))

export function template(id: TemplateId): GateTemplate {
  return templateById.get(id) ?? TEMPLATES[1]
}
