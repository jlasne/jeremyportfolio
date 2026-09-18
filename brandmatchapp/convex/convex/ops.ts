import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { periodKey } from './accounts'

// Internal reads. Cost, analysed volume and fair use live here and nowhere
// else. Nothing in this file is reachable from /api: the only caller is the
// /ops router, which checks the owner role first.

export const overview = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const period = periodKey(Date.now())
    const today = new Date().toISOString().slice(0, 10)
    const accounts = await ctx.db.query('accounts').collect()
    const runs = await ctx.db.query('crawlRuns').collect()

    const rows = []
    let revenueCentsPerMonth = 0
    for (const account of accounts) {
      const sub = await ctx.db
        .query('subscriptions')
        .withIndex('by_account', (q) => q.eq('accountId', account._id))
        .first()
      const entries = await ctx.db
        .query('quotaEntries')
        .withIndex('by_account_period', (q) => q.eq('accountId', account._id).eq('period', period))
        .collect()
      const campaigns = await ctx.db
        .query('campaigns')
        .withIndex('by_account', (q) => q.eq('accountId', account._id))
        .collect()
      const ids = new Set(campaigns.map((c) => c._id as string))
      const mine = runs.filter((r) => r.campaignId && ids.has(r.campaignId as string))

      if (sub?.status === 'active') revenueCentsPerMonth += sub.priceCents
      rows.push({
        id: account._id,
        name: account.name,
        tier: sub?.tier ?? 0,
        priceCents: sub?.priceCents ?? 0,
        deliveredThisPeriod: entries.filter((e) => e.kind === 'delivery').length,
        analysedToday: mine
          .filter((r) => new Date(r.startedAt).toISOString().slice(0, 10) === today)
          .reduce((sum, r) => sum + r.profilesFetched, 0),
        analysisBudgetPerDay: account.analysisBudgetPerDay,
        costCentsThisPeriod: mine
          .filter((r) => periodKey(r.startedAt) === period)
          .reduce((sum, r) => sum + r.costCents, 0),
      })
    }

    const costCentsPerMonth = rows.reduce((sum, r) => sum + r.costCentsThisPeriod, 0)
    const leads = await ctx.db.query('leads').collect()
    return {
      accounts: rows,
      totals: {
        revenueCentsPerMonth,
        costCentsPerMonth,
        marginPct: revenueCentsPerMonth
          ? Math.round(((revenueCentsPerMonth - costCentsPerMonth) / revenueCentsPerMonth) * 100)
          : null,
        profilesAnalysedToday: rows.reduce((sum, r) => sum + r.analysedToday, 0),
        leadsDeliveredToday: leads.filter(
          (l) => new Date(l.deliveredAt).toISOString().slice(0, 10) === today,
        ).length,
      },
    }
  },
})

export const runs = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query('crawlRuns').order('desc').take(limit ?? 30)
    return rows.map((r) => ({
      id: r._id,
      campaignId: r.campaignId ?? null,
      phase: r.phase,
      status: r.status,
      profilesFetched: r.profilesFetched,
      profilesEvaluated: r.profilesEvaluated,
      qualified: r.qualified,
      costCents: r.costCents,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt ?? null,
    }))
  },
})

/** Fair use, moved by hand. Invisible to the client whose account it sits on. */
export const setBudget = internalMutation({
  args: { accountId: v.id('accounts'), analysisBudgetPerDay: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, { analysisBudgetPerDay: args.analysisBudgetPerDay })
    return null
  },
})

/** How much of today's fair use an account has spent. Read before a crawl. */
export const budgetLeft = internalQuery({
  args: { accountId: v.id('accounts') },
  returns: v.any(),
  handler: async (ctx, { accountId }) => {
    const account = await ctx.db.get(accountId)
    if (!account) return { left: 0 }
    const today = new Date().toISOString().slice(0, 10)
    const campaigns = await ctx.db.query('campaigns').withIndex('by_account', (q) => q.eq('accountId', accountId)).collect()
    const ids = new Set(campaigns.map((c) => c._id as string))
    const runs = await ctx.db.query('crawlRuns').collect()
    const spent = runs
      .filter((r) => r.campaignId && ids.has(r.campaignId as string))
      .filter((r) => new Date(r.startedAt).toISOString().slice(0, 10) === today)
      .reduce((sum, r) => sum + r.profilesFetched, 0)
    return { budget: account.analysisBudgetPerDay, spent, left: Math.max(0, account.analysisBudgetPerDay - spent) }
  },
})
