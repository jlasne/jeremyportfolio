// Turns the Postgres export into the shape convex/schema.ts expects:
// camelCase keys, timestamps as numbers, and lastSignalAt precomputed so the
// pool can be walked freshest signal first.
//
//   node transform.mjs <in.jsonl> <out.jsonl>

import { createReadStream, createWriteStream } from 'node:fs'
import { createInterface } from 'node:readline'

const [, , inPath = '/tmp/creators.jsonl', outPath = 'creators.jsonl'] = process.argv

const time = (iso) => {
  if (!iso) return undefined
  const t = Date.parse(iso)
  return Number.isNaN(t) ? undefined : t
}

const newestSignal = (signals) => {
  let best
  for (const s of signals ?? []) {
    const t = Date.parse(s?.date)
    if (!Number.isNaN(t) && (best === undefined || t > best)) best = t
  }
  return best
}

/** Convex rejects undefined inside documents, so drop the keys entirely. */
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null))

const out = createWriteStream(outPath)
const rl = createInterface({ input: createReadStream(inPath), crlfDelay: Infinity })

let n = 0
for await (const line of rl) {
  if (!line.trim()) continue
  const r = JSON.parse(line)
  const signals = r.signals ?? []
  const seen = time(r.first_seen_at) ?? Date.now()

  out.write(JSON.stringify(clean({
    platform: r.platform ?? 'instagram',
    handle: String(r.handle).toLowerCase(),
    name: r.name ?? '',
    bio: r.bio ?? '',
    avatar: r.avatar ?? undefined,
    followers: Number(r.followers ?? 0),
    engagementRate: r.engagement_rate != null ? Number(r.engagement_rate) : undefined,
    medianReelViews: r.median_reel_views != null ? Number(r.median_reel_views) : undefined,
    postsPerMonth: r.posts_per_month != null ? Number(r.posts_per_month) : undefined,
    lastPostAt: time(r.last_post_at),
    country: r.country ?? undefined,
    language: r.language ?? undefined,
    email: r.email ?? undefined,
    externalLinks: r.external_links ?? [],
    linkType: r.link_type ?? undefined,
    sells: r.sells ?? '',
    signals,
    lastSignalAt: newestSignal(signals),
    firstSeenAt: seen,
    lastCrawlAt: time(r.last_crawl_at) ?? seen,
  })) + '\n')
  n++
}

out.end()
console.log(`${n} creators written to ${outPath}`)
