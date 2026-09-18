import type { Campaign } from '../types'
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
    dailyCap: 20,
    brief:
      'We build custom mobile apps for fitness coaches. We want to reach English speaking coaches who already sell a programme and teach a method of their own, so we can pitch turning that programme into their own app. Their audience has to be buying from them already.',
    extracted: {
      sells: 'Custom mobile app build for coaches, 12k to 30k euros a project',
      audience: 'English speaking fitness coaches with a paid programme and a named method',
      outcome: 'A discovery call about turning their programme into an app',
      countries: ['US', 'UK', 'CA', 'AU'],
      languages: ['en'],
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
    brief:
      'We sell a white label course platform to finance educators. We want creators who already run a paid community or cohort, publish every week, and whose audience has money to invest. We stay away from anyone giving regulated advice.',
    extracted: {
      sells: 'White label course and community platform, 450 euros a month',
      audience: 'Finance educators running a paid cohort or community',
      outcome: 'A demo booked on the platform',
      countries: ['US', 'UK', 'CA'],
      languages: ['en'],
      extractedAt: daysAgo(24),
    },
    gateSetId: 'gate_fin_v1',
    createdAt: daysAgo(24),
    updatedAt: daysAgo(24),
  },
]

export const campaignById = new Map(campaigns.map((c) => [c.id, c]))
