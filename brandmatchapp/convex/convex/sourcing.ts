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
    // A handle the client named is a parent whatever the rules said about it.
    // They are telling us who they want; an account that misses the follower
    // ceiling by a hair still stands among exactly the right people, and its
    // neighbourhood is the neighbourhood we are looking for.
    const named = new Set((campaign.brief.seeds ?? []).map((h) => h.toLowerCase()))
    const rows = await ctx.db.query('evaluations').withIndex('by_campaign', (q) => q.eq('campaignId', campaignId)).collect()
    const out = []
    const seen = new Set<string>()
    for (const e of rows) {
      const c = await ctx.db.get(e.creatorId)
      if (!c) continue
      const isNamed = named.has(c.handle)
      if (!isNamed) {
        if (!PARENT_VERDICTS.has(e.verdict)) continue
        if (hasNiches && !e.niche) continue
      }
      seen.add(c.handle)
      out.push({
        handle: c.handle,
        verdict: e.verdict,
        score: e.score,
        niche: e.niche ?? null,
        cited: c.cited ?? [],
        related: c.related ?? [],
      })
    }
    for (const handle of named) {
      if (seen.has(handle)) continue
      const c = await ctx.db
        .query('creators')
        .withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', handle))
        .first()
      if (!c) continue
      out.push({ handle: c.handle, verdict: 'named', score: 0, niche: null, cited: c.cited ?? [], related: c.related ?? [] })
    }
    // Qualified first, then by fit. The order decides who gets cited first
    // when the run is capped.
    return out.sort((a, b) => Number(b.verdict === 'qualified') - Number(a.verdict === 'qualified') || b.score - a.score)
  },
})

/**
 * Everyone the good accounts point at, ranked, before a penny is spent.
 *
 * Two free signals sit on a profile we have already paid for:
 *
 *   related  the accounts Instagram itself shows beside this one. It computes
 *            them on audience overlap, so the neighbours of a 900k account are
 *            other 900k accounts. This is the only size signal we get without
 *            paying, and it only comes back when the profile was fetched by
 *            its own url: a search result does not carry it.
 *   cited    the handles mentioned and tagged in their last posts. Plentiful
 *            and much weaker: a coach tags their gym, their sponsor and their
 *            friend as readily as a peer.
 *
 * So a suggestion counts for three and a mention for one, and a handle has to
 * reach two before it is worth a profile. One suggestion clears it. One
 * mention never does, which is the whole point: a handle two coaches both tag
 * is a peer, a handle one of them tags once is usually a brand.
 */
export const candidates = internalQuery({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()), floor: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const list = (await ctx.runQuery(internal.sourcing.parents, { campaignId: args.campaignId })) as
      | { handle: string; cited: string[]; related?: string[] }[]
      | { error: string }
    if ('error' in list) return list

    const parentHandles = new Set(list.map((p) => p.handle))
    const rows = new Map<string, { suggested: Set<string>; mentioned: Set<string> }>()
    const put = (handle: string, parent: string, how: 'suggested' | 'mentioned') => {
      if (!handle || parentHandles.has(handle)) return
      if (!rows.has(handle)) rows.set(handle, { suggested: new Set(), mentioned: new Set() })
      rows.get(handle)![how].add(parent)
    }
    for (const p of list) {
      for (const h of p.related ?? []) put(h, p.handle, 'suggested')
      for (const h of p.cited ?? []) put(h, p.handle, 'mentioned')
    }

    const floor = args.floor ?? 2
    const scored = [...rows.entries()]
      .map(([handle, v]) => ({
        handle,
        suggestedBy: [...v.suggested],
        mentionedBy: [...v.mentioned],
        score: v.suggested.size * 3 + v.mentioned.size,
      }))
      .sort((a, b) => b.score - a.score || b.suggestedBy.length - a.suggestedBy.length)

    const worth = scored.filter((c) => c.score >= floor)
    const handles = []
    let known = 0
    for (const c of worth) {
      const seen = await ctx.db
        .query('creators')
        .withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', c.handle))
        .first()
      if (seen) { known++; continue }
      // One parent that both suggests and mentions a handle is still one
      // parent. The list is what the lead shows as where it came from.
      handles.push({
        handle: c.handle,
        parents: [...new Set([...c.suggestedBy, ...c.mentionedBy])],
        score: c.score,
      })
      if (handles.length >= (args.limit ?? 300)) break
    }

    return {
      parents: list.length,
      /** Every distinct handle the parents point at, at any strength. */
      seen: rows.size,
      suggested: scored.filter((c) => c.suggestedBy.length).length,
      mentionedTwice: scored.filter((c) => !c.suggestedBy.length && c.mentionedBy.length > 1).length,
      worth: worth.length,
      known,
      fresh: handles.length,
      handles,
    }
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

    const found = await ctx.runQuery(internal.sourcing.candidates, {
      campaignId: args.campaignId, limit: Math.min(args.limit ?? 300, budget.left),
    })
    if ('error' in found) return found
    const sources = found.handles as { handle: string; parents: string[] }[]
    if (!sources.length) return { ...found, note: 'Nobody new to look at' }
    const run = await ctx.runAction(internal.ingest.detailRun, {
      handles: sources.map((s) => s.handle),
      campaignId: args.campaignId,
      channel: 'neighbour',
      // The rank is ours to decide with, never ours to store on the run.
      sources: sources.map((s) => ({ handle: s.handle, parents: s.parents })),
    })
    return {
      parents: found.parents, seen: found.seen, suggested: found.suggested,
      worth: found.worth, known: found.known, asked: sources.length, ...run,
    }
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
        // Same payload as fifteen. See ingest.detailRun.
        resultsLimit: 1,
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

/**
 * What one run actually bought.
 *
 * The channel figures on the ops screen mix every profile a channel ever
 * found, across campaigns and across months. Comparing two ways of searching
 * needs the batch each one paid for, on its own.
 */
export const cohort = internalQuery({
  args: {
    externalRunId: v.optional(v.string()),
    handles: v.optional(v.array(v.string())),
    campaignId: v.optional(v.id('campaigns')),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const run = args.externalRunId
      ? await ctx.db
          .query('crawlRuns')
          .withIndex('by_external', (q) => q.eq('externalRunId', args.externalRunId!))
          .first()
      : null
    if (args.externalRunId && !run) return { error: 'No such run' }
    const asked = args.handles?.length
      ? args.handles.map((h) => h.toLowerCase().replace(/^@/, ''))
      : (run?.sources ?? []).map((s) => s.handle)
    const campaignId = run?.campaignId ?? args.campaignId
    const out: Record<string, number> = {}
    const sizes: number[] = []
    let found = 0
    for (const handle of asked) {
      const creator = await ctx.db
        .query('creators')
        .withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', handle))
        .first()
      if (!creator) { out.never_fetched = (out.never_fetched ?? 0) + 1; continue }
      found++
      sizes.push(creator.followers ?? 0)
      const ev = await ctx.db
        .query('evaluations')
        .withIndex('by_campaign_creator', (q) =>
          q.eq('campaignId', campaignId!).eq('creatorId', creator._id))
        .first()
      const key = ev ? `${ev.verdict}${ev.blockedBy ? ':' + ev.blockedBy : ''}` : 'not_scored'
      out[key] = (out[key] ?? 0) + 1
    }
    sizes.sort((a, b) => a - b)
    return {
      asked: asked.length,
      fetched: found,
      medianFollowers: sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0,
      over100k: sizes.filter((n) => n >= 100_000).length,
      verdicts: out,
      costCents: run?.costCents,
      profilesFetched: run?.profilesFetched,
    }
  },
})
