import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { template, TEMPLATE_IDS, withinTemplate } from './templates'

// Two questions become a proposal.
//
// The client never starts from a blank page. They say who they want to reach
// and what they sell, and everything below is the first draft they correct.
//
// What the model is allowed to do:
//
//   Gate 1  write the numbers. Only thresholds, so the risk is low and the
//           brief has to move them or every campaign would filter the same.
//   Gate 2  reword the library's questions, and add at most one.
//   Gate 3  write the sentences for this offer, from the library's. Then set the bar. Never invent
//           a criterion, never drop one. templates.ts enforces it.

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['templateId', 'name', 'countries', 'languages', 'niches', 'hard', 'knockouts', 'criteria', 'passScore'],
  properties: {
    templateId: { type: 'string', enum: TEMPLATE_IDS },
    name: { type: 'string' },
    countries: { type: 'array', items: { type: 'string' } },
    languages: { type: 'array', items: { type: 'string' } },
    niches: {
      type: 'array',
      minItems: 4,
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label'],
        properties: { id: { type: 'string' }, label: { type: 'string' } },
      },
    },
    hard: {
      type: 'object',
      additionalProperties: false,
      required: ['followersMin', 'followersMax', 'lastPostWithinDays', 'medianViewsMin', 'medianCommentsMin', 'postsPerMonthMin'],
      properties: {
        followersMin: { type: 'integer' },
        followersMax: { type: 'integer' },
        lastPostWithinDays: { type: 'integer' },
        medianViewsMin: { type: 'integer' },
        medianCommentsMin: { type: 'integer' },
        postsPerMonthMin: { type: 'integer' },
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
      minItems: 4,
      maxItems: 9,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: { id: { type: 'string' }, text: { type: 'string' } },
      },
    },
    passScore: { type: 'integer', minimum: 1, maximum: 18 },
  },
}

function instructions(): string {
  const libraries = TEMPLATE_IDS.map((id) => {
    const lib = template(id)
    return [
      `${lib.id}: ${lib.name}. ${lib.when}`,
      '  knockouts: ' + lib.knockouts.map((k) => `${k.id} (${k.question})`).join('; '),
      '  sentences: ' + lib.criteria.map((c) => `${c.id} (${c.text})`).join('; '),
    ].join('\n')
  }).join('\n')

  return [
    'You turn a lead search brief into qualification rules.',
    '',
    'Pick the library that matches what they want from these creators.',
    libraries,
    '',
    'Then adapt it to the brief.',
    'Gate 1: write thresholds for the target described. Reach is measured on real posts, never a declared figure. Keep the follower range the brief asks for when it gives one.',
    'Gate 2: keep every knockout id of the library. Reword the questions for this offer. You may add at most one new knockout.',
    'Gate 3: write four to nine sentences describing the ideal profile for this offer, starting from the library sentences and rewording them for the brief. Each sentence is a plain statement about a person that can be answered true, partly true or false from their profile and posts. Ids are short snake_case. Set passScore in points out of twice the number of sentences, so that roughly one profile in six reaching gate 3 qualifies.',
    '',
    'Niches: four to seven slices of the target, the sub topics these people actually work in. A target is never one audience, and the slices do not answer at the same rate. Ids are short snake_case.',
    '',
    'Also write a short campaign name, "<who>, <what you sell>", and the country and language codes the brief implies.',
    'Write in English. Never use an em dash.',
  ].join('\n')
}

export const gatesFromBrief = internalAction({
  args: {
    accountId: v.id('accounts'),
    campaignId: v.id('campaigns'),
    audience: v.string(),
    offer: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) return { error: 'OPENROUTER_API_KEY is not set' }

    const res = await fetch(OPENROUTER, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash',
        messages: [
          { role: 'system', content: instructions() },
          { role: 'user', content: `Who they want to reach: ${args.audience}\nWhat they sell: ${args.offer}` },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'proposal', strict: true, schema: SCHEMA } },
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

    // The library decides what gate 2 and gate 3 may be. The model only edits.
    const lib = template(draft.templateId)
    const kept = withinTemplate(lib, draft)
    const hard = {
      ...draft.hard,
      ...(Array.isArray(draft.countries) && draft.countries.length ? { countries: draft.countries } : {}),
      ...(Array.isArray(draft.languages) && draft.languages.length ? { languages: draft.languages } : {}),
    }

    await ctx.runMutation(internal.campaigns.patch, {
      accountId: args.accountId,
      campaignId: args.campaignId,
      name: draft.name ? String(draft.name).slice(0, 80) : undefined,
      brief: { audience: args.audience, offer: args.offer },
      extracted: {
        countries: draft.countries ?? [],
        languages: draft.languages ?? [],
        templateId: lib.id,
        // All switched on: a suggestion the client has to switch on is not a
        // suggestion. Each one can take its own numbers later.
        niches: (Array.isArray(draft.niches) ? draft.niches : []).map((n: any) => ({
          id: String(n.id),
          label: String(n.label),
          enabled: true,
        })),
        extractedAt: Date.now(),
      },
    })
    const gates = await ctx.runMutation(internal.campaigns.saveGates, {
      accountId: args.accountId,
      campaignId: args.campaignId,
      origin: 'generated',
      templateId: lib.id,
      hard,
      knockouts: kept.knockouts,
      criteria: kept.criteria,
      passScore: kept.passScore,
    })
    return { gates, name: draft.name, templateId: lib.id, usedLibrary: lib.name }
  },
})
