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
//   Gate 2  reword the library's questions, and add at most one. Every one is
//           delivered switched off.
//   Gate 3  write the sentences for this offer, from the library's. Never invent
//           a criterion, never drop one. templates.ts enforces it. The score
//           they produce orders the list; it never decides who is on it.

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
    'Gate 2: keep every knockout id of the library. Reword the questions for this offer. You may add at most one new knockout. Every one of them is delivered switched off, so write them as questions worth losing people over rather than as defaults.',
    'Gate 3: write four to nine sentences describing the ideal profile for this offer, starting from the library sentences and rewording them for the brief. Each sentence is a plain statement about a person that can be answered true, partly true or false from what the judge will see: the bio, the links, the follower count, and the last twelve posts with their captions, dates, likes, comments and views. Never write a sentence that needs what the judge cannot see, such as whether they reply to comments, how their reach moved over a year, or what their audience earns. Ids are short snake_case. Brand fit scores a lead and orders the list, it never drops anyone, so passScore is carried but decides nothing: set it to half of twice the number of sentences.',
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

    // Gate 1 starts from the library's balanced numbers. The model has no
    // basis for a views floor or a posting rhythm, and asked for them it
    // writes 500 views and three days, which is a filter that lets everyone
    // through and then nobody. It may move the follower range, and only when
    // the brief actually names a size.
    const d = lib.defaults
    const namesASize = /\d/.test(`${args.audience} ${args.offer}`)
    const followersMin = namesASize && Number.isFinite(draft.hard?.followersMin) ? Number(draft.hard.followersMin) : d.followersMin
    const followersMax = namesASize && Number.isFinite(draft.hard?.followersMax) ? Number(draft.hard.followersMax) : d.followersMax
    const codes = (list: unknown) =>
      Array.isArray(list) ? list.map((c) => String(c).toUpperCase().replace(/^GB$/, 'UK')).filter((c) => /^[A-Z]{2}$/.test(c)) : []
    const countries = codes(draft.countries)
    const languages = Array.isArray(draft.languages)
      ? draft.languages.map((l: unknown) => String(l).toLowerCase()).filter((l: string) => /^[a-z]{2}$/.test(l))
      : []
    const hard = {
      followersMin,
      followersMax,
      lastPostWithinDays: d.lastPostWithinDays,
      postsPerMonthMin: d.postsPerMonthMin,
      medianViewsMin: Math.round(followersMin * d.viewsShare),
      medianCommentsMin: Math.round(followersMin * d.viewsShare * 0.002),
      ...(countries.length ? { countries } : {}),
      ...(languages.length ? { languages } : {}),
    }

    await ctx.runMutation(internal.campaigns.patch, {
      accountId: args.accountId,
      campaignId: args.campaignId,
      name: draft.name ? String(draft.name).slice(0, 80) : undefined,
      brief: { audience: args.audience, offer: args.offer },
      extracted: {
        countries,
        languages,
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
    // Carried, not applied. Brand fit scores a lead and never removes one, so
    // this number decides nothing: it is kept at half the ceiling so an old
    // row and a new one read the same way.
    const passScore = Math.ceil(kept.criteria.length * 2 * 0.5)
    const gates = await ctx.runMutation(internal.campaigns.saveGates, {
      accountId: args.accountId,
      campaignId: args.campaignId,
      origin: 'generated',
      templateId: lib.id,
      hard,
      // Delivered switched off, every one. A deal breaker drops someone
      // whatever else they score, so it is a decision the client makes once
      // they have seen what the rest of the filters bring, never a default.
      knockouts: kept.knockouts.map((k) => ({ ...k, enabled: false })),
      criteria: kept.criteria,
      passScore,
    })
    return { gates, name: draft.name, templateId: lib.id, usedLibrary: lib.name }
  },
})
