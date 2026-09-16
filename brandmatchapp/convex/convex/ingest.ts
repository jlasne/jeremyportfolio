import { internalAction, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { deliver } from './pool'
import { newestSignal, type Signal } from './scoring'
import { APIFY, ACTOR, toBase64 } from './crawl'

// What Apify sends back, turned into pool rows.
//
//   search run → pull the handles out, start the detail run on them
//   detail run → write the profiles into the pool, claim what is free, score it
//
// Engagement and median views are computed from the 12 posts we crawl
// ourselves. An aggregator's average-views field has been measured at up to
// 74 times the real number, so it is never read.

function median(ns: number[]): number | undefined {
  const v = ns.filter((n) => n > 0).sort((a, b) => a - b)
  if (!v.length) return undefined
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2)
}

function postsPerMonth(dates: number[]): number | undefined {
  const t = dates.filter((n) => n > 0).sort((a, b) => b - a)
  if (t.length < 2) return undefined
  const spanDays = (t[0] - t[t.length - 1]) / 86_400_000
  if (spanDays < 1) return t.length
  return Math.round((t.length / spanDays) * 30.4 * 100) / 100
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/

/** What the creator sells today, in plain words, from the bio and the link. */
export function sellsFrom(bio: string, link: string): string {
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
export function signalsFrom(bio: string, posts: { caption: string; date: string }[], now: Date): Signal[] {
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

async function datasetItems(datasetId: string, token: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${APIFY}/datasets/${datasetId}/items?token=${token}&clean=true&limit=2000`)
  return res.ok ? ((await res.json()) as Record<string, unknown>[]) : []
}

/** Called by the /apify HTTP route when a run ends. */
export const fromApify = internalAction({
  args: {
    runId: v.string(),
    status: v.string(),
    datasetId: v.optional(v.string()),
    phase: v.string(),
    campaignId: v.id('campaigns'),
    agentId: v.optional(v.id('agents')),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = process.env.APIFY_TOKEN
    if (!token) return { error: 'APIFY_TOKEN is not set' }

    if (args.status !== 'SUCCEEDED' || !args.datasetId) {
      await ctx.runMutation(internal.crawl.finishRun, {
        runId: args.runId, status: args.status, error: `Apify run ${args.status}`,
      })
      return { ok: true, note: `run ${args.status}` }
    }

    const rows = await datasetItems(args.datasetId, token)
    await ctx.runMutation(internal.crawl.finishRun, {
      runId: args.runId, status: 'SUCCEEDED', items: rows.length,
    })

    // Phase one: handles out of the posts, straight into a detail run --------
    if (args.phase === 'search') {
      const handles = [...new Set(rows.map((r) => String(r.ownerUsername ?? '').toLowerCase()).filter(Boolean))]
      if (!handles.length) return { ok: true, handles: 0 }

      const hook = toBase64(JSON.stringify([{
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT'],
        requestUrl: `${process.env.CONVEX_SITE_URL ?? ''}/apify`,
        headersTemplate: JSON.stringify({ 'x-crawl-secret': process.env.CRAWL_SECRET ?? '' }),
        payloadTemplate: JSON.stringify({
          runId: '{{resource.id}}', status: '{{resource.status}}',
          datasetId: '{{resource.defaultDatasetId}}',
          phase: 'detail', campaignId: args.campaignId, agentId: args.agentId ?? '',
        }),
      }]))

      const input = {
        directUrls: handles.slice(0, 300).map((h) => `https://www.instagram.com/${h}/`),
        resultsType: 'details',
        resultsLimit: 12,
        addParentData: false,
      }
      const res = await fetch(`${APIFY}/acts/${ACTOR}/runs?token=${token}&webhooks=${encodeURIComponent(hook)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      })
      const started = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
      if (res.ok && started?.data?.id) {
        await ctx.runMutation(internal.crawl.noteRun, {
          runId: started.data.id, phase: 'detail',
          campaignId: args.campaignId, agentId: args.agentId, input,
        })
      }
      return { ok: true, handles: handles.length, detailRun: started?.data?.id ?? null }
    }

    // Phase two: the profiles land in the pool ------------------------------
    const now = new Date()
    const profiles = []
    for (const r of rows) {
      const handle = String(r.username ?? '').toLowerCase()
      if (!handle) continue

      const latest = (Array.isArray(r.latestPosts) ? r.latestPosts : []) as Record<string, unknown>[]
      const posts = latest.slice(0, 12).map((p) => ({
        kind: p.type === 'Video' || p.videoViewCount ? 'reel' : 'post',
        url: String(p.url ?? ''),
        thumbnail: String(p.displayUrl ?? ''),
        caption: String(p.caption ?? '').slice(0, 2000),
        views: Number(p.videoViewCount ?? p.videoPlayCount ?? 0),
        likes: Number(p.likesCount ?? 0),
        comments: Number(p.commentsCount ?? 0),
        date: String(p.timestamp ?? ''),
      })).filter((p) => p.url)

      const followers = Number(r.followersCount ?? 0)
      const bio = String(r.biography ?? '')
      const link = String(r.externalUrl ?? '')
      const medianEngagement = median(posts.map((p) => p.likes + p.comments))
      const signals = signalsFrom(bio, posts.map((p) => ({ caption: p.caption, date: p.date })), now)
      const postDates = posts.map((p) => Date.parse(p.date)).filter((n) => !Number.isNaN(n))

      profiles.push({
        creator: {
          platform: 'instagram',
          handle,
          name: String(r.fullName ?? ''),
          bio,
          avatar: String(r.profilePicUrlHD ?? r.profilePicUrl ?? '') || undefined,
          followers,
          engagementRate: followers > 0 && medianEngagement
            ? Math.round((medianEngagement / followers) * 10_000) / 10_000 : undefined,
          medianReelViews: median(posts.filter((p) => p.kind === 'reel').map((p) => p.views)),
          postsPerMonth: postsPerMonth(postDates),
          lastPostAt: postDates.length ? Math.max(...postDates) : undefined,
          email: String(r.publicEmail ?? r.businessEmail ?? '') || bio.match(EMAIL)?.[0] || undefined,
          externalLinks: [link, ...(Array.isArray(r.externalUrls)
            ? (r.externalUrls as { url?: string }[]).map((u) => u?.url ?? '') : [])].filter(Boolean),
          sells: sellsFrom(bio, link),
          signals,
          lastSignalAt: newestSignal(signals),
        },
        posts: posts.map((p) => ({
          kind: p.kind, url: p.url, thumbnail: p.thumbnail, caption: p.caption,
          views: p.views, likes: p.likes, comments: p.comments,
          postedAt: Date.parse(p.date) || undefined,
        })),
      })
    }

    const result = await ctx.runMutation(internal.ingest.save, {
      runId: args.runId, campaignId: args.campaignId, agentId: args.agentId,
      gathered: rows.length, profiles,
    })

    // Hand the new rows to the model.
    if (result.claimed.length) {
      await ctx.scheduler.runAfter(0, internal.qualify.score, {
        campaignId: args.campaignId, creatorIds: result.claimed,
      })
    }
    return result
  },
})

/**
 * Writes the crawl into the pool. The profile is refreshed either way, which
 * is worth having for whoever holds it. Whether this campaign may be given it
 * is a separate question, and deliver() answers it.
 */
export const save = internalMutation({
  args: {
    runId: v.string(),
    campaignId: v.id('campaigns'),
    agentId: v.optional(v.id('agents')),
    gathered: v.number(),
    profiles: v.array(v.object({ creator: v.any(), posts: v.array(v.any()) })),
  },
  returns: v.object({ ingested: v.number(), fresh: v.number(), heldByOthers: v.number(), claimed: v.array(v.id('creators')) }),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign) return { ingested: 0, fresh: 0, heldByOthers: 0, claimed: [] }

    let fresh = 0
    let held = 0
    const claimed = []

    for (const p of args.profiles) {
      const c = p.creator
      const existing = await ctx.db
        .query('creators')
        .withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', c.handle))
        .first()

      let creatorId
      if (existing) {
        await ctx.db.patch(existing._id, { ...c, lastCrawlAt: Date.now() })
        creatorId = existing._id
      } else {
        creatorId = await ctx.db.insert('creators', {
          ...c, firstSeenAt: Date.now(), lastCrawlAt: Date.now(),
        })
      }

      for (const post of p.posts) {
        const seen = await ctx.db
          .query('posts')
          .withIndex('by_creator_url', (q) => q.eq('creatorId', creatorId).eq('url', post.url))
          .first()
        if (seen) await ctx.db.patch(seen._id, post)
        else await ctx.db.insert('posts', { ...post, creatorId })
      }

      const creator = await ctx.db.get(creatorId)
      if (!creator) continue
      const isNew = !existing
      if (await deliver(ctx, { creator, campaign, agentId: args.agentId, fresh: isNew })) {
        if (isNew) fresh++
        claimed.push(creatorId)
      } else {
        held++
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const stat = await ctx.db
      .query('dailyStats')
      .withIndex('by_campaign_date', (q) => q.eq('campaignId', args.campaignId).eq('date', today))
      .first()
    if (stat) {
      await ctx.db.patch(stat._id, {
        gathered: stat.gathered + args.gathered,
        leads: stat.leads + claimed.length,
      })
    } else {
      await ctx.db.insert('dailyStats', {
        date: today, campaignId: args.campaignId, agentId: args.agentId,
        gathered: args.gathered, leads: claimed.length, qualified: 0,
      })
    }

    return { ingested: claimed.length, fresh, heldByOthers: held, claimed }
  },
})
