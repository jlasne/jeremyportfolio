import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

// brandmatch over MCP, so the AI you already pay for can work the list.
//
// JSON-RPC 2.0 on one POST endpoint. Point Claude, Cursor or an IDE at
// https://<deployment>.convex.site/mcp with the brand key as a bearer token,
// and ask in words: who fired a signal this week, tag the three star ones.
//
// Same key and same rules as the REST API: a brand reaches only the leads
// attributed to it, and a write is refused on a handle it does not hold.

const PROTOCOL = '2024-11-05'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RpcId = string | number | null | undefined

const reply = (id: RpcId, result: unknown) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const rpcError = (id: RpcId, code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** MCP wants tool output as content blocks, so everything lands as text. */
const text = (value: unknown) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

const TOOLS = [
  {
    name: 'list_leads',
    description:
      "This morning's leads for the brand, ranked best first. Three stars: fits the niche, sells something of their own, fired a brand signal recently. Filters narrow it, they never change a score.",
    inputSchema: {
      type: 'object',
      properties: {
        campaign: { type: 'string', description: 'Campaign id. Omit for every campaign.' },
        min_stars: { type: 'number', description: 'Only leads at or above this score, 0 to 3.' },
        with_email: { type: 'boolean', description: 'Only leads carrying a contact.' },
        signal_within_days: { type: 'number', description: 'Only leads whose last brand signal is this fresh.' },
        limit: { type: 'number', description: 'How many rows, up to 200. Defaults to 40.' },
      },
    },
  },
  {
    name: 'get_lead',
    description: 'One creator in full: the profile, the last 12 posts with their views, every dated signal, and why it scores what it scores.',
    inputSchema: { type: 'object', required: ['creator_id'], properties: { creator_id: { type: 'string' } } },
  },
  {
    name: 'classify_lead',
    description: 'Mark a lead as dealt with (done), tag it, note it, or reject it. The app is the CRM, so a write here shows in the list straight away. Use done once you have written to them.',
    inputSchema: {
      type: 'object',
      required: ['creator_id', 'action'],
      properties: {
        creator_id: { type: 'string' },
        action: { type: 'string', enum: ['tag', 'untag', 'note', 'done', 'undone', 'reject', 'unreject'] },
        value: { type: 'string', description: 'The tag, or the note text. Ignored by the others.' },
      },
    },
  },
  {
    name: 'list_campaigns',
    description: 'Every campaign the brand runs, with its brief, its filters, its daily volume and its agents. An agent marked proposed is waiting on a human.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_campaign',
    description: 'Start a campaign for the brand: a name, the website, one sentence on who to look for. It is seeded from the shared pool at once, one credit a lead, before any agent runs.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        website: { type: 'string' },
        who: { type: 'string', description: 'One sentence: who the brand wants to reach.' },
        leads_per_day: { type: 'number', description: 'Daily volume. Defaults to 250.' },
        seed: { type: 'number', description: 'How many to take from the pool now. Defaults to 200.' },
      },
    },
  },
  {
    name: 'create_agent',
    description: 'Add a searcher to a campaign with its own hashtags and daily share. It lands as proposed and spends nothing until approved.',
    inputSchema: {
      type: 'object',
      required: ['campaign_id', 'name', 'hashtags'],
      properties: {
        campaign_id: { type: 'string' },
        name: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Without the # sign.' },
        leads_per_day: { type: 'number', description: 'Defaults to 80.' },
      },
    },
  },
  {
    name: 'approve_agent',
    description: 'Turn a proposed or paused agent on. It runs tonight and starts spending credits.',
    inputSchema: { type: 'object', required: ['agent_id'], properties: { agent_id: { type: 'string' }, leads_per_day: { type: 'number' } } },
  },
  {
    name: 'pause_agent',
    description: 'Stop an agent without deleting it. Nothing it found is lost.',
    inputSchema: { type: 'object', required: ['agent_id'], properties: { agent_id: { type: 'string' } } },
  },
  {
    name: 'account',
    description: 'Credits left and how much of the shared pool is still free to this brand. One credit buys one lead.',
    inputSchema: { type: 'object', properties: {} },
  },
]

export const mcp = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return rpcError(null, -32600, 'POST a JSON-RPC request')

  let rpc: { id?: RpcId; method?: string; params?: Record<string, unknown> }
  try {
    rpc = await req.json()
  } catch {
    return rpcError(null, -32700, 'That is not JSON')
  }
  const { id, method, params = {} } = rpc

  // Handshake and discovery need no key: a client lists before it authenticates.
  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: 'brandmatch', version: '1.0.0' },
      instructions:
        'Leads are scored 0 to 3 stars in half steps: niche fit, selling something of their own, a dated brand signal. Sorted best first. Every lead here belongs to this brand alone for 14 days.',
    })
  }
  if (method === 'notifications/initialized') return new Response(null, { status: 202, headers: CORS })
  if (method === 'tools/list') return reply(id, { tools: TOOLS })
  if (method === 'ping') return reply(id, {})
  if (method !== 'tools/call') return rpcError(id, -32601, `Unknown method ${method}`)

  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const brand = key ? await ctx.runQuery(internal.brands.byKey, { key }) : null
  if (!brand) return rpcError(id, -32001, 'Send your brandmatch key as a bearer token')

  const name = String(params.name ?? '')
  const args = (params.arguments ?? {}) as Record<string, unknown>

  try {
    if (name === 'account') {
      const me = await ctx.runQuery(internal.brands.me, { brandId: brand._id })
      if (!me) return rpcError(id, -32001, 'No such brand')
      return reply(id, text({
        credits_left: me.credits,
        still_free_to_you: me.availableToYou,
        note: 'One credit buys one lead, whether it came from the pool or a fresh crawl.',
      }))
    }

    if (name === 'list_leads') {
      const out = await ctx.runQuery(internal.leads.feed, {
        brandId: brand._id,
        campaignId: (args.campaign as Id<'campaigns'>) ?? undefined,
        scope: 'open',
        limit: Math.min(Number(args.limit ?? 40), 200),
      })
      const minStars = Number(args.min_stars ?? 0)
      const within = args.signal_within_days ? Number(args.signal_within_days) : null
      const now = Date.now()

      const leads = out.rows
        .filter((r: any) => r.stars >= minStars)
        .filter((r: any) => (args.with_email ? Boolean(r.email) : true))
        .filter((r: any) => {
          if (within === null) return true
          if (!r.signals?.length) return false
          const newest = Date.parse(r.signals[0].date)
          return !Number.isNaN(newest) && (now - newest) / 86_400_000 <= within
        })
        .map((r: any) => ({
          creator_id: r.id,
          handle: `@${r.handle}`,
          name: r.name,
          stars: r.stars,
          why: [r.nicheWhy, r.signals?.[0]?.label].filter(Boolean).join('. '),
          followers: r.followers,
          median_reel_views: r.medianReelViews,
          email: r.email,
          sells: r.sells,
          last_signal: r.signals?.[0] ?? null,
          campaign: r.campaignName,
        }))

      return reply(id, text({ count: leads.length, leads }))
    }

    if (name === 'get_lead') {
      const out = await ctx.runQuery(internal.leads.detail, {
        brandId: brand._id, creatorId: args.creator_id as Id<'creators'>,
      })
      if (!out) return reply(id, text('No such lead in your list.'))
      return reply(id, text(out))
    }

    if (name === 'classify_lead') {
      const ok = await ctx.runMutation(internal.leads.mark, {
        brandId: brand._id,
        creatorId: args.creator_id as Id<'creators'>,
        action: String(args.action ?? ''),
        value: args.value as string | undefined,
      })
      return reply(id, text(ok ? `Done. ${args.action} on ${args.creator_id}.` : 'No such lead in your list.'))
    }

    if (name === 'create_campaign') {
      const campaign = await ctx.runMutation(internal.brands.createCampaign, {
        brandId: brand._id,
        name: String(args.name ?? 'New campaign'),
        website: args.website as string | undefined,
        brief: args.who ? { who: String(args.who) } : {},
        leadsPerDay: args.leads_per_day ? Number(args.leads_per_day) : undefined,
      })
      if (!campaign) return reply(id, text('Could not create the campaign.'))
      const seeded = await ctx.runMutation(internal.pool.seedFromPool, {
        campaignId: campaign._id, limit: Number(args.seed ?? 200),
      })
      return reply(id, text({ campaign_id: campaign._id, name: campaign.name, seeded_from_pool: seeded }))
    }

    if (name === 'create_agent') {
      const agent = await ctx.runMutation(internal.brands.addAgent, {
        brandId: brand._id,
        campaignId: args.campaign_id as Id<'campaigns'>,
        name: String(args.name ?? 'New agent'),
        hashtags: ((args.hashtags as string[]) ?? []).map((h) => String(h).replace(/^#/, '')),
        leadsPerDay: args.leads_per_day ? Number(args.leads_per_day) : undefined,
      })
      if (!agent) return reply(id, text('No such campaign in your account.'))
      return reply(id, text({ agent_id: agent._id, status: agent.status, note: 'Proposed. Approve it to run tonight.' }))
    }

    if (name === 'approve_agent' || name === 'pause_agent') {
      const agent = await ctx.runMutation(internal.brands.setAgentStatus, {
        brandId: brand._id,
        agentId: args.agent_id as Id<'agents'>,
        status: name === 'approve_agent' ? 'active' : 'paused',
        leadsPerDay: args.leads_per_day ? Number(args.leads_per_day) : undefined,
      })
      if (!agent) return reply(id, text('No such agent in your account.'))
      return reply(id, text({ agent_id: agent._id, name: agent.name, status: agent.status }))
    }

    if (name === 'list_campaigns') {
      const campaigns = await ctx.runQuery(internal.brands.listCampaigns, { brandId: brand._id })
      return reply(id, text({ campaigns }))
    }

    return rpcError(id, -32602, `Unknown tool ${name}`)
  } catch (e) {
    return rpcError(id, -32003, String(e instanceof Error ? e.message : e))
  }
})
