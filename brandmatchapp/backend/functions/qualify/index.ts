// The Niche star, written by a model through OpenRouter.
//
// Selling and Signal are facts about the creator, read off the pool by every
// campaign alike. Niche is the one criterion that only means something against
// a brief, so it is the only one the model is asked for, and the only one
// stored per campaign.
//
// POST { campaignId, creatorIds?: string[], limit?: number }
// With no creatorIds it scores whatever that campaign has not scored yet.

import { db, fail, json, sellingLevel, signalLevel, type Signal } from './lib.ts'

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'
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

interface Row {
  id: string; handle: string; name: string; bio: string; followers: number
  country: string | null; sells: string; signals: Signal[]
  median_reel_views: number | null; engagement_rate: number | null
}

function brief(c: { brief: Record<string, unknown>; website: string | null; name: string }): string {
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

function describe(r: Row): string {
  const bits = [
    `@${r.handle}`,
    r.name,
    `${r.followers.toLocaleString('en-US')} followers`,
    r.median_reel_views ? `${r.median_reel_views.toLocaleString('en-US')} median reel views` : '',
    r.engagement_rate ? `${(r.engagement_rate * 100).toFixed(1)}% engagement` : '',
    r.country ?? '',
    r.sells ? `sells ${r.sells}` : '',
    r.bio ? `bio: ${r.bio.replace(/\s+/g, ' ').slice(0, 320)}` : '',
  ].filter(Boolean)
  return bits.join(' | ')
}

async function askModel(model: string, key: string, theBrief: string, rows: Row[]): Promise<Record<string, { niche: number; why: string; sells: string }>> {
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
        { role: 'user', content: `${theBrief}\n\nCreators:\n${rows.map(describe).join('\n')}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'verdicts',
          strict: true,
          schema: {
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
          },
        },
      },
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter replied ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = await res.json()
  const text = body?.choices?.[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''))
  const out: Record<string, { niche: number; why: string; sells: string }> = {}
  for (const v of parsed.verdicts ?? []) {
    const handle = String(v.handle ?? '').replace(/^@/, '').toLowerCase()
    if (!handle) continue
    const niche = [0, 0.5, 1].includes(Number(v.niche)) ? Number(v.niche) : 0
    out[handle] = { niche, why: String(v.why ?? '').slice(0, 300), sells: String(v.sells ?? '').slice(0, 80) }
  }
  return out
}

Deno.serve(async (req) => {
  const sb = db()
  const key = Deno.env.get('OPENROUTER_API_KEY')
  if (!key) return fail('OPENROUTER_API_KEY is not set', 500)
  const model = Deno.env.get('OPENROUTER_MODEL') ?? 'google/gemini-2.5-flash'

  try {
    const { campaignId, creatorIds, limit } = await req.json()
    if (!campaignId) return fail('campaignId is required')

    const { data: campaign } = await sb.from('campaigns')
      .select('id, brand_id, name, website, brief').eq('id', campaignId).maybeSingle()
    if (!campaign) return fail('No such campaign', 404)

    // Either the rows just crawled, or whatever this campaign has not read yet.
    let rows: Row[] = []
    if (Array.isArray(creatorIds) && creatorIds.length) {
      const { data } = await sb.from('creators')
        .select('id, handle, name, bio, followers, country, sells, signals, median_reel_views, engagement_rate')
        .in('id', creatorIds)
      rows = (data ?? []) as Row[]
    } else {
      const { data } = await sb.rpc('unscored_for_campaign', {
        p_campaign: campaignId, p_limit: Math.min(Number(limit ?? 120), 600),
      })
      rows = (data ?? []) as Row[]
    }
    if (!rows.length) return json({ scored: 0, note: 'Nothing left to score' })

    const theBrief = brief(campaign as never)
    const now = new Date()
    let scored = 0
    let qualified = 0

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      let verdicts: Record<string, { niche: number; why: string; sells: string }> = {}
      try {
        verdicts = await askModel(model, key, theBrief, batch)
      } catch (e) {
        console.error('batch failed', e)
        continue
      }

      const scoreRows = []
      for (const r of batch) {
        const v = verdicts[r.handle.toLowerCase()]
        if (!v) continue
        const signals = Array.isArray(r.signals) ? r.signals : []
        // The model read the bio, so take its sells when the crawl found none.
        const sells = r.sells || v.sells
        const stars = v.niche + sellingLevel(sells, signals) + signalLevel(signals, now)
        scoreRows.push({
          creator_id: r.id, campaign_id: campaignId, brand_id: campaign.brand_id,
          niche: v.niche, niche_why: v.why, stars, model, scored_at: now.toISOString(),
        })
        if (stars >= 1) qualified++
        if (!r.sells && v.sells) {
          await sb.from('creators').update({ sells: v.sells }).eq('id', r.id)
        }
      }

      if (scoreRows.length) {
        await sb.from('creator_scores').upsert(scoreRows, { onConflict: 'campaign_id,creator_id' })
        scored += scoreRows.length
      }
    }

    const today = now.toISOString().slice(0, 10)
    await sb.rpc('bump_qualified', { p_campaign: campaignId, p_date: today, p_qualified: qualified })

    return json({ scored, qualified, model })
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500)
  }
})
