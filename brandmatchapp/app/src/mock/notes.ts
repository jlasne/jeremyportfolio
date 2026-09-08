import type { Note } from '../types'
import { daysAgo } from './time'

export const notes: Note[] = [
  { creatorId: 'c01', text: 'Replied on DM in 2 hours last time. Ask for the media kit rate card first.', updatedAt: daysAgo(4) },
  { creatorId: 'c04', text: 'UK only audience per her media kit. Fits the London launch.', updatedAt: daysAgo(3) },
  { creatorId: 'c12', text: 'App users skew 25 to 34. Could bundle a discount code.', updatedAt: daysAgo(1) },
]
