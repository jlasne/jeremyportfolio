import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

// Finding out how big someone is before paying to find out.
//
// Every other channel hands back a handle and nothing else, so the only way
// to learn that an account has 1,200 followers when the client asked for
// 10,000 is to buy its profile. Measured across three campaigns, that is
// where most of the money goes: the account index lands 24% of what it buys
// inside the client's window, so three profiles in four are bought only to
// be thrown away.
//
// Google already knows. Its result for an Instagram profile carries the
// follower count in the snippet, because that is what Instagram puts in the
// page description. Checked on 22/09/26: eight of ten results for
// `site:instagram.com comedy creator "Followers" "Posts"` were profiles with
// a readable count, from 65 followers to 6M.
//
// So the filter moves in front of the money. A search costs a tenth of a
// cent, a profile costs 0.23, and only the profiles inside the window are
// ever bought.
//
// What it does not give: views, rhythm, or when they last posted. Those still
// need the profile. This removes the waste on size, which is most of it, not
// all of it.

const SERPER = 'https://google.serper.dev/search'

/** A tenth of a cent a search, at Serper's entry price of $50 for 50,000. */
const CENTS_PER_SEARCH = 0.1

/**
 * The follower count Instagram writes into its own page description.
 *
 * It arrives in every shape Instagram uses: "6M followers", "24K followers",
 * "7,332 Followers", "337 Followers". The count is what matters and the case
 * and separators are noise.
 *
 * Returns null rather than zero when there is nothing to read, because a
 * result we cannot size is a result we must not judge: dropping it silently
 * as too small would throw away exactly the accounts whose snippet Google
 * happened to truncate.
 */
export function followersIn(text: string): number | null {
  const m = text.match(/([\d][\d.,\s]*)\s*([KkMmBb])?\s*followers/i)
  if (!m) return null
  const digits = m[1].replace(/[,\s]/g, '')
  const n = Number(digits)
  if (!Number.isFinite(n) || n <= 0) return null
  const scale = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[(m[2] ?? '').toLowerCase()] ?? 1
  return Math.round(n * scale)
}

/** The handle behind an Instagram url, or null when it is not a profile. */
export function handleIn(url: string): string | null {
  const m = url.match(/^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?|$)/)
  if (!m) return null
  const handle = m[1].toLowerCase()
  // Instagram's own pages sit on the same path shape as a person's.
  const NOT_PEOPLE = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'directory', 'about', 'legal'])
  return NOT_PEOPLE.has(handle) ? null : handle
}

/**
 * The shapes one topic is asked in.
 *
 * A single `site:instagram.com "comedy" "Followers" "Posts"` returns nine
 * handles and then repeats: page two carried nothing new, measured. That is
 * not a reason to drop the channel, it is a reason to ask more questions.
 * Google's index of a site is shallow per query and wide across queries, and
 * a query costs a tenth of a cent while the profile behind it costs 0.23.
 *
 * So the topic is asked as the bare word and as the words people actually
 * put in a profile name. Each shape is a different nine.
 */
const SHAPES = [
  '', 'creator', 'page', 'videos', 'reels', 'official',
  'daily', 'clips', 'content', 'account', 'world', 'club',
]

export function variants(topics: string[]): string[] {
  const out: string[] = []
  for (const topic of topics) {
    const word = topic.trim()
    if (!word) continue
    for (const shape of SHAPES) {
      const term = shape ? `"${word}" ${shape}` : `"${word}"`
      out.push(`site:instagram.com ${term} "Followers" "Posts"`)
    }
  }
  return [...new Set(out)]
}

type Organic = { title?: string; link?: string; snippet?: string }

/**
 * One page of Google, read for handles and sizes.
 *
 * The title carries the account name and the snippet the counts, and either
 * can hold the followers depending on how Google cut the description, so both
 * are read.
 */
async function page(
  key: string,
  q: string,
  opts: { gl?: string; hl?: string; num?: number; page?: number },
): Promise<{ rows: { handle: string; followers: number | null }[]; results?: number; error?: string }> {
  const res = await fetch(SERPER, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, gl: opts.gl ?? 'us', hl: opts.hl ?? 'en', num: opts.num ?? 10, page: opts.page ?? 1 }),
  })
  if (!res.ok) {
    const why = await res.text().catch(() => '')
    return { rows: [], error: `Serper replied ${res.status}${why ? `: ${why.slice(0, 200)}` : ''}` }
  }
  const body = (await res.json()) as { organic?: Organic[] }
  const rows: { handle: string; followers: number | null }[] = []
  const seen = new Set<string>()
  for (const r of body.organic ?? []) {
    const handle = handleIn(String(r.link ?? ''))
    if (!handle || seen.has(handle)) continue
    seen.add(handle)
    rows.push({ handle, followers: followersIn(`${r.title ?? ''} ${r.snippet ?? ''}`) })
  }
  return { rows, results: (body.organic ?? []).length }
}

/**
 * Searches Google for this campaign's people and buys only the right sizes.
 *
 * The queries are the campaign's own niches, restricted to Instagram profile
 * pages and to results whose description carries a follower count. Each one
 * is asked once per page, and a page that returns no handle we have not seen
 * ends that query: Google's deep pages repeat, exactly as Instagram's account
 * index does.
 */
export const search = internalAction({
  args: {
    campaignId: v.id('campaigns'),
    /** Words to search. Empty takes the campaign's niches. */
    queries: v.optional(v.array(v.string())),
    /** Result pages per query. Each one is a search and costs a tenth of a cent. */
    pages: v.optional(v.number()),
    /** How many query shapes to ask. Each topic makes six. */
    maxQueries: v.optional(v.number()),
    /** How many of the campaign's countries to read the results from. */
    maxPlaces: v.optional(v.number()),
    /** Buy the profiles found. Off by default, so a first look costs one cent. */
    buy: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const key = process.env.SERPER_API_KEY
    if (!key) {
      return { error: 'SERPER_API_KEY is not set. Chantier 4 waits on it.', blocked: true }
    }

    const plan = await ctx.runQuery(internal.channels.plan, { campaignId: args.campaignId })
    if (plan.error) return plan
    const window = (plan.window ?? {}) as { followersMin?: number | null; followersMax?: number | null }
    const lo = window.followersMin ?? 0
    const hi = window.followersMax ?? Number.MAX_SAFE_INTEGER

    const topics = (args.queries?.length ? args.queries : plan.topics ?? []) as string[]
    if (!topics.length) return { error: 'Nothing to search for' }
    const asks = variants(topics).slice(0, args.maxQueries ?? 60)
    const pages = Math.max(1, Math.min(args.pages ?? 2, 10))

    // The country the results are read from. Google answers the same words
    // differently per market, so a campaign selling into five countries has
    // five indexes to read rather than one, at no extra cost per country.
    const places = ((plan.countries ?? []) as string[]).map((c) => c.toLowerCase()).slice(0, args.maxPlaces ?? 2)
    const markets = places.length ? places : ['us']

    const found = new Map<string, number | null>()
    const perQuery: Record<string, unknown>[] = []
    let searches = 0

    // Asked in batches rather than one after another.
    //
    // Each search is a round trip of about a second, and a campaign with
    // eight topics asks close to four hundred of them across its markets.
    // Sequentially that is longer than a function is allowed to live, and the
    // first attempt at the full set died without returning anything. The
    // queries do not depend on each other, so they go out together.
    const jobs: { q: string; gl: string }[] = []
    for (const q of asks) for (const gl of markets) jobs.push({ q, gl })

    const WIDTH = 8
    for (let at = 0; at < jobs.length; at += WIDTH) {
      const batch = jobs.slice(at, at + WIDTH)
      const answers = await Promise.all(batch.map(async (job) => {
        const out: { rows: { handle: string; followers: number | null }[]; searches: number; error?: string } =
          { rows: [], searches: 0 }
        const here = new Set<string>()
        for (let p = 1; p <= pages; p++) {
          const got = await page(key, job.q, { page: p, gl: job.gl })
          out.searches++
          if (got.error) { out.error = got.error; break }
          let newHere = 0
          for (const row of got.rows) {
            if (here.has(row.handle)) continue
            here.add(row.handle)
            out.rows.push(row)
            newHere++
          }
          // A page that repeated everything is the end of this query, and the
          // next page would be another tenth of a cent for the same rows.
          if (newHere === 0) break
        }
        return { job, out }
      }))

      for (const { job, out } of answers) {
        searches += out.searches
        if (out.error) { perQuery.push({ query: job.q, gl: job.gl, error: out.error }); continue }
        let fresh = 0
        let sized = 0
        let inWindow = 0
        for (const row of out.rows) {
          if (found.has(row.handle)) continue
          found.set(row.handle, row.followers)
          fresh++
          if (row.followers !== null) {
            sized++
            if (row.followers >= lo && row.followers <= hi) inWindow++
          }
        }
        perQuery.push({ query: job.q.replace('site:instagram.com ', ''), gl: job.gl, found: fresh, sized, inWindow })
      }
    }

    // The whole point: the window is applied before a penny is spent on a
    // profile.
    //
    // A result Google could not size is dropped, and that is the opposite of
    // what this did at first. Keeping them looked like the careful choice:
    // throwing away what we cannot measure should bias the pool towards
    // whatever Google chose to truncate. Measured on 22/09/26, that worry was
    // backwards. Of 17 handles bought and checked, the 9 Google had sized
    // landed inside the window, every one, and its figure was within 3% of
    // what Apify then measured. The 8 it had not sized came back at 1,698 to
    // 8,633 followers: every one below the floor.
    //
    // Google truncates the small and the thinly indexed. That is not noise to
    // be preserved, it is the signal. Dropping them takes the aim of what we
    // pay for from 63% to 100%.
    const worth = [...found.entries()]
      .filter(([, n]) => n !== null && n >= lo && n <= hi)
      .map(([handle]) => handle)

    const out: Record<string, unknown> = {
      window,
      topics: topics.length,
      queries: asks.length,
      markets,
      searches,
      /** What Google said each kept handle was, so it can be held to it. */
      sizes: Object.fromEntries([...found.entries()].filter(([, n]) => n !== null && n >= lo && n <= hi)),
      costCents: Math.round(searches * CENTS_PER_SEARCH * 100) / 100,
      handles: found.size,
      sized: [...found.values()].filter((n) => n !== null).length,
      inWindow: worth.length,
      /** The share of what Google returned that is worth paying for. */
      aim: found.size ? Math.round((worth.length / found.size) * 100) : 0,
      perQuery,
    }
    if (!args.buy) return { ...out, note: 'Nothing bought. Pass buy: true to fetch these profiles.' }
    if (!worth.length) return { ...out, note: 'Nothing inside the window' }

    const run = (await ctx.runAction(internal.ingest.detailRun, {
      handles: worth, campaignId: args.campaignId, channel: 'google',
    })) as Record<string, unknown>
    // Under its own key, because a detail run reports a handle count too and
    // spreading it flat overwrote Google's. That read as 30 handles found
    // where 126 had been, which is the kind of number a decision gets made on.
    return { ...out, bought: run }
  },
})

/**
 * One raw query, reported and never bought from.
 *
 * The shape of the query decides everything this channel is worth, and it is
 * not guessable: quoting the words Instagram puts in its description sounds
 * right and returns almost nothing, because Google matches quoted terms
 * against the indexed document rather than the description it renders.
 *
 * So the shapes are measured against each other before one is chosen. Each
 * page is one search, which is a tenth of a cent, and Serper gives 2,500 of
 * them away.
 */
export const probe = internalAction({
  args: {
    q: v.string(), pages: v.optional(v.number()), num: v.optional(v.number()),
    gl: v.optional(v.string()), hl: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const key = process.env.SERPER_API_KEY
    if (!key) return { error: 'SERPER_API_KEY is not set', blocked: true }
    const pages = Math.max(1, Math.min(args.pages ?? 1, 10))

    const found = new Map<string, number | null>()
    let searches = 0
    for (let p = 1; p <= pages; p++) {
      const got = await page(key, args.q, { page: p, num: args.num, gl: args.gl, hl: args.hl })
      searches++
      if (got.error) return { q: args.q, searches, error: got.error }
      let newHere = 0
      for (const row of got.rows) {
        if (found.has(row.handle)) continue
        found.set(row.handle, row.followers)
        newHere++
      }
      if (newHere === 0) break
    }

    const sizes = [...found.values()].filter((n): n is number => n !== null)
    return {
      q: args.q,
      searches,
      /** Serper charges two credits for a page of more than ten results. */
      credits: searches * ((args.num ?? 10) > 10 ? 2 : 1),
      handles: found.size,
      sized: sizes.length,
      sample: [...found.entries()].slice(0, 12).map(([h, n]) => `${h}: ${n ?? '?'}`),
    }
  },
})

// ---------------------------------------------------------------------------
// The same search, bought from Apify instead
// ---------------------------------------------------------------------------
//
// Serper's free tier refuses more than ten results a search, which is what
// makes the channel look dear: a tenth of a cent buys ten results, so a
// hundred results cost a cent. Apify sells the same Google page at $1.80 per
// thousand pages and lets a page carry a hundred results.
//
// If a hundred-result page is charged as one page, that is 0.18 cents for a
// hundred results against 1 cent through Serper's free tier. Same Google,
// same account we already pay Instagram scraping to, no second vendor and no
// fifty dollars up front.
//
// That "if" is the whole question, so this exists to answer it by running it.

const GOOGLE_ACTOR = 'apify~google-search-scraper'

type ApifySerp = {
  organicResults?: { title?: string; url?: string; description?: string }[]
}

/**
 * Runs the Google queries through Apify and reports the same numbers as
 * search does, so the two can be put side by side on one campaign.
 *
 * Waits for the run rather than taking a webhook, because the answer is
 * wanted now and the run takes under a minute.
 */
export const viaApify = internalAction({
  args: {
    campaignId: v.id('campaigns'),
    queries: v.optional(v.array(v.string())),
    maxQueries: v.optional(v.number()),
    /** Results asked of each page. The point of the comparison. */
    perPage: v.optional(v.number()),
    country: v.optional(v.string()),
    buy: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const token = process.env.APIFY_TOKEN
    if (!token) return { error: 'APIFY_TOKEN is not set' }

    const plan = await ctx.runQuery(internal.channels.plan, { campaignId: args.campaignId })
    if (plan.error) return plan
    const window = (plan.window ?? {}) as { followersMin?: number | null; followersMax?: number | null }
    const lo = window.followersMin ?? 0
    const hi = window.followersMax ?? Number.MAX_SAFE_INTEGER

    const topics = (args.queries?.length ? args.queries : plan.topics ?? []) as string[]
    if (!topics.length) return { error: 'Nothing to search for' }
    const asks = variants(topics).slice(0, args.maxQueries ?? 24)
    const perPage = Math.max(10, Math.min(args.perPage ?? 100, 100))

    const started = await fetch(`https://api.apify.com/v2/acts/${GOOGLE_ACTOR}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: asks.join('\n'),
        resultsPerPage: perPage,
        maxPagesPerQuery: 1,
        countryCode: args.country ?? 'us',
        languageCode: 'en',
        mobileResults: false,
        saveHtml: false,
      }),
    })
    if (!started.ok) return { error: `Apify replied ${started.status}: ${(await started.text()).slice(0, 200)}` }
    const runId = (await started.json())?.data?.id
    if (!runId) return { error: 'Apify started no run' }

    // Poll. The run is a handful of pages and finishes inside a minute.
    let status = 'RUNNING'
    let datasetId = ''
    let costUsd = 0
    for (let i = 0; i < 40 && (status === 'RUNNING' || status === 'READY'); i++) {
      await new Promise((r) => setTimeout(r, 5_000))
      const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
      if (!res.ok) continue
      const d = (await res.json())?.data
      status = String(d?.status ?? '')
      datasetId = String(d?.defaultDatasetId ?? '')
      costUsd = Number(d?.usageTotalUsd ?? 0)
    }
    if (status !== 'SUCCEEDED' || !datasetId) return { runId, status, costUsd, error: `Run ended ${status}` }

    const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=200`)
    const pages = res.ok ? ((await res.json()) as ApifySerp[]) : []

    const found = new Map<string, number | null>()
    let results = 0
    for (const p of pages) {
      for (const r of p.organicResults ?? []) {
        results++
        const handle = handleIn(String(r.url ?? ''))
        if (!handle || found.has(handle)) continue
        found.set(handle, followersIn(`${r.title ?? ''} ${r.description ?? ''}`))
      }
    }

    const worth = [...found.entries()]
      .filter(([, n]) => n !== null && n >= lo && n <= hi)
      .map(([handle]) => handle)

    const out: Record<string, unknown> = {
      via: 'apify',
      queries: asks.length,
      perPage,
      pages: pages.length,
      results,
      costUsd: Math.round(costUsd * 1000) / 1000,
      /** The number that decides between the two vendors. */
      usdPer100Results: results ? Math.round((costUsd / results) * 100 * 10_000) / 10_000 : null,
      handles: found.size,
      sized: [...found.values()].filter((n) => n !== null).length,
      inWindow: worth.length,
      sizes: Object.fromEntries([...found.entries()].filter(([, n]) => n !== null && n >= lo && n <= hi)),
    }
    if (!args.buy || !worth.length) return { ...out, note: 'Nothing bought' }
    const run = await ctx.runAction(internal.ingest.detailRun, {
      handles: worth, campaignId: args.campaignId, channel: 'google',
    })
    return { ...out, bought: run }
  },
})
