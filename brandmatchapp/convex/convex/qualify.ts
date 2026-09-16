import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { QUALIFIED_MIN, sellingLevel, signalLevel } from './scoring'

// The Niche star, written by a model through OpenRouter.
//
// Selling and Signal are facts about the creator, read off the pool by every
// campaign alike. Niche is the one criterion that only means something
// against a brief, so it is the only one the model is asked for, and the only
// one stored per campaign.
//
// The default model reads 500 profiles for about half a cent, against the
// $1.15 the same 500 cost to crawl. Judgment is what to buy here, not tokens.

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash-0731'
const BATCH = 15

const SYSTEM = `You judge whether an Instagram creator fits a brand's brief.

You return one verdict per creator, nothing else.

niche:
  1    content, audience and follower band all fit the brief
  0.5  the right discipline, but a different audience or size band
  0    a different discipline

why: one plain sentence, under 20 words, no jargon, no numbers.
     Say what the creator does and how it sits against the brief.
sells: what this creator sells today, 2 to 4 words, from the bio only.
       Use "" when the bio shows nothing on sale.

Judge only on what you are given. Never invent a follower count, a product or a country.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['handle', 'niche', 'why', 'sells'],
        properties: {
          handle: { type: 'string' },
          niche: { type: 'number', enum: [0, 0.5, 1] },
          why: { type: 'string' },
          sells: { type: 'string' },
        },
      },
    },
  },
}

export interface Verdict { niche: number; why: string; sells: string }

export async function askModel(
  key: string,
  model: string,
  brief: string,
  rows: { handle: string; line: string }[],
): Promise<Record<string, Verdict>> {
  const res = await fetch(OPENROUTER, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://brandmatch.app',
      'X-Title': 'brandmatch',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `${brief}\n\nCreators:\n${rows.map((r) => r.line).join('\n')}` },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'verdicts', strict: true, schema: SCHEMA } },
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter replied ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const raw = body?.choices?.[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as { verdicts?: Record<string, unknown>[] }

  const out: Record<string, Verdict> = {}
  for (const vd of parsed.verdicts ?? []) {
    const handle = String(vd.handle ?? '').replace(/^@/, '').toLowerCase()
    if (!handle) continue
    const niche = [0, 0.5, 1].includes(Number(vd.niche)) ? Number(vd.niche) : 0
    out[handle] = {
      niche,
      why: String(vd.why ?? '').slice(0, 300),
      sells: String(vd.sells ?? '').slice(0, 80),
    }
  }
  return out
}

function briefText(c: { name: string; website?: string; brief: Record<string, unknown> }): string {
  const b = c.brief ?? {}
  const answers = Array.isArray(b.answers)
    ? (b.answers as { questionId: string; value: string | null }[])
        .filter((a) => a.value).map((a) => `- ${a.questionId}: ${a.value}`).join('\n')
    : ''
  return [
    `Campaign: ${c.name}`,
    c.website ? `Brand site: ${c.website}` : '',
    b.who ? `Looking for: ${b.who}` : '',
    b.summary ? `In short: ${b.summary}` : '',
    answers ? `Details:\n${answers}` : '',
  ].filter(Boolean).join('\n')
}

export const score = internalAction({
  args: {
    campaignId: v.id('campaigns'),
    creatorIds: v.optional(v.array(v.id('creators'))),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) return { error: 'OPENROUTER_API_KEY is not set' }
    const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL

    const work = await ctx.runQuery(internal.qualify.toScore, {
      campaignId: args.campaignId,
      creatorIds: args.creatorIds,
      limit: args.limit ?? 120,
    })
    if (!work || !work.rows.length) return { scored: 0, note: 'Nothing left to score' }

    const brief = briefText(work.campaign)
    const now = Date.now()
    let scored = 0
    let qualified = 0

    for (let i = 0; i < work.rows.length; i += BATCH) {
      const batch = work.rows.slice(i, i + BATCH)
      let verdicts: Record<string, Verdict> = {}
      try {
        verdicts = await askModel(key, model, brief, batch)
      } catch (e) {
        console.error('batch failed', e)
        continue
      }

      const writes = []
      for (const r of batch) {
        const verdict = verdicts[r.handle.toLowerCase()]
        if (!verdict) continue
        // The model read the bio, so take its sells when the crawl found none.
        const sells = r.sells || verdict.sells
        const stars = verdict.niche + sellingLevel(sells, r.signals) + signalLevel(r.lastSignalAt, now)
        if (stars >= QUALIFIED_MIN) qualified++
        writes.push({
          creatorId: r.id,
          niche: verdict.niche,
          nicheWhy: verdict.why,
          stars,
          sells: r.sells ? undefined : verdict.sells || undefined,
        })
      }

      if (writes.length) {
        await ctx.runMutation(internal.qualify.saveScores, {
          campaignId: args.campaignId, brandId: work.campaign.brandId, model, writes,
        })
        scored += writes.length
      }
    }

    await ctx.runMutation(internal.qualify.bumpQualified, { campaignId: args.campaignId, qualified })
    return { scored, qualified, model }
  },
})

/** Either the rows just crawled, or whatever this campaign has not read yet. */
export const toScore = internalQuery({
  args: {
    campaignId: v.id('campaigns'),
    creatorIds: v.optional(v.array(v.id('creators'))),
    limit: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, { campaignId, creatorIds, limit }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign) return null

    const line = (c: { handle: string; name: string; followers: number; medianReelViews?: number; engagementRate?: number; country?: string; sells: string; bio: string }) =>
      [
        `@${c.handle}`,
        c.name,
        `${c.followers.toLocaleString('en-US')} followers`,
        c.medianReelViews ? `${c.medianReelViews.toLocaleString('en-US')} median reel views` : '',
        c.engagementRate ? `${(c.engagementRate * 100).toFixed(1)}% engagement` : '',
        c.country ?? '',
        c.sells ? `sells ${c.sells}` : '',
        c.bio ? `bio: ${c.bio.replace(/\s+/g, ' ').slice(0, 320)}` : '',
      ].filter(Boolean).join(' | ')

    const rows = []
    if (creatorIds?.length) {
      for (const id of creatorIds) {
        const c = await ctx.db.get(id)
        if (c) rows.push({ id: c._id, handle: c.handle, sells: c.sells, signals: c.signals, lastSignalAt: c.lastSignalAt, line: line(c) })
      }
    } else {
      for await (const d of ctx.db.query('discoveries').withIndex('by_campaign', (q) => q.eq('campaignId', campaignId)).order('desc')) {
        if (rows.length >= limit) break
        const already = await ctx.db
          .query('scores')
          .withIndex('by_campaign_creator', (q) => q.eq('campaignId', campaignId).eq('creatorId', d.creatorId))
          .first()
        if (already) continue
        const c = await ctx.db.get(d.creatorId)
        if (c) rows.push({ id: c._id, handle: c.handle, sells: c.sells, signals: c.signals, lastSignalAt: c.lastSignalAt, line: line(c) })
      }
    }
    return { campaign, rows }
  },
})

export const saveScores = internalMutation({
  args: { campaignId: v.id('campaigns'), brandId: v.id('brands'), model: v.string(), writes: v.array(v.any()) },
  returns: v.null(),
  handler: async (ctx, { campaignId, brandId, model, writes }) => {
    for (const w of writes) {
      const existing = await ctx.db
        .query('scores')
        .withIndex('by_campaign_creator', (q) => q.eq('campaignId', campaignId).eq('creatorId', w.creatorId))
        .first()
      const row = { creatorId: w.creatorId, campaignId, brandId, niche: w.niche, nicheWhy: w.nicheWhy, stars: w.stars, model }
      if (existing) await ctx.db.patch(existing._id, row)
      else await ctx.db.insert('scores', row)

      // `sells` is a fact about the creator, so it goes back to the pool.
      if (w.sells) await ctx.db.patch(w.creatorId, { sells: w.sells })
    }
    return null
  },
})

export const bumpQualified = internalMutation({
  args: { campaignId: v.id('campaigns'), qualified: v.number() },
  returns: v.null(),
  handler: async (ctx, { campaignId, qualified }) => {
    const today = new Date().toISOString().slice(0, 10)
    const stat = await ctx.db
      .query('dailyStats')
      .withIndex('by_campaign_date', (q) => q.eq('campaignId', campaignId).eq('date', today))
      .first()
    if (stat) await ctx.db.patch(stat._id, { qualified: stat.qualified + qualified })
    return null
  },
})
