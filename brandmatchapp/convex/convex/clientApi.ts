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
      // The brief is two answers and an optional list of handles. The app
      // sends them flat; an older caller may still send them under `brief`.
      const raw = typeof body.brief === 'object' && body.brief ? body.brief : body
      const seeds = Array.isArray(raw.seeds) ? raw.seeds.map((h: unknown) => String(h).replace(/^@/, '').trim().toLowerCase()).filter(Boolean) : undefined
      const brief = {
        audience: String(raw.audience ?? '').slice(0, 2000),
        offer: String(raw.offer ?? '').slice(0, 2000),
        ...(seeds?.length ? { seeds } : {}),
      }
      if (!brief.audience || !brief.offer) return fail('Say who you want to reach and what you sell them', 400)
      const campaign = await ctx.runMutation(internal.campaigns.create, {
        accountId: account._id,
        name: String(body.name ?? 'New campaign').slice(0, 80),
        brief,
        dailyCap: body.dailyCap !== undefined ? Number(body.dailyCap) : undefined,
      })
      // Too few named accounts is the caller's mistake, so it comes back as
      // one rather than as a campaign object carrying an error inside it.
      if (campaign && 'error' in campaign) return fail(String(campaign.error), 400)
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
          niches: body.niches,
        })
        if ('error' in campaign) return fail(campaign.error, 404)
        return json({ campaign })
      }

      // Zone 3 into zone 4: the brief becomes a first set of gates.
      //
      // The model reads a brief and writes a whole rule set, which takes it
      // over a minute. Held inside this request it outlives the connection
      // and the browser is told the draft failed while the server is still
      // writing it. So it is scheduled, and the caller watches the campaign
      // until its rules appear.
      if (tail === 'gates' && parts[3] === 'draft' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}))
        // The campaign already holds the brief, so a caller that sends none
        // is asking us to draft from what it wrote when it was created, not
        // from nothing. Sending nothing used to draft from nothing: the model
        // met the schema with placeholder niches named default_1 to
        // default_5 and a set of fitness coaching sentences, on a brief about
        // food. Nothing said it had happened.
        const held = await ctx.runQuery(internal.campaigns.get, { accountId: account._id, campaignId })
        const brief = (held as { campaign?: { brief?: { audience?: string; offer?: string } } })?.campaign?.brief
        const audience = String(body.audience ?? '').trim() || String(brief?.audience ?? '').trim()
        const offer = String(body.offer ?? '').trim() || String(brief?.offer ?? '').trim()
        if (!audience || !offer) {
          return fail('Say who you want to reach and what you sell them before asking for rules', 400)
        }
        await ctx.scheduler.runAfter(0, internal.drafting.gatesFromBrief, {
          accountId: account._id, campaignId, audience, offer,
        })
        return json({ drafting: true })
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
          either: body.either,
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

    // The client's own labels. Theirs to read and write, ours to store.
    if (head === 'tags' && req.method === 'GET') {
      return json({ tags: await ctx.runQuery(internal.leads.tags, { accountId: account._id }) })
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
        const { status, note, by, lostReason } = await req.json()
        const out = await ctx.runMutation(internal.leads.move, {
          accountId: account._id, leadId, status, note, by, lostReason,
        })
        if (out.error) return fail(out.error, 404)
        return json(out)
      }

      // One click back out of the last change.
      if (parts[2] === 'undo' && req.method === 'POST') {
        const out = await ctx.runMutation(internal.leads.undo, { accountId: account._id, leadId })
        if ('error' in out) return fail(String(out.error), 404)
        return json(out)
      }

      // Add and remove in one call: a model retagging a list sends one
      // request a lead, not two.
      if (parts[2] === 'tags' && req.method === 'POST') {
        const body = await req.json()
        const list = (x: unknown) => (Array.isArray(x) ? x.map(String) : typeof x === 'string' ? [x] : undefined)
        const out = await ctx.runMutation(internal.leads.tag, {
          accountId: account._id, leadId, add: list(body.add), remove: list(body.remove),
        })
        if ('error' in out) return fail(String(out.error), 404)
        return json(out)
      }

      if (parts[2] === 'mark' && req.method === 'POST') {
        const { saved, note } = await req.json()
        const out = await ctx.runMutation(internal.leads.mark, {
          accountId: account._id,
          leadId,
          saved: typeof saved === 'boolean' ? saved : undefined,
          note: typeof note === 'string' ? note : undefined,
        })
        if ('error' in out) return fail(String(out.error), 404)
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
