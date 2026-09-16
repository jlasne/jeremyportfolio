import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// Website in, a brief and three agents out. Nothing crawls yet.
//
// The model reads the brand's own site and writes what it should hunt for:
// the audience in plain words, then three angles, each with the hashtags it
// would search. Every agent lands as `proposed`, which the crawl skips. A
// human turns one on, and only then does it spend anything.

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash-0731'

const SYSTEM = `You read a brand's website and plan who should be hunted for on Instagram.

summary: one sentence naming the creators this brand should reach. Under 25 words.
         Say the discipline, what they sell, and who follows them.

agents: exactly 3, each a different angle on the same brief. Never 3 wordings of one idea.
  name     2 to 4 words, what this angle hunts
  focus    one line, under 15 words
  hashtags 4 to 6 Instagram hashtags creators in that angle actually post under.
           No # sign, lowercase, no spaces. Real tags, not invented ones.
  why      one line on why this angle brings buyers, under 15 words

Write from the site. Never invent a product the site does not sell.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'agents'],
  properties: {
    summary: { type: 'string' },
    agents: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'focus', 'hashtags', 'why'],
        properties: {
          name: { type: 'string' },
          focus: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          why: { type: 'string' },
        },
      },
    },
  },
}

/** The readable words on a page, enough for the model to place the brand. */
async function readSite(url: string): Promise<string> {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'brandmatch/1.0 (+https://brandmatch.app)' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000)
  } catch {
    return ''
  }
}

export const forCampaign = internalAction({
  args: { campaignId: v.id('campaigns'), website: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) return { error: 'OPENROUTER_API_KEY is not set' }
    const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL

    const campaign = await ctx.runQuery(internal.propose.campaign, { campaignId: args.campaignId })
    if (!campaign) return { error: 'No such campaign' }

    const site = args.website ?? campaign.website
    if (!site) return { error: 'This campaign has no website to read' }

    const text = await readSite(site)
    const who = campaign.brief?.who ?? ''
    const context = [
      `Brand site: ${site}`,
      who ? `The brand says it wants: ${who}` : '',
      text ? `What the site says:\n${text}` : 'The site could not be read. Work from the address and the sentence above.',
    ].filter(Boolean).join('\n\n')

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
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: context },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'proposal', strict: true, schema: SCHEMA } },
      }),
    })

    if (!res.ok) return { error: `OpenRouter replied ${res.status}: ${(await res.text()).slice(0, 300)}` }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const raw = body?.choices?.[0]?.message?.content ?? '{}'
    const plan = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as {
      summary?: string
      agents?: { name?: string; focus?: string; hashtags?: string[]; why?: string }[]
    }

    const agents = (plan.agents ?? []).slice(0, 3).map((a) => ({
      name: String(a.name ?? 'Agent').slice(0, 60),
      focus: String(a.focus ?? '').slice(0, 200),
      hashtags: (a.hashtags ?? [])
        .map((h) => String(h).replace(/^#/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''))
        .filter(Boolean).slice(0, 6),
      proposedWhy: String(a.why ?? '').slice(0, 200),
    })).filter((a) => a.hashtags.length)

    if (!agents.length) return { error: 'The model proposed no usable hashtags' }

    const saved = await ctx.runMutation(internal.propose.save, {
      campaignId: args.campaignId,
      brandId: campaign.brandId,
      website: site,
      summary: plan.summary ?? '',
      agents,
    })
    return { summary: plan.summary, agents: saved, model, readSite: text.length > 0 }
  },
})

export const campaign = internalQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: (ctx, { campaignId }) => ctx.db.get(campaignId),
})

/** Replaces any earlier proposal, and leaves approved agents alone. */
export const save = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    brandId: v.id('brands'),
    website: v.string(),
    summary: v.string(),
    agents: v.array(v.object({
      name: v.string(),
      focus: v.string(),
      hashtags: v.array(v.string()),
      proposedWhy: v.string(),
    })),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign) return []

    // Keep the brand's own sentence, take the model's summary.
    await ctx.db.patch(args.campaignId, {
      website: args.website,
      brief: { ...campaign.brief, summary: args.summary },
    })

    const old = await ctx.db
      .query('agents')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    for (const a of old) {
      if (a.status === 'proposed') await ctx.db.delete(a._id)
    }

    const saved = []
    for (const a of args.agents) {
      const id = await ctx.db.insert('agents', {
        campaignId: args.campaignId,
        brandId: args.brandId,
        name: a.name,
        focus: a.focus,
        keywords: [],
        hashtags: a.hashtags,
        leadsPerDay: 80,
        status: 'proposed',
        proposedWhy: a.proposedWhy,
      })
      saved.push(await ctx.db.get(id))
    }
    return saved
  },
})
