import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { evaluate as runGates, passesHard, runHard, type GateSetShape, type Judgement } from './gates'

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

    // Exclusivity: a profile claimed by anyone is never evaluated again.
    const claimed = new Set((await ctx.db.query('creatorClaims').collect()).map((c) => c.creatorId))

    const creators = await ctx.db.query('creators').withIndex('by_measured').order('desc').take(1_500)
    const fresh = creators.filter((c) => !seen.has(c._id) && !claimed.has(c._id)).slice(0, args.limit ?? 200)

    return {
      accountId: campaign.accountId,
      gateSetId: gates._id,
      gateSetVersion: gates.version,
      gates: { hard: gates.hard, knockouts: gates.knockouts, criteria: gates.criteria, passScore: gates.passScore },
      brief: campaign.brief,
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
      v.literal('qualified'), v.literal('hard_fail'), v.literal('knockout_fail'), v.literal('below_threshold'),
    ),
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
 * and the seven criteria in one strict JSON object, so a profile costs one call
 * and never two.
 */
export const campaign = internalAction({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const batch = await ctx.runQuery(internal.evaluate.pending, { campaignId: args.campaignId, limit: args.limit })
    if ('error' in batch) return batch as Record<string, unknown>

    const gates = batch.gates as GateSetShape
    const now = Date.now()
    let hardFail = 0
    let asked = 0
    let qualified = 0

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
      const checks = runHard(measured, gates.hard, now)

      // Gate 1 decided. No model call, no cost.
      if (!passesHard(checks)) {
        hardFail++
        const result = runGates(measured, gates, null, now)
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
      const judgement = await ask(creator, gates, batch.brief as string)
      const result = runGates(measured, gates, judgement, now)
      if (result.verdict === 'qualified') qualified++
      await ctx.runMutation(internal.evaluate.write, {
        creatorId: creator.id,
        campaignId: args.campaignId,
        accountId: batch.accountId,
        gateSetId: batch.gateSetId,
        gateSetVersion: batch.gateSetVersion,
        verdict: result.verdict,
        blockedBy: result.blockedBy,
        hardChecks: result.hardChecks,
        knockoutAnswers: result.knockoutAnswers,
        criteriaScores: result.criteriaScores,
        score: result.score,
        reason: result.reason,
        model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash-0731',
      })
    }

    return { tested: (batch.creators as unknown[]).length, hardFail, asked, qualified }
  },
})

/** One call, both gates. A strict schema, so the answer is parseable or absent. */
async function ask(
  creator: Record<string, unknown>,
  gates: GateSetShape,
  brief: string,
): Promise<Judgement | null> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['knockouts', 'criteria', 'reason'],
    properties: {
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
    'Score every criterion 0, 1 or 2. A 2 is what the guide describes.',
    ...gates.criteria.map((c) => `- ${c.id}: ${c.label}${c.guide ? ` (${c.guide})` : ''}`),
    '',
    'Judge only what the profile shows. Never assume. Write one plain sentence as the reason.',
    '',
    `Profile: ${JSON.stringify(creator)}`,
  ].join('\n')

  const res = await fetch(OPENROUTER, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash-0731',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'gates', strict: true, schema } },
    }),
  })
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null
  const text = body?.choices?.[0]?.message?.content
  if (!text) return null
  try {
    return JSON.parse(text) as Judgement
  } catch {
    return null
  }
}
