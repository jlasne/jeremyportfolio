// brandmatch over MCP, so the AI you already pay for can work the list.
//
// JSON-RPC 2.0 on one POST endpoint. Point Claude, Cursor or an IDE at
// https://<project>.supabase.co/functions/v1/mcp with the brand key as a
// bearer token, and ask in words: who fired a signal this week, tag the three
// star ones, start tonight's crawl.
//
// Same key and same rules as the REST API: a brand reaches only the leads
// attributed to it, and a write is refused on a handle it does not hold.

import { brandFrom, CORS, db, type Signal } from './lib.ts'

const PROTOCOL = '2024-11-05'

interface Rpc {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

function reply(id: Rpc['id'], result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function rpcError(id: Rpc['id'], code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** MCP wants tool output as content blocks, so everything lands as text. */
function text(value: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  }
}

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
    inputSchema: {
      type: 'object',
      required: ['creator_id'],
      properties: { creator_id: { type: 'string' } },
    },
  },
  {
    name: 'classify_lead',
    description: 'Tag, note, tick off or reject a lead. The app is the CRM, so a write here shows in the list straight away.',
    inputSchema: {
      type: 'object',
      required: ['creator_id', 'action'],
      properties: {
        creator_id: { type: 'string' },
        action: {
          type: 'string',
          enum: ['tag', 'untag', 'note', 'done', 'undone', 'reject', 'unreject'],
        },
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
    name: 'account',
    description: 'Credits left, how big the shared pool is, and how much of it is still free to this brand. One credit buys one lead.',
    inputSchema: { type: 'object', properties: {} },
  },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return rpcError(null, -32600, 'POST a JSON-RPC request')

  const sb = db()
  let rpc: Rpc
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

  const brand = await brandFrom(req, sb)
  if (!brand) return rpcError(id, -32001, 'Send your brandmatch key as a bearer token')

  const name = String(params.name ?? '')
  const args = (params.arguments ?? {}) as Record<string, unknown>

  try {
    if (name === 'account') {
      const { count } = await sb.from('creators').select('*', { count: 'exact', head: true })
      const { data: free } = await sb.rpc('free_pool', { p_brand: brand.id })
      return reply(id, text({
        credits_left: brand.credits,
        pool_size: count ?? 0,
        still_free_to_you: free ?? 0,
        note: 'One credit buys one lead, whether it came from the pool or a fresh crawl.',
      }))
    }

    if (name === 'list_leads') {
      const { data, error } = await sb.rpc('feed', {
        p_brand: brand.id,
        p_campaign: (args.campaign as string) || null,
        p_limit: Math.min(Number(args.limit ?? 40), 200),
        p_offset: 0,
        p_scope: 'open',
      })
      if (error) return rpcError(id, -32002, error.message)

      const minStars = Number(args.min_stars ?? 0)
      const within = args.signal_within_days ? Number(args.signal_within_days) : null
      const rows = (data ?? [])
        .filter((r: { stars: number }) => Number(r.stars) >= minStars)
        .filter((r: { email: string | null }) => (args.with_email ? Boolean(r.email) : true))
        .filter((r: { signals: Signal[] }) => {
          if (within === null) return true
          const newest = (r.signals ?? [])[0]?.date
          if (!newest) return false
          return (Date.now() - new Date(newest).getTime()) / 86_400_000 <= within
        })
        .map((r: Record<string, unknown>) => ({
          creator_id: r.id,
          handle: `@${r.handle}`,
          name: r.name,
          stars: r.stars,
          why: [r.niche_why, (r.signals as Signal[])?.[0]?.label].filter(Boolean).join('. '),
          followers: r.followers,
          median_reel_views: r.median_reel_views,
          email: r.email,
          sells: r.sells,
          last_signal: (r.signals as Signal[])?.[0] ?? null,
          campaign: r.campaign_name,
        }))

      return reply(id, text({ count: rows.length, leads: rows }))
    }

    if (name === 'get_lead') {
      const creatorId = String(args.creator_id ?? '')
      const { data: mine } = await sb.from('discoveries').select('creator_id')
        .eq('creator_id', creatorId).eq('brand_id', brand.id).maybeSingle()
      if (!mine) return reply(id, text('No such lead in your list.'))

      const { data: creator } = await sb.from('creators').select('*').eq('id', creatorId).maybeSingle()
      const { data: posts } = await sb.from('creator_posts')
        .select('kind, url, views, likes, comments, posted_at')
        .eq('creator_id', creatorId).order('posted_at', { ascending: false }).limit(12)
      return reply(id, text({ creator, last_posts: posts ?? [] }))
    }

    if (name === 'classify_lead') {
      const creatorId = String(args.creator_id ?? '')
      const action = String(args.action ?? '')
      const value = args.value as string | undefined

      const { data: mine } = await sb.from('discoveries').select('creator_id')
        .eq('creator_id', creatorId).eq('brand_id', brand.id).maybeSingle()
      if (!mine) return reply(id, text('No such lead in your list.'))

      const row = { brand_id: brand.id, creator_id: creatorId }
      switch (action) {
        case 'tag':      await sb.from('creator_tags').upsert({ ...row, tag: value }); break
        case 'untag':    await sb.from('creator_tags').delete().match({ ...row, tag: value }); break
        case 'note':     await sb.from('notes').upsert({ ...row, text: value ?? '', updated_at: new Date().toISOString() }); break
        case 'done':     await sb.from('done').upsert(row); break
        case 'undone':   await sb.from('done').delete().match(row); break
        case 'reject':   await sb.from('rejections').upsert(row); break
        case 'unreject': await sb.from('rejections').delete().match(row); break
        default: return reply(id, text(`Unknown action ${action}`))
      }
      return reply(id, text(`Done. ${action} on ${creatorId}.`))
    }

    if (name === 'list_campaigns') {
      const { data: campaigns } = await sb.from('campaigns')
        .select('id, name, website, brief, filters, leads_per_day, run_at, active')
        .eq('brand_id', brand.id).order('created_at', { ascending: false })
      const { data: agents } = await sb.from('agents')
        .select('id, campaign_id, name, focus, hashtags, leads_per_day, status')
        .in('campaign_id', (campaigns ?? []).map((c: { id: string }) => c.id))
      return reply(id, text({
        campaigns: (campaigns ?? []).map((c: { id: string }) => ({
          ...c,
          agents: (agents ?? []).filter((a: { campaign_id: string }) => a.campaign_id === c.id),
        })),
      }))
    }

    return rpcError(id, -32602, `Unknown tool ${name}`)
  } catch (e) {
    return rpcError(id, -32003, String(e instanceof Error ? e.message : e))
  }
})
