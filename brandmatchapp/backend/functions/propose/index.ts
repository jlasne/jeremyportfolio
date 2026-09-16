// Website in, a brief and three agents out. Nothing crawls yet.
//
// The model reads the brand's own site and writes what it should hunt for:
// the audience in plain words, then three angles, each with the hashtags it
// would search. Every agent lands as `proposed`, which the crawl skips. A
// human turns one on, and only then does it spend anything.
//
// POST { campaignId, website? }

import { db, fail, json, CORS } from './lib.ts'

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

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

interface Proposal {
  summary: string
  agents: { name: string; focus: string; hashtags: string[]; why: string }[]
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('OPENROUTER_API_KEY')
  if (!key) return fail('OPENROUTER_API_KEY is not set', 500)
  const model = Deno.env.get('OPENROUTER_MODEL') ?? 'deepseek/deepseek-v4-flash-0731'
  const sb = db()

  try {
    const { campaignId, website } = await req.json()
    if (!campaignId) return fail('campaignId is required')

    const { data: campaign } = await sb.from('campaigns')
      .select('id, brand_id, name, website, brief').eq('id', campaignId).maybeSingle()
    if (!campaign) return fail('No such campaign', 404)

    const site = website ?? campaign.website
    if (!site) return fail('This campaign has no website to read')

    const text = await readSite(site)
    const who = (campaign.brief as { who?: string })?.who ?? ''
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
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'proposal',
            strict: true,
            schema: {
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
            },
          },
        },
      }),
    })

    if (!res.ok) return fail(`OpenRouter replied ${res.status}: ${(await res.text()).slice(0, 300)}`, 502)
    const body = await res.json()
    const raw = body?.choices?.[0]?.message?.content ?? '{}'
    const plan = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as Proposal

    const agents = (plan.agents ?? []).slice(0, 3).map((a) => ({
      campaign_id: campaignId,
      name: String(a.name ?? 'Agent').slice(0, 60),
      focus: String(a.focus ?? '').slice(0, 200),
      hashtags: (a.hashtags ?? [])
        .map((h) => String(h).replace(/^#/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''))
        .filter(Boolean).slice(0, 6),
      keywords: [],
      leads_per_day: Math.max(20, Math.round((80 * 3) / Math.max((plan.agents ?? []).length, 1) / 3)),
      // Nothing runs until a human says so.
      active: false,
      status: 'proposed',
      proposed_why: String(a.why ?? '').slice(0, 200),
    })).filter((a) => a.hashtags.length)

    if (!agents.length) return fail('The model proposed no usable hashtags', 502)

    // Keep the brand's own sentence, take the model's summary.
    const brief = { ...(campaign.brief as Record<string, unknown> ?? {}), summary: plan.summary ?? '' }
    await sb.from('campaigns').update({ brief, website: site }).eq('id', campaignId)

    // Replace any earlier proposal, leave approved agents alone.
    await sb.from('agents').delete().eq('campaign_id', campaignId).eq('status', 'proposed')
    const { data: saved, error } = await sb.from('agents').insert(agents).select()
    if (error) return fail(error.message, 500)

    return json({ summary: plan.summary, agents: saved, model, readSite: text.length > 0 })
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500)
  }
})
