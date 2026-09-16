// Apify calls this when a run ends.
//
//   search run  → pull the handles out, start the detail run on them
//   detail run  → write the profiles into the shared pool, then qualify them
//
// The pool has no owner. A creator is crawled once and every campaign after
// that reads the same row. Only the crawl that first put it there is fresh,
// and only that one costs the brand a credit.

import { db, fail, json, type Signal } from './lib.ts'

const APIFY = 'https://api.apify.com/v2'
const ACTOR = 'apify~instagram-scraper'

// Reading the last 12 posts ourselves, never an average-views field ---------

function median(ns: number[]): number | null {
  const v = ns.filter((n) => n > 0).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2)
}

function postsPerMonth(dates: string[]): number | null {
  const t = dates.map((d) => new Date(d).getTime()).filter((n) => !Number.isNaN(n)).sort((a, b) => b - a)
  if (t.length < 2) return null
  const spanDays = (t[0] - t[t.length - 1]) / 86_400_000
  if (spanDays < 1) return t.length
  return Math.round((t.length / spanDays) * 30.4 * 100) / 100
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/

/** What the creator sells today, in plain words, from the bio and the link. */
function sellsFrom(bio: string, link: string): string {
  const t = `${bio} ${link}`.toLowerCase()
  if (/\bprogram|plan\b|coaching|1:1|training plan/.test(t)) return 'a program'
  if (/\bapp\b|membership|subscription/.test(t)) return 'a membership'
  if (/course|academy|masterclass/.test(t)) return 'a course'
  if (/ebook|guide|pdf/.test(t)) return 'an ebook'
  if (/merch|shop|store/.test(t)) return 'merch'
  if (/linktr\.ee|beacons|stan\.store|komi|milkshake/.test(t)) return 'a link hub'
  return ''
}

/** Every signal we can date. Bio wording is dated at the crawl, captions at the post. */
function signalsFrom(bio: string, posts: { caption: string; date: string }[], now: Date): Signal[] {
  const out: Signal[] = []
  const today = now.toISOString().slice(0, 10)
  const b = bio.toLowerCase()

  if (/dm for collab|collabs?\b|open to collab|partnerships?\b/.test(b))
    out.push({ type: 'collab_bio', label: 'Collab wording in the bio', strength: 'soft', date: today })
  if (/media kit|rate card|rates\b/.test(b))
    out.push({ type: 'media_kit', label: 'Media kit offered in the bio', strength: 'strong', date: today })

  for (const p of posts) {
    const c = (p.caption ?? '').toLowerCase()
    const date = (p.date ?? '').slice(0, 10)
    if (!date) continue
    if (/#ad\b|#sponsored|paid partnership|#partner\b|in partnership with/.test(c))
      out.push({ type: 'sponsored_post', label: 'Ran a sponsored post', strength: 'strong', date })
    else if (/\bcode\b.{0,20}\boff\b|discount code|use my code/.test(c))
      out.push({ type: 'promoted_supplement', label: 'Promoted a brand with a code', strength: 'strong', date })
    else if (/my new (program|course|app|ebook)|just launched|now open|enrolment|enrollment/.test(c))
      out.push({ type: 'launched_program', label: 'Launched something of their own', strength: 'soft', date })
  }
  return out.sort((a, b2) => (a.date < b2.date ? 1 : -1)).slice(0, 12)
}

async function items(datasetId: string, token: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${APIFY}/datasets/${datasetId}/items?token=${token}&clean=true&limit=2000`)
  return res.ok ? await res.json() : []
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRAWL_SECRET')
  if (secret && req.headers.get('x-crawl-secret') !== secret) return fail('Bad secret', 401)

  const sb = db()
  const token = Deno.env.get('APIFY_TOKEN')
  if (!token) return fail('APIFY_TOKEN is not set', 500)

  try {
    const { runId, status, datasetId, phase, campaignId, agentId } = await req.json()
    const now = new Date()

    if (status !== 'SUCCEEDED') {
      await sb.from('apify_runs').update({ status, error: `Apify run ${status}`, finished_at: now.toISOString() })
        .eq('run_id', runId)
      return json({ ok: true, note: `run ${status}` })
    }

    const rows = await items(datasetId, token)
    await sb.from('apify_runs').update({ status: 'SUCCEEDED', items: rows.length, finished_at: now.toISOString() })
      .eq('run_id', runId)

    // Phase one: handles out of the posts, straight into a detail run --------
    if (phase === 'search') {
      const handles = [...new Set(rows.map((r) => String(r.ownerUsername ?? '').toLowerCase()).filter(Boolean))]
      if (!handles.length) return json({ ok: true, handles: 0 })

      // The detail run starts here, so this function owns the whole chain.
      const hook = btoa(JSON.stringify([{
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT'],
        requestUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/apify-webhook`,
        headersTemplate: JSON.stringify({ 'x-crawl-secret': secret ?? '' }),
        payloadTemplate: JSON.stringify({
          runId: '{{resource.id}}', status: '{{resource.status}}',
          datasetId: '{{resource.defaultDatasetId}}',
          phase: 'detail', campaignId, agentId,
        }),
      }]))
      const input = {
        directUrls: handles.slice(0, 200).map((h) => `https://www.instagram.com/${h}/`),
        resultsType: 'details',
        resultsLimit: 12,
        addParentData: false,
      }
      const res = await fetch(`${APIFY}/acts/${ACTOR}/runs?token=${token}&webhooks=${encodeURIComponent(hook)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      })
      const started = await res.json().catch(() => ({}))
      if (res.ok) {
        await sb.from('apify_runs').insert({
          run_id: started?.data?.id, phase: 'detail', campaign_id: campaignId,
          agent_id: agentId || null, status: 'RUNNING', input,
        })
      }
      return json({ ok: true, handles: handles.length, detailRun: started?.data?.id ?? null })
    }

    // Phase two: the profiles land in the pool ------------------------------
    const { data: campaign } = await sb.from('campaigns').select('id, brand_id').eq('id', campaignId).maybeSingle()
    if (!campaign) return fail('No such campaign', 404)

    let fresh = 0
    const touched: string[] = []

    for (const r of rows) {
      const handle = String(r.username ?? '').toLowerCase()
      if (!handle) continue

      const latest = (Array.isArray(r.latestPosts) ? r.latestPosts : []) as Record<string, unknown>[]
      const posts = latest.slice(0, 12).map((p) => ({
        kind: p.type === 'Video' || p.videoViewCount ? 'reel' : 'post',
        url: String(p.url ?? ''),
        thumbnail: String(p.displayUrl ?? ''),
        caption: String(p.caption ?? ''),
        views: Number(p.videoViewCount ?? p.videoPlayCount ?? 0),
        likes: Number(p.likesCount ?? 0),
        comments: Number(p.commentsCount ?? 0),
        date: String(p.timestamp ?? ''),
      })).filter((p) => p.url)

      const followers = Number(r.followersCount ?? 0)
      const bio = String(r.biography ?? '')
      const link = String(r.externalUrl ?? '')
      const engagements = posts.map((p) => p.likes + p.comments)
      const medianEngagement = median(engagements)

      const record = {
        platform: 'instagram',
        handle,
        name: String(r.fullName ?? ''),
        bio,
        avatar: String(r.profilePicUrlHD ?? r.profilePicUrl ?? '') || null,
        followers,
        engagement_rate: followers > 0 && medianEngagement
          ? Math.round((medianEngagement / followers) * 10_000) / 10_000 : null,
        median_reel_views: median(posts.filter((p) => p.kind === 'reel').map((p) => p.views)),
        posts_per_month: postsPerMonth(posts.map((p) => p.date)),
        last_post_at: posts[0]?.date || null,
        email: String(r.publicEmail ?? r.businessEmail ?? '') || bio.match(EMAIL)?.[0] || null,
        external_links: [link, ...(Array.isArray(r.externalUrls) ? r.externalUrls.map((u: { url?: string }) => u?.url ?? '') : [])]
          .filter(Boolean),
        sells: sellsFrom(bio, link),
        signals: signalsFrom(bio, posts.map((p) => ({ caption: p.caption, date: p.date })), now),
        last_crawl_at: now.toISOString(),
      }

      const { data: before } = await sb.from('creators').select('id').eq('platform', 'instagram').eq('handle', handle).maybeSingle()
      const isNew = !before

      const { data: saved, error } = await sb.from('creators')
        .upsert(record, { onConflict: 'platform,handle' }).select('id').single()
      if (error || !saved) continue
      if (isNew) fresh++
      touched.push(saved.id)

      if (posts.length) {
        await sb.from('creator_posts').upsert(
          posts.map((p) => ({
            creator_id: saved.id, kind: p.kind, url: p.url, thumbnail: p.thumbnail,
            caption: p.caption.slice(0, 2000), views: p.views, likes: p.likes,
            comments: p.comments, posted_at: p.date || null,
          })),
          { onConflict: 'creator_id,url' },
        )
      }

      await sb.from('discoveries').upsert({
        creator_id: saved.id, campaign_id: campaignId, agent_id: agentId || null,
        brand_id: campaign.brand_id, fresh: isNew,
      }, { onConflict: 'campaign_id,creator_id', ignoreDuplicates: true })
    }

    // A credit buys a fresh profile. Reading the pool costs nothing.
    if (fresh > 0) {
      await sb.from('credits_ledger').insert({
        brand_id: campaign.brand_id, delta: -fresh, campaign_id: campaignId,
        reason: `${fresh} fresh profiles crawled`,
      })
      await sb.rpc('spend_credits', { p_brand: campaign.brand_id, p_amount: fresh })
    }

    await sb.from('apify_runs').update({ fresh }).eq('run_id', runId)

    const today = now.toISOString().slice(0, 10)
    await sb.from('daily_stats').upsert({
      date: today, campaign_id: campaignId, agent_id: agentId || null,
      gathered: rows.length, leads: touched.length, qualified: 0,
    }, { onConflict: 'date,campaign_id,agent_id' })

    // Hand the new rows to the model.
    if (touched.length) {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/qualify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ campaignId, creatorIds: touched }),
      }).catch(() => {})
    }

    return json({ ok: true, ingested: touched.length, fresh })
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500)
  }
})
