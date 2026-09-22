import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { APIFY, FRESH_MS, startRun } from './crawl'

// What Apify sends back, turned into measured facts.
//
//   search run → pull the handles out, start the detail run on them
//   detail run → write the profile and its posts, then hand the campaign to
//                the gates
//
// Every number a gate reads is computed here from the 12 posts we fetched. An
// aggregator's average views field has been measured at up to 74 times the real
// figure, so it is never read. This file writes facts and judges nothing.

function median(ns: number[]): number | undefined {
  const values = ns.filter((n) => n > 0).sort((a, b) => a - b)
  if (!values.length) return undefined
  const mid = Math.floor(values.length / 2)
  return values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2)
}

function postsPerMonth(dates: number[]): number | undefined {
  const t = dates.filter((n) => n > 0).sort((a, b) => b - a)
  if (t.length < 2) return undefined
  const spanDays = (t[0] - t[t.length - 1]) / 86_400_000
  if (spanDays < 1) return t.length
  return Math.round((t.length / spanDays) * 30.4 * 100) / 100
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/
const HANDLE = /^[a-z0-9._]{1,30}$/

/** The handles a post points at: the people it mentions and the people it tags. */
function citedIn(post: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const m of Array.isArray(post.mentions) ? post.mentions : []) out.push(String(m))
  for (const t of Array.isArray(post.taggedUsers) ? post.taggedUsers : []) {
    out.push(String((t as { username?: string })?.username ?? t ?? ''))
  }
  return out.map((h) => h.toLowerCase().replace(/^@/, '')).filter((h) => HANDLE.test(h))
}

async function datasetItems(datasetId: string, token: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${APIFY}/datasets/${datasetId}/items?token=${token}&clean=true&limit=2000`)
  return res.ok ? ((await res.json()) as Record<string, unknown>[]) : []
}

/**
 * Writes the median likes on profiles measured before likes were kept.
 *
 * The posts are already in base with their like counts, so this reads what we
 * hold and computes. Nothing is paid for. Walks oldest first, a page at a
 * time, and hands back the cursor for the next page.
 */
export const backfillLikes = internalMutation({
  args: { after: v.optional(v.number()), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('creators')
      .withIndex('by_measured', (q) => q.gt('measuredAt', args.after ?? 0))
      .order('asc')
      .take(args.limit ?? 200)
    let written = 0
    let last = args.after ?? 0
    for (const c of rows) {
      last = c.measuredAt
      if (c.medianLikes !== undefined) continue
      const posts = await ctx.db
        .query('creatorPosts')
        .withIndex('by_creator', (q) => q.eq('creatorId', c._id))
        .collect()
      const likes = median(posts.filter((p) => !p.pinned).map((p) => p.likes))
      if (likes === undefined) continue
      await ctx.db.patch(c._id, { medianLikes: likes })
      written++
    }
    return { seen: rows.length, written, next: rows.length ? last : null }
  },
})

/**
 * Which of these handles we already hold a recent measurement of.
 *
 * Read before every detail run. The profile behind a handle costs 0.23 cents
 * whether or not we bought it last week, and Instagram's account search hands
 * back the same accounts for the same words every time, so a campaign that
 * searches twice pays twice for the same rows unless someone checks.
 */
export const alreadyFresh = internalQuery({
  args: { handles: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, { handles }) => {
    const cutoff = Date.now() - FRESH_MS
    const out: string[] = []
    for (const handle of handles) {
      const c = await ctx.db
        .query('creators')
        .withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', handle))
        .first()
      if (c && (c.measuredAt ?? 0) > cutoff) out.push(handle)
    }
    return out
  },
})

/** How many of these handles were first seen inside a window. */
export const firstSeenIn = internalQuery({
  args: { handles: v.array(v.string()), from: v.number(), to: v.number() },
  returns: v.number(),
  handler: async (ctx, { handles, from, to }) => {
    let n = 0
    for (const handle of handles) {
      const c = await ctx.db
        .query('creators')
        .withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', handle))
        .first()
      const seen = c?.firstSeenAt ?? 0
      if (seen >= from && seen <= to) n++
    }
    return n
  },
})

/**
 * Pay Apify for what only Apify has: the profile behind a handle, its bio, its
 * email and its last posts. Where the handles came from is not its business,
 * so a search engine and a hashtag crawl both end here.
 */
export const detailRun = internalAction({
  args: {
    handles: v.array(v.string()),
    campaignId: v.id('campaigns'),
    /** How these handles were found: search, accounts, neighbour or seed. */
    channel: v.optional(v.string()),
    /** The words that found them, when a search did. Kept so a query can be judged. */
    query: v.optional(v.string()),
    /**
     * Buy these profiles again even though we hold a recent measurement.
     *
     * The one reason to: the measurement has gone stale and the profile is
     * being brought back for judging. Every other caller leaves this off.
     */
    refresh: v.optional(v.boolean()),
    /** For a neighbour run, who pointed at each handle. */
    sources: v.optional(v.array(v.object({ handle: v.string(), parents: v.optional(v.array(v.string())) }))),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const asked = [...new Set(args.handles.map((h) => h.toLowerCase().replace(/^@/, '')))].filter(Boolean)
    // Nobody is bought twice inside the window. The cap is applied after, so
    // a run of 300 is 300 profiles we do not hold rather than 300 rows of
    // which 200 are already on file.
    const held = args.refresh
      ? []
      : ((await ctx.runQuery(internal.ingest.alreadyFresh, { handles: asked })) as string[])
    const skip = new Set(held)
    const handles = asked.filter((h) => !skip.has(h)).slice(0, 300)
    if (!handles.length) return { handles: 0, asked: asked.length, skipped: skip.size }
    const channel = args.channel ?? 'search'

    const input = {
      directUrls: handles.map((h) => `https://www.instagram.com/${h}/`),
      resultsType: 'details',
      // One. The actor hands back the twelve posts a profile shows anyway,
      // with their views, comments, likes and the related profiles, so asking
      // for fifteen asks for nothing more.
      //
      // It is not cheaper. Five profiles at one cost 0.138 cents each against
      // 0.23 at fifteen, which read as a 40% saving until eighty profiles at
      // one came back at 0.225. The actor charges for the profile, and a run
      // of five is too short to measure anything but its own startup.
      resultsLimit: 1,
      addParentData: false,
    }
    const started = await startRun(input, { phase: 'detail', campaignId: args.campaignId, channel })
    if ('error' in started) return { ...started, handles: handles.length }
    const bought = new Set(handles)
    await ctx.runMutation(internal.crawl.noteRun, {
      externalRunId: started.runId,
      phase: 'detail',
      campaignId: args.campaignId,
      channel,
      query: args.query,
      sources: (args.sources ?? []).filter((s) => bought.has(s.handle)),
    })
    return { runId: started.runId, handles: handles.length, asked: asked.length, skipped: skip.size }
  },
})

/** Called by the /apify HTTP route when a run ends. */
export const fromApify = internalAction({
  args: {
    runId: v.string(),
    status: v.string(),
    datasetId: v.optional(v.string()),
    phase: v.string(),
    campaignId: v.id('campaigns'),
    /** What Apify says the run cost, in dollars. */
    costUsd: v.optional(v.number()),
    /** How the handles in this run were found. */
    channel: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const token = process.env.APIFY_TOKEN
    if (!token) return { error: 'APIFY_TOKEN is not set' }

    if (args.status !== 'SUCCEEDED' || !args.datasetId) {
      await ctx.runMutation(internal.crawl.finishRun, {
        externalRunId: args.runId, status: args.status, error: `Apify run ${args.status}`,
      })
      return { ok: true, note: `run ${args.status}` }
    }

    const rows = await datasetItems(args.datasetId, token)
    await ctx.runMutation(internal.crawl.finishRun, {
      externalRunId: args.runId,
      status: 'SUCCEEDED',
      profilesFetched: rows.length,
      ...(args.costUsd !== undefined ? { costCents: Math.round(args.costUsd * 100) } : {}),
    })

    // Phase one: handles out of the results, straight into a detail run ------
    // A hashtag search answers with posts, which carry a handle and nothing
    // else. An account search answers with whole profiles, followers and
    // last posts included, so those go straight to phase two: a detail run
    // on them would pay for the same rows twice.
    const wholeProfiles = rows.some((r) => r.username && typeof r.followersCount === 'number')
    if (args.phase === 'search' && !wholeProfiles) {
      // The words carry over. A hashtag search pays for the handles here and
      // for the profiles in the next run, and only the second run knows how
      // many of them were new, so the query has to travel with them. The run
      // also carries the band, and this is the moment it has to be applied:
      // the posts are paid for, the profiles behind them are not.
      const asked = await ctx.runQuery(internal.crawl.runByExternal, { externalRunId: args.runId })
      const band = asked?.band as { min: number; max: number } | undefined

      // One author can have several posts in the results. Their best post is
      // the one to judge them on: a band set on a bad day's post would throw
      // away the right person for the wrong reason.
      const best = new Map<string, number>()
      for (const r of rows) {
        const handle = String(r.ownerUsername ?? r.username ?? '').toLowerCase()
        if (!handle) continue
        const likes = Number(r.likesCount ?? 0)
        if (likes > (best.get(handle) ?? -1)) best.set(handle, likes)
      }
      const seen = best.size
      const handles = [...best.entries()]
        .filter(([, likes]) => !band || (likes >= band.min && (!band.max || likes <= band.max)))
        .map(([handle]) => handle)

      if (!handles.length) return { ok: true, posts: rows.length, authors: seen, handles: 0, band }
      const run: Record<string, unknown> = await ctx.runAction(internal.ingest.detailRun, {
        handles, campaignId: args.campaignId, channel: args.channel ?? 'search', query: asked?.query,
      })
      return {
        ok: true, posts: rows.length, authors: seen, band,
        /** Authors the band kept, and so the only ones a profile is paid for. */
        inBand: handles.length,
        detailRun: run.runId ?? null, skipped: run.skipped ?? 0,
      }
    }

    // Phase two: the measured facts land -------------------------------------
    // The run record holds who pointed at each handle. Apify sends the run id
    // back and nothing else, so the parents wait there.
    const record = await ctx.runQuery(internal.crawl.runByExternal, { externalRunId: args.runId })
    const parentsOf = new Map<string, string[]>()
    for (const s of (record?.sources ?? []) as { handle: string; parents?: string[] }[]) {
      if (s.parents?.length) parentsOf.set(s.handle, s.parents)
    }
    const channel = args.channel ?? record?.channel ?? 'search'

    const now = Date.now()
    const profiles = []
    for (const r of rows) {
      const handle = String(r.username ?? '').toLowerCase()
      if (!handle) continue

      const latest = (Array.isArray(r.latestPosts) ? r.latestPosts : []) as Record<string, unknown>[]
      const posts = latest.slice(0, 15).map((p) => ({
        kind: p.type === 'Video' || p.videoViewCount ? 'reel' : 'post',
        url: String(p.url ?? ''),
        thumbnail: String(p.displayUrl ?? ''),
        caption: String(p.caption ?? '').slice(0, 2000),
        views: Number(p.videoViewCount ?? p.videoPlayCount ?? 0),
        likes: Number(p.likesCount ?? 0),
        comments: Number(p.commentsCount ?? 0),
        postedAt: Date.parse(String(p.timestamp ?? '')) || 0,
        pinned: Boolean(p.isPinned),
        // Paid partnership and the comments under a post are not in a profile
        // fetch. They come from a post run of their own, so they arrive when a
        // criterion asks for them and are priced there.
        ...(p.paidPartnership !== undefined ? { paid: Boolean(p.paidPartnership) } : {}),
      })).filter((p) => p.url && p.postedAt)

      // A pinned post is a chosen highlight and not a typical post. It sits
      // first in the list and is often years old, so it is kept for the record
      // and left out of every number. Without this, the first real run had a
      // daily poster at 0.14 posts a month because of two pins from 2019.
      const typical = posts.filter((p) => !p.pinned).slice(0, 12)

      // Views, counted only on posts that have had time to be seen. Someone
      // posting ten times a week has twelve posts four days old, and a post two
      // hours old has almost no views. Counting those punishes the most active
      // accounts for being active: measured on a real pipeline, at twenty one
      // posts a week it rejected 86% of them.
      const ripe = typical.filter((p) => now - p.postedAt >= 48 * 3_600_000)
      const forReach = ripe.length >= 6 ? ripe : typical

      const bio = String(r.biography ?? '')
      const link = String(r.externalUrl ?? '')
      const dates = typical.map((p) => p.postedAt)

      profiles.push({
        creator: {
          platform: 'instagram',
          handle,
          name: String(r.fullName ?? ''),
          bio,
          avatar: String(r.profilePicUrlHD ?? r.profilePicUrl ?? '') || undefined,
          followers: Number(r.followersCount ?? 0),
          // Gate 1 reads these three. All computed, none declared.
          medianViews: median(forReach.filter((p) => p.kind === 'reel').map((p) => p.views)),
          medianComments: median(forReach.map((p) => p.comments)),
          // Not judged on. It is the dial the post channel reads: likes are
          // free and arrive before the profile is paid for.
          medianLikes: median(forReach.map((p) => p.likes)),
          postsPerMonth: postsPerMonth(dates),
          lastPostAt: dates.length ? Math.max(...dates) : undefined,
          email: String(r.publicEmail ?? r.businessEmail ?? '') || bio.match(EMAIL)?.[0] || undefined,
          country: undefined,
          language: undefined,
          // What the profile says about itself. All of it arrives with every
          // fetch and was being dropped, and each line answers a question the
          // judge was scoring zero on for want of anything to read.
          verified: Boolean(r.verified) || undefined,
          category: String(r.businessCategoryName ?? '') || undefined,
          follows: Number(r.followsCount ?? 0) || undefined,
          postsLifetime: Number(r.postsCount ?? 0) || undefined,
          highlights: Number(r.highlightReelCount ?? 0) || undefined,
          reelShare: typical.length
            ? Math.round((typical.filter((p) => p.kind === 'reel').length / typical.length) * 100)
            : undefined,
          links: [link, ...(Array.isArray(r.externalUrls)
            ? (r.externalUrls as { url?: string }[]).map((u) => u?.url ?? '') : [])].filter(Boolean),
          foundVia: { channel, parents: parentsOf.get(handle) },
        },
        posts,
        // Everyone this person points at, across every post we read. Pinned
        // posts count here: an old collaboration still names a peer.
        cited: [...new Set(latest.flatMap(citedIn))].slice(0, 200),
        // Apify hands back the accounts Instagram shows next to this one. That
        // is the neighbour channel, free, in the same response, and the one
        // way of searching that finds accounts like the good ones.
        related: (Array.isArray(r.relatedProfiles) ? r.relatedProfiles : [])
          .map((x: any) => String(x?.username ?? '').toLowerCase())
          .filter(Boolean),
      })
    }

    const saved: { written: number; fresh: number } = await ctx.runMutation(internal.ingest.save, {
      campaignId: args.campaignId, profiles,
    })
    // Written back on the run, so a campaign can be read by the discovery it
    // actually did rather than by the rows it paid to see again.
    await ctx.runMutation(internal.crawl.finishRun, {
      externalRunId: args.runId, status: 'SUCCEEDED', profilesFresh: saved.fresh,
    })

    // Facts are in. The gates run next, and gate 1 costs nothing.
    await ctx.scheduler.runAfter(0, internal.evaluate.campaign, { campaignId: args.campaignId })
    return saved
  },
})

/**
 * Writes the crawl. The profile is refreshed whoever else holds it: a fresher
 * measurement is worth having, and measuring is not judging.
 */
export const save = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    profiles: v.array(v.object({
      creator: v.any(),
      posts: v.array(v.any()),
      related: v.optional(v.array(v.string())),
      cited: v.optional(v.array(v.string())),
    })),
  },
  returns: v.object({ written: v.number(), fresh: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now()
    let fresh = 0

    for (const p of args.profiles) {
      const { foundVia, ...c } = p.creator
      const existing = await ctx.db
        .query('creators')
        .withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', c.handle))
        .first()

      let creatorId
      if (existing) {
        // A re-measure keeps how the person was first found, and fills it in
        // when the first measure never wrote it.
        await ctx.db.patch(existing._id, {
          ...c, measuredAt: now, related: p.related, cited: p.cited,
          ...(existing.foundVia ? {} : { foundVia }),
        })
        creatorId = existing._id
      } else {
        fresh++
        creatorId = await ctx.db.insert('creators', {
          ...c, foundVia, related: p.related, cited: p.cited, measuredAt: now, firstSeenAt: now,
        })
      }

      for (const post of p.posts) {
        const seen = await ctx.db
          .query('creatorPosts')
          .withIndex('by_creator_url', (q) => q.eq('creatorId', creatorId).eq('url', post.url))
          .first()
        if (seen) await ctx.db.patch(seen._id, post)
        else await ctx.db.insert('creatorPosts', { ...post, creatorId })
      }
    }

    return { written: args.profiles.length, fresh }
  },
})
