import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// Zone three into zone four: the brief becomes a first set of gates.
//
// The model proposes, the client edits. It never runs a campaign on its own
// proposal: the draft is written as version 1 with origin `generated`, and the
// first edit writes version 2 with origin `edited`.

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['extracted', 'hard', 'knockouts', 'criteria', 'passScore'],
  properties: {
    extracted: {
      type: 'object',
      additionalProperties: false,
      required: ['sells', 'audience', 'outcome', 'countries', 'languages'],
      properties: {
        sells: { type: 'string' },
        audience: { type: 'string' },
        outcome: { type: 'string' },
        countries: { type: 'array', items: { type: 'string' } },
        languages: { type: 'array', items: { type: 'string' } },
      },
    },
    hard: {
      type: 'object',
      additionalProperties: false,
      required: ['followersMin', 'followersMax', 'lastPostWithinDays', 'medianViewsMin', 'medianCommentsMin', 'postsPerMonthMin', 'languages'],
      properties: {
        followersMin: { type: 'integer' },
        followersMax: { type: 'integer' },
        lastPostWithinDays: { type: 'integer' },
        medianViewsMin: { type: 'integer' },
        medianCommentsMin: { type: 'integer' },
        postsPerMonthMin: { type: 'integer' },
        languages: { type: 'array', items: { type: 'string' } },
      },
    },
    knockouts: {
      type: 'array',
      minItems: 4,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'question', 'why'],
        properties: { id: { type: 'string' }, question: { type: 'string' }, why: { type: 'string' } },
      },
    },
    criteria: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'guide'],
        properties: { id: { type: 'string' }, label: { type: 'string' }, guide: { type: 'string' } },
      },
    },
    passScore: { type: 'integer', minimum: 0, maximum: 14 },
  },
}

const INSTRUCTIONS = [
  'You write qualification rules for an Instagram lead search.',
  '',
  'Three gates, in order.',
  'Gate 1, hard filters: thresholds on numbers we measure off real posts. Follower range, days since the last post, median views, median comments, posts a month. Never a declared figure.',
  'Gate 2, knockouts: four to six yes or no questions about the profile. A single no eliminates. Write them so a no is unambiguous.',
  'Gate 3, score: exactly seven criteria, each worth 0, 1 or 2. The guide says what a 2 looks like. Set passScore so roughly one profile in six that reaches gate 3 qualifies.',
  '',
  'Ids are short snake_case. Write in English. Never use an em dash.',
].join('\n')

export const gatesFromBrief = internalAction({
  args: { accountId: v.id('accounts'), campaignId: v.id('campaigns'), brief: v.string() },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) return { error: 'OPENROUTER_API_KEY is not set' }

    const res = await fetch(OPENROUTER, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash-0731',
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          { role: 'user', content: args.brief },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'gates', strict: true, schema: SCHEMA } },
      }),
    })
    if (!res.ok) return { error: `OpenRouter replied ${res.status}` }
    const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null
    const text = body?.choices?.[0]?.message?.content
    if (!text) return { error: 'OpenRouter sent nothing back' }

    let draft: Record<string, any>
    try {
      draft = JSON.parse(text)
    } catch {
      return { error: 'OpenRouter sent something that is not JSON' }
    }

    await ctx.runMutation(internal.campaigns.patch, {
      accountId: args.accountId,
      campaignId: args.campaignId,
      brief: args.brief,
      extracted: { ...draft.extracted, extractedAt: Date.now() },
    })
    const gates = await ctx.runMutation(internal.campaigns.saveGates, {
      accountId: args.accountId,
      campaignId: args.campaignId,
      origin: 'generated',
      hard: draft.hard,
      knockouts: draft.knockouts,
      criteria: draft.criteria,
      passScore: draft.passScore,
    })
    return { gates, extracted: draft.extracted }
  },
})
