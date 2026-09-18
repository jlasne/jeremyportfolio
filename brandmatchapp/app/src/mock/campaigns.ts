import type { Campaign } from '../types'
import { suggestNiches } from '../data/niches'
import { account } from './account'
import { daysAgo } from './time'

// Two campaigns under one agency account. Between them they take the whole
// daily quota, and the caps show that the split is the client's to set.

export const campaigns: Campaign[] = [
  {
    id: 'cmp_fitness',
    accountId: account.id,
    name: 'Fitness coaches, app build',
    status: 'live',
    dailyCap: 10,
    brief: {
      audience:
        'English speaking fitness coaches who already sell a programme and teach a method of their own, with an audience that buys from them',
      offer: 'We build custom mobile apps for coaches, 12k to 30k euros a project',
      writtenAt: daysAgo(96),
    },
    extracted: {
      countries: ['US', 'UK', 'CA', 'AU'],
      languages: ['en'],
      templateId: 'sell_to_creators',
      // A postnatal account at 20k is worth more than a general one at 200k,
      // so that slice carries its own, lower numbers.
      niches: suggestNiches('fitness coaches strength training', 'mobile apps').map((n) =>
        n.id === 'postnatal_and_womens_health'
          ? { ...n, hard: { followersMin: 8_000, medianViewsMin: 6_000 } }
          : n.id === 'rehab_and_physio'
            ? { ...n, hard: { followersMin: 10_000, medianViewsMin: 7_000 } }
            : n,
      ),
      extractedAt: daysAgo(96),
    },
    gateSetId: 'gate_fit_v2',
    createdAt: daysAgo(96),
    updatedAt: daysAgo(31),
  },
  {
    id: 'cmp_finance',
    accountId: account.id,
    name: 'Finance educators, course platform',
    status: 'live',
    dailyCap: 12,
    brief: {
      audience:
        'Finance educators who already run a paid community or cohort, publish every week, and whose audience has money to invest. Nobody giving regulated advice',
      offer: 'We sell a white label course and community platform, 450 euros a month',
      writtenAt: daysAgo(24),
    },
    extracted: {
      countries: ['US', 'UK', 'CA'],
      languages: ['en'],
      templateId: 'sell_to_creators',
      niches: suggestNiches('finance educators investing', 'course platform').map((n) =>
        // Options is a small, noisy corner. Switched off for now.
        n.id === 'options_and_derivatives' ? { ...n, enabled: false } : n,
      ),
      extractedAt: daysAgo(24),
    },
    gateSetId: 'gate_fin_v1',
    createdAt: daysAgo(24),
    updatedAt: daysAgo(24),
  },
]

export const campaignById = new Map(campaigns.map((c) => [c.id, c]))
