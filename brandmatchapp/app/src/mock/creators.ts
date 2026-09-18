import type { Creator, CreatorPost } from '../types'
import { between, pick, seeded } from './rand'
import { daysAgo } from './time'

// Eight thousand profiles, built from one seed so the sample account never
// moves. Enough that a month of delivery fills a dashboard, and every band on
// it carries the twenty leads a share needs. That is the real shape of the funnel: most of them never become a lead.
//
// Every number a gate reads is computed from the posts below, never declared.
// That is the rule in production too: reach comes off the posts we fetched.

const FIRST = [
  'Mara', 'Tobias', 'Lena', 'Dev', 'Priya', 'Callum', 'Sasha', 'Nolan', 'Iris', 'Marco',
  'Jude', 'Talia', 'Owen', 'Nadia', 'Felix', 'Rae', 'Quinn', 'Zane', 'Elodie', 'Hugo',
  'Simone', 'Kofi', 'Wren', 'Arlo', 'Noor', 'Bram', 'Cleo', 'Idris', 'Juno', 'Milo',
]
const LAST = [
  'Vance', 'Okafor', 'Brandt', 'Marsh', 'Delgado', 'Ferreira', 'Whitlock', 'Nsereko', 'Hale', 'Petrov',
  'Ellery', 'Sato', 'Koren', 'Byrne', 'Aldridge', 'Moreau', 'Stavros', 'Lindqvist', 'Adeyemi', 'Crowe',
]

const FIT_WORDS = ['strength', 'hybrid', 'lift', 'method', 'coach', 'run', 'built', 'form', 'train', 'pace']
const FIN_WORDS = ['capital', 'ledger', 'compound', 'yield', 'index', 'runway', 'margin', 'stack', 'quiet', 'signal']

const FIT_BIOS = [
  'Strength coach. 12 week method for lifters over 35. Programme link below.',
  'I turn desk workers into runners. Coaching cohort opens twice a year.',
  'Hybrid training, no fluff. 400+ clients through the system since 2019.',
  'Former physio. Rebuilding knees and shoulders. Book a call.',
  'Kettlebell only. One method, four phases. Taught it to 1,800 people.',
  'Postnatal strength. Evidence first. Programme and community below.',
  'Daily lifts and honest numbers. Coaching by application.',
  'Powerlifting for people with jobs. The 3 day block, explained.',
]
const FIN_BIOS = [
  'Index investing explained without the jargon. Cohort opens in March.',
  'I break down company filings every Sunday. Paid community below.',
  'Personal finance for freelancers. Course and spreadsheet library.',
  'Ex analyst. Teaching the research process I used for nine years.',
  'Budgeting that survives a bad month. Weekly, free and paid.',
  'Small business cash flow. One framework, taught to 900 owners.',
  'Options, plainly. Education only, never advice.',
  'How I read an earnings report. Live cohort twice a year.',
]

const COUNTRIES = ['US', 'US', 'US', 'UK', 'UK', 'CA', 'AU', 'IE', 'DE', 'FR']
const DOMAINS = ['gmail.com', 'outlook.com', 'proton.me']

/**
 * The band a profile is built in. It steers the numbers so the sample spans
 * every verdict instead of everything passing.
 */
type Band = 'strong' | 'fair' | 'thin' | 'stale'

const BANDS: Band[] = ['strong', 'strong', 'strong', 'fair', 'fair', 'fair', 'thin', 'stale']

function median(list: number[]): number {
  const sorted = [...list].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export interface Built {
  creator: Creator
  /** Which campaign this profile was crawled for. */
  niche: 'fitness' | 'finance'
  band: Band
}

function build(index: number): { built: Built; posts: CreatorPost[] } {
  const rand = seeded(9_000_017 + index * 7919)
  const niche: 'fitness' | 'finance' = index % 3 === 2 ? 'finance' : 'fitness'
  const band = BANDS[index % BANDS.length]
  const first = pick(rand, FIRST)
  const last = pick(rand, LAST)
  const word = pick(rand, niche === 'fitness' ? FIT_WORDS : FIN_WORDS)
  const handle = `${first.toLowerCase()}.${word}`
  const id = `cre_${String(index).padStart(3, '0')}`

  // Follower counts are a power law, not a range. Most accounts are small and
  // a handful are enormous, which is what makes a threshold bite: moving the
  // floor from 15k to 30k has to remove a real slice of the population.
  const followers = Math.round(2_000 * Math.pow(1_000, Math.pow(rand(), 2.1)))

  // Reach as a share of the follower count, spread wide inside each band. A
  // strong account beats its count. A thin one is a tenth of it.
  const reachRate =
    band === 'strong' ? 0.45 + rand() * rand() * 2.4
      : band === 'fair' ? 0.18 + rand() * rand() * 1.1
        : band === 'thin' ? 0.04 + rand() * 0.3
          : 0.08 + rand() * 0.55

  const cadence = band === 'strong' ? between(rand, 9, 28) : band === 'fair' ? between(rand, 4, 18) : between(rand, 1, 9)
  const gapDays = Math.max(1, Math.round(30 / cadence))
  const startedDaysAgo = band === 'stale' ? between(rand, 34, 190) : between(rand, 0, 9)

  const posts: CreatorPost[] = []
  for (let i = 0; i < 12; i++) {
    const back = startedDaysAgo + i * gapDays
    const swing = 0.55 + rand() * 1.1
    const views = Math.max(220, Math.round(followers * reachRate * swing))
    posts.push({
      id: `${id}_p${i}`,
      creatorId: id,
      kind: i % 4 === 3 ? 'post' : 'reel',
      url: `https://instagram.com/p/${id}${i}`,
      views,
      likes: Math.round(views * (0.03 + rand() * 0.05)),
      comments: Math.max(1, Math.round(views * (0.0012 + rand() * 0.0035))),
      postedAt: daysAgo(back, 10 + (i % 8)),
    })
  }

  const hasEmail = rand() < (band === 'strong' ? 0.72 : 0.45)
  const creator: Creator = {
    id,
    platform: 'instagram',
    handle,
    name: `${first} ${last}`,
    bio: pick(rand, niche === 'fitness' ? FIT_BIOS : FIN_BIOS),
    email: hasEmail ? `${first.toLowerCase()}@${pick(rand, DOMAINS)}` : null,
    followers,
    medianViews: median(posts.map((p) => p.views)),
    medianComments: median(posts.map((p) => p.comments)),
    postsPerMonth: cadence,
    lastPostAt: posts[0].postedAt,
    country: pick(rand, COUNTRIES),
    language: rand() < 0.88 ? 'en' : 'de',
    links: [`https://${handle.replace('.', '')}.com`],
    measuredAt: daysAgo(between(rand, 0, 3)),
    firstSeenAt: daysAgo(between(rand, 4, 90)),
  }

  return { built: { creator, niche, band }, posts }
}

/**
 * The twelve posts behind one profile's numbers.
 *
 * Kept out of memory until something asks. At this sample size holding every
 * post would be a hundred thousand objects nobody looks at, and `build` is pure
 * and seeded, so regenerating one profile's posts costs nothing and gives
 * exactly the posts its medians came from.
 */
const postCache = new Map<number, CreatorPost[]>()

export function postsFor(index: number): CreatorPost[] {
  const held = postCache.get(index)
  if (held) return held
  const made = build(index).posts
  postCache.set(index, made)
  return made
}

export const built: Built[] = Array.from({ length: 8_000 }, (_, i) => build(i).built)
export const creators: Creator[] = built.map((b) => b.creator)
export const creatorById = new Map(creators.map((c) => [c.id, c]))
/** Position in `built`, so posts can be regenerated from an id alone. */
export const indexOfCreator = new Map(built.map((b, i) => [b.creator.id, i]))
