import { internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx } from './_generated/server'

// The knobs, and their defaults. Edit the `settings` row keyed `main` in the
// dashboard and the next night's crawl reads the new value. No deploy.

export const DEFAULTS = {
  /** At least this share of every brand's daily quota is crawled fresh. */
  freshFloor: 0.3,
  /** What the $99 plan covers, a day. */
  includedPerDay: 500,
  claimDays: 14,
  trialDays: 3,
  trialCredits: 750,
}

export type Settings = typeof DEFAULTS

export async function readSettings(ctx: QueryCtx): Promise<Settings> {
  const row = await ctx.db.query('settings').withIndex('by_key', (q) => q.eq('key', 'main')).first()
  return {
    freshFloor: row?.freshFloor ?? DEFAULTS.freshFloor,
    includedPerDay: row?.includedPerDay ?? DEFAULTS.includedPerDay,
    claimDays: row?.claimDays ?? DEFAULTS.claimDays,
    trialDays: row?.trialDays ?? DEFAULTS.trialDays,
    trialCredits: row?.trialCredits ?? DEFAULTS.trialCredits,
  }
}

export const get = internalQuery({
  args: {},
  returns: v.any(),
  handler: (ctx) => readSettings(ctx),
})

/** Writes the row the dashboard edits, so it exists to be edited. */
export const init = internalMutation({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const row = await ctx.db.query('settings').withIndex('by_key', (q) => q.eq('key', 'main')).first()
    if (row) return row
    const id = await ctx.db.insert('settings', { key: 'main', ...DEFAULTS })
    return await ctx.db.get(id)
  },
})
