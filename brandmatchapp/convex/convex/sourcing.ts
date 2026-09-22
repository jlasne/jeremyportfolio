import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { FRESH_MS, startRun } from './crawl'
import { loosest } from './gates'

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
 * Empty runs in a row before a query is retired. One.
 *
 * The plan said two. Two is right for a well that refills and wrong for a
 * list, and Instagram's account search is a list: the same words hand back
 * the same accounts in the same order, so a run that found nothing new found
 * nothing new for a reason that will still hold next week. Measured on this
 * campaign, two queries came back with 26 profiles and zero new between them
 * on their second run; waiting for a third would buy that twice more.
 *
 * A run that fetched no profiles at all is not evidence and does not count.
 * That is a budget cap or a failed actor talking, not the query.
 *
 * Retirement is reversible: accounts takes force, for the day a query is
 * worth asking deeper than it was asked before.
 */
const RETIRE_AFTER = 1

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
 * What each set of words has actually given this campaign.
 *
 * Instagram's account search is deterministic: the same words hand back the
 * same accounts in the same order. So a query is not a well, it is a list,
 * and once the list is on file it returns nothing however often it is paid
 * for. Measured on one campaign: seven queries, 504 profiles bought, 135 of
 * them new, and two of the seven gave zero twice in a row.
 *
 * A query that gave zero new profiles on each of its last two finished runs
 * is retired. Two, not one, because a first run capped by the daily budget
 * can come back empty for a reason that has nothing to do with the words.
 *
 * Only finished runs count. A run that failed says nothing about the query.
 */
export const queryYield = internalQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const runs = await ctx.db
      .query('crawlRuns')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect()

    type Row = { query: string; runs: number; fetched: number; fresh: number; cents: number; recent: number[] }
    const by = new Map<string, Row>()
    for (const r of [...runs].sort((a, b) => a.startedAt - b.startedAt)) {
      if (!r.query) continue
      const key = r.query.trim().toLowerCase()
      if (!by.has(key)) by.set(key, { query: r.query, runs: 0, fetched: 0, fresh: 0, cents: 0, recent: [] })
      const row = by.get(key)!
      row.runs++
      row.fetched += r.profilesFetched
      row.cents += r.costCents
      if (r.status !== 'SUCCEEDED' || r.profilesFresh === undefined) continue
      row.fresh += r.profilesFresh
      // Only a run that bought something has an opinion on the query.
      if (r.profilesFetched > 0) row.recent.push(r.profilesFresh)
    }

    const rows = [...by.values()]
      .map((r) => ({
        query: r.query,
        runs: r.runs,
        fetched: r.fetched,
        fresh: r.fresh,
        /** The share of what it bought that it had never seen before. */
        freshShare: r.fetched ? Math.round((r.fresh / r.fetched) * 100) : 0,
        costCents: r.cents,
        centsPerFresh: r.fresh ? Math.round((r.cents / r.fresh) * 100) / 100 : null,
        retired: r.recent.length >= RETIRE_AFTER && r.recent.slice(-RETIRE_AFTER).every((n) => n === 0),
      }))
      .sort((a, b) => b.fresh - a.fresh)

    return {
      rows,
      retired: rows.filter((r) => r.retired).map((r) => r.query.trim().toLowerCase()),
      fetched: rows.reduce((n, r) => n + r.fetched, 0),
      fresh: rows.reduce((n, r) => n + r.fresh, 0),
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
  args: {
    campaignId: v.id('campaigns'),
    queries: v.optional(v.array(v.string())),
    perQuery: v.optional(v.number()),
    /** Run a retired query anyway. For measuring whether it has come back. */
    force: v.optional(v.boolean()),
  },
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

    // A query that has already given this campaign everything it has is not
    // asked a third time. See queryYield for the rule and what it is worth.
    const yields = (await ctx.runQuery(internal.sourcing.queryYield, {
      campaignId: args.campaignId,
    })) as { retired: string[] }
    const spent = new Set(args.force ? [] : yields.retired)

    const runs = []
    for (const query of queries) {
      if (spent.has(query.toLowerCase())) {
        runs.push({ query, retired: 'gave nothing new the last time it was paid for' })
        continue
      }
      const input = {
        search: query,
        searchType: 'user',
        searchLimit: Math.min(args.perQuery ?? 50, budget.left),
        resultsType: 'details',
        // Same payload as fifteen. See ingest.detailRun.
        resultsLimit: 1,
      }
      const started = await startRun(input, { phase: 'search', campaignId: args.campaignId, channel: 'accounts' })
      if ('error' in started) {
        runs.push({ query, ...started })
        // Out of Apify budget stops the whole loop. Nine more refusals tell
        // us nothing the first one did not.
        if (started.error.includes('left this cycle')) break
        continue
      }
      await ctx.runMutation(internal.crawl.noteRun, {
        externalRunId: started.runId, phase: 'search', campaignId: args.campaignId, channel: 'accounts',
        query,
      })
      runs.push({ query, runId: started.runId })
    }
    return { runs, retired: [...spent] }
  },
})

/**
 * The profiles on file whose numbers have gone stale, oldest first.
 *
 * Only ones this campaign has never judged. A profile it has already ruled on
 * is a verdict, and a verdict is not re-opened by the clock.
 */
export const stale = internalQuery({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - FRESH_MS
    const done = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    const judged = new Set(done.map((e) => e.creatorId))

    // Oldest measurement first, so the walk stops at the first fresh row.
    const rows = await ctx.db.query('creators').withIndex('by_measured').order('asc').take(2_000)
    const handles: string[] = []
    let held = 0
    for (const c of rows) {
      if ((c.measuredAt ?? 0) > cutoff) break
      held++
      if (judged.has(c._id)) continue
      if (handles.length < (args.limit ?? 200)) handles.push(c.handle)
    }
    return { stale: held, handles }
  },
})

/**
 * Buys the stale profiles again, so they can be judged on today's numbers.
 *
 * This is the one caller that is allowed past the freshness check, because
 * the whole point of the run is that the measurement has expired.
 */
export const refresh = internalAction({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const campaign = await ctx.runQuery(internal.crawl.campaignFor, { campaignId: args.campaignId })
    if (!campaign) return { error: 'No such campaign' }
    const budget = await ctx.runQuery(internal.ops.budgetLeft, { accountId: campaign.accountId })
    if (budget.left <= 0) return { error: 'Fair use reached for today', internal: true }

    const found = await ctx.runQuery(internal.sourcing.stale, {
      campaignId: args.campaignId, limit: Math.min(args.limit ?? 200, budget.left),
    })
    if (!found.handles.length) return { ...found, note: 'Every profile on file was measured inside the window' }
    const run = await ctx.runAction(internal.ingest.detailRun, {
      handles: found.handles, campaignId: args.campaignId, channel: 'refresh', refresh: true,
    })
    return { stale: found.stale, asked: found.handles.length, ...run }
  },
})

/**
 * How well each channel aims, on this campaign.
 *
 * The ops screen mixes every profile a channel ever found, across campaigns
 * and across months. That answers which channel is good in general, which is
 * not a question anyone has. The question is which channel is good for this
 * client, whose follower window is their own, and the answer changes with it:
 * a channel that lands 63% for someone hunting 500k accounts lands near
 * nothing for someone hunting 10k ones.
 *
 * Aim is the share of what a channel bought that fell inside the window.
 * Everything else follows from it: the profile costs the same whoever found
 * it, so cost per candidate in the target is the profile price divided by aim.
 */
export const aim = internalQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign) return { error: 'No such campaign' }
    const gates = campaign.gateSetId ? await ctx.db.get(campaign.gateSetId) : null
    if (!gates) return { error: 'This campaign has no gates yet' }
    const hard = loosest(gates.hard, campaign.extracted.niches ?? [])
    const lo = hard.followersMin ?? 0
    const hi = hard.followersMax ?? Number.MAX_SAFE_INTEGER

    const rows = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()

    type Line = { bought: number; inWindow: number; qualified: number }
    const by = new Map<string, Line>()
    for (const e of rows) {
      const c = await ctx.db.get(e.creatorId)
      if (!c) continue
      const key = c.foundVia?.channel ?? 'search'
      const line = by.get(key) ?? { bought: 0, inWindow: 0, qualified: 0 }
      line.bought++
      const n = c.followers ?? 0
      if (n >= lo && n <= hi) line.inWindow++
      if (e.verdict === 'qualified') line.qualified++
      by.set(key, line)
    }

    // What each channel was paid. A run belongs to one channel, so this is
    // the one number that does not need a join.
    const runs = await ctx.db
      .query('crawlRuns')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    const cents = new Map<string, number>()
    for (const r of runs) {
      const key = r.channel ?? 'search'
      cents.set(key, (cents.get(key) ?? 0) + r.costCents)
    }

    const channels = [...by.entries()]
      .map(([channel, l]) => ({
        channel,
        bought: l.bought,
        inWindow: l.inWindow,
        /** The share that landed inside the window. The number to compare. */
        aim: l.bought ? Math.round((l.inWindow / l.bought) * 100) : 0,
        qualified: l.qualified,
        costCents: cents.get(channel) ?? 0,
        centsPerInWindow: l.inWindow ? Math.round(((cents.get(channel) ?? 0) / l.inWindow) * 100) / 100 : null,
      }))
      .sort((a, b) => b.aim - a.aim)

    return { window: { followersMin: lo, followersMax: hard.followersMax ?? null }, channels }
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
 * Asks Apify what really happened to every run still marked as running.
 *
 * A run is written down when it starts and closed by the webhook when it
 * ends. When the webhook never arrives the row stays open for ever: it reads
 * as zero profiles and zero cost, so a campaign that paid for a run looks
 * like a campaign that never made it. Thirteen runs of one campaign sat that
 * way.
 *
 * Report first. Closing a run is free; re-reading its dataset writes profiles
 * and sets the judge going, which costs money, so that half is asked for.
 */
export const reconcile = internalAction({
  args: { campaignId: v.id('campaigns'), ingest: v.optional(v.boolean()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const token = process.env.APIFY_TOKEN
    if (!token) return { error: 'APIFY_TOKEN is not set' }
    const runs = (await ctx.runQuery(internal.crawl.runsFor, { campaignId: args.campaignId })) as {
      externalRunId?: string; phase: string; status: string; query?: string; channel?: string
    }[]

    const out: Record<string, unknown>[] = []
    let closed = 0
    let rows = 0
    for (const r of runs) {
      if (r.status !== 'RUNNING' || !r.externalRunId) continue
      const meta = await fetch(`https://api.apify.com/v2/actor-runs/${r.externalRunId}?token=${token}`)
      if (!meta.ok) continue
      const data = (await meta.json())?.data
      const status = String(data?.status ?? '')
      if (status === 'RUNNING' || status === 'READY') { out.push({ query: r.query, status }); continue }
      const costUsd = Number(data?.usageTotalUsd ?? 0)
      const datasetId = String(data?.defaultDatasetId ?? '')

      let held = 0
      if (status === 'SUCCEEDED' && datasetId) {
        const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=2000`)
        held = res.ok ? ((await res.json()) as unknown[]).length : 0
      }
      rows += held
      out.push({ query: r.query, status, costUsd, held })

      if (status === 'SUCCEEDED' && held) {
        // Rows we paid for and never read. Closing the run would lose them,
        // so it stays open until someone asks for them to be taken in.
        if (!args.ingest) continue
        await ctx.runAction(internal.ingest.fromApify, {
          runId: r.externalRunId, status, datasetId, phase: r.phase,
          campaignId: args.campaignId, costUsd, channel: r.channel,
        })
        closed++
        continue
      }
      await ctx.runMutation(internal.crawl.finishRun, {
        externalRunId: r.externalRunId,
        status,
        ...(costUsd ? { costCents: Math.round(costUsd * 100) } : { costCents: 0 }),
        ...(status === 'SUCCEEDED' ? {} : { error: `Apify run ${status}` }),
      })
      closed++
    }
    return { open: out.length, closed, rowsWaiting: rows, ingested: Boolean(args.ingest), runs: out }
  },
})

/**
 * Counts what each finished run actually discovered, on runs that finished
 * before the count existed.
 *
 * A profile carries the moment it was first seen. A run carries the window it
 * ran in. Every profile first seen inside a run's window was discovered by
 * that run, so the number is recoverable without paying Apify anything.
 */
export const backfillFresh = internalAction({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const token = process.env.APIFY_TOKEN
    if (!token) return { error: 'APIFY_TOKEN is not set' }
    const runs = (await ctx.runQuery(internal.crawl.runsFor, { campaignId: args.campaignId })) as {
      externalRunId?: string; status: string; query?: string
      profilesFresh?: number; startedAt: number; finishedAt?: number
    }[]
    const out = []
    for (const r of runs) {
      if (!r.externalRunId || r.status !== 'SUCCEEDED' || r.profilesFresh !== undefined) continue
      const meta = await fetch(`https://api.apify.com/v2/actor-runs/${r.externalRunId}?token=${token}`)
      if (!meta.ok) continue
      const datasetId = String((await meta.json())?.data?.defaultDatasetId ?? '')
      if (!datasetId) continue
      const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=2000&fields=username`)
      if (!res.ok) continue
      const handles = [...new Set(((await res.json()) as { username?: string }[])
        .map((x) => String(x?.username ?? '').toLowerCase()).filter(Boolean))]
      const fresh = (await ctx.runQuery(internal.ingest.firstSeenIn, {
        handles, from: r.startedAt, to: (r.finishedAt ?? r.startedAt) + 300_000,
      })) as number
      await ctx.runMutation(internal.crawl.finishRun, {
        externalRunId: r.externalRunId, status: 'SUCCEEDED', profilesFresh: fresh,
      })
      out.push({ query: r.query, fetched: handles.length, fresh })
    }
    return { written: out.length, runs: out }
  },
})

/**
 * Writes the words on runs started before runs kept them.
 *
 * Apify still holds the input of every run it has ever executed, so the query
 * is recoverable for free: the run record names a key-value store, and the
 * store holds the INPUT the run was started with. Without this, the retirement
 * rule would begin with no history and this campaign would pay a third time
 * for the two queries that have already given it everything they have.
 */
export const backfillQueries = internalAction({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const token = process.env.APIFY_TOKEN
    if (!token) return { error: 'APIFY_TOKEN is not set' }
    const runs = (await ctx.runQuery(internal.crawl.runsFor, { campaignId: args.campaignId })) as {
      externalRunId?: string; phase: string; query?: string
    }[]
    let written = 0
    let missing = 0
    for (const r of runs) {
      if (!r.externalRunId || r.query || r.phase !== 'search') continue
      const meta = await fetch(`https://api.apify.com/v2/actor-runs/${r.externalRunId}?token=${token}`)
      if (!meta.ok) { missing++; continue }
      const store = (await meta.json())?.data?.defaultKeyValueStoreId
      if (!store) { missing++; continue }
      const res = await fetch(`https://api.apify.com/v2/key-value-stores/${store}/records/INPUT?token=${token}`)
      if (!res.ok) { missing++; continue }
      const query = String((await res.json())?.search ?? '')
      if (!query) { missing++; continue }
      await ctx.runMutation(internal.crawl.setQuery, { externalRunId: r.externalRunId, query })
      written++
    }
    return { runs: runs.length, written, missing }
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
