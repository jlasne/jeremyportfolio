import type { Agent } from '../types'
import { defaultFilters } from './filters'
import { daysAgo } from './time'

// One saved search that runs every morning and fills the contact list.
// It owns a brief, its own filters, and how many leads a day it should deliver.

export const agents: Agent[] = [
  {
    id: 'a1',
    name: 'Women lifting coaches',
    brief: {
      who: 'Women lifting coaches who sell their own program',
      answers: [],
      summary: 'Women lifting coaches who sell their own program.',
    },
    filters: { ...defaultFilters, countries: [], languages: [] },
    leadsPerDay: 250,
    runAt: '07:00',
    active: true,
    createdAt: daysAgo(34),
  },
  {
    id: 'a2',
    name: 'Supplement ambassadors',
    brief: {
      who: 'Fitness creators who already promote supplement brands',
      answers: [],
      summary: 'Fitness creators who already promote supplement brands.',
    },
    filters: { ...defaultFilters, followersMin: 50_000, emailInBio: 'yes', countries: ['US', 'CA'], languages: [] },
    leadsPerDay: 150,
    runAt: '07:00',
    active: true,
    createdAt: daysAgo(21),
  },
  {
    id: 'a3',
    name: 'Postpartum and 40+',
    brief: {
      who: 'Coaches training women through postpartum and after 40',
      answers: [],
      summary: 'Coaches training women through postpartum and after 40.',
    },
    filters: { ...defaultFilters, followersMax: 200_000, countries: [], languages: [] },
    leadsPerDay: 100,
    runAt: '08:00',
    active: false,
    createdAt: daysAgo(9),
  },
]
