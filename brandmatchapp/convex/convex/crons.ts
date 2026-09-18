import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

// Two jobs, in order.
//
// The month opens once, so a new period has its entitlement line before
// anything spends against it. Delivery then runs every morning and hands over
// the best qualified profiles the account's balance allows.

const crons = cronJobs()

crons.cron('open the month', '5 0 1 * *', internal.jobs.openPeriods, {})
crons.cron('deliver the day', '0 6 * * *', internal.jobs.deliverAll, {})

export default crons
