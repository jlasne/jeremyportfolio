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

    // Each campaign as the operator reads it. Evaluations are read whole and
    // filtered to thirty days; at this size that is cheaper than an index
    // nobody else needs, and the day it stops being true is the day to add one.
    const since = Date.now() - 30 * 86_400_000
    const evaluations = (await ctx.db.query('evaluations').collect()).filter((e) => e.evaluatedAt >= since)
    const allCampaigns = await ctx.db.query('campaigns').collect()
    const byAccount = new Map(accounts.map((a) => [a._id as string, a]))
    // One read per profile, not one per evaluation.
    const creatorCache = new Map<string, any>()
    const creatorOf = async (id: any) => {
      const key = String(id)
      if (!creatorCache.has(key)) creatorCache.set(key, await ctx.db.get(id))
      return creatorCache.get(key)
    }
    const campaignRows = []
    for (const c of allCampaigns) {
      const mine = evaluations.filter((e) => e.campaignId === c._id)
      const sub = rows.find((r) => r.id === c.accountId)
      const qualified = mine.filter((e) => e.verdict === 'qualified').length
      const delivered = leads.filter((l) => l.campaignId === c._id).length
      const costCents = runs
        .filter((r) => r.campaignId === c._id && r.startedAt >= since)
        .reduce((sum, r) => sum + r.costCents, 0)
      const perDay = c.dailyCap ?? sub?.tier ?? 0
      const held = Math.max(0, qualified - delivered)

      // Each way of searching, on its own line: what it cost and what came
      // through. This is the number the sourcing work is steered by, and the
      // only place it exists.
      const byChannel = new Map<string, { analysed: number; passedSize: number; passedNiche: number; qualified: number; costCents: number }>()
      const line = (key: string) => {
        if (!byChannel.has(key)) byChannel.set(key, { analysed: 0, passedSize: 0, passedNiche: 0, qualified: 0, costCents: 0 })
        return byChannel.get(key)!
      }
      for (const e of mine) {
        const creator = await creatorOf(e.creatorId)
        const row = line(creator?.foundVia?.channel ?? 'search')
        row.analysed++
        if (e.verdict !== 'hard_fail') row.passedSize++
        if (e.verdict !== 'hard_fail' && e.verdict !== 'off_niche') row.passedNiche++
        if (e.verdict === 'qualified') row.qualified++
      }
      for (const r of runs.filter((r) => r.campaignId === c._id && r.startedAt >= since)) {
        line(r.channel ?? 'search').costCents += r.costCents
      }
      const channels = [...byChannel.entries()].map(([channel, r]) => ({
        channel, ...r, costPerQualifiedCents: r.qualified ? Math.round(r.costCents / r.qualified) : null,
      })).sort((a, b) => b.analysed - a.analysed)

      campaignRows.push({
        id: c._id,
        name: c.name,
        account: byAccount.get(c.accountId as string)?.name ?? '',
        status: c.status,
        perDay,
        analysed: mine.length,
        passedSize: mine.filter((e) => e.verdict !== 'hard_fail').length,
        passedNiche: mine.filter((e) => e.verdict !== 'hard_fail' && e.verdict !== 'off_niche').length,
        passedBreakers: mine.filter((e) => e.verdict === 'qualified' || e.verdict === 'below_threshold').length,
        qualified,
        delivered,
        costCents,
        costPerQualifiedCents: qualified ? Math.round(costCents / qualified) : null,
        held,
        daysHeld: perDay ? Math.floor(held / perDay) : null,
        channels,
      })
    }

    const days = []
    for (let back = 13; back >= 0; back--) {
      const date = new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10)
      const mine = runs.filter((r) => new Date(r.startedAt).toISOString().slice(0, 10) === date)
      days.push({
        date,
        analysed: mine.reduce((sum, r) => sum + r.profilesFetched, 0),
        qualified: mine.reduce((sum, r) => sum + r.qualified, 0),
        costCents: mine.reduce((sum, r) => sum + r.costCents, 0),
      })
    }

    return {
      campaigns: campaignRows,
      days,
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
