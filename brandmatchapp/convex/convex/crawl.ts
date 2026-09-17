import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// Sourcing, on apify/instagram-scraper. The same actor and the same hashtag
// URL input that 247 of the 248 search runs on record already use.
//
//   search  the agent's hashtags go in, handles come out
//   detail  those handles go in, the profile and its last 12 posts come out
//
// The pool comes first and costs nothing: whatever is already in the database
// and held by nobody is handed over before a run is started. Only the
// shortfall goes to Apify, which bills about $0.0023 a profile. An agent
// whose day the pool already covered starts no run at all.

export const ACTOR = 'apify~instagram-scraper'
export const APIFY = 'https://api.apify.com/v2'

/** base64 without Buffer, so this stays off the Node runtime. */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

/**
 * Apify wants the webhook as base64 JSON on the query string.
 *
 * The payload template is a JSON string where `{{variable}}` is spliced in
 * before the call. Only whole top-level variables are substituted, so the run
 * arrives as `{{resource}}`, unquoted, and the handler reads its fields. A
 * dotted `{{resource.status}}` is not resolved: it arrives as those literal
 * characters, and a crawl that finished looks to us like it never did.
 */
export function webhookParam(payload: Record<string, string>): string {
  const ours = Object.entries(payload)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(', ')
  return toBase64(JSON.stringify([{
    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT'],
    requestUrl: `${process.env.CONVEX_SITE_URL ?? ''}/apify`,
    headersTemplate: JSON.stringify({ 'x-crawl-secret': process.env.CRAWL_SECRET ?? '' }),
    payloadTemplate: `{ "resource": {{resource}}, "eventType": {{eventType}}${ours ? ', ' + ours : ''} }`,
  }]))
}

export async function startRun(
  input: Record<string, unknown>,
  meta: { phase: string; campaignId: string; agentId?: string },
): Promise<{ runId: string } | { error: string }> {
  const token = process.env.APIFY_TOKEN
  if (!token) return { error: 'APIFY_TOKEN is not set' }

  const hook = webhookParam({ phase: meta.phase, campaignId: meta.campaignId, agentId: meta.agentId ?? '' })
  const res = await fetch(`${APIFY}/acts/${ACTOR}/runs?token=${token}&webhooks=${encodeURIComponent(hook)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await res.json().catch(() => ({}))) as { data?: { id?: string }; error?: { message?: string } }
  if (!res.ok) return { error: body?.error?.message ?? `Apify replied ${res.status}` }
  const runId = body?.data?.id
  if (!runId) return { error: 'Apify started no run' }
  return { runId }
}

/**
 * Fills today's quota, as cheaply as it can. Called hourly by cron, and by
 * POST /campaigns/:id/run. The pool is tried first, every time.
 */
export const run = internalAction({
  args: { campaignId: v.optional(v.id('campaigns')) },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const due = await ctx.runQuery(internal.crawl.dueAgents, { campaignId })

    const started: string[] = []
    const failed: string[] = []
    let coveredByPool = 0

    for (const agent of due) {
      // Free first. What comes back is what the pool could not cover.
      const want: number = await ctx.runMutation(internal.pool.shortfall, { agentId: agent._id })
      if (want <= 0) {
        coveredByPool++
        await ctx.runMutation(internal.crawl.touchAgent, { agentId: agent._id })
        continue
      }

      const tags: string[] = (agent.hashtags ?? [])
        .map((h: string) => h.replace(/^#/, '').trim())
        .filter(Boolean)
      const words: string[] = (agent.keywords ?? []).filter(Boolean)
      if (!tags.length && !words.length) { failed.push(`${agent.name}: no hashtags yet`); continue }

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

      const out = await startRun(input, { phase: 'search', campaignId: agent.campaignId, agentId: agent._id })
      if ('error' in out) { failed.push(`${agent.name}: ${out.error}`); continue }

      await ctx.runMutation(internal.crawl.noteRun, {
        runId: out.runId, phase: 'search', campaignId: agent.campaignId, agentId: agent._id, input,
      })
      await ctx.runMutation(internal.crawl.touchAgent, { agentId: agent._id })
      started.push(out.runId)
    }

    return { started: started.length, runs: started, coveredByPool, failed }
  },
})

/**
 * Active agents, 20 hours stale or never run.
 *
 * A campaign is a name for a group. Whether anything runs is the agents' own
 * answer, one flag per agent, so a campaign cannot say paused while its agents
 * say running.
 */
export const dueAgents = internalQuery({
  args: { campaignId: v.optional(v.id('campaigns')) },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const agents = await ctx.db
      .query('agents')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect()

    const cutoff = Date.now() - 20 * 3600_000
    const out = []
    for (const a of agents) {
      if (campaignId && a.campaignId !== campaignId) continue
      if (!campaignId && a.lastRunAt && a.lastRunAt > cutoff) continue
      const campaign = await ctx.db.get(a.campaignId)
      if (!campaign) continue
      // A trial reads the pool and never spends on Apify.
      const brand = await ctx.db.get(campaign.brandId)
      if (brand?.plan !== 'paid') continue
      out.push(a)
    }
    return out
  },
})

export const touchAgent = internalMutation({
  args: { agentId: v.id('agents') },
  returns: v.null(),
  handler: async (ctx, { agentId }) => {
    await ctx.db.patch(agentId, { lastRunAt: Date.now() })
    return null
  },
})

export const noteRun = internalMutation({
  args: {
    runId: v.string(),
    phase: v.string(),
    campaignId: v.id('campaigns'),
    agentId: v.optional(v.id('agents')),
    input: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert('runs', {
      runId: args.runId,
      actor: 'apify/instagram-scraper',
      phase: args.phase,
      campaignId: args.campaignId,
      agentId: args.agentId,
      status: 'RUNNING',
      input: args.input,
      items: 0,
      fresh: 0,
    })
    return null
  },
})

export const finishRun = internalMutation({
  args: {
    runId: v.string(),
    status: v.string(),
    items: v.optional(v.number()),
    fresh: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { runId, status, items, fresh, error }) => {
    const row = await ctx.db.query('runs').withIndex('by_runId', (q) => q.eq('runId', runId)).first()
    if (!row) return null
    await ctx.db.patch(row._id, {
      status,
      items: items ?? row.items,
      fresh: fresh ?? row.fresh,
      error,
      finishedAt: Date.now(),
    })
    return null
  },
})
