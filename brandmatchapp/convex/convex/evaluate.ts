import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import {
  evaluate as runGates, loosest, passesHard, runHard,
  type GateSetShape, type Judgement, type Niche,
} from './gates'

// One profile through one campaign's gates.
//
// Gate 1 runs here, on measured numbers, for free. Only what survives it is
// sent to the model, which answers gate 2 and gate 3 in a single strict JSON
// call. A profile rejected by gate 1 is written down anyway: the audit trail is
// the product, and knowing where profiles die is what the simulator reads.

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

export const pending = internalQuery({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign?.gateSetId) return { error: 'This campaign has no gates yet' }
    const gates = await ctx.db.get(campaign.gateSetId)
    if (!gates) return { error: 'The gate version is missing' }

    const done = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    const seen = new Set(done.map((e) => e.creatorId))

    // Exclusivity is against the kind of offer, so a profile held by a client
    // selling something else is still worth looking at for this one.
    const offerKey = campaign.extracted.templateId ?? 'sell_to_creators'
    const claimed = new Set(
      (await ctx.db.query('creatorClaims').collect())
        .filter((c) => c.offerKey === offerKey)
        .map((c) => c.creatorId),
    )

    const creators = await ctx.db.query('creators').withIndex('by_measured').order('desc').take(1_500)
    const fresh = creators.filter((c) => !seen.has(c._id) && !claimed.has(c._id)).slice(0, args.limit ?? 200)

    return {
      accountId: campaign.accountId,
      gateSetId: gates._id,
      gateSetVersion: gates.version,
      gates: { hard: gates.hard, knockouts: gates.knockouts, criteria: gates.criteria, passScore: gates.passScore },
      niches: campaign.extracted.niches ?? [],
      brief: `${campaign.brief.audience}. They sell: ${campaign.brief.offer}`,
      extracted: campaign.extracted,
      creators: fresh.map((c) => ({
        id: c._id,
        handle: c.handle,
        name: c.name,
        bio: c.bio,
        followers: c.followers,
        medianViews: c.medianViews,
        medianComments: c.medianComments,
        postsPerMonth: c.postsPerMonth,
        lastPostAt: c.lastPostAt,
        country: c.country,
        language: c.language,
        links: c.links,
        firstSeenAt: c.firstSeenAt,
      })),
    }
  },
})

export const write = internalMutation({
  args: {
    creatorId: v.id('creators'),
    campaignId: v.id('campaigns'),
    accountId: v.id('accounts'),
    gateSetId: v.id('gateSets'),
    gateSetVersion: v.number(),
    verdict: v.union(
      v.literal('qualified'), v.literal('hard_fail'), v.literal('off_niche'),
      v.literal('knockout_fail'), v.literal('below_threshold'),
    ),
    niche: v.optional(v.string()),
    blockedBy: v.optional(v.string()),
    hardChecks: v.any(),
    knockoutAnswers: v.any(),
    criteriaScores: v.any(),
    score: v.number(),
    reason: v.string(),
    model: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const already = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign_creator', (q) => q.eq('campaignId', args.campaignId).eq('creatorId', args.creatorId))
      .first()
    if (already) return already._id
    return await ctx.db.insert('evaluations', { ...args, evaluatedAt: Date.now() })
  },
})

/**
 * Runs the gates over one campaign's untouched profiles.
 *
 * The model is asked once per surviving profile and answers both the knockouts
 * and every sentence in one strict JSON object, so a profile costs one call
 * and never two.
 */
export const campaign = internalAction({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const batch = await ctx.runQuery(internal.evaluate.pending, { campaignId: args.campaignId, limit: args.limit })
    if ('error' in batch) return batch as Record<string, unknown>

    const gates = batch.gates as GateSetShape
    const niches = (batch.niches ?? []) as Niche[]
    const now = Date.now()
    let hardFail = 0
    let asked = 0
    let qualified = 0
    // A model call that fails is not a verdict. The profile stays unjudged and
    // is asked again next time, and the failure is said out loud, because a
    // silent one would read as a hundred profiles too small to bother with.
    let failed = 0
    let lastError = ''

    for (const creator of batch.creators as Record<string, any>[]) {
      const measured = {
        followers: creator.followers,
        medianViews: creator.medianViews,
        medianComments: creator.medianComments,
        postsPerMonth: creator.postsPerMonth,
        lastPostAt: creator.lastPostAt,
        country: creator.country,
        language: creator.language,
      }
      const checks = runHard(measured, loosest(gates.hard, niches), now)

      // Gate 1 decided. No model call, no cost.
      if (!passesHard(checks)) {
        hardFail++
        const result = runGates(measured, gates, niches, null, now)
        await ctx.runMutation(internal.evaluate.write, {
          creatorId: creator.id,
          campaignId: args.campaignId,
          accountId: batch.accountId,
          gateSetId: batch.gateSetId,
          gateSetVersion: batch.gateSetVersion,
          verdict: 'hard_fail',
          blockedBy: result.blockedBy,
          hardChecks: checks,
          knockoutAnswers: [],
          criteriaScores: [],
          score: 0,
          reason: result.reason,
        })
        continue
      }

      asked++
      const answer = await ask(creator, gates, niches, batch.brief as string)
      if ('error' in answer) {
        failed++
        lastError = answer.error
        continue
      }
      const result = runGates(measured, gates, niches, answer.judgement, now)
      if (result.verdict === 'qualified') qualified++
      await ctx.runMutation(internal.evaluate.write, {
        creatorId: creator.id,
        campaignId: args.campaignId,
        accountId: batch.accountId,
        gateSetId: batch.gateSetId,
        gateSetVersion: batch.gateSetVersion,
        verdict: result.verdict,
        niche: result.niche,
        blockedBy: result.blockedBy,
        hardChecks: result.hardChecks,
        knockoutAnswers: result.knockoutAnswers,
        criteriaScores: result.criteriaScores,
        score: result.score,
        reason: result.reason,
        model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash',
      })
    }

    return { tested: (batch.creators as unknown[]).length, hardFail, asked, qualified, failed, lastError }
  },
})

/** One call, both gates. A strict schema, so the answer is parseable or absent. */
async function ask(
  creator: Record<string, unknown>,
  gates: GateSetShape,
  niches: Niche[],
  brief: string,
): Promise<{ judgement: Judgement } | { error: string }> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return { error: 'OPENROUTER_API_KEY is not set' }

  const on = niches.filter((n) => n.enabled)
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: [...(on.length ? ['niche'] : []), 'knockouts', 'criteria', 'reason'],
    properties: {
      // Classification against a list the client controls, never a free guess.
      ...(on.length
        ? { niche: { type: 'string', enum: [...on.map((n) => n.id), 'other'] } }
        : {}),
      knockouts: {
        type: 'object',
        additionalProperties: false,
        required: gates.knockouts.map((k) => k.id),
        properties: Object.fromEntries(
          gates.knockouts.map((k) => [
            k.id,
            {
              type: 'object',
              additionalProperties: false,
              required: ['pass', 'note'],
              properties: { pass: { type: 'boolean' }, note: { type: 'string' } },
            },
          ]),
        ),
      },
      criteria: {
        type: 'object',
        additionalProperties: false,
        required: gates.criteria.map((c) => c.id),
        properties: Object.fromEntries(
          gates.criteria.map((c) => [
            c.id,
            {
              type: 'object',
              additionalProperties: false,
              required: ['score', 'note'],
              properties: { score: { type: 'integer', minimum: 0, maximum: 2 }, note: { type: 'string' } },
            },
          ]),
        ),
      },
      reason: { type: 'string' },
    },
  }

  const prompt = [
    'You qualify Instagram profiles for a business.',
    `What the business sells: ${brief}`,
    '',
    'Answer every knockout with true or false. One false eliminates the profile.',
    ...gates.knockouts.map((k) => `- ${k.id}: ${k.question}${k.why ? ` (${k.why})` : ''}`),
    '',
    'Then read each sentence below against the profile. Answer 2 when it is true of them, 1 when it is partly true, 0 when it is false or you cannot tell. Give one line of evidence as the note.',
    ...gates.criteria.map((c) => `- ${c.id}: ${c.text}`),
    '',
    ...(on.length
      ? [
          '',
          'Say which of these they work in. Use "other" when none of them fits.',
          ...on.map((n) => `- ${n.id}: ${n.label}`),
        ]
      : []),
    '',
    'Judge only what the profile shows. Never assume. Write one plain sentence as the reason.',
    '',
    `Profile: ${JSON.stringify(creator)}`,
  ].join('\n')

  const res = await fetch(OPENROUTER, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'gates', strict: true, schema } },
    }),
  })
  const raw = await res.text()
  if (!res.ok) return { error: `OpenRouter replied ${res.status}: ${raw.slice(0, 300)}` }
  let body: { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null = null
  try { body = JSON.parse(raw) } catch { return { error: `OpenRouter sent something that is not JSON: ${raw.slice(0, 200)}` } }
  const text = body?.choices?.[0]?.message?.content
  if (!text) return { error: body?.error?.message ?? `OpenRouter sent no answer: ${raw.slice(0, 200)}` }
  try {
    const parsed = JSON.parse(text) as Judgement
    // "other" is not a niche, it is the absence of one.
    if (parsed.niche === 'other') parsed.niche = null
    return { judgement: parsed }
  } catch {
    return { error: `The model answered outside the schema: ${text.slice(0, 200)}` }
  }
}
