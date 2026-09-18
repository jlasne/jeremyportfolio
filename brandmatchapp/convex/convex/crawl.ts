import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// Sourcing, on apify/instagram-scraper.
//
//   search  keywords go in, handles come out
//   detail  those handles go in, the profile and its last 12 posts come out
//
// Nothing here judges anything. A crawl writes measured facts and stops. The
// gates run afterwards, in evaluate.ts, and delivery afterwards again, in
// deliver.ts. Keeping the three apart is what lets gate 1 reject a profile
// before a single model call is paid for.

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
 * before the call. Only whole top level variables are substituted, so the run
 * arrives as `{{resource}}`, unquoted, and the handler reads its fields. A
 * dotted `{{resource.status}}` is not resolved: it arrives as those literal
 * characters, and a crawl that finished looks to us like it never did.
 */
export function webhookParam(payload: Record<string, string>): string {
  const ours = Object.entries(payload)
    .map(([k, value]) => `${JSON.stringify(k)}: ${JSON.stringify(value)}`)
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
  meta: { phase: string; campaignId: string },
): Promise<{ runId: string } | { error: string }> {
  const token = process.env.APIFY_TOKEN
  if (!token) return { error: 'APIFY_TOKEN is not set' }

  const hook = webhookParam({ phase: meta.phase, campaignId: meta.campaignId })
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
 * Starts a search for one campaign, inside its fair use budget. The budget is
 * an internal ceiling and is never quoted back to the client.
 */
export const search = internalAction({
  args: { campaignId: v.id('campaigns'), keywords: v.array(v.string()), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const campaign = await ctx.runQuery(internal.crawl.campaignFor, { campaignId: args.campaignId })
    if (!campaign) return { error: 'No such campaign' }
    const budget = await ctx.runQuery(internal.ops.budgetLeft, { accountId: campaign.accountId })
    if (budget.left <= 0) return { error: 'Fair use reached for today', internal: true }

    const input = {
      directUrls: args.keywords.slice(0, 20).map((k) => `https://www.instagram.com/explore/tags/${encodeURIComponent(k)}/`),
      resultsType: 'posts',
      resultsLimit: Math.min(args.limit ?? 120, budget.left),
      addParentData: false,
    }
    const started = await startRun(input, { phase: 'search', campaignId: args.campaignId })
    if ('error' in started) return started
    await ctx.runMutation(internal.crawl.noteRun, {
      externalRunId: started.runId, phase: 'search', campaignId: args.campaignId,
    })
    return { runId: started.runId }
  },
})

export const campaignFor = internalQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => await ctx.db.get(campaignId),
})

export const noteRun = internalMutation({
  args: {
    externalRunId: v.string(),
    phase: v.string(),
    campaignId: v.optional(v.id('campaigns')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert('crawlRuns', {
      campaignId: args.campaignId,
      source: 'apify',
      externalRunId: args.externalRunId,
      phase: args.phase,
      status: 'RUNNING',
      profilesFetched: 0,
      profilesEvaluated: 0,
      qualified: 0,
      costCents: 0,
      startedAt: Date.now(),
    })
    return null
  },
})

/** Closes a run and writes what it cost. The cost never leaves this table. */
export const finishRun = internalMutation({
  args: {
    externalRunId: v.string(),
    status: v.string(),
    profilesFetched: v.optional(v.number()),
    costCents: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('crawlRuns')
      .withIndex('by_external', (q) => q.eq('externalRunId', args.externalRunId))
      .first()
    if (!run) return null
    await ctx.db.patch(run._id, {
      status: args.status,
      profilesFetched: args.profilesFetched ?? run.profilesFetched,
      // Measured on real runs: search plus detail lands near 0.6 cents a profile.
      costCents: args.costCents ?? Math.round((args.profilesFetched ?? run.profilesFetched) * 0.6),
      error: args.error,
      finishedAt: Date.now(),
    })
    return null
  },
})
