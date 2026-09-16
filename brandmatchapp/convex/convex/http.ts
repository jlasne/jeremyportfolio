import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { mcp } from './mcp'

// Everything that speaks HTTP: the one API, the Apify callback, and MCP.
//
// The brand api key is the only credential. A brand reaches only the leads
// attributed to it, on every route, so a handle another brand holds is not
// merely hidden, it is unreachable.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-crawl-secret',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const fail = (message: string, status = 400) => json({ error: message }, status)

async function brandFrom(ctx: any, req: Request) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!key) return null
  return await ctx.runQuery(internal.brands.byKey, { key })
}

const http = httpRouter()

http.route({
  path: '/api',
  method: 'OPTIONS',
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
})

// The one API --------------------------------------------------------------

const api = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = new URL(req.url)
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const head = parts[0] ?? ''
  const q = url.searchParams

  try {
    // Public ---------------------------------------------------------------
    if (head === 'waitlist' && req.method === 'POST') {
      const { email, website, source } = await req.json()
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('A real email, please')
      await ctx.runMutation(internal.brands.joinWaitlist, { email, website, source })
      return json({ ok: true })
    }

    // Everything below needs a brand ---------------------------------------
    const brand = await brandFrom(ctx, req)
    if (!brand) return fail('Send Authorization: Bearer <api key>', 401)

    if (head === 'me') {
      const me = await ctx.runQuery(internal.brands.me, { brandId: brand._id })
      return json(me)
    }

    if (head === 'contacts' && req.method === 'GET') {
      const out = await ctx.runQuery(internal.leads.feed, {
        brandId: brand._id,
        campaignId: (q.get('campaign') as Id<'campaigns'>) ?? undefined,
        scope: q.get('scope') ?? 'all',
        limit: Math.min(Number(q.get('limit') ?? 60), 500),
        offset: Number(q.get('offset') ?? 0),
      })
      return json({ contacts: out.rows, counts: out.counts })
    }

    if (head === 'creators' && parts[1]) {
      const out = await ctx.runQuery(internal.leads.detail, {
        brandId: brand._id, creatorId: parts[1] as Id<'creators'>,
      })
      if (!out) return fail('No such creator', 404)
      return json(out)
    }

    if (head === 'campaigns' && req.method === 'GET') {
      const campaigns = await ctx.runQuery(internal.brands.listCampaigns, { brandId: brand._id })
      return json({ campaigns })
    }

    if (head === 'campaigns' && req.method === 'POST' && !parts[1]) {
      const body = await req.json()
      const campaign: Doc<'campaigns'> | null = await ctx.runMutation(internal.brands.createCampaign, {
        brandId: brand._id,
        name: body.name ?? 'New campaign',
        website: body.website,
        brief: body.brief,
        filters: body.filters,
        leadsPerDay: body.leadsPerDay,
      })
      if (!campaign) return fail('Could not create the campaign', 500)
      // Free to us, one credit to them: the pool hands over what nobody holds.
      const seeded = await ctx.runMutation(internal.pool.seedFromPool, {
        campaignId: campaign._id, limit: body.seed ?? 400,
      })
      return json({ campaign, seededFromPool: seeded })
    }

    if (head === 'campaigns' && parts[1] && req.method === 'PATCH') {
      const patch = await req.json()
      const campaign = await ctx.runMutation(internal.brands.patchCampaign, {
        brandId: brand._id, campaignId: parts[1] as Id<'campaigns'>, patch,
      })
      if (!campaign) return fail('No such campaign', 404)
      return json({ campaign })
    }

    if (head === 'campaigns' && parts[1] && parts[2] === 'agents' && req.method === 'POST') {
      const body = await req.json()
      const agent = await ctx.runMutation(internal.brands.addAgent, {
        brandId: brand._id,
        campaignId: parts[1] as Id<'campaigns'>,
        name: body.name ?? 'New agent',
        focus: body.focus,
        hashtags: body.hashtags,
        keywords: body.keywords,
        leadsPerDay: body.leadsPerDay,
        status: body.status,
      })
      if (!agent) return fail('No such campaign', 404)
      return json({ agent })
    }

    // The model proposes, a human approves. Nothing here spends a credit.
    if (head === 'campaigns' && parts[1] && parts[2] === 'propose' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const owned = await ctx.runQuery(internal.propose.campaign, { campaignId: parts[1] as Id<'campaigns'> })
      if (!owned || owned.brandId !== brand._id) return fail('No such campaign', 404)
      const out: Record<string, unknown> = await ctx.runAction(internal.propose.forCampaign, {
        campaignId: parts[1] as Id<'campaigns'>, website: body.website,
      })
      return json(out, out?.error ? 502 : 200)
    }

    if (head === 'agents' && parts[1] && req.method !== 'GET') {
      const agentId = parts[1] as Id<'agents'>
      if (req.method === 'DELETE') {
        const ok = await ctx.runMutation(internal.brands.removeAgent, { brandId: brand._id, agentId })
        return ok ? json({ ok: true }) : fail('No such agent', 404)
      }
      const body = await req.json().catch(() => ({}))
      const status = parts[2] === 'approve' ? 'active' : parts[2] === 'pause' ? 'paused' : null
      if (!status) return fail(`No route for /agents/${parts[1]}/${parts[2] ?? ''}`, 404)
      const agent = await ctx.runMutation(internal.brands.setAgentStatus, {
        brandId: brand._id, agentId, status,
        leadsPerDay: body.leadsPerDay, hashtags: body.hashtags,
      })
      if (!agent) return fail('No such agent', 404)
      return json({ agent })
    }

    if (head === 'campaigns' && parts[1] && parts[2] === 'run' && req.method === 'POST') {
      const owned: Doc<'campaigns'> | null =
        await ctx.runQuery(internal.propose.campaign, { campaignId: parts[1] as Id<'campaigns'> })
      if (!owned || owned.brandId !== brand._id) return fail('No such campaign', 404)
      // One credit, one lead. No credits, nothing to deliver.
      if (brand.credits <= 0) return fail('No credits left. Top up to take more leads.', 402)
      // A trial reads the pool. Crawling is what a plan pays for.
      if (brand.plan !== 'paid') {
        return fail('Your trial reads the shared pool. Start a plan to crawl for new ones.', 402)
      }
      const out = await ctx.runAction(internal.crawl.run, { campaignId: parts[1] as Id<'campaigns'> })
      return json(out)
    }

    // The owner's screen. Everyone else gets a 404, not a hint.
    if (head === 'admin') {
      if (brand.role !== 'owner') return fail(`No route for /${parts.join('/')}`, 404)
      if (parts[1] === 'settings' && req.method === 'POST') {
        const body = await req.json()
        const settings = await ctx.runMutation(internal.settings.set, {
          freshFloor: body.freshFloor, includedPerDay: body.includedPerDay,
          claimDays: body.claimDays, trialDays: body.trialDays, trialCredits: body.trialCredits,
        })
        return json({ settings })
      }
      const overview = await ctx.runQuery(internal.admin.overview, {})
      return json(overview)
    }

    if (head === 'stats') {
      const daily = await ctx.runQuery(internal.brands.stats, {
        brandId: brand._id, days: Math.min(Number(q.get('days') ?? 30), 180),
      })
      return json({ daily })
    }

    if (head === 'actions' && req.method === 'POST') {
      const { creatorId, action, value } = await req.json()
      if (!creatorId || !action) return fail('creatorId and action are required')
      const ok = await ctx.runMutation(internal.leads.mark, {
        brandId: brand._id, creatorId: creatorId as Id<'creators'>, action, value,
      })
      return ok ? json({ ok: true }) : fail('No such creator', 404)
    }

    return fail(`No route for /${parts.join('/')}`, 404)
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500)
  }
})

http.route({ path: '/api', method: 'GET', handler: api })
http.route({ path: '/api', method: 'POST', handler: api })
http.route({ pathPrefix: '/api/', method: 'GET', handler: api })
http.route({ pathPrefix: '/api/', method: 'POST', handler: api })
http.route({ pathPrefix: '/api/', method: 'PATCH', handler: api })
http.route({ pathPrefix: '/api/', method: 'DELETE', handler: api })
http.route({ pathPrefix: '/api/', method: 'OPTIONS', handler: api })

// Apify calls back here when a run ends -------------------------------------

http.route({
  path: '/apify',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.CRAWL_SECRET
    if (!secret || req.headers.get('x-crawl-secret') !== secret) return fail('Bad secret', 401)
    const body = await req.json()
    const out = await ctx.runAction(internal.ingest.fromApify, {
      runId: String(body.runId ?? ''),
      status: String(body.status ?? ''),
      datasetId: body.datasetId ? String(body.datasetId) : undefined,
      phase: String(body.phase ?? 'search'),
      campaignId: body.campaignId as Id<'campaigns'>,
      agentId: body.agentId ? (body.agentId as Id<'agents'>) : undefined,
    })
    return json(out)
  }),
})

// The same leads and the same writes, spoken as MCP.
http.route({ path: '/mcp', method: 'POST', handler: mcp })
http.route({ path: '/mcp', method: 'OPTIONS', handler: mcp })

export default http
