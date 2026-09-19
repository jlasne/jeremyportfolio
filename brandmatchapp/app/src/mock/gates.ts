import type { GateSet } from '../types'
import { preset, settle } from '../data/tuning'
import { template } from '../data/templates'
import { account } from './account'
import { daysAgo } from './time'

// Two campaigns, four gate versions between them.
//
// Built from the libraries and the presets rather than typed out, so the sample
// account and the editor cannot drift apart. The first campaign carries the
// version it was born with, the tighter one that replaced it, and the door it
// had to open three weeks ago to keep filling the day. That third move is the
// one worth reading: it is what every campaign eventually does.

const lib = template('sell_to_creators')
const balanced = preset('balanced', lib)

/** Where the client sells. Set from the brief, and the same across versions. */
const WHERE = { countries: ['US', 'UK', 'CA', 'AU'], languages: ['en'] }

/** The tighter second version: more reach, fresher, and a higher bar. */
const tuned = settle({
  ...balanced.hard,
  ...WHERE,
  lastPostWithinDays: 14,
  medianViewsMin: 12_000,
  medianCommentsMin: 25,
  postsPerMonthMin: 8,
})

/**
 * The door. The follower floor lowered when the first rules stopped filling
 * the day.
 *
 * Every lead handed over since is measured against the version above, and the
 * ones that only clear this one carry the mark for good.
 */
const opened = (() => {
  // Views moved under the niches when this version was written, so the
  // campaign carries no number for them any more.
  const hard = settle({ ...tuned, followersMin: 7_000 })
  delete hard.medianViewsMin
  return hard
})()

export const gateSets: GateSet[] = [
  {
    id: 'gate_fit_v1',
    campaignId: 'cmp_fitness',
    accountId: account.id,
    version: 1,
    origin: 'generated',
    templateId: lib.id,
    hard: { ...balanced.hard, ...WHERE },
    knockouts: lib.knockouts.map((k) => ({ ...k, enabled: true })),
    criteria: lib.criteria,
    passScore: balanced.passScore,
    preset: 'balanced',
    by: 'system',
    changes: ['Proposed from the brief'],
    createdAt: daysAgo(96),
  },
  {
    id: 'gate_fit_v2',
    campaignId: 'cmp_fitness',
    accountId: account.id,
    version: 2,
    origin: 'edited',
    templateId: lib.id,
    hard: tuned,
    knockouts: lib.knockouts.map((k) => ({ ...k, enabled: true })),
    criteria: lib.criteria,
    passScore: 9,
    preset: 'custom',
    by: 'mem_1',
    changes: [
      'Views on a typical post, at least: 7.5k to 12k',
      'Comments on a typical post, at least: 15 to 25',
    ],
    createdAt: daysAgo(31),
  },
  {
    id: 'gate_fit_v3',
    campaignId: 'cmp_fitness',
    accountId: account.id,
    version: 3,
    origin: 'edited',
    templateId: lib.id,
    hard: opened,
    knockouts: lib.knockouts.map((k) => ({ ...k, enabled: true })),
    criteria: lib.criteria,
    passScore: 9,
    preset: 'custom',
    by: 'mem_1',
    changes: ['Followers, from: 15k to 7k', 'Views on a typical post, at least: now set per niche'],
    createdAt: daysAgo(24),
  },
  {
    id: 'gate_fin_v1',
    campaignId: 'cmp_finance',
    accountId: account.id,
    version: 1,
    origin: 'generated',
    templateId: lib.id,
    hard: settle({
      ...balanced.hard,
      countries: ['US', 'UK', 'CA'],
      languages: ['en'],
      followersMin: 120_000,
      followersMax: 600_000,
      lastPostWithinDays: 7,
      medianViewsMin: 90_000,
      medianCommentsMin: 300,
      postsPerMonthMin: 18,
    }),
    knockouts: lib.knockouts.map((k) => ({ ...k, enabled: true })),
    criteria: lib.criteria,
    passScore: 12,
    preset: 'custom',
    by: 'system',
    changes: ['Proposed from the brief'],
    createdAt: daysAgo(24),
  },
]

export const gateSetById = new Map(gateSets.map((g) => [g.id, g]))
