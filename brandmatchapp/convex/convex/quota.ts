import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { periodKey } from './accounts'

// The journal.
//
// `quotaEntries` is append only and is the truth. A month opens with one
// positive entitlement line of tier x days, every delivered lead writes one
// negative line, a top up writes another positive one. The balance is the sum,
// which is why an unused day is not lost: the month carries it.
//
// `quotaPeriods` is a cache of that sum. It can be thrown away and rebuilt.

export const balance = internalQuery({
  args: { accountId: v.id('accounts'), period: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const period = args.period ?? periodKey(Date.now())
    return await read(ctx, args.accountId, period)
  },
})

async function read(
  ctx: { db: { query: (t: 'quotaEntries') => any } },
  accountId: string,
  period: string,
) {
  const rows = await ctx.db
    .query('quotaEntries')
    .withIndex('by_account_period', (q: any) => q.eq('accountId', accountId).eq('period', period))
    .collect()
  let entitled = 0
  let delivered = 0
  let carried = 0
  for (const row of rows as { kind: string; delta: number }[]) {
    if (row.kind === 'delivery') delivered += -row.delta
    else if (row.kind === 'adjustment' && row.delta > 0) carried += row.delta
    else entitled += row.delta
  }
  return { period, entitled: entitled + carried, delivered, carried, remaining: entitled + carried - delivered }
}

/** Opens a month: one entitlement line, plus whatever last month left over. */
export const openPeriod = internalMutation({
  args: { accountId: v.id('accounts') },
  returns: v.any(),
  handler: async (ctx, { accountId }) => {
    const now = Date.now()
    const period = periodKey(now)
    const already = await ctx.db
      .query('quotaEntries')
      .withIndex('by_account_period', (q) => q.eq('accountId', accountId).eq('period', period))
      .first()
    if (already) return { period, opened: false }

    const sub = await ctx.db.query('subscriptions').withIndex('by_account', (q) => q.eq('accountId', accountId)).first()
    if (!sub) return { error: 'No subscription on this account' }
    const d = new Date(now)
    const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()

    await ctx.db.insert('quotaEntries', {
      accountId,
      period,
      kind: 'entitlement',
      delta: sub.tier * days,
      note: `Tier ${sub.tier} a day over ${days} days`,
      at: now,
    })
    return { period, opened: true, entitled: sub.tier * days }
  },
})

/** One delivered lead, one line. Called by deliver.ts and nowhere else. */
export const spend = internalMutation({
  args: { accountId: v.id('accounts'), campaignId: v.id('campaigns'), leadId: v.id('leads') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.insert('quotaEntries', {
      accountId: args.accountId,
      period: periodKey(now),
      kind: 'delivery',
      delta: -1,
      campaignId: args.campaignId,
      leadId: args.leadId,
      at: now,
    })
    return null
  },
})

export const addTopup = internalMutation({
  args: { accountId: v.id('accounts'), leads: v.number(), priceCents: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const topupId = await ctx.db.insert('topups', {
      accountId: args.accountId,
      leads: args.leads,
      priceCents: args.priceCents,
      currency: 'EUR',
      remaining: args.leads,
      purchasedAt: now,
    })
    await ctx.db.insert('quotaEntries', {
      accountId: args.accountId,
      period: periodKey(now),
      kind: 'topup',
      delta: args.leads,
      topupId,
      note: 'One off top up',
      at: now,
    })
    return { topupId }
  },
})

/** Rewrites the cached period row from the journal. Safe to run any time. */
export const recompute = internalMutation({
  args: { accountId: v.id('accounts'), period: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const period = args.period ?? periodKey(Date.now())
    const summed = await read(ctx, args.accountId, period)
    const existing = await ctx.db
      .query('quotaPeriods')
      .withIndex('by_account_period', (q) => q.eq('accountId', args.accountId).eq('period', period))
      .first()
    const row = { ...summed, accountId: args.accountId, computedAt: Date.now() }
    if (existing) await ctx.db.patch(existing._id, row)
    else await ctx.db.insert('quotaPeriods', row)
    return summed
  },
})
