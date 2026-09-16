import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

// Every hour, hand the crawl whatever agent has not run in 20 hours.
//
// The hour is the granularity: the crawl itself decides who is due, so a
// brand in Sydney and a brand in Paris both get their batch before their 7am
// without a job per timezone. Most hours it spends nothing, because the pool
// covers the quota before Apify is ever called.

const crons = cronJobs()

crons.hourly(
  'fill every due agent',
  { minuteUTC: 17 },
  internal.crawl.run,
  {},
)

export default crons
