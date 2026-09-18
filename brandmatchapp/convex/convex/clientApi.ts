import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { publicAccount } from './accounts'
import { CORS, fail, json } from './httpUtil'

// The client surface, at /api.
//
// Rule one of the product lives here: no production cost, no analysed volume
// and no fair use figure ever leaves this file. Every response is assembled
// from the `public*` projections, never from a raw document, so a field added
// to a table upstream cannot ride along into a client screen.
//
// Anything internal is at /ops, in the file next door, behind the owner role.

async function accountFrom(ctx: any, req: Request) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!key) return null
  return await ctx.runQuery(internal.accounts.byKey, { key })
}

export const clientApi = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = new URL(req.url)
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const head = parts[0] ?? ''
  const q = url.searchParams

  try {
    // Public -----------------------------------------------------------------
    if (head === 'waitlist' && req.method === 'POST') {
      const { email, website, source } = await req.json()
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('A real email, please')
      await ctx.runMutation(internal.waitlist.join, { email, website, source })
      return json({ ok: true })
    }

    // The admin door. Public by necessity: whoever is outside has no key yet.
    if (head === 'admin-login' && req.method === 'POST') {
      const { password } = await req.json().catch(() => ({ password: '' }))
      const out = await ctx.runQuery(internal.accounts.ownerKeyFor, { password: String(password ?? '') })
      if (out.error) return fail(out.error, 401)
      return json(out)
    }

    // Everything below needs an account --------------------------------------
    const account = await accountFrom(ctx, req)
    if (!account) return fail('Send Authorization: Bearer <api key>', 401)

    if (head === 'me') {
      const [subscription, quota] = await Promise.all([
        ctx.runQuery(internal.accounts.subscription, { accountId: account._id }),
        ctx.runQuery(internal.quota.balance, { accountId: account._id }),
      ])
      return json({
        account: publicAccount(account),
        role: account.role,
        subscription,
        quota,
        members: await ctx.runQuery(internal.accounts.members, { accountId: account._id }),
      })
    }

    // Campaigns, and the three zones under them ------------------------------
    if (head === 'campaigns' && !parts[1] && req.method === 'GET') {
      return json({ campaigns: await ctx.runQuery(internal.campaigns.list, { accountId: account._id }) })
    }

    if (head === 'campaigns' && !parts[1] && req.method === 'POST') {
      const body = await req.json()
      const campaign = await ctx.runMutation(internal.campaigns.create, {
        accountId: account._id,
        name: body.name ?? 'New campaign',
        brief: body.brief ?? '',
        dailyCap: body.dailyCap,
      })
      return json({ campaign })
    }

    if (head === 'campaigns' && parts[1]) {
      const campaignId = parts[1] as Id<'campaigns'>
      const tail = parts[2] ?? ''

      if (!tail && req.method === 'GET') {
        const out = await ctx.runQuery(internal.campaigns.get, { accountId: account._id, campaignId })
        if (!out) return fail('No such campaign', 404)
        return json(out)
      }

      if (!tail && req.method === 'PATCH') {
        const body = (await req.json()) as Record<string, any>
        const campaign = await ctx.runMutation(internal.campaigns.patch, {
          accountId: account._id,
          campaignId,
          name: body.name,
          status: body.status,
          dailyCap: body.dailyCap,
          brief: body.brief,
          extracted: body.extracted,
        })
        if ('error' in campaign) return fail(campaign.error, 404)
        return json({ campaign })
      }

      // Zone 3 into zone 4: the brief becomes a first set of gates.
      if (tail === 'gates' && parts[3] === 'draft' && req.method === 'POST') {
        const { audience, offer } = await req.json()
        const out = await ctx.runAction(internal.drafting.gatesFromBrief, {
          accountId: account._id,
          campaignId,
          audience: String(audience ?? ''),
          offer: String(offer ?? ''),
        })
        if (out.error) return fail(String(out.error), 502)
        return json(out)
      }

      // Zone 4. An edit writes the next version, it never overwrites one.
      if (tail === 'gates' && req.method === 'POST') {
        const body = await req.json()
        const gates = await ctx.runMutation(internal.campaigns.saveGates, {
          accountId: account._id,
          campaignId,
          origin: 'edited',
          templateId: body.templateId,
          hard: body.hard ?? {},
          knockouts: body.knockouts ?? [],
          criteria: body.criteria ?? [],
          passScore: Number(body.passScore ?? 0),
          preset: body.preset,
          by: body.by,
          changes: Array.isArray(body.changes) ? body.changes.map(String) : undefined,
        })
        if ('error' in gates) return fail(gates.error, 404)
        return json({ gates })
      }

      // Zone 5. Survival per gate and the score spread. No cost, no volume.
      if (tail === 'feasibility' && req.method === 'POST') {
        const out = await ctx.runMutation(internal.feasibility.run, { accountId: account._id, campaignId })
        if ('error' in out) return fail(String(out.error), 400)
        const levers = await ctx.runQuery(internal.feasibility.levers, { accountId: account._id, campaignId })
        return json({ run: out, levers: levers.levers })
      }

      if (tail === 'feasibility' && req.method === 'GET') {
        const [run, levers] = await Promise.all([
          ctx.runQuery(internal.feasibility.latest, { campaignId }),
          ctx.runQuery(internal.feasibility.levers, { accountId: account._id, campaignId }),
        ])
        return json({ run, levers: levers.levers })
      }
    }

    // Zone 2, the daily list -------------------------------------------------
    if (head === 'leads' && !parts[1] && req.method === 'GET') {
      const leads = await ctx.runQuery(internal.leads.list, {
        accountId: account._id,
        campaignId: (q.get('campaign') as Id<'campaigns'>) ?? undefined,
        status: (q.get('status') as any) ?? undefined,
        limit: Math.min(Number(q.get('limit') ?? 200), 1000),
      })
      return json({ leads })
    }

    if (head === 'leads' && parts[1]) {
      const leadId = parts[1] as Id<'leads'>

      if (!parts[2] && req.method === 'GET') {
        const lead = await ctx.runQuery(internal.leads.get, { accountId: account._id, leadId })
        if (!lead) return fail('No such lead', 404)
        return json({ lead })
      }

      // The one click. A status and nothing else, and the event is appended.
      if (parts[2] === 'status' && req.method === 'POST') {
        const { status, note, by } = await req.json()
        const out = await ctx.runMutation(internal.leads.move, {
          accountId: account._id, leadId, status, note, by,
        })
        if (out.error) return fail(out.error, 404)
        return json(out)
      }

      if (parts[2] === 'deal' && req.method === 'POST') {
        const { amountCents, currency, note } = await req.json()
        const out = await ctx.runMutation(internal.leads.addDeal, {
          accountId: account._id, leadId, amountCents: Number(amountCents ?? 0), currency, note,
        })
        if (out.error) return fail(out.error, 404)
        return json(out)
      }
    }

    // Zone 1 -----------------------------------------------------------------
    if (head === 'overview' && req.method === 'GET') {
      const [overview, quota] = await Promise.all([
        ctx.runQuery(internal.leads.overview, { accountId: account._id, days: Number(q.get('days') ?? 30) }),
        ctx.runQuery(internal.quota.balance, { accountId: account._id }),
      ])
      return json({ ...overview, quota })
    }

    return fail(`No route for ${req.method} ${url.pathname}`, 404)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Something went wrong', 500)
  }
})
