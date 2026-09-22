import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { ACTOR, APIFY, FRESH_MS } from './crawl'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import {
  evaluate as runGates, loosest, nearMiss, outOf, passesHard, runEither, runHard,
  type EitherGroup, type GateSetShape, type HardRules, type Judgement, type Niche, type Measured } from './gates'

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
    // A near miss whose date has come stops counting as judged, so the pool
    // picks it up again. It is still stale by then, so the freshness rule
    // below holds it back until its profile has been bought again.
    const nowAt = Date.now()
    const seen = new Set(
      done.filter((e) => !(e.retryAfter !== undefined && e.retryAfter <= nowAt)).map((e) => e.creatorId),
    )
    const retrying = done.filter((e) => e.retryAfter !== undefined && e.retryAfter <= nowAt).length

    // Exclusivity is against the kind of offer, so a profile held by a client
    // selling something else is still worth looking at for this one.
    const offerKey = campaign.extracted.templateId ?? 'sell_to_creators'
    const claimed = new Set(
      (await ctx.db.query('creatorClaims').collect())
        .filter((c) => c.offerKey === offerKey)
        .map((c) => c.creatorId),
    )

    const creators = await ctx.db.query('creators').withIndex('by_measured').order('desc').take(1_500)
    const waiting = creators.filter((c) => !seen.has(c._id) && !claimed.has(c._id))

    // A measurement older than thirty days is not judged. Followers, median
    // views and posting rhythm all move, and a verdict written on last
    // quarter's numbers describes a person who no longer exists. Those
    // profiles go back to being candidates: sourcing.refresh buys them again,
    // and they arrive here on the next pass with numbers from today.
    const cutoff = Date.now() - FRESH_MS
    const expired = waiting.filter((c) => (c.measuredAt ?? 0) <= cutoff)
    const fresh = waiting.filter((c) => (c.measuredAt ?? 0) > cutoff).slice(0, args.limit ?? 200)

    return {
      accountId: campaign.accountId,
      gateSetId: gates._id,
      gateSetVersion: gates.version,
      /** Waiting, but on numbers too old to rule on. Re-buy them first. */
      expired: expired.length,
      /** Verdicts that missed by a hair and whose second look is due. */
      retrying,
      gates: {
        hard: gates.hard,
        // Without this the batch runs the demands and none of the choices, so
        // reach and rhythm come back as hard filters the client never set.
        either: gates.either,
        criteria: gates.criteria,
        passScore: gates.passScore,
      },
      niches: campaign.extracted.niches ?? [],
      brief: `${campaign.brief.audience}. They sell: ${campaign.brief.offer}`,
      extracted: campaign.extracted,
      creators: await Promise.all(fresh.map(async (c) => {
        // The posts go to the model too. Half the sentences a client writes
        // are about what a person posts and who answers them, and a model
        // given only a bio scores every one of those a zero for lack of data,
        // which the first real run did.
        const posts = await ctx.db
          .query('creatorPosts')
          .withIndex('by_creator', (q) => q.eq('creatorId', c._id))
          .collect()
        const typical = posts
          .filter((p) => !p.pinned)
          .sort((a, b) => b.postedAt - a.postedAt)
          .slice(0, 12)
          .map((p) => ({
            date: new Date(p.postedAt).toISOString().slice(0, 10),
            kind: p.kind,
            views: p.views || undefined,
            likes: p.likes,
            comments: p.comments,
            // Cut by characters, not by code units: a slice through the middle
            // of an emoji leaves half a surrogate pair, and that is a value
            // the runtime refuses to serialise. The first re-judge died on it.
            caption: Array.from((p.caption ?? '').replace(/\s+/g, ' ')).slice(0, 280).join(''),
            image: p.thumbnail,
          }))
        return {
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
          linkPage: c.linkReadAt ? (c.linkText ?? '') : undefined,
          // Already bought, so never bought again. Without this the most
          // expensive fetch we make ran in full on every pass over the pool.
          hasComments: c.commentsReadAt !== undefined,
          audience: c.topComments,
          paidPosts: c.paidPosts,
          verified: c.verified,
          category: c.category,
          follows: c.follows,
          postsLifetime: c.postsLifetime,
          highlights: c.highlights,
          reelSharePercent: c.reelShare,
          email: c.email ? 'on the profile' : undefined,
          firstSeenAt: c.firstSeenAt,
          posts: typical,
        }
      })),
    }
  },
})

/**
 * The words on the page a bio links to.
 *
 * A creator lists what they sell on a linktree, not in 150 characters of
 * bio. One page, the first link only, tags stripped, two thousand characters
 * kept: enough for the judge to read an app, a price and a product name.
 *
 * It fails quietly. A page that times out or refuses us is an empty string,
 * which is stored so the next pass does not try again, and the judge is told
 * nothing rather than told wrongly.
 */
async function readLink(links: string[] | undefined): Promise<string | null> {
  const url = (links ?? []).find((u) => /^https?:\/\//i.test(u))
  if (!url) return null
  try {
    // Five seconds and no more.
    //
    // This reads a page nobody vetted, on a host nobody chose, and it had no
    // deadline. A batch judged one profile whose linktree never answered and
    // held the whole run open until the platform killed it, which surfaces as
    // "fetch failed" with nothing to say which profile did it. A page that
    // cannot answer in five seconds has nothing to tell the judge.
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; brandmatch/1.0)' },
      signal: AbortSignal.timeout(5_000),
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
      .slice(0, 2000)
  } catch {
    return ''
  }
}


/**
 * The comments under a survivor's posts, and whether the post was paid.
 *
 * A profile fetch does not carry either. They come from a run of their own,
 * so this only happens when a sentence asked for comments, and only for the
 * handful of profiles that already cleared the numbers. Around one centime a
 * creator, against a fifth of that for the profile itself, which is why it
 * is never spent on someone who was going to fail on their follower count.
 *
 * Started and waited on here rather than through the webhook, because the
 * judge is about to read them and a verdict written without them would have
 * to be thrown away.
 */
async function readComments(handles: string[]): Promise<Map<string, { paid: boolean; comments: { by: string; text: string }[] }[]>> {
  const out = new Map<string, { paid: boolean; comments: { by: string; text: string }[] }[]>()
  const token = process.env.APIFY_TOKEN
  if (!token || !handles.length) return out
  try {
    const started = await fetch(`${APIFY}/acts/${ACTOR}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: handles.slice(0, 40).map((h) => `https://www.instagram.com/${h}/`),
        resultsType: 'posts',
        // Two posts, not six. The question a client asks of comments is what
        // kind of people answer, and the first two posts answer it. Six cost
        // three times as much and said the same thing.
        resultsLimit: 2,
        addParentData: false,
      }),
    })
    const run = (await started.json()) as { data?: { id?: string; defaultDatasetId?: string } }
    const id = run?.data?.id
    if (!id) return out

    // Apify takes a minute or two. Past ninety seconds the judge goes ahead
    // without them rather than holding a batch open: four minutes of waiting
    // was most of the time a batch is allowed to live, and the batch died
    // before it could write what it had already worked out.
    let dataset = ''
    for (let waited = 0; waited < 90_000; waited += 8_000) {
      await new Promise((r) => setTimeout(r, 8_000))
      const res = await fetch(`${APIFY}/actor-runs/${id}?token=${token}`)
      const body = (await res.json()) as { data?: { status?: string; defaultDatasetId?: string } }
      if (body?.data?.status === 'SUCCEEDED') { dataset = String(body.data.defaultDatasetId ?? ''); break }
      if (body?.data?.status && !['RUNNING', 'READY'].includes(body.data.status)) return out
    }
    if (!dataset) return out

    const items = (await (await fetch(`${APIFY}/datasets/${dataset}/items?token=${token}&clean=true&limit=500`)).json()) as Record<string, unknown>[]
    for (const post of items) {
      const who = String(post.ownerUsername ?? '').toLowerCase()
      if (!who) continue
      if (!out.has(who)) out.set(who, [])
      out.get(who)!.push({
        paid: Boolean(post.paidPartnership),
        comments: (Array.isArray(post.latestComments) ? post.latestComments : [])
          .slice(0, 12)
          .map((c) => ({
            by: String((c as Record<string, unknown>)?.ownerUsername ?? ''),
            text: String((c as Record<string, unknown>)?.text ?? '').replace(/\s+/g, ' ').slice(0, 160),
          }))
          .filter((c) => c.text),
      })
    }
  } catch {
    /* the judge goes ahead with what it has */
  }
  return out
}

export const keepComments = internalMutation({
  args: {
    creatorId: v.id('creators'),
    paidPercent: v.optional(v.number()),
    comments: v.optional(v.array(v.object({ by: v.string(), text: v.string() }))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creatorId, {
      ...(args.paidPercent !== undefined ? { paidPosts: args.paidPercent } : {}),
      ...(args.comments ? { topComments: args.comments.slice(0, 40) } : {}),
      // Stamped even when nothing came back, so a profile whose comments are
      // off is not bought again every night.
      commentsReadAt: Date.now(),
    })
    return null
  },
})

export const keepLink = internalMutation({
  args: { creatorId: v.id('creators'), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.creatorId, { linkText: args.text, linkReadAt: Date.now() })
    return null
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
    /** Deal breaker sentences that came back false. */
    flags: v.optional(v.array(v.string())),
    score: v.number(),
    reason: v.string(),
    model: v.optional(v.string()),
    /** What the model read as the person's country and language, kept on the profile. */
    country: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { country, language, ...row } = args
    if (country || language) {
      await ctx.db.patch(args.creatorId, {
        ...(country ? { country } : {}), ...(language ? { language } : {}),
      })
    }
    const now = Date.now()

    // A profile that missed by a hair on a rule it can grow into comes back.
    // The date is the same one its measurement expires on, because the two
    // are the same event: the profile is bought again at thirty days anyway,
    // and this is the one verdict worth re-reading when it is.
    const near = args.verdict === 'hard_fail' ? nearMiss(args.hardChecks) : null
    const retryAfter = near ? now + FRESH_MS : undefined

    const already = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign_creator', (q) => q.eq('campaignId', args.campaignId).eq('creatorId', args.creatorId))
      .first()
    if (already) {
      // A verdict stands unless it was marked for a second look and the date
      // has come. Then it is replaced, and the count says how many tries it
      // took, so a profile cannot be re-judged for ever on our own optimism.
      const due = already.retryAfter !== undefined && already.retryAfter <= now
      if (!due) return already._id
      await ctx.db.replace(already._id, {
        ...row,
        evaluatedAt: now,
        retryAfter,
        attempts: (already.attempts ?? 1) + 1,
      })
      return already._id
    }
    return await ctx.db.insert('evaluations', { ...row, evaluatedAt: now, retryAfter, attempts: 1 })
  },
})

/** A two letter code or nothing. "GB" is written "UK", as the briefs say it. */
function code(raw: unknown, upper: boolean): string | undefined {
  const s = String(raw ?? '').trim()
  if (!/^[A-Za-z]{2}$/.test(s)) return undefined
  const c = upper ? s.toUpperCase() : s.toLowerCase()
  return c === 'GB' ? 'UK' : c
}

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

    // Pass one, on the numbers alone. Nothing is fetched and nothing is paid
    // for: whoever fails here never costs a link, a comment or a look.
    const survivors: Record<string, any>[] = []
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
      const checks = [
        ...runHard(measured, loosest(gates.hard, niches), now),
        ...runEither(measured, gates.either, now),
      ]

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

      creator.measured = measured
      survivors.push(creator)
    }

    // Pass two. Only the sentences decide what is fetched, so a campaign that
    // never asks about comments never pays for one.
    const needs = new Set(gates.criteria.flatMap((c) => c.needs ?? []))
    if (needs.has('links')) {
      for (const creator of survivors) {
        if (creator.linkPage !== undefined) continue
        const text = await readLink(creator.links as string[] | undefined)
        await ctx.runMutation(internal.evaluate.keepLink, { creatorId: creator.id, text: text ?? '' })
        creator.linkPage = text ?? ''
      }
    }

    /**
     * Buys the comments for a set of profiles, once each, ever.
     *
     * Six times the price of a profile fetch, and the most expensive thing
     * this pipeline does. Measured on one run: 345 profiles for $4.72, next
     * to $0.55 for discovering all of them.
     */
    const buyComments = async (people: Record<string, any>[]) => {
      const want = people.filter((c) => !c.hasComments).map((c) => c.handle as string)
      if (!want.length) return
      const found = await readComments(want)
      for (const creator of people) {
        if (creator.hasComments) continue
        const rows = found.get(creator.handle as string)
        const comments = (rows ?? []).flatMap((r) => r.comments).slice(0, 40)
        creator.audience = comments
        if (rows?.length) creator.paidPosts = Math.round((rows.filter((r) => r.paid).length / rows.length) * 100)
        creator.hasComments = true
        await ctx.runMutation(internal.evaluate.keepComments, {
          creatorId: creator.id,
          ...(creator.paidPosts !== undefined ? { paidPercent: creator.paidPosts } : {}),
          comments,
        })
      }
    }

    /**
     * Comments are bought for everyone the numbers let through.
     *
     * They used to be bought after a first judging pass, for the few left
     * standing, because deal breakers threw away most of a batch: 57 judged
     * and 6 surviving on one run, so 51 profiles' comments went unbought.
     *
     * Deal breakers no longer remove anybody. Almost everyone judged is now
     * delivered, so deferring would buy the same comments a pass later and
     * pay a second model call for the privilege. Priced on that same run:
     * 51 extra calls at $0.0035 against 6 sets of comments at $0.0046.
     */
    if (needs.has('comments')) await buyComments(survivors)

    /** One profile, judged and written down. Returns whether it is still alive. */
    const judge = async (creator: Record<string, any>): Promise<boolean> => {
      const measured = creator.measured as Measured
      asked++
      const answer = await ask(creator, gates, niches, batch.brief as string)
      if ('error' in answer) {
        failed++
        lastError = answer.error
        return false
      }
      // Country and language come back with the judgement and gate 1 reads
      // them now, on the same pass. Unknown stays unknown and passes.
      const country = code(answer.judgement.country, true)
      const language = code(answer.judgement.language, false)
      const placed = { ...measured, country: country ?? measured.country, language: language ?? measured.language }
      const result = runGates(placed, gates, niches, answer.judgement, now)
      await ctx.runMutation(internal.evaluate.write, {
        country,
        language,
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
        flags: result.flags,
        score: result.score,
        reason: result.reason,
        model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash',
      })
      return result.verdict === 'qualified'
    }

    for (const creator of survivors) {
      if (await judge(creator)) qualified++
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
    required: [...(on.length ? ['niche'] : []), 'country', 'language', 'criteria', 'reason'],
    properties: {
      // Two letter codes, so the gate can compare them. "unknown" passes.
      country: { type: 'string' },
      language: { type: 'string' },
      // Classification against a list the client controls, never a free guess.
      ...(on.length
        ? { niche: { type: 'string', enum: [...on.map((n) => n.id), 'other'] } }
        : {}),
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
    'Read each sentence below against the profile. Answer 2 when it is true of them, 1 when it is partly true, 0 when it is false or you cannot tell. Quote what you read it in as the note.',
    'A 0 means you looked and it is not there. Say in the note what you looked at, so a zero for absence reads differently from a zero for lack of data.',
    'Some sentences are marked non negotiable. They are scored exactly like the rest, and the difference is what the client does with the answer afterwards, which is no concern of yours. Answer what you see.',
    'Each sentence carries how to settle it. Proof is what the evidence line names. The trap is the near miss that scores 0, however much it looks like the thing.',
    ...gates.criteria.flatMap((c) => [
      `- ${c.id}: ${c.text}${c.breaker ? '  [non negotiable]' : ''}`,
      ...(c.evidence ? [`    proof: ${c.evidence}`] : []),
      ...(c.trap ? [`    not this: ${c.trap}`] : []),
      ...(c.rubric ? [`    scale: ${c.rubric}`] : []),
    ]),
    '',
    ...(on.length
      ? [
          '',
          'Say which of these they work in. Use "other" when none of them fits.',
          ...on.map((n) => `- ${n.id}: ${n.label}`),
        ]
      : []),
    '',
    ...(gates.criteria.some((c) => c.needs?.includes('images'))
      ? ['The pictures attached are the last nine posts, newest first. Look at them for anything a sentence asks you to look at: how it is shot, how it is lit, whether it holds together as one look, whether a person is on camera.', '']
      : []),
    ...((creator.audience as unknown[] | undefined)?.length
      ? [
          'Comments under their recent posts, their own replies among them:',
          ...((creator.audience as { by: string; text: string }[]).map((c) => `- ${c.by}: ${c.text}`)),
          '',
        ]
      : []),
    'Judge from the bio, the link page, the numbers and the posts below. The posts are the last twelve, newest first, with their captions and their counts: read them for what the person sells, teaches, complains about, and how people respond. Never assume what the posts do not show. Write one plain sentence as the reason.',
    '',
    'Also say where the person lives as a two letter country code (US, GB, AU, FR, TH) and the language they post in as a two letter code (en, fr, pt). Read them from the bio, the city, the currency, the captions. Answer "unknown" for either when the profile does not say.',
    '',
    `Profile: ${JSON.stringify({ ...creator, posts: undefined })}`,
    '',
    'Their last posts, newest first:',
    ...((creator.posts as Record<string, unknown>[] | undefined) ?? []).map(
      (p) => `- ${p.date} ${p.kind}${p.views ? `, ${p.views} views` : ''}, ${p.likes} likes, ${p.comments} comments: ${p.caption || '(no caption)'}`,
    ),
  ].join('\n')

  // A sentence that asked to see the work gets a model that can look, and
  // the last nine pictures ride with the question. Nobody asked, nobody
  // pays: the text model answers and no image is ever fetched.
  const wantsEyes = gates.criteria.some((c) => c.needs?.includes('images'))
  const shots = wantsEyes
    ? ((creator.posts as Record<string, unknown>[] | undefined) ?? [])
        .map((p) => String(p.image ?? ''))
        .filter(Boolean)
        .slice(0, 9)
    : []
  const content = shots.length
    ? [
        { type: 'text', text: prompt },
        ...shots.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]
    : prompt

  const payload = JSON.stringify({
    model: shots.length
      ? (process.env.OPENROUTER_VISION_MODEL ?? 'google/gemini-2.5-flash')
      : (process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash'),
    messages: [{ role: 'user', content }],
    // The same profile should get the same verdict twice. Judged again
    // after a rule change, one profile moved niche and another moved gate
    // with nothing else changed.
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: { name: 'gates', strict: true, schema } },
  })

  // One profile's network trouble is not the batch's.
  //
  // This call used to be bare. A dropped connection threw out of the whole
  // run with "fetch failed", and everything not yet written was lost: a
  // batch of 400 died twice that way after writing a few hundred verdicts,
  // and there was nothing to say which profile had done it. A failure here
  // is now one profile's failure, tried twice and then reported.
  let res: Response | null = null
  let reached: string | null = null
  for (let go = 0; go < 2 && !res; go++) {
    if (go) await new Promise((r) => setTimeout(r, 1_500))
    try {
      res = await fetch(OPENROUTER, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: payload,
        // A judge that never answers is a batch that never ends.
        signal: AbortSignal.timeout(60_000),
      })
    } catch (e) {
      reached = e instanceof Error ? e.message : String(e)
    }
  }
  if (!res) return { error: `Could not reach OpenRouter: ${reached ?? 'unknown'}` }

  let raw: string
  try {
    raw = await res.text()
  } catch (e) {
    return { error: `OpenRouter cut the answer short: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!res.ok) return { error: `OpenRouter replied ${res.status}: ${raw.slice(0, 300)}` }
  let body: { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null = null
  try { body = JSON.parse(raw) } catch { return { error: `OpenRouter sent something that is not JSON: ${raw.slice(0, 200)}` } }
  const text = body?.choices?.[0]?.message?.content
  if (!text) return { error: body?.error?.message ?? `OpenRouter sent no answer: ${raw.slice(0, 200)}` }
  try {
    const raw2 = JSON.parse(text) as Record<string, any>
    // The model answered the disqualifying fact. The engine reads a pass, so
    // the two are flipped here and nowhere else. A found fact with no quote
    // still drops the profile: the quote is evidence, never permission.
    // There is one list of sentences now, and every one of them is scored.
    // A deal breaker is a sentence the client marked, not a second kind of
    // question: the flipping and the quoting that a knockout needed are gone
    // with it, and so are the double negatives they kept producing.
    const parsed = { ...raw2, knockouts: {} } as Judgement
    // "other" is not a niche, it is the absence of one.
    if (parsed.niche === 'other') parsed.niche = null
    return { judgement: parsed }
  } catch {
    return { error: `The model answered outside the schema: ${text.slice(0, 200)}` }
  }
}

/**
 * Forgets the verdicts on the named handles, so the next run judges them
 * again. Refused for a handle a lead already points at.
 */
export const rejudge = internalMutation({
  args: { campaignId: v.id('campaigns'), handles: v.array(v.string()) },
  returns: v.any(),
  handler: async (ctx, { campaignId, handles }) => {
    let forgotten = 0
    const kept: string[] = []
    for (const handle of handles.map((h) => h.toLowerCase())) {
      const c = await ctx.db.query('creators').withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', handle)).first()
      if (!c) continue
      const lead = await ctx.db.query('leads').withIndex('by_creator', (q) => q.eq('creatorId', c._id)).first()
      if (lead) { kept.push(handle); continue }
      const row = await ctx.db.query('evaluations').withIndex('by_campaign_creator', (q) => q.eq('campaignId', campaignId).eq('creatorId', c._id)).first()
      if (row) { await ctx.db.delete(row._id); forgotten++ }
    }
    return { forgotten, kept }
  },
})

/**
 * Forgets every verdict a campaign holds, so the next run judges everyone
 * again. For the operator, after a measurement or a rule changed under the
 * profiles. Refused while a lead still points at one of them: a lead's audit
 * trail is not something to delete.
 */
export const forget = internalMutation({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const leads = await ctx.db.query('leads').withIndex('by_campaign', (q) => q.eq('campaignId', campaignId)).first()
    if (leads) return { error: 'This campaign has leads, and their verdicts stay' }
    const rows = await ctx.db.query('evaluations').withIndex('by_campaign', (q) => q.eq('campaignId', campaignId)).collect()
    for (const r of rows) await ctx.db.delete(r._id)
    return { forgotten: rows.length }
  },
})

/**
 * Judges named handles again and writes nothing.
 *
 * A lead's verdict is its audit trail and is not something to overwrite while
 * measuring a change to the judge. This runs the new one over profiles we
 * already paid for and says what it would have decided, so a change to the
 * questions can be priced in leads kept and leads dropped before it touches
 * anybody's list.
 */
export const tryOn = internalAction({
  args: { campaignId: v.id('campaigns'), handles: v.array(v.string()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const batch = await ctx.runQuery(internal.evaluate.pending, { campaignId: args.campaignId, limit: 0 })
    if ('error' in batch) return batch as Record<string, unknown>
    const gates = batch.gates as GateSetShape
    const niches = (batch.niches ?? []) as Niche[]
    const now = Date.now()
    const out = []

    for (const handle of args.handles.map((h) => h.toLowerCase().replace(/^@/, ''))) {
      const creator = await ctx.runQuery(internal.evaluate.oneByHandle, { handle })
      if (!creator) { out.push({ handle, error: 'never measured' }); continue }
      const measured = {
        followers: creator.followers,
        medianViews: creator.medianViews,
        medianComments: creator.medianComments,
        postsPerMonth: creator.postsPerMonth,
        lastPostAt: creator.lastPostAt,
        country: creator.country,
        language: creator.language,
      }
      if (creator.linkPage === undefined) {
        const text = await readLink(creator.links as string[] | undefined)
        await ctx.runMutation(internal.evaluate.keepLink, { creatorId: creator.id, text: text ?? '' })
        creator.linkPage = text ?? ''
      }
      const answer = await ask(creator, gates, niches, batch.brief as string)
      if ('error' in answer) { out.push({ handle, error: answer.error }); continue }
      const country = code(answer.judgement.country, true)
      const language = code(answer.judgement.language, false)
      const result = runGates(
        { ...measured, country: country ?? measured.country, language: language ?? measured.language },
        gates, niches, answer.judgement, now,
      )
      out.push({
        handle,
        verdict: result.verdict,
        blockedBy: result.blockedBy,
        score: result.score,
        outOf: outOf(gates),
        flags: result.flags ?? [],
        linkChars: String(creator.linkPage ?? '').length,
        scores: result.criteriaScores.map((c) => `${c.id} ${c.score}`),
        reason: result.reason,
      })
    }
    return { judged: out.length, out }
  },
})

/** One measured profile, shaped the way the judge reads it. */
export const oneByHandle = internalQuery({
  args: { handle: v.string() },
  returns: v.any(),
  handler: async (ctx, { handle }) => {
    const c = await ctx.db
      .query('creators')
      .withIndex('by_handle', (q) => q.eq('platform', 'instagram').eq('handle', handle))
      .first()
    if (!c) return null
    const posts = await ctx.db
      .query('creatorPosts')
      .withIndex('by_creator', (q) => q.eq('creatorId', c._id))
      .collect()
    const typical = posts
      .sort((a, b) => b.postedAt - a.postedAt)
      .slice(0, 12)
      .map((p) => ({
        date: new Date(p.postedAt).toISOString().slice(0, 10),
        kind: p.kind,
        views: p.views,
        likes: p.likes,
        comments: p.comments,
        caption: Array.from((p.caption ?? '').replace(/\s+/g, ' ')).slice(0, 280).join(''),
        image: p.thumbnail,
      }))
    return {
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
      linkPage: c.linkReadAt ? (c.linkText ?? '') : undefined,
      verified: c.verified,
      category: c.category,
      follows: c.follows,
      postsLifetime: c.postsLifetime,
      highlights: c.highlights,
      reelSharePercent: c.reelShare,
      email: c.email ? 'on the profile' : undefined,
      firstSeenAt: c.firstSeenAt,
      posts: typical,
    }
  },
})

/**
 * Gate 1 over the whole pool, counted and never written.
 *
 * The numbers gate costs nothing to run, so the effect of moving it can be read
 * before a single model call is paid for. It answers the one question that
 * matters when a rule is loosened: how many more people reach the judge, and
 * which rule was turning them away.
 */
export const numbersOnly = internalQuery({
  args: {
    campaignId: v.id('campaigns'),
    sample: v.optional(v.number()),
    /** Only profiles first seen after this, so one run can be read on its own. */
    since: v.optional(v.number()),
    /** Rules to try instead of the campaign's own, for comparing two versions. */
    hard: v.optional(v.any()),
    either: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, { campaignId, sample, since, hard: tryHard, either: tryEither }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign) return { error: 'No such campaign' }
    const sets = await ctx.db
      .query('gateSets')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect()
    const gates = sets.find((g) => g._id === campaign.gateSetId) ?? sets[sets.length - 1]
    if (!gates) return { error: 'No rules on this campaign' }

    const all = await ctx.db.query('creators').take(sample ?? 3000)
    const creators = since ? all.filter((c) => (c.firstSeenAt ?? 0) >= since) : all
    const now = Date.now()
    const blockedBy: Record<string, number> = {}
    // Every rule each profile misses, not only the first one it hits. The
    // first alone hides the rest: everybody under the follower floor dies
    // there and never gets counted against the views or the rhythm.
    const alsoMissed: Record<string, number> = {}
    const sizes: number[] = []
    let kept = 0
    for (const c of creators) {
      const m = {
        followers: c.followers ?? 0,
        medianViews: c.medianViews,
        medianComments: c.medianComments,
        postsPerMonth: c.postsPerMonth,
        lastPostAt: c.lastPostAt,
        country: c.country,
        language: c.language,
      }
      const checks = [
        ...runHard(m, (tryHard ?? gates.hard) as HardRules, now),
        ...runEither(m, (tryEither ?? gates.either) as EitherGroup[] | undefined, now),
      ]
      sizes.push(m.followers)
      const first = checks.find((k) => !k.pass)
      if (!first) kept += 1
      else blockedBy[first.key] = (blockedBy[first.key] ?? 0) + 1
      for (const k of checks) if (!k.pass) alsoMissed[k.key] = (alsoMissed[k.key] ?? 0) + 1
    }
    sizes.sort((a, b) => a - b)
    const at = (share: number) => sizes[Math.floor(sizes.length * share)] ?? 0
    return {
      followers: sizes.length
        ? { p10: at(0.1), median: at(0.5), p90: at(0.9), under10k: sizes.filter((n) => n < 10_000).length }
        : null,
      alsoMissed: Object.fromEntries(Object.entries(alsoMissed).sort((a, b) => b[1] - a[1])),
      version: tryHard || tryEither ? 'trial' : gates.version,
      hard: tryHard ?? gates.hard,
      either: tryEither ?? gates.either ?? [],
      looked: creators.length,
      kept,
      blockedBy: Object.fromEntries(Object.entries(blockedBy).sort((a, b) => b[1] - a[1])),
    }
  },
})

/** What a campaign decided, newest first, for reading a run without delivering it. */
export const verdicts = internalQuery({
  args: { campaignId: v.id('campaigns'), limit: v.optional(v.number()), judgedOnly: v.optional(v.boolean()) },
  returns: v.any(),
  handler: async (ctx, { campaignId, limit, judgedOnly }) => {
    const all = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .order('desc')
      .take(limit ?? 40)
    // A profile the numbers turned away never reached the model, so it has
    // nothing to read. Dropping those is what lets one call cover a whole run.
    const rows = judgedOnly ? all.filter((r) => r.verdict !== 'hard_fail') : all
    return Promise.all(rows.map(async (r) => {
      const c = await ctx.db.get(r.creatorId)
      return {
        handle: c?.handle ?? '?',
        followers: c?.followers,
        firstSeenAt: c?.firstSeenAt,
        foundVia: c?.foundVia?.channel,
        verdict: r.verdict,
        score: r.score,
        blockedBy: r.blockedBy,
        reason: r.reason,
        criteria: r.criteriaScores,
        knockouts: r.knockoutAnswers,
      }
    }))
  },
})

/**
 * The profiles that missed by a hair, and when each comes back.
 *
 * Every number here was already paid for. A rejection carries the checks it
 * failed and by how much, so this reads the file rather than the platform,
 * and it answers the only question worth asking about a hard fail: was the
 * person wrong, or were we early.
 */
export const nearMisses = internalQuery({
  args: { campaignId: v.id('campaigns'), margin: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const rows = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()

    const fails = rows.filter((e) => e.verdict === 'hard_fail')
    const byRule: Record<string, number> = {}
    const out = []
    let due = 0
    for (const e of fails) {
      const near = nearMiss(e.hardChecks, args.margin)
      if (!near) continue
      byRule[near.key] = (byRule[near.key] ?? 0) + 1
      const ready = e.retryAfter !== undefined && e.retryAfter <= now
      if (ready) due++
      const c = await ctx.db.get(e.creatorId)
      out.push({
        handle: c?.handle ?? '?',
        rule: near.key,
        had: near.value,
        asked: near.limit,
        offByPercent: Math.round(near.offBy * 100),
        attempts: e.attempts ?? 1,
        retryAfter: e.retryAfter ?? null,
        ready,
      })
    }

    return {
      hardFails: fails.length,
      nearMisses: out.length,
      /** The share of rejections that were a matter of timing, not of fit. */
      sharePercent: fails.length ? Math.round((out.length / fails.length) * 100) : 0,
      dueNow: due,
      byRule,
      sample: out.sort((a, b) => a.offByPercent - b.offByPercent).slice(0, 20),
    }
  },
})

/**
 * Dates the near misses written before they carried a date.
 *
 * Reads the checks already on file, so nothing is paid for and no verdict
 * changes. A profile judged before this existed gets its second look thirty
 * days after it was judged, which for most of them is already behind us.
 */
export const backfillRetries = internalMutation({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    let marked = 0
    for (const e of rows) {
      if (e.retryAfter !== undefined || e.verdict !== 'hard_fail') continue
      if (!nearMiss(e.hardChecks)) continue
      await ctx.db.patch(e._id, { retryAfter: e.evaluatedAt + FRESH_MS, attempts: e.attempts ?? 1 })
      marked++
    }
    return { judged: rows.length, marked }
  },
})
