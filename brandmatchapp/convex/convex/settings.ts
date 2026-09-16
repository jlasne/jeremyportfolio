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
  /** A lead handed to a brand is that brand's. A hundred years is forever. */
  claimDays: 36500,
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

/** The owner turns a knob. Every field is optional; only what is sent moves. */
export const set = internalMutation({
  args: {
    freshFloor: v.optional(v.number()),
    includedPerDay: v.optional(v.number()),
    claimDays: v.optional(v.number()),
    trialDays: v.optional(v.number()),
    trialCredits: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const patch: Record<string, number> = {}
    if (args.freshFloor !== undefined) patch.freshFloor = Math.min(Math.max(args.freshFloor, 0), 1)
    if (args.includedPerDay !== undefined) patch.includedPerDay = Math.max(Math.round(args.includedPerDay), 0)
    if (args.claimDays !== undefined) patch.claimDays = Math.max(Math.round(args.claimDays), 1)
    if (args.trialDays !== undefined) patch.trialDays = Math.max(Math.round(args.trialDays), 0)
    if (args.trialCredits !== undefined) patch.trialCredits = Math.max(Math.round(args.trialCredits), 0)

    const row = await ctx.db.query('settings').withIndex('by_key', (q) => q.eq('key', 'main')).first()
    if (row) await ctx.db.patch(row._id, patch)
    else await ctx.db.insert('settings', { key: 'main', ...DEFAULTS, ...patch })
    return await readSettings(ctx)
  },
})
