import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// What the crons call. Kept apart from the schedule so either can be run by
// hand from the dashboard without waiting for a clock.

export const openPeriods = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx): Promise<Record<string, unknown>> => {
    const accounts = await ctx.runQuery(internal.deliver.activeAccounts, {})
    let opened = 0
    for (const account of accounts as { accountId: any }[]) {
      const out = await ctx.runMutation(internal.quota.openPeriod, { accountId: account.accountId })
      if (out.opened) opened++
    }
    return { accounts: (accounts as unknown[]).length, opened }
  },
})

export const deliverAll = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx): Promise<Record<string, unknown>> => {
    const accounts = await ctx.runQuery(internal.deliver.activeAccounts, {})
    let delivered = 0
    for (const account of accounts as { accountId: any }[]) {
      const out = await ctx.runMutation(internal.deliver.today, { accountId: account.accountId })
      delivered += Number(out.delivered ?? 0)
    }
    return { accounts: (accounts as unknown[]).length, delivered }
  },
})
