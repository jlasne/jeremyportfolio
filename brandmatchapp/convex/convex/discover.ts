'use node'

import { internalAction } from './_generated/server'
import { v } from 'convex/values'

// Finding handles, before anything is paid for by the profile.
//
// The crawl has two halves. The search half turns a niche into a list of
// handles; the detail half turns each handle into a profile with a bio, an
// email and its last posts. On the first run those halves cost about the same,
// and the search half buys the least: a handle and nothing else.
//
// A search engine answers the same question for a fraction of it, so when a
// key is set the search half runs here and Apify is paid only for detail.
// Without a key this returns nothing and the caller falls back to the crawl
// it already knows.
//
// Instagram's own pages are not an option: the profile page served to a
// datacentre address is the login wall, and the profile API answers 401
// without a session. Measured, not assumed, from this deployment.

const SERPER = 'https://google.serper.dev/search'

/** Words that are a path, never a handle. */
const NOT_A_HANDLE = new Set([
  'p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'tv', 'about',
  'legal', 'directory', 'web', 'developer', 'privacy', 'terms', 'help',
])

export function handlesFrom(urls: string[]): string[] {
  const out: string[] = []
  for (const url of urls) {
    const m = url.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/)
    const handle = m?.[1]?.toLowerCase()
    if (handle && !NOT_A_HANDLE.has(handle)) out.push(handle)
  }
  return [...new Set(out)]
}

/** One query per hashtag, plus the angle in words. Google reads both. */
export function queriesFor(tags: string[], focus: string): string[] {
  const qs = tags.slice(0, 6).map((t) => `site:instagram.com "#${t}"`)
  const words = focus.trim().split(/\s+/).slice(0, 8).join(' ')
  if (words) qs.push(`site:instagram.com ${words}`)
  return qs
}

export const handles = internalAction({
  args: { hashtags: v.array(v.string()), focus: v.optional(v.string()), want: v.number() },
  returns: v.any(),
  handler: async (_ctx, { hashtags, focus, want }) => {
    const key = process.env.SERPER_API_KEY
    if (!key) return { handles: [], searches: 0, reason: 'no SERPER_API_KEY' }

    const queries = queriesFor(hashtags, focus ?? '')
    if (!queries.length) return { handles: [], searches: 0, reason: 'nothing to search for' }

    // 100 results a query is one credit either way, so ask for all of them.
    const perQuery = 100
    const need = Math.ceil(want * 1.6)
    const found = new Set<string>()
    let searches = 0

    for (const q of queries) {
      if (found.size >= need) break
      try {
        const res = await fetch(SERPER, {
          method: 'POST',
          headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, num: perQuery }),
          signal: AbortSignal.timeout(20_000),
        })
        searches++
        if (!res.ok) continue
        const body = (await res.json()) as { organic?: { link?: string }[] }
        for (const h of handlesFrom((body.organic ?? []).map((o) => o.link ?? ''))) found.add(h)
      } catch {
        // A search that fails costs a credit and nothing else. The next one runs.
      }
    }

    return { handles: [...found].slice(0, need), searches }
  },
})
