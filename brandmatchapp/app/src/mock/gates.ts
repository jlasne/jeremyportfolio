import type { GateSet } from '../types'
import { preset, settle } from '../data/tuning'
import { template } from '../data/templates'
import { account } from './account'
import { daysAgo } from './time'

// Two campaigns, three gate versions between them.
//
// Built from the libraries and the presets rather than typed out, so the sample
// account and the editor cannot drift apart. The first campaign carries the
// version it was born with and the tighter one that replaced it, which is what
// makes the history readable from the first screen.

const lib = template('sell_to_creators')
const balanced = preset('balanced', lib)

/** The tighter second version: more reach, fresher, and a higher bar. */
const tuned = settle({
  ...balanced.hard,
  lastPostWithinDays: 14,
  medianViewsMin: 12_000,
  medianCommentsMin: 25,
  postsPerMonthMin: 8,
  languages: ['en'],
})

export const gateSets: GateSet[] = [
  {
    id: 'gate_fit_v1',
    campaignId: 'cmp_fitness',
    accountId: account.id,
    version: 1,
    origin: 'generated',
    templateId: lib.id,
    hard: { ...balanced.hard, languages: ['en'] },
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
      'Median views, floor: 7.5k to 12k',
      'Median comments, floor: 15 to 25',
    ],
    createdAt: daysAgo(31),
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
      followersMin: 25_000,
      followersMax: 600_000,
      lastPostWithinDays: 10,
      medianViewsMin: 20_000,
      medianCommentsMin: 40,
      postsPerMonthMin: 12,
      languages: ['en'],
    }),
    knockouts: lib.knockouts.map((k) => ({ ...k, enabled: true })),
    criteria: lib.criteria,
    passScore: 10,
    preset: 'custom',
    by: 'system',
    changes: ['Proposed from the brief'],
    createdAt: daysAgo(24),
  },
]

export const gateSetById = new Map(gateSets.map((g) => [g.id, g]))
