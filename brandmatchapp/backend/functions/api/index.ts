// The one API. The front end reads it, and so can the brand's own code.
// Every call carries `Authorization: Bearer <api key>`, except the waitlist.
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
      return json({ ...brand, poolSize: count ?? 0 })
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
      const { data: creator } = await sb.from('creators').select('*').eq('id', parts[1]).maybeSingle()
      if (!creator) return fail('No such creator', 404)
      const { data: posts } = await sb.from('creator_posts').select('*')
        .eq('creator_id', parts[1]).order('posted_at', { ascending: false }).limit(12)
      return json({ creator, posts: posts ?? [] })
    }

    if (head === 'campaigns' && req.method === 'GET') {
      const { data, error } = await sb.from('campaigns')
        .select('*, agents(*)').eq('brand_id', brand.id).order('created_at', { ascending: false })
      if (error) return fail(error.message, 500)
      return json({ campaigns: data ?? [] })
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
      // A new campaign reads the pool before it crawls anything of its own.
      await sb.rpc('seed_from_pool', { p_campaign: data.id, p_limit: body.seed ?? 400 })
      return json({ campaign: data })
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

    if (head === 'campaigns' && parts[1] && parts[2] === 'run' && req.method === 'POST') {
      const { data: owned } = await sb.from('campaigns').select('id').eq('id', parts[1]).eq('brand_id', brand.id).maybeSingle()
      if (!owned) return fail('No such campaign', 404)
      // A crawl spends credits on whatever comes back fresh, so it needs some.
      if (brand.credits <= 0) return fail('No credits left. The pool still reads free.', 402)
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
