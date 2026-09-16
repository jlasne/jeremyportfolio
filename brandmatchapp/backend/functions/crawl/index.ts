// Starts the crawl. Two phases, both on apify/instagram-scraper.
//
//   search  the agent's keywords and hashtags go in, handles come out
//   detail  those handles go in, the profile and its last 12 posts come out
//
// Both run async. Apify calls back into apify-webhook when a run finishes, so
// nothing here waits. Called by pg_cron every hour, and by POST /campaigns/:id/run.
//
// A crawl spends real money, so the caller proves itself with the shared
// secret rather than any valid project JWT. JWT verification is off for that.

import { db, fail, json, CORS } from './lib.ts'

const ACTOR = 'apify~instagram-scraper'
const APIFY = 'https://api.apify.com/v2'

interface Agent {
  id: string; campaign_id: string; name: string; keywords: string[]
  hashtags: string[]; leads_per_day: number; last_run_at: string | null
}

/** Apify wants the webhook as base64 JSON on the query string. */
function webhookParam(payload: Record<string, string>): string {
  const hook = [{
    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT'],
    requestUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/apify-webhook`,
    headersTemplate: JSON.stringify({ 'x-crawl-secret': Deno.env.get('CRAWL_SECRET') ?? '' }),
    payloadTemplate: JSON.stringify({
      runId: '{{resource.id}}',
      status: '{{resource.status}}',
      datasetId: '{{resource.defaultDatasetId}}',
      ...payload,
    }),
  }]
  return btoa(JSON.stringify(hook))
}

export async function startRun(
  sb: ReturnType<typeof db>,
  input: Record<string, unknown>,
  meta: { phase: string; campaignId: string; agentId: string | null },
): Promise<{ runId: string } | { error: string }> {
  const token = Deno.env.get('APIFY_TOKEN')
  if (!token) return { error: 'APIFY_TOKEN is not set' }

  const hook = webhookParam({ phase: meta.phase, campaignId: meta.campaignId, agentId: meta.agentId ?? '' })
  const res = await fetch(`${APIFY}/acts/${ACTOR}/runs?token=${token}&webhooks=${encodeURIComponent(hook)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { error: body?.error?.message ?? `Apify replied ${res.status}` }

  const runId = body?.data?.id as string
  await sb.from('apify_runs').insert({
    run_id: runId, phase: meta.phase, campaign_id: meta.campaignId,
    agent_id: meta.agentId, status: 'RUNNING', input,
  })
  return { runId }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const secret = Deno.env.get('CRAWL_SECRET')
  if (!secret) return fail('CRAWL_SECRET is not set', 500)
  if (req.headers.get('x-crawl-secret') !== secret) return fail('Bad secret', 401)

  const sb = db()

  try {
    const body = await req.json().catch(() => ({}))
    const campaignId: string | undefined = body.campaignId

    // Pick the agents to run: one campaign on demand, or everything due today.
    let query = sb.from('agents').select('*, campaigns!inner(id, brand_id, active)').eq('active', true)
    if (campaignId) query = query.eq('campaign_id', campaignId)
    else query = query.or(`last_run_at.is.null,last_run_at.lt.${new Date(Date.now() - 20 * 3600_000).toISOString()}`)
    const { data: agents, error } = await query
    if (error) return fail(error.message, 500)

    const due = (agents ?? []).filter((a: Agent & { campaigns: { active: boolean } }) => a.campaigns?.active)
    if (!due.length) return json({ started: 0, note: 'No agent was due' })

    const started: string[] = []
    const failed: string[] = []
    let fromPool = 0

    for (const agent of due as (Agent & Record<string, unknown>)[]) {
      // Free first. What comes back is what the pool could not cover.
      const { data: missing, error: shortfallError } = await sb.rpc('shortfall', { p_agent: agent.id })
      if (shortfallError) { failed.push(`${agent.name}: ${shortfallError.message}`); continue }

      const want = Number(missing ?? 0)
      if (want <= 0) {
        fromPool++
        await sb.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agent.id)
        continue
      }

      // Hashtag pages beat the actor's own search field: they answer the same
      // way every time, which is why 247 of the 248 search runs on record use
      // them. Keywords fall back to search when an agent has no hashtag.
      const tags = (agent.hashtags ?? []).map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean)
      const words = (agent.keywords ?? []).filter(Boolean)
      if (!tags.length && !words.length) { failed.push(`${agent.name}: no keywords yet`); continue }

      // Ask for more than the shortfall, since the filters cut some of it.
      const ask = Math.ceil(want * 1.5)
      const input: Record<string, unknown> = tags.length
        ? {
            directUrls: tags.map((t) => `https://www.instagram.com/explore/tags/${encodeURIComponent(t)}/`),
            resultsType: 'posts',
            resultsLimit: Math.ceil(ask / tags.length),
            addParentData: true,
          }
        : {
            search: words.join(' '),
            searchType: 'hashtag',
            searchLimit: Math.max(3, Math.ceil(want / 40)),
            resultsType: 'posts',
            resultsLimit: ask,
            addParentData: true,
          }

      const out = await startRun(sb, input,
        { phase: 'search', campaignId: agent.campaign_id, agentId: agent.id })

      if ('error' in out) { failed.push(`${agent.name}: ${out.error}`); continue }
      started.push(out.runId)
      await sb.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', agent.id)
    }

    return json({ started: started.length, runs: started, coveredByPool: fromPool, failed })
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500)
  }
})
