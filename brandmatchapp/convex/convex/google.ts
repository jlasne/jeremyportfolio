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
): Promise<{ rows: { handle: string; followers: number | null }[]; error?: string }> {
  const res = await fetch(SERPER, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, gl: opts.gl ?? 'us', hl: opts.hl ?? 'en', num: opts.num ?? 10, page: opts.page ?? 1 }),
  })
  if (!res.ok) return { rows: [], error: `Serper replied ${res.status}` }
  const body = (await res.json()) as { organic?: Organic[] }
  const rows: { handle: string; followers: number | null }[] = []
  const seen = new Set<string>()
  for (const r of body.organic ?? []) {
    const handle = handleIn(String(r.link ?? ''))
    if (!handle || seen.has(handle)) continue
    seen.add(handle)
    rows.push({ handle, followers: followersIn(`${r.title ?? ''} ${r.snippet ?? ''}`) })
  }
  return { rows }
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

    const words = (args.queries?.length ? args.queries : plan.topics ?? []).slice(0, 10)
    if (!words.length) return { error: 'Nothing to search for' }
    const pages = Math.max(1, Math.min(args.pages ?? 3, 10))

    const found = new Map<string, number | null>()
    const perQuery: Record<string, unknown>[] = []
    let searches = 0

    for (const word of words) {
      // Profile pages only, and only the ones whose description carries the
      // count we are about to filter on. Asking for it in the query is what
      // makes the snippet carry it.
      const q = `site:instagram.com "${word}" "Followers" "Posts"`
      let fresh = 0
      let sized = 0
      let inWindow = 0
      for (let p = 1; p <= pages; p++) {
        const got = await page(key, q, { page: p })
        searches++
        if (got.error) { perQuery.push({ query: word, error: got.error }); break }
        let newHere = 0
        for (const row of got.rows) {
          if (found.has(row.handle)) continue
          found.set(row.handle, row.followers)
          newHere++
          if (row.followers !== null) {
            sized++
            if (row.followers >= lo && row.followers <= hi) inWindow++
          }
        }
        fresh += newHere
        // A page that repeated everything is the end of this query, and the
        // next page would be another tenth of a cent for the same rows.
        if (newHere === 0) break
      }
      perQuery.push({ query: word, found: fresh, sized, inWindow })
    }

    // The whole point: the window is applied before a penny is spent on a
    // profile. A result whose size we could not read is kept, because
    // throwing away what we could not measure would bias the pool towards
    // whatever Google chose to truncate.
    const worth = [...found.entries()]
      .filter(([, n]) => n === null || (n >= lo && n <= hi))
      .map(([handle]) => handle)

    const out: Record<string, unknown> = {
      window,
      queries: words.length,
      searches,
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

    const run = await ctx.runAction(internal.ingest.detailRun, {
      handles: worth, campaignId: args.campaignId, channel: 'google',
    })
    return { ...out, ...run }
  },
})
