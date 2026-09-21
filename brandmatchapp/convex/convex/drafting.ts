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
  required: ['templateId', 'name', 'countries', 'languages', 'niches', 'hard', 'either', 'knockouts', 'criteria', 'passScore'],
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
      required: ['followersMin', 'followersMax', 'lastPostWithinDays', 'medianCommentsMin'],
      properties: {
        followersMin: { type: 'integer' },
        followersMax: { type: 'integer' },
        lastPostWithinDays: { type: 'integer' },
        medianViewsMin: { type: 'integer' },
        medianCommentsMin: { type: 'integer' },
        postsPerMonthMin: { type: 'integer' },
      },
    },
    either: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'options'],
        properties: {
          label: { type: 'string' },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                medianViewsMin: { type: 'integer' },
                medianCommentsMin: { type: 'integer' },
                postsPerMonthMin: { type: 'integer' },
                viewRatioMin: { type: 'integer' },
                monthlyViewsMin: { type: 'integer' },
                lastPostWithinDays: { type: 'integer' },
              },
            },
          },
        },
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
        required: ['id', 'text', 'evidence', 'trap', 'rubric', 'needs'],
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          evidence: { type: 'string' },
          trap: { type: 'string' },
          rubric: { type: 'string' },
          needs: {
            type: 'array',
            items: { type: 'string', enum: ['profile', 'posts', 'links', 'images', 'comments', 'web'] },
          },
        },
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
    '  A threshold in hard is a demand: every one of them has to hold.',
    '  A group in either is a choice: one of its options holding is enough.',
    '  Reach and rhythm are already written as groups for you, so leave medianViewsMin and postsPerMonthMin out unless the brief names a figure for one.',
    '  Write a group yourself only for a choice the brief spells out, in words like "or", "either", "unless".',
    '  For "40k views with a ratio over 10%, or 100k views": one group labelled Reach, options {medianViewsMin: 40000, viewRatioMin: 10} and {medianViewsMin: 100000}.',
    '  For "at least one post a week, or a million views a month": one group labelled Rhythm, options {postsPerMonthMin: 4} and {monthlyViewsMin: 1000000}.',
    '  A group you write on reach or rhythm replaces the one written for you. A number in a group is left out of hard, or it is demanded twice.',
    'Gate 2: keep every knockout id of the library. Reword the questions for this offer. You may add at most one new knockout. Every one of them is delivered switched off, so write them as questions worth losing people over rather than as defaults.',
    'Gate 3: six to nine sentences describing one ideal person for this offer, starting from the library sentences and rewording them for the brief.',
    '  Each entry is ONE statement about a person, under 140 characters, written as a fact someone could agree or disagree with.',
    '  Write a statement, never a question, never a heading, never a list, never a number range, and never a summary of anything else in this answer.',
    '  Good: "They sell a paid programme at a price shown in their bio."  Good: "They film themselves teaching, face on camera."',
    '  Bad: "thresholds: 100k to 3M followers"  Bad: "Do they teach a method?"  Bad: "c_sells: ... c_method: ..."',
    '  It has to be answerable from what the judge sees: the bio, the links, the follower count, and the last twelve posts with their captions, dates, likes, comments and views. Nothing about replies, a year of growth, or what their audience earns.',
    '  Ids are short snake_case and say what the sentence is about. Set passScore to half of twice the number of sentences.',
    '',
    'For every sentence, also write how to settle it. This is the part that decides whether the answer is worth anything.',
    '  evidence: what would prove it, named precisely. "A link to apps.apple.com or play.google.com", not "signs of an app".',
    '  trap: the near miss that must not count. A subscription on their own website is not an app in a store. A cookbook is not a programme.',
    '  rubric: what a 2, a 1 and a 0 look like, in one line each, so the scale is yours and not the judge\'s.',
    '  needs: what has to be in front of the judge to answer. Pick from:',
    '    profile   the bio, the numbers, the category, the badge',
    '    posts     the last twelve captions, dates and counts',
    '    links     the page their bio links to, read as text',
    '    images    the last nine post pictures, looked at',
    '    comments  the comments under their posts, and their replies',
    '    web       a search of the open web for them',
    '  Name only what the sentence actually needs. Everything named is fetched and paid for, and a sentence about what they sell needs links, not images.',
    '',
    'Niches: five to seven slices of the target. Each one is run as an Instagram account-name search, word for word, so write what these people put in their own bio or handle, which is the job they do. Never the topic they cover.',
    '  Measured: "online personal trainer" returned 36 people named for the job out of 40. "fitness coach" returned 4 in a niche out of 120.',
    '  Two to four words, lower case, no punctuation. Ids are short snake_case.',
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
    // The library's numbers are a starting point, not a ceiling. A brief that
    // names a figure gets that figure: one client wrote "at least 100 comments
    // on a typical post" and was handed twenty, because this took the library
    // every time. The model only overrides what it actually returned, so a
    // brief that says nothing still lands on the library.
    //
    // Only a figure the brief actually contains. Asked for a views floor with
    // nothing to go on, the model writes one anyway: 50,000 on a 100,000
    // follower brief that never mentions views, which is half the audience
    // watching every post. So the model may carry a number across, and may not
    // invent one.
    const said = `${args.audience} ${args.offer}`
    const namedInBrief = (n: number): boolean => {
      const forms = [String(n)]
      if (n % 1_000 === 0) forms.push(`${n / 1_000}k`)
      if (n % 1_000_000 === 0) forms.push(`${n / 1_000_000}m`)
      return forms.some((f) => new RegExp(`(?<![0-9])${f}(?![0-9])`, 'i').test(said))
    }
    const take = (key: string, fallback: number): number => {
      const asked = Number(draft.hard?.[key])
      return Number.isFinite(asked) && asked > 0 && namedInBrief(asked) ? Math.round(asked) : fallback
    }
    // What a typical post gets, as a share of the audience.
    //
    // The library's share was written for its own follower floor. Taken
    // straight to a bigger one it asks for something nobody does: at 15,000
    // followers half of them watching is normal, at 100,000 it is not. The
    // five accounts one client named as his ideal clients came in at 5.4%,
    // 5.7%, 8.4%, 28% and 188%, and a flat half would have refused three of
    // them. So the share falls as the floor rises, and never climbs above the
    // library's own.
    const share = Math.min(d.viewsShare, d.viewsShare * Math.pow(d.followersMin / followersMin, 0.35))
    const viewsBar = Math.round(followersMin * share)

    const inGroups = new Set<string>()
    const groups: { label: string; options: Record<string, number>[] }[] = []
    for (const g of Array.isArray(draft.either) ? draft.either : []) {
      const options = (Array.isArray(g?.options) ? g.options : [])
        .map((o: any) => {
          const clean: Record<string, number> = {}
          for (const [k, v] of Object.entries(o ?? {})) {
            const n = Number(v)
            // Same rule as the thresholds above, and for the same reason: the
            // two worked examples in the prompt came back word for word, 40,000
            // views and 100,000 views on a brief that never mentions views.
            // A ratio has no figure to name, so it rides on the option it sits
            // in rather than on the brief.
            if (!Number.isFinite(n) || n <= 0) continue
            if (k !== 'viewRatioMin' && !namedInBrief(n)) continue
            clean[k] = Math.round(n)
          }
          // A ratio alone is not a way through: it would take a 200 follower
          // account with 20 views.
          if (Object.keys(clean).length === 1 && clean.viewRatioMin !== undefined) return {}
          return clean
        })
        .filter((o: Record<string, number>) => Object.keys(o).length > 0)
      if (options.length < 2) continue
      groups.push({ label: String(g.label ?? 'Either'), options })
    }
    const covers = (keys: string[]) => groups.some((g) => g.options.some((o) => keys.some((k) => k in o)))

    // Reach, as a choice. Someone at the bar on absolute views and someone
    // under it who a tenth of their audience turns out for are both worth
    // writing to. One number keeps the first and loses the second.
    if (!covers(['medianViewsMin', 'viewRatioMin'])) {
      groups.push({
        label: 'Reach',
        options: [
          { medianViewsMin: take('medianViewsMin', viewsBar) },
          { medianViewsMin: Math.round(viewsBar * 0.4), viewRatioMin: 10 },
        ],
      })
    }
    // Rhythm, as a choice. A creator who posts twice a month to three million
    // views a month is not dormant, and a posting count on its own says he is.
    if (!covers(['postsPerMonthMin', 'monthlyViewsMin'])) {
      groups.push({
        label: 'Rhythm',
        options: [
          { postsPerMonthMin: take('postsPerMonthMin', d.postsPerMonthMin) },
          { monthlyViewsMin: viewsBar * 4 },
        ],
      })
    }
    for (const g of groups) for (const o of g.options) for (const k of Object.keys(o)) inGroups.add(k)

    const hard: Record<string, unknown> = {
      followersMin,
      followersMax,
      lastPostWithinDays: take('lastPostWithinDays', d.lastPostWithinDays),
      postsPerMonthMin: take('postsPerMonthMin', d.postsPerMonthMin),
      medianViewsMin: take('medianViewsMin', viewsBar),
      medianCommentsMin: take('medianCommentsMin', Math.round(viewsBar * 0.002)),
      ...(countries.length ? { countries } : {}),
      ...(languages.length ? { languages } : {}),
    }
    // A number a group decides is not demanded here as well. Left in both, the
    // hard copy always fires first and the choice never gets to matter.
    for (const key of inGroups) delete hard[key]

    await ctx.runMutation(internal.campaigns.patch, {
      accountId: args.accountId,
      campaignId: args.campaignId,
      name: draft.name ? String(draft.name).slice(0, 80) : undefined,
      // The brief is already stored, handles and all. Writing it back from
      // the two arguments here dropped the accounts the client had named,
      // which are the one input we ask for and cannot reconstruct.
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
      either: groups,
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
