import type { Agent } from '../types'
import { defaultFilters } from './filters'
import { daysAgo } from './time'

// An agent is one saved search that runs every morning.
// It owns a brief, its own filters, and how many leads a day it should deliver.

export const agents: Agent[] = [
  {
    id: 'a1',
    name: 'Women lifting coaches',
    brief: {
      who: 'Women lifting coaches who sell their own program',
      answers: [
        { questionId: 'sells', value: 'online program' },
        { questionId: 'content', value: 'technique tutorials' },
        { questionId: 'audience', value: 'beginner women' },
      ],
      summary: 'Looking for: women lifting coaches, sell an online program, technique content, audience of beginner women.',
    },
    filters: { ...defaultFilters, countries: [], languages: [] },
    leadsPerDay: 25,
    runAt: '07:00',
    active: true,
    createdAt: daysAgo(34),
  },
  {
    id: 'a2',
    name: 'Supplement ambassadors',
    brief: {
      who: 'Fitness creators who already promote supplement brands',
      answers: [
        { questionId: 'sells', value: 'anything' },
        { questionId: 'content', value: 'transformations' },
        { questionId: 'audience', value: 'competitive lifters' },
      ],
      summary: 'Looking for: fitness creators who already promote supplement brands, transformation content, audience of competitive lifters.',
    },
    filters: { ...defaultFilters, followersMin: 50_000, emailInBio: 'yes', countries: ['US', 'CA'], languages: [] },
    leadsPerDay: 15,
    runAt: '07:00',
    active: true,
    createdAt: daysAgo(21),
  },
  {
    id: 'a3',
    name: 'Postpartum and 40+',
    brief: {
      who: 'Coaches training women through postpartum and after 40',
      answers: [
        { questionId: 'sells', value: 'coaching' },
        { questionId: 'content', value: 'technique tutorials' },
        { questionId: 'audience', value: 'postpartum' },
      ],
      summary: 'Looking for: coaches training women through postpartum and after 40, sell coaching, technique content, audience of postpartum women.',
    },
    filters: { ...defaultFilters, followersMax: 200_000, countries: [], languages: [] },
    leadsPerDay: 10,
    runAt: '08:00',
    active: false,
    createdAt: daysAgo(9),
  },
]
