import type { Campaign } from '../types'
import { defaultFilters } from './filters'
import { daysAgo } from './time'

// One saved search that runs every morning and fills the contact list.
// It owns a brief, its own filters, and how many leads a day it should deliver.

export const campaigns: Campaign[] = [
  {
    id: 'a1',
    name: 'Women lifting coaches',
    website: 'strongher.co',
    agents: [
      { id: 'g1', name: 'Technique coaches', focus: 'Coaches filming squat, bench and deadlift cues for beginners', leadsPerDay: 150, active: true },
      { id: 'g2', name: 'Program sellers', focus: 'Creators with a program, an app or a membership in the bio', leadsPerDay: 100, active: true },
    ],
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
    website: 'purefuel.com',
    agents: [
      { id: 'g3', name: 'Paid post watchers', focus: 'Fitness creators who ran a sponsored post in the last month', leadsPerDay: 150, active: true },
    ],
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
    website: 'strongher.co',
    agents: [
      { id: 'g4', name: 'Postpartum', focus: 'Coaches training women back after birth', leadsPerDay: 50, active: true },
      { id: 'g5', name: 'Over 40', focus: 'Coaches for women over 40 lifting for the first time', leadsPerDay: 50, active: false },
    ],
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
