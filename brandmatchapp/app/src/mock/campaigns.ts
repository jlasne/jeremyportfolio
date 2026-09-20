import type { Campaign, Niche } from '../types'
import { suggestNiches } from '../data/niches'
import { account } from './account'
import { daysAgo } from './time'

// Two campaigns under one agency account. Between them they take the whole
// daily quota, and the caps show that the split is the client's to set.
//
// The first one has already opened a door. Three weeks ago its rules stopped
// filling the day, views were lowered, and the flow came back. It is kept here
// because it is the normal life of a campaign, and because every screen that
// touches a lead has to be able to say which side of that move it came from.

/**
 * The slices the first campaign looks in.
 *
 * Views on a typical post are set under each niche here and nowhere else: a
 * postnatal account at 6k views is worth more than a general one at 12k, so
 * the campaign carries no single number for it and every niche carries its
 * own. One number, one place.
 */
// Size and activity are the campaign's, not the niche's. A number that moves
// per niche is a number nobody can state in one sentence, and the rules screen
// exists to state them in one sentence.
const fitnessNiches: Niche[] = suggestNiches('fitness coaches strength training', 'mobile apps')

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
      // Four we know, one we have never seen. Exactly what a client gives you.
      seeds: ['nolan.built', 'marco.hybrid', 'bram.form', 'rae.method', 'coachsamira'],
      writtenAt: daysAgo(96),
    },
    extracted: {
      countries: ['US', 'UK', 'CA', 'AU'],
      languages: ['en'],
      templateId: 'sell_to_creators',
      niches: fitnessNiches,
      extractedAt: daysAgo(96),
    },
    gateSetId: 'gate_fit_v3',
    // The rules this campaign agreed to before it opened anything. Every lead
    // handed over since is measured against these, and the ones that only clear
    // today's rules are marked on the list.
    widened: {
      fromGateSetId: 'gate_fit_v2',
      fromNiches: fitnessNiches,
      doors: [
        {
          id: 'medianViewsMin',
          label: 'Followers lowered from 15k to 7k',
          openedAt: daysAgo(24),
        },
      ],
    },
    createdAt: daysAgo(96),
    updatedAt: daysAgo(24),
  },
  {
    id: 'cmp_finance',
    accountId: account.id,
    name: 'Finance educators, course platform',
    status: 'live',
    dailyCap: 5,
    brief: {
      audience:
        'Finance educators who already run a paid community or cohort, publish every week, and whose audience has money to invest. Nobody giving regulated advice',
      offer: 'We sell a white label course and community platform, 450 euros a month',
      seeds: ['milo.signal', 'marco.capital'],
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
