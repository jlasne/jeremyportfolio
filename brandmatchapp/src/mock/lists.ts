import type { SavedList } from '../types'
import { daysAgo } from './time'

// One list with content, one empty, so both states show.
export const lists: SavedList[] = [
  { id: 'l1', name: 'Q4 launch shortlist', creatorIds: ['c01', 'c04', 'c12'], createdAt: daysAgo(6) },
  { id: 'l2', name: 'Ambassadors 2027', creatorIds: [], createdAt: daysAgo(2) },
]
