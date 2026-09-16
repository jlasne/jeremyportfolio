// The one API. The front end reads it, and so can the brand's own code.
// Every call carries `Authorization: Bearer <api key>`, except the waitlist.
//
// A brand only ever sees the leads attributed to it. Every read below is
// joined to its own discoveries, so a handle held by another brand is not
// merely hidden from the list, it is unreachable by id.
//
// JWT verification is off on purpose: this function runs its own auth on the
// brand api key, so the project's anon key never has to ship in a browser.
//
//   POST   /waitlist                  { email, website? }        public
//   GET    /me
//   GET    /contacts?campaign&scope&limit&offset
//   GET    /creators/:id
//   GET    /campaigns
//   POST   /campaigns                 { name, website, brief, filters, leadsPerDay }
//   PATCH  /campaigns/:id             any column above
//   POST   /campaigns/:id/agents      { name, focus, keywords, hashtags, leadsPerDay }
//   POST   /campaigns/:id/propose     the model reads the site and writes 3 agents
//   POST   /agents/:id/approve        a proposed agent starts running tonight
//   POST   /agents/:id/pause          stop it without deleting it
//   DELETE /agents/:id
//   POST   /campaigns/:id/run         starts a crawl now
//   GET    /stats?days=30
//   POST   /actions                   { creatorId, action, value? }

import { brandFrom, CORS, db, fail, json } from './lib.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const sb = db()
  const url = new URL(req.url)
  // The gateway hands us /api/<route>, the local runtime /functions/v1/api/<route>.
  // Drop everything up to and including the function's own name.
  const segs = url.pathname.split('/').filter(Boolean)
  const at = segs.indexOf('api')
  const parts = at >= 0 ? segs.slice(at + 1) : segs
  const head = parts[0] ?? ''
  const q = url.searchParams

  try {
    // Public ---------------------------------------------------------------
    if (head === 'waitlist' && req.method === 'POST') {
      const { email, website, source } = await req.json()
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('A real email, please')
      const { error } = await sb.from('waitlist')
        .upsert({ email: email.toLowerCase().trim(), website: website ?? null, source: source ?? 'landing' },
                { onConflict: 'email' })
      if (error) return fail(error.message, 500)
      return json({ ok: true })
    }

    // Everything below needs a brand ---------------------------------------
    const brand = await brandFrom(req, sb)
    if (!brand) return fail('Send Authorization: Bearer <api key>', 401)

    if (head === 'me') {
      const { count } = await sb.from('creators').select('*', { count: 'exact', head: true })
      // What is left to be given: the pool minus every handle held elsewhere.
      const { data: free } = await sb.rpc('free_pool', { p_brand: brand.id })
      return json({ ...brand, poolSize: count ?? 0, availableToYou: free ?? 0 })
    }

    if (head === 'contacts' && req.method === 'GET') {
      const campaign = q.get('campaign')
      const { data, error } = await sb.rpc('feed', {
        p_brand: brand.id,
        p_campaign: campaign || null,
        p_limit: Math.min(Number(q.get('limit') ?? 60), 500),
        p_offset: Number(q.get('offset') ?? 0),
        p_scope: q.get('scope') ?? 'all',
      })
      if (error) return fail(error.message, 500)
      const { data: counts } = await sb.rpc('feed_counts', { p_brand: brand.id, p_campaign: campaign || null })
      return json({ contacts: data ?? [], counts: counts?.[0] ?? { total: 0, today: 0, qualified: 0 } })
    }

    if (head === 'creators' && parts[1]) {
      // A brand reads a profile only where it holds the lead.
      const { data: mine } = await sb.from('discoveries').select('creator_id')
        .eq('creator_id', parts[1]).eq('brand_id', brand.id).maybeSingle()
      if (!mine) return fail('No such creator', 404)
      // A brand reads a profile only where it holds the lead.
      const { data: mine } = await sb.from('discoveries').select('creator_id')
        .eq('creator_id', parts[1]).eq('brand_id', brand.id).maybeSingle()
      if (!mine) return fail('No such creator', 404)
      const { data: creator } = await sb.from('creators').select('*').eq('id', parts[1]).maybeSingle()
      if (!creator) return fail('No such creator', 404)
      const { data: posts } = await sb.from('creator_posts').select('*')
        .eq('creator_id', parts[1]).order('posted_at', { ascending: false }).limit(12)
      return json({ creator, posts: posts ?? [] })
    }

    if (head === 'campaigns' && req.method === 'GET') {
      // Two plain reads, joined here: discoveries, daily_stats and apify_runs
      // each carry a campaign_id and an agent_id, so PostgREST reads them as
      // junctions and an agents embed comes back ambiguous.
      const { data: rows, error } = await sb.from('campaigns').select('*')
        .eq('brand_id', brand.id).order('created_at', { ascending: false })
      if (error) return fail(error.message, 500)

      const campaigns = rows ?? []
      const { data: agents } = await sb.from('agents').select('*')
        .in('campaign_id', campaigns.map((c: { id: string }) => c.id))
        .order('created_at')
      const byCampaign = new Map<string, unknown[]>()
      for (const a of agents ?? []) {
        const list = byCampaign.get(a.campaign_id) ?? []
        list.push(a)
        byCampaign.set(a.campaign_id, list)
      }
      return json({
        campaigns: campaigns.map((c: { id: string }) => ({ ...c, agents: byCampaign.get(c.id) ?? [] })),
      })
    }

    if (head === 'campaigns' && req.method === 'POST' && !parts[1]) {
      const body = await req.json()
      const { data, error } = await sb.from('campaigns').insert({
        brand_id: brand.id,
        name: body.name ?? 'New campaign',
        website: body.website ?? null,
        brief: body.brief ?? {},
        filters: body.filters ?? {},
        leads_per_day: body.leadsPerDay ?? 250,
        run_at: body.runAt ?? '07:00',
      }).select().single()
      if (error) return fail(error.message, 500)
      // Free first: the pool hands over what nobody else holds, before any crawl.
      const { data: seeded } = await sb.rpc('seed_from_pool', { p_campaign: data.id, p_limit: body.seed ?? 400 })
      return json({ campaign: data, seededFromPool: seeded ?? 0 })
    }

    if (head === 'campaigns' && parts[1] && req.method === 'PATCH') {
      const body = await req.json()
      const patch: Record<string, unknown> = {}
      for (const [k, col] of [['name','name'],['website','website'],['brief','brief'],
                              ['filters','filters'],['leadsPerDay','leads_per_day'],
                              ['runAt','run_at'],['active','active']] as const) {
        if (k in body) patch[col] = body[k]
      }
      const { data, error } = await sb.from('campaigns').update(patch)
        .eq('id', parts[1]).eq('brand_id', brand.id).select().single()
      if (error) return fail(error.message, 500)
      return json({ campaign: data })
    }

    if (head === 'campaigns' && parts[1] && parts[2] === 'agents' && req.method === 'POST') {
      const body = await req.json()
      const { data: owned } = await sb.from('campaigns').select('id').eq('id', parts[1]).eq('brand_id', brand.id).maybeSingle()
      if (!owned) return fail('No such campaign', 404)
      const { data, error } = await sb.from('agents').insert({
        campaign_id: parts[1],
        name: body.name ?? 'New agent',
        focus: body.focus ?? '',
        keywords: body.keywords ?? [],
        hashtags: body.hashtags ?? [],
        leads_per_day: body.leadsPerDay ?? 80,
      }).select().single()
      if (error) return fail(error.message, 500)
      return json({ agent: data })
    }

    // The model proposes, a human approves. Nothing here spends a credit.
    if (head === 'campaigns' && parts[1] && parts[2] === 'propose' && req.method === 'POST') {
      const { data: owned } = await sb.from('campaigns').select('id').eq('id', parts[1]).eq('brand_id', brand.id).maybeSingle()
      if (!owned) return fail('No such campaign', 404)
      const body = await req.json().catch(() => ({}))
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ campaignId: parts[1], website: body.website }),
      })
      return json(await res.json(), res.status)
    }

    if (head === 'agents' && parts[1] && req.method !== 'GET') {
      // An agent belongs to a brand through its campaign. Two plain reads,
      // rather than an embed the junction tables make ambiguous.
      const { data: agent } = await sb.from('agents')
        .select('id, status, campaign_id').eq('id', parts[1]).maybeSingle()
      if (!agent) return fail('No such agent', 404)
      const { data: owns } = await sb.from('campaigns').select('id')
        .eq('id', agent.campaign_id).eq('brand_id', brand.id).maybeSingle()
      if (!owns) return fail('No such agent', 404)

      if (req.method === 'DELETE') {
        await sb.from('agents').delete().eq('id', parts[1])
        return json({ ok: true })
      }
      if (parts[2] === 'approve') {
        const body = await req.json().catch(() => ({}))
        const patch: Record<string, unknown> = { status: 'active', active: true }
        if (typeof body.leadsPerDay === 'number') patch.leads_per_day = body.leadsPerDay
        if (Array.isArray(body.hashtags)) patch.hashtags = body.hashtags
        const { data, error } = await sb.from('agents').update(patch).eq('id', parts[1]).select().single()
        if (error) return fail(error.message, 500)
        return json({ agent: data })
      }
      if (parts[2] === 'pause') {
        const { data, error } = await sb.from('agents')
          .update({ status: 'paused', active: false }).eq('id', parts[1]).select().single()
        if (error) return fail(error.message, 500)
        return json({ agent: data })
      }
      return fail(`No route for /agents/${parts[1]}/${parts[2] ?? ''}`, 404)
    }

    if (head === 'campaigns' && parts[1] && parts[2] === 'run' && req.method === 'POST') {
      const { data: owned } = await sb.from('campaigns').select('id').eq('id', parts[1]).eq('brand_id', brand.id).maybeSingle()
      if (!owned) return fail('No such campaign', 404)
      // One credit, one lead. No credits, nothing to deliver.
      if (brand.credits <= 0) return fail('No credits left. Top up to take more leads.', 402)
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-crawl-secret': Deno.env.get('CRAWL_SECRET') ?? '',
        },
        body: JSON.stringify({ campaignId: parts[1] }),
      })
      return json(await res.json(), res.status)
    }

    if (head === 'stats') {
      const days = Math.min(Number(q.get('days') ?? 30), 180)
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
      const { data: campaigns } = await sb.from('campaigns').select('id').eq('brand_id', brand.id)
      const ids = (campaigns ?? []).map((c: { id: string }) => c.id)
      if (!ids.length) return json({ daily: [] })
      const { data, error } = await sb.from('daily_stats').select('*')
        .in('campaign_id', ids).gte('date', since).order('date')
      if (error) return fail(error.message, 500)
      return json({ daily: data ?? [] })
    }

    if (head === 'actions' && req.method === 'POST') {
      const { creatorId, action, value } = await req.json()
      if (!creatorId || !action) return fail('creatorId and action are required')
      // Write only against a lead this brand holds.
      const { data: mine } = await sb.from('discoveries').select('creator_id')
        .eq('creator_id', creatorId).eq('brand_id', brand.id).maybeSingle()
      if (!mine) return fail('No such creator', 404)
      const row = { brand_id: brand.id, creator_id: creatorId }
      switch (action) {
        case 'reject':   await sb.from('rejections').upsert(row); break
        case 'unreject': await sb.from('rejections').delete().match(row); break
        case 'done':     await sb.from('done').upsert(row); break
        case 'undone':   await sb.from('done').delete().match(row); break
        case 'note':     await sb.from('notes').upsert({ ...row, text: value ?? '', updated_at: new Date().toISOString() }); break
        case 'tag':      await sb.from('creator_tags').upsert({ ...row, tag: value }); break
        case 'untag':    await sb.from('creator_tags').delete().match({ ...row, tag: value }); break
        default: return fail(`Unknown action ${action}`)
      }
      return json({ ok: true })
    }

    return fail(`No route for /${parts.join('/')}`, 404)
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500)
  }
})
