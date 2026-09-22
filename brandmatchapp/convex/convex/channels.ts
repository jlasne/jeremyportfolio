import { internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { loosest, type HardRules } from './gates'

// Which way of searching suits which campaign.
//
// Until now there was one answer for everybody: search Instagram's account
// index for the words of the niche. It lands 15% of what it buys inside the
// client's follower window. A campaign looking for 100k accounts and a
// campaign looking for 10k accounts got the same search and the same 15%.
//
// A campaign is not one kind of campaign. The one thing that changes the
// answer most is the size of person it is looking for, because the channels
// do not reach the same sizes:
//
//   neighbours   the accounts Instagram shows beside a profile. Measured on
//                1,345 profiles: alive above 500k, near dead below it. A
//                campaign hunting 10k accounts gets nothing from it.
//   posts        the posts under a hashtag. Cheap, and the likes on a post
//                say how big its author is before we pay to find out.
//   accounts     Instagram's account index on the words of the niche. Works
//                anywhere, aims at 15%.
//   seed         the client's own handles.
//
// So the follower window picks the channels, and the screen tells the client
// which ones it picked and why.

/**
 * What a post's like count says about the size of its author.
 *
 * Measured on 22/09/26 across the 1,075 accounts in our base with readable
 * likes. Each row is a band of likes on a typical post and the median
 * follower count of the accounts in it.
 *
 * The progression is monotone over three orders of magnitude, which is what
 * makes it usable: a band of likes is a dial for size. It is the only size
 * signal that arrives before we pay for anything, because a post search
 * hands back likes and an author name, and a profile costs 0.23 cents.
 *
 * It is a median, not a promise. Half the accounts in a band sit above it and
 * half below, so a band is chosen to cover a window rather than to hit a
 * point.
 */
export const LIKES_TO_FOLLOWERS: { likes: number; followers: number }[] = [
  { likes: 25, followers: 1_083 },
  { likes: 87, followers: 8_987 },
  { likes: 245, followers: 25_931 },
  { likes: 566, followers: 128_140 },
  { likes: 1_095, followers: 227_128 },
  { likes: 2_121, followers: 433_760 },
  { likes: 4_899, followers: 469_021 },
  { likes: 12_000, followers: 1_214_549 },
]

/**
 * The likes a person of this size gets on a typical post.
 *
 * Read off the measured table, interpolated on a log scale because both
 * axes span three orders of magnitude and neither is linear. Outside the
 * table the last two rows carry the slope on.
 */
export function likesForFollowers(followers: number): number {
  const t = LIKES_TO_FOLLOWERS
  if (followers <= t[0].followers) return t[0].likes
  let lo = 0
  while (lo < t.length - 2 && t[lo + 1].followers < followers) lo++
  const a = t[lo]
  const b = t[lo + 1]
  const span = Math.log(b.followers / a.followers)
  const at = span > 0 ? Math.log(followers / a.followers) / span : 0
  return Math.round(a.likes * Math.pow(b.likes / a.likes, at))
}

/**
 * The band of likes to keep, for a campaign looking for this size of person.
 *
 * The edges are the window's own edges, read through the table. No margin,
 * no fudge: measured on our base on 22/09/26, squeezing the band inwards buys
 * almost no aim and costs most of the reach.
 *
 *   edges      aim    reach of the window
 *   plain      39%    37%
 *   in 35%     41%    23%
 *   in 100%    46%     7%
 *
 * Two points of aim for thirty of reach is a bad trade, so the plain edges
 * win and there is nothing to tune. What matters is having a band at all:
 * without one the same posts land 25% inside the window, and Instagram's
 * account search lands 15%.
 *
 * Re-measure with channels.bandCheck, which takes a tuning and answers from
 * the accounts we already hold. It costs nothing.
 */
export function likesBandFor(hard: HardRules | undefined): { min: number; max: number } | null {
  const lo = hard?.followersMin
  const hi = hard?.followersMax
  if (!lo && !hi) return null
  return {
    min: lo ? likesForFollowers(lo) : 0,
    max: hi ? likesForFollowers(hi) : 0,
  }
}

export type ChannelPlan = { channel: string; rank: number; why: string }

/**
 * The channels this campaign should search, best first, each with its reason.
 *
 * The reasons are written for the client to read on the screen. They say what
 * the channel does and what it is worth, never how it is implemented.
 */
export function channelsFor(hard: HardRules | undefined, seeds: number, hasSearchKey = false): ChannelPlan[] {
  const lo = hard?.followersMin ?? 0
  const hi = hard?.followersMax ?? Number.MAX_SAFE_INTEGER
  const out: ChannelPlan[] = []

  // Neighbours need a parent big enough to have any. Measured: the accounts
  // Instagram suggests beside a profile are its own size, and below 500k it
  // suggests almost nobody. A campaign whose ceiling sits under 500k cannot
  // use the channel at all, whatever its seeds.
  if (hi >= 500_000 && seeds > 0) {
    out.push({
      channel: 'neighbour',
      rank: 1,
      why: 'Accounts Instagram itself puts beside the ones you named. The best aim we have, and only above 500k followers.',
    })
  }

  // Posts under a hashtag were meant to be the channel for everyone below
  // 500k: posts are cheap, the likes on them say how big the author is, so
  // the profiles could be bought only for the right sizes. Tested in the open
  // on 22/09/26 for 3.82 dollars. Two results, and they point opposite ways.
  //
  // The dial works. Of the 23 authors the band kept, 10 landed inside the
  // 10k-100k window: 43% aim, against 41% predicted from our own base and 24%
  // for the account index. It is the best aim of any channel we have.
  //
  // The channel is unaffordable. A post costs 0.23 cents, the same as a
  // profile, and 81% of the 1,225 authors under eight topic tags get under 50
  // likes, median 1. Only 23 cleared the band. So one candidate inside the
  // window costs 38 cents this way and 1 cent through the account index.
  //
  // Instagram hashtags are not where creators worth buying post. The dial is
  // kept and validated; the channel stays off until there is a cheap source
  // of posts by real creators to point it at.

  // Google, when there is a key for it. It is the only channel that reads a
  // follower count before a profile is paid for: Instagram writes the count
  // into its own page description, so the search result carries it. That puts
  // the size filter in front of the money instead of behind it, which is
  // where three quarters of the waste sits.
  if (hasSearchKey) {
    out.push({
      channel: 'google',
      rank: hi < 500_000 ? 1 : 2,
      why: 'Public profile pages, read for their follower count before we look at anyone. Only the right sizes are ever opened.',
    })
  }

  out.push({
    channel: 'accounts',
    rank: 3,
    why: 'Instagram’s own account search, on the words of your niches. Works at any size and lands one in seven inside your window.',
  })

  if (seeds > 0) {
    out.push({
      channel: 'seed',
      rank: 4,
      why: 'The accounts you named. Measured like anyone else, never delivered back to you.',
    })
  }

  // A campaign with no ceiling and no floor gets everything, in the order
  // above. One with a narrow window gets the order its window earns.
  void lo
  return out.sort((a, b) => a.rank - b.rank)
}

/**
 * What a band would actually keep, measured on the accounts we already hold.
 *
 * This is the same measurement that produced the table, run on demand for any
 * window, and it costs nothing: every number it reads was paid for months ago.
 * It answers the only question that matters about a band, which is what share
 * of what it keeps lands inside the window.
 *
 * It measures the filter on a population our channels already found, not the
 * channel in the open. It is a floor on the aim, not a forecast.
 */
export const bandCheck = internalQuery({
  args: {
    followersMin: v.optional(v.number()),
    followersMax: v.optional(v.number()),
    /** Try a different tuning of the band's edges, to see what it is worth. */
    tight: v.optional(v.object({ lo: v.number(), hi: v.number() })),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const band = args.tight
      ? {
          min: args.followersMin ? Math.round(likesForFollowers(args.followersMin) * args.tight.lo) : 0,
          max: args.followersMax ? Math.round(likesForFollowers(args.followersMax) * args.tight.hi) : 0,
        }
      : likesBandFor({ followersMin: args.followersMin, followersMax: args.followersMax })
    const rows = await ctx.db.query('creators').withIndex('by_measured').order('desc').take(4_000)
    const withLikes = rows.filter((c) => (c.medianLikes ?? 0) > 0 && (c.followers ?? 0) > 0)

    const inWindow = (n: number) =>
      n >= (args.followersMin ?? 0) && n <= (args.followersMax ?? Number.MAX_SAFE_INTEGER)

    const kept = band
      ? withLikes.filter((c) =>
          (c.medianLikes ?? 0) >= (band.min || 0) &&
          (!band.max || (c.medianLikes ?? 0) <= band.max))
      : withLikes

    const keptIn = kept.filter((c) => inWindow(c.followers ?? 0)).length
    const allIn = withLikes.filter((c) => inWindow(c.followers ?? 0)).length

    return {
      band,
      population: withLikes.length,
      /** What the window is worth with no filter at all. The thing to beat. */
      baseline: withLikes.length ? Math.round((allIn / withLikes.length) * 100) : 0,
      kept: kept.length,
      keptInWindow: keptIn,
      /** The share of what the band keeps that lands inside the window. */
      aim: kept.length ? Math.round((keptIn / kept.length) * 100) : 0,
      /** The share of the window's accounts the band still reaches. */
      recall: allIn ? Math.round((keptIn / allIn) * 100) : 0,
    }
  },
})

/**
 * The channels this campaign should search, its likes band, and why.
 *
 * One read, so the screen, the crawler and the report all answer the same
 * way. The window comes from the gates the client actually saved, widened by
 * whichever niche is loosest, because a campaign is as wide as its widest
 * niche and searching narrower than that would miss people it would accept.
 */
export const plan = internalQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign) return { error: 'No such campaign' }
    const gates = campaign.gateSetId ? await ctx.db.get(campaign.gateSetId) : null
    if (!gates) return { error: 'This campaign has no gates yet' }

    const hard = loosest(gates.hard, campaign.extracted.niches ?? [])
    const seeds = (campaign.brief.seeds ?? []).length
    const band = likesBandFor(hard)

    return {
      window: { followersMin: hard.followersMin ?? null, followersMax: hard.followersMax ?? null },
      band,
      seeds,
      channels: channelsFor(hard, seeds, Boolean(process.env.SERPER_API_KEY)),
      /** Where the campaign sells, so a search can be read from each market. */
      countries: campaign.extracted.countries ?? [],
      /** The words a post search runs on. Niches first, topics after. */
      topics: (campaign.extracted.niches ?? [])
        .filter((n: { enabled: boolean }) => n.enabled)
        .map((n: { label: string }) => n.label),
    }
  },
})
