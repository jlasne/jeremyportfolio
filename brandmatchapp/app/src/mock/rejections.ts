import type { Rejection } from '../types'
import { daysAgo } from './time'

// Rejected creators leave the feed for good. The reject state stays visible in the detail panel and the exports.
export const rejections: Rejection[] = [
  { creatorId: 'c17', date: daysAgo(5) },
  { creatorId: 'c29', date: daysAgo(9) },
]
