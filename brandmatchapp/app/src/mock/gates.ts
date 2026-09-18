import type { GateSet } from '../types'
import { account } from './account'
import { daysAgo } from './time'

// Two campaigns, three gate versions between them. The first campaign carries a
// generated version and the edited version that replaced it, so the versioning
// is visible from the first screen.
//
// The wording below comes from a real recruitment pipeline. The product
// generalises it: every campaign writes its own from its own brief.

export const gateSets: GateSet[] = [
  {
    id: 'gate_fit_v1',
    campaignId: 'cmp_fitness',
    accountId: account.id,
    version: 1,
    origin: 'generated',
    templateId: 'sell_to_creators',
    hard: {
      followersMin: 10_000,
      followersMax: 400_000,
      lastPostWithinDays: 21,
      medianViewsMin: 8_000,
      medianCommentsMin: 15,
      postsPerMonthMin: 6,
      languages: ['en'],
    },
    knockouts: [
      { id: 'k_method', question: 'Do they teach a repeatable method rather than only show results?', why: 'A method can become software. A highlight reel cannot.' },
      { id: 'k_software', question: 'Can the value they deliver live inside an app?' },
      { id: 'k_no_app', question: 'Are they without an app of their own today?', why: 'If they already shipped one, there is nothing to sell them.' },
      { id: 'k_buys', question: 'Does their audience already buy from them?' },
    ],
    criteria: CRITERIA_FITNESS(),
    passScore: 8,
    createdAt: daysAgo(96),
  },
  {
    id: 'gate_fit_v2',
    campaignId: 'cmp_fitness',
    accountId: account.id,
    version: 2,
    origin: 'edited',
    templateId: 'sell_to_creators',
    hard: {
      followersMin: 15_000,
      followersMax: 400_000,
      lastPostWithinDays: 14,
      medianViewsMin: 12_000,
      medianCommentsMin: 25,
      postsPerMonthMin: 8,
      languages: ['en'],
    },
    knockouts: [
      { id: 'k_method', question: 'Do they teach a repeatable method rather than only show results?', why: 'A method can become software. A highlight reel cannot.' },
      { id: 'k_software', question: 'Can the value they deliver live inside an app?' },
      { id: 'k_no_app', question: 'Are they without an app of their own today?', why: 'If they already shipped one, there is nothing to sell them.' },
      { id: 'k_buys', question: 'Does their audience already buy from them?' },
      { id: 'k_person', question: 'Is this a real person rather than a theme page?', why: 'A theme page has no method and nobody to sign a contract.' },
    ],
    criteria: CRITERIA_FITNESS(),
    passScore: 9,
    createdAt: daysAgo(31),
  },
  {
    id: 'gate_fin_v1',
    campaignId: 'cmp_finance',
    accountId: account.id,
    version: 1,
    origin: 'generated',
    templateId: 'sell_to_creators',
    hard: {
      followersMin: 25_000,
      followersMax: 600_000,
      lastPostWithinDays: 10,
      medianViewsMin: 20_000,
      medianCommentsMin: 40,
      postsPerMonthMin: 12,
      languages: ['en'],
    },
    knockouts: [
      { id: 'k_paid', question: 'Do they run a paid community or cohort today?' },
      { id: 'k_clear', question: 'Are they clear of regulated financial advice?', why: 'Regulated advice drags a licence into the deal.' },
      { id: 'k_no_platform', question: 'Are they without a platform of their own today?' },
      { id: 'k_person', question: 'Is this a real person rather than a theme page?' },
    ],
    criteria: [
      { id: 'c_sells', label: 'Sells a product today', guide: 'A paid cohort, community or course, priced in public.' },
      { id: 'c_method', label: 'Has a named method', guide: 'A framework they repeat by name across posts.' },
      { id: 'c_demand', label: 'Demand shows in the comments', guide: 'People ask where to join or how to start.' },
      { id: 'c_proof', label: 'Shows measurable results', guide: 'Numbers with dates, not screenshots without context.' },
      { id: 'c_stable', label: 'Old and steady account', guide: 'Two years or more, posting without long gaps.' },
      { id: 'c_person', label: 'Audience follows the person', guide: 'Face on camera, first person, replies in the comments.' },
      { id: 'c_reach', label: 'Reach beats the follower count', guide: 'Median views above the follower count.' },
    ],
    passScore: 10,
    createdAt: daysAgo(24),
  },
]

/** Shared by both fitness versions, so an edit to one gate is visibly one gate. */
function CRITERIA_FITNESS() {
  return [
    { id: 'c_sells', label: 'Sells a product today', guide: 'A paid programme, coaching or course, priced in public.' },
    { id: 'c_method', label: 'Has a named method', guide: 'The method has a name they repeat.' },
    { id: 'c_demand', label: 'Demand shows in the comments', guide: 'People ask how to buy or where to start.' },
    { id: 'c_proof', label: 'Shows measurable progress', guide: 'Client numbers, before and after, with dates.' },
    { id: 'c_stable', label: 'Old and steady account', guide: 'Two years or more, posting without long gaps.' },
    { id: 'c_person', label: 'Audience follows the person', guide: 'Face on camera, first person, replies in the comments.' },
    { id: 'c_reach', label: 'Reach beats the follower count', guide: 'Median views above the follower count.' },
  ]
}

export const gateSetById = new Map(gateSets.map((g) => [g.id, g]))
