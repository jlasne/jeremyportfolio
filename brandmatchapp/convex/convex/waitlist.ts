import { internalMutation } from './_generated/server'
import { v } from 'convex/values'

/** The landing's one write. Public, so it takes an email and nothing else. */
export const join = internalMutation({
  args: { email: v.string(), website: v.optional(v.string()), source: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const already = await ctx.db.query('waitlist').withIndex('by_email', (q) => q.eq('email', args.email)).first()
    if (already) return null
    await ctx.db.insert('waitlist', { email: args.email, website: args.website, source: args.source ?? 'landing' })
    return null
  },
})
