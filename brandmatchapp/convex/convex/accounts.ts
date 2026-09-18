import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'

// Who is calling, and what they are allowed to know.
//
// One key per account. `byKey` is the only door, and it hands back the account
// document. Every client route projects that document field by field, so the
// fair use budget sitting on it never rides along by accident.

export const byKey = internalQuery({
  args: { key: v.string() },
  returns: v.any(),
  handler: async (ctx, { key }) => {
    if (!key) return null
    return await ctx.db.query('accounts').withIndex('by_key', (q) => q.eq('apiKey', key)).first()
  },
})

/** What a client account is allowed to see about itself. Nothing else. */
export function publicAccount(account: Doc<'accounts'>) {
  return {
    id: account._id,
    name: account.name,
    kind: account.kind,
    email: account.email,
    timezone: account.timezone,
  }
}

export const members = internalQuery({
  args: { accountId: v.id('accounts') },
  returns: v.any(),
  handler: async (ctx, { accountId }) => {
    const rows = await ctx.db.query('members').withIndex('by_account', (q) => q.eq('accountId', accountId)).collect()
    return rows.map((m) => ({ id: m._id, email: m.email, name: m.name, role: m.role }))
  },
})

export const subscription = internalQuery({
  args: { accountId: v.id('accounts') },
  returns: v.any(),
  handler: async (ctx, { accountId }) => {
    const sub = await ctx.db.query('subscriptions').withIndex('by_account', (q) => q.eq('accountId', accountId)).first()
    if (!sub) return null
    return {
      tier: sub.tier,
      priceCents: sub.priceCents,
      currency: sub.currency,
      status: sub.status,
      period: sub.period,
      periodStart: sub.periodStart,
      periodEnd: sub.periodEnd,
    }
  },
})

/**
 * The password door. A constant time compare, then the owner's key. The server
 * decides who the owner is, so a stolen screen cannot name one.
 */
export const ownerKeyFor = internalQuery({
  args: { password: v.string() },
  returns: v.any(),
  handler: async (ctx, { password }) => {
    const expected = process.env.ADMIN_PASSWORD
    if (!expected) return { error: 'No admin password is set on this deployment' }
    let same = password.length === expected.length
    for (let i = 0; i < Math.max(password.length, expected.length); i++) {
      if (password.charCodeAt(i) !== expected.charCodeAt(i)) same = false
    }
    if (!same) return { error: 'Wrong password' }
    const owner = await ctx.db.query('accounts').filter((q) => q.eq(q.field('role'), 'owner')).first()
    if (!owner) return { error: 'No owner account on this deployment' }
    return { key: owner.apiKey, email: owner.email }
  },
})

/** Creates an account with its first member and its plan. Used by ops and seed. */
export const create = internalMutation({
  args: {
    name: v.string(),
    kind: v.union(v.literal('brand'), v.literal('agency')),
    email: v.string(),
    timezone: v.optional(v.string()),
    tier: v.number(),
    priceCents: v.number(),
    role: v.optional(v.union(v.literal('owner'), v.literal('client'))),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const apiKey = randomKey()
    const accountId = await ctx.db.insert('accounts', {
      name: args.name,
      kind: args.kind,
      email: args.email,
      timezone: args.timezone ?? 'Europe/Paris',
      apiKey,
      role: args.role ?? 'client',
      // Fair use. Internal, and never quoted to the client.
      analysisBudgetPerDay: args.tier * 40,
      createdAt: now,
    })
    await ctx.db.insert('members', {
      accountId,
      email: args.email,
      name: args.email.split('@')[0],
      role: 'owner',
      createdAt: now,
    })
    const start = new Date(now)
    const periodStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
    const periodEnd = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)
    await ctx.db.insert('subscriptions', {
      accountId,
      tier: args.tier,
      priceCents: args.priceCents,
      currency: 'EUR',
      status: 'active',
      period: periodKey(now),
      periodStart,
      periodEnd,
      startedAt: now,
    })
    return { accountId, apiKey }
  },
})

/** "2026-09", the key every quota row is filed under. */
export function periodKey(at: number): string {
  const d = new Date(at)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function randomKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
