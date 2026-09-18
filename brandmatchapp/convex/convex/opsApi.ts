import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { CORS, fail, json } from './httpUtil'

// The internal surface, at /ops. Owner role only.
//
// This is the one place cost, analysed volume and fair use are readable. The
// client surface next door cannot reach any of it, which is what keeps rule
// one of the product true by construction rather than by care.

export const opsApi = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!key) return fail('Send Authorization: Bearer <api key>', 401)
  const account = await ctx.runQuery(internal.accounts.byKey, { key })
  if (!account || account.role !== 'owner') return fail('Not yours to read', 403)

  const url = new URL(req.url)
  const parts = url.pathname.replace(/^\/ops\/?/, '').split('/').filter(Boolean)
  const head = parts[0] ?? ''

  try {
    if (head === 'overview') return json(await ctx.runQuery(internal.ops.overview, {}))

    if (head === 'runs') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 30), 200)
      return json({ runs: await ctx.runQuery(internal.ops.runs, { limit }) })
    }

    if (head === 'budget' && req.method === 'POST') {
      const { accountId, analysisBudgetPerDay } = await req.json()
      await ctx.runMutation(internal.ops.setBudget, {
        accountId: accountId as Id<'accounts'>,
        analysisBudgetPerDay: Number(analysisBudgetPerDay ?? 0),
      })
      return json({ ok: true })
    }

    if (head === 'evaluate' && req.method === 'POST') {
      const { campaignId, limit } = await req.json()
      const out = await ctx.runAction(internal.evaluate.campaign, {
        campaignId: campaignId as Id<'campaigns'>,
        limit: limit ? Number(limit) : undefined,
      })
      return json(out)
    }

    if (head === 'deliver' && req.method === 'POST') {
      const { accountId, max } = await req.json()
      const out = await ctx.runMutation(internal.deliver.today, {
        accountId: accountId as Id<'accounts'>,
        max: max ? Number(max) : undefined,
      })
      return json(out)
    }

    return fail(`No route for ${req.method} ${url.pathname}`, 404)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Something went wrong', 500)
  }
})
