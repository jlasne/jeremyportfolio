import { internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { readSettings } from './settings'
import { DAY } from './scoring'

// The owner's view. What every account is asking for, what it got today, and
// what the fresh share does to the Apify bill and to the pool.
//
// Two numbers frame the recommendation:
//
//   floor    the fresh share at which the pool lasts 90 days. A lead handed
//            over is gone from the pool for good, so the pool is a stock, and
//            what is not crawled fresh is drawn from it. Under the floor it
//            empties inside a quarter.
//   ceiling  above this share, Apify eats more than 30% of revenue. A crawl
//            nets about two thirds of what it fetches, at $0.0023 a profile.

const POOL_HORIZON_DAYS = 90
const APIFY_PER_PROFILE = 0.0023
const FETCH_PER_LEAD = 1.5
const SCORE_PER_LEAD = 0.000011
const PRICE_PER_MONTH = 99
const COST_SHARE_CAP = 0.30

export const overview = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const settings = await readSettings(ctx)
    const now = Date.now()
    const midnight = new Date().setHours(0, 0, 0, 0)

    // The pool: how much of it is free right now.
    let poolSize = 0
    let poolFree = 0
    for await (const c of ctx.db.query('creators')) {
      poolSize++
      if (!c.claimedUntil || c.claimedUntil <= now) poolFree++
    }

    // Every account, what it asks for, what it got today.
    const brands = await ctx.db.query('brands').collect()
    const waitlist = await ctx.db.query('waitlist').collect()
    const accounts = []
    let paidDemand = 0
    let paidCount = 0

    for (const b of brands) {
      const campaigns = await ctx.db.query('campaigns').withIndex('by_brand', (q) => q.eq('brandId', b._id)).collect()
      let quota = 0
      for (const c of campaigns) {
        if (!c.active) continue
        const agents = await ctx.db.query('agents').withIndex('by_campaign', (q) => q.eq('campaignId', c._id)).collect()
        for (const a of agents) if (a.status === 'active') quota += a.leadsPerDay
      }

      let today = 0
      let freshToday = 0
      for await (const d of ctx.db.query('discoveries').withIndex('by_brand', (q) => q.eq('brandId', b._id)).order('desc')) {
        if (d.discoveredAt < midnight) break
        today++
        if (d.fresh) freshToday++
      }

      const paid = b.plan === 'paid'
      if (paid) { paidDemand += quota; paidCount++ }

      accounts.push({
        id: b._id,
        email: b.email,
        plan: b.plan ?? 'trial',
        role: b.role ?? 'brand',
        credits: b.credits,
        trialDaysLeft: b.plan === 'trial' && b.trialEndsAt ? Math.max(Math.ceil((b.trialEndsAt - now) / DAY), 0) : 0,
        quota,
        today,
        freshToday,
        poolToday: today - freshToday,
        // What this account costs at the current fresh share, a day.
        costPerDay: paid ? quota * settings.freshFloor * FETCH_PER_LEAD * APIFY_PER_PROFILE + quota * SCORE_PER_LEAD : quota * SCORE_PER_LEAD,
      })
    }

    // The recommendation.
    const fresh = settings.freshFloor
    const drawPerDay = paidDemand * (1 - fresh)
    const poolDaysLeft = drawPerDay > 0 ? Math.floor(poolFree / drawPerDay) : null
    const floor = paidDemand > 0 ? Math.min(1, Math.max(0, 1 - poolFree / (paidDemand * POOL_HORIZON_DAYS))) : 0
    const revenuePerDay = (paidCount * PRICE_PER_MONTH) / 30
    const apifyPerFreshLead = FETCH_PER_LEAD * APIFY_PER_PROFILE
    const ceiling = paidDemand > 0
      ? Math.min(1, (COST_SHARE_CAP * revenuePerDay) / (paidDemand * apifyPerFreshLead))
      : 1

    const apifyPerDay = paidDemand * fresh * apifyPerFreshLead
    const scoringPerDay = paidDemand * SCORE_PER_LEAD

    return {
      settings,
      pool: { size: poolSize, free: poolFree, daysLeft: poolDaysLeft, horizonDays: POOL_HORIZON_DAYS },
      demand: { paidAccounts: paidCount, leadsPerDay: paidDemand },
      recommendation: {
        floor: Math.round(floor * 100) / 100,
        ceiling: Math.round(ceiling * 100) / 100,
        current: fresh,
        // Where the current setting sits: under the floor the pool is spent
        // inside the horizon, over the ceiling the margin is.
        verdict: fresh < floor ? 'pool runs dry' : fresh > ceiling ? 'margin too thin' : 'in range',
      },
      cost: {
        apifyPerDay: Math.round(apifyPerDay * 100) / 100,
        scoringPerDay: Math.round(scoringPerDay * 1000) / 1000,
        perMonth: Math.round((apifyPerDay + scoringPerDay) * 30 * 100) / 100,
        revenuePerMonth: paidCount * PRICE_PER_MONTH,
        marginPct: paidCount > 0
          ? Math.round((1 - ((apifyPerDay + scoringPerDay) * 30) / (paidCount * PRICE_PER_MONTH)) * 100)
          : null,
      },
      accounts: accounts.sort((a, b) => b.quota - a.quota),
      // Who asked to be let in, newest first. The landing writes here and
      // nothing else reads it, so this page is where it is answered.
      waitlist: {
        total: waitlist.length,
        recent: waitlist.slice(-40).reverse().map((w) => ({
          email: w.email,
          website: w.website ?? '',
          source: w.source ?? 'landing',
          at: w._creationTime,
        })),
      },
    }
  },
})
