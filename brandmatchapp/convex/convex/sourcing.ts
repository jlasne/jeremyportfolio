import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { startRun } from './crawl'

// Where the handles come from.
//
// Four ways of searching, one destination: each ends in a detail run, and the
// detail run writes which way found every handle. Without that line no way can
// be measured, and the first real run measured them by hand.
//
//   search     posts under a hashtag. Cheap to start, small accounts: one in
//              a hundred passed gate 1 on the first real run.
//   accounts   Instagram's own account search, on the words of a niche.
//   neighbour  the handles good accounts mention and tag in their posts.
//              Seven times better on size than a hashtag, and on target only
//              when the parents are: read from every big account it handed
//              back a bikini brand and its models.
//   seed       the client's own handles. Judged like anyone, never delivered
//              back to them, and used to find others only when they pass.
//
// The parents rule is the whole channel. A neighbour is worth paying for when
// the account that cited them passed gate 1 and sits in one of the campaign's
// niches. What the gates said about the parent is the only free signal there
// is about the child.

const PARENT_VERDICTS = new Set(['qualified', 'below_threshold', 'knockout_fail'])

/**
 * The accounts worth standing next to, and everyone they point at.
 *
 * A parent passed gate 1 and, when the campaign has niches, was placed in one.
 * A knockout or a low fit score does not disqualify a parent: a nutrition
 * coach who sells their own app still stands among nutrition coaches.
 */
export const parents = internalQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign) return { error: 'No such campaign' }
    const hasNiches = (campaign.extracted.niches ?? []).some((n) => n.enabled)
    const rows = await ctx.db.query('evaluations').withIndex('by_campaign', (q) => q.eq('campaignId', campaignId)).collect()
    const out = []
    for (const e of rows) {
      if (!PARENT_VERDICTS.has(e.verdict)) continue
      if (hasNiches && !e.niche) continue
      const c = await ctx.db.get(e.creatorId)
      if (!c) continue
      out.push({ handle: c.handle, verdict: e.verdict, score: e.score, niche: e.niche ?? null, cited: c.cited ?? [] })
    }
    // Qualified first, then by fit. The order decides who gets cited first
    // when the run is capped.
    return out.sort((a, b) => Number(b.verdict === 'qualified') - Number(a.verdict === 'qualified') || b.score - a.score)
  },
})

/**
 * The handles to pay for next, ranked. Cited by more parents comes first:
 * a handle two coaches both tag is a peer, a handle one of them tags once
 * is as often a brand, a gym or a friend.
 */
export const harvest = internalQuery({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const list = (await ctx.runQuery(internal.sourcing.parents, { campaignId: args.campaignId })) as
      | { handle: string; cited: string[] }[]
      | { error: string }
    if ('error' in list) return list
    const parentHandles = new Set(list.map((p) => p.handle))
    const by = new Map<string, Set<string>>()
    for (const p of list) {
      for (const h of p.cited) {
        if (parentHandles.has(h)) continue
        if (!by.has(h)) by.set(h, new Set())
        by.get(h)!.add(p.handle)
      }
    }
    // Already measured, by any run for any campaign, is already paid for.
    const handles = []
    let known = 0
    for (const [handle, from] of [...by.entries()].sort((a, b) => b[1].size - a[1].size)) {
      const seen = await ctx.db.query('creators').withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', handle)).first()
      if (seen) { known++; continue }
      handles.push({ handle, parents: [...from] })
      if (handles.length >= (args.limit ?? 300)) break
    }
    return { parents: list.length, cited: by.size, known, handles }
  },
})

/** Pays for the neighbours of this campaign's good accounts, inside fair use. */
export const neighbours = internalAction({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const campaign = await ctx.runQuery(internal.crawl.campaignFor, { campaignId: args.campaignId })
    if (!campaign) return { error: 'No such campaign' }
    const budget = await ctx.runQuery(internal.ops.budgetLeft, { accountId: campaign.accountId })
    if (budget.left <= 0) return { error: 'Fair use reached for today', internal: true }

    const found = await ctx.runQuery(internal.sourcing.harvest, {
      campaignId: args.campaignId, limit: Math.min(args.limit ?? 300, budget.left),
    })
    if ('error' in found) return found
    const sources = found.handles as { handle: string; parents: string[] }[]
    if (!sources.length) return { ...found, note: 'Nobody new to look at' }
    const run = await ctx.runAction(internal.ingest.detailRun, {
      handles: sources.map((s) => s.handle), campaignId: args.campaignId, channel: 'neighbour', sources,
    })
    return { parents: found.parents, cited: found.cited, known: found.known, asked: sources.length, ...run }
  },
})

/**
 * Instagram's own account search, one run per query. Asked for details, the
 * actor answers with whole profiles, followers and last posts included, so
 * the search run is the detail run: 0.23 cents a profile, measured, and no
 * second run to pay for.
 *
 * Every limit is set by hand here. Left to its defaults the actor takes a
 * profile search as a request for a hundred posts from each account found,
 * and one probe of thirty accounts cost eleven dollars that way.
 *
 * Measured on the first query, "online personal trainer": 36 of 40 were
 * named for the job, against 120 accounts for "fitness coach" of which 4
 * were in a niche. The words of the niche are the query, never the topic.
 */
export const accounts = internalAction({
  args: { campaignId: v.id('campaigns'), queries: v.optional(v.array(v.string())), perQuery: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const campaign = await ctx.runQuery(internal.crawl.campaignFor, { campaignId: args.campaignId })
    if (!campaign) return { error: 'No such campaign' }
    const budget = await ctx.runQuery(internal.ops.budgetLeft, { accountId: campaign.accountId })
    if (budget.left <= 0) return { error: 'Fair use reached for today', internal: true }

    const queries = (args.queries?.length
      ? args.queries
      : (campaign.extracted.niches ?? []).filter((n: { enabled: boolean }) => n.enabled).map((n: { label: string }) => n.label)
    ).map((q: string) => q.trim()).filter(Boolean).slice(0, 10)
    if (!queries.length) return { error: 'Nothing to search for' }

    const runs = []
    for (const query of queries) {
      const input = {
        search: query,
        searchType: 'user',
        searchLimit: Math.min(args.perQuery ?? 50, budget.left),
        resultsType: 'details',
        resultsLimit: 15,
      }
      const started = await startRun(input, { phase: 'search', campaignId: args.campaignId, channel: 'accounts' })
      if ('error' in started) { runs.push({ query, ...started }); continue }
      await ctx.runMutation(internal.crawl.noteRun, {
        externalRunId: started.runId, phase: 'search', campaignId: args.campaignId, channel: 'accounts',
      })
      runs.push({ query, runId: started.runId })
    }
    return { runs }
  },
})

/** The client's own handles, measured and judged like anyone else. */
export const seeds = internalAction({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const campaign = await ctx.runQuery(internal.crawl.campaignFor, { campaignId: args.campaignId })
    if (!campaign) return { error: 'No such campaign' }
    const handles = (campaign.brief.seeds ?? []) as string[]
    if (!handles.length) return { error: 'This campaign names no accounts' }
    return await ctx.runAction(internal.ingest.detailRun, { handles, campaignId: args.campaignId, channel: 'seed' })
  },
})

/**
 * Writes the channel on profiles measured before the channel was written.
 * The first real run found everyone through a hashtag search.
 */
export const backfill = internalMutation({
  args: { channel: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, { channel }) => {
    const rows = await ctx.db.query('creators').collect()
    let fixed = 0
    for (const c of rows) {
      if (c.foundVia) continue
      await ctx.db.patch(c._id, { foundVia: { channel: channel ?? 'search' } })
      fixed++
    }
    return { fixed }
  },
})

/**
 * Writes the cited handles on profiles measured before they were kept. Read
 * from the run datasets Apify still holds, so nothing is paid for twice.
 */
export const setCited = internalMutation({
  args: { rows: v.array(v.object({ handle: v.string(), cited: v.array(v.string()) })) },
  returns: v.any(),
  handler: async (ctx, { rows }) => {
    let written = 0
    for (const r of rows) {
      const c = await ctx.db.query('creators').withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', r.handle)).first()
      if (!c) continue
      await ctx.db.patch(c._id, { cited: r.cited.slice(0, 200) })
      written++
    }
    return { written }
  },
})
