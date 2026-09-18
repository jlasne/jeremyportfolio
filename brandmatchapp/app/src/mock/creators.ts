import type { Creator, CreatorPost } from '../types'
import { between, pick, seeded, skewed } from './rand'
import { daysAgo } from './time'

// Sixteen hundred profiles, built from one seed so the sample account never
// moves. That is the real shape of the funnel: most of them never become a lead.
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
  posts: CreatorPost[]
  /** Which campaign this profile was crawled for. */
  niche: 'fitness' | 'finance'
  band: Band
}

function build(index: number): Built {
  const rand = seeded(9_000_017 + index * 7919)
  const niche: 'fitness' | 'finance' = index % 3 === 2 ? 'finance' : 'fitness'
  const band = BANDS[index % BANDS.length]
  const first = pick(rand, FIRST)
  const last = pick(rand, LAST)
  const word = pick(rand, niche === 'fitness' ? FIT_WORDS : FIN_WORDS)
  const handle = `${first.toLowerCase()}.${word}`
  const id = `cre_${String(index).padStart(3, '0')}`

  const followers =
    band === 'strong' ? between(rand, 28_000, 320_000)
      : band === 'fair' ? between(rand, 16_000, 90_000)
        : band === 'thin' ? skewed(rand, 2_400, 22_000)
          : between(rand, 12_000, 160_000)

  // Reach as a share of the follower count. A strong account beats its count.
  const reachRate =
    band === 'strong' ? 0.9 + rand() * 1.4
      : band === 'fair' ? 0.35 + rand() * 0.6
        : band === 'thin' ? 0.12 + rand() * 0.3
          : 0.2 + rand() * 0.5

  const cadence = band === 'strong' ? between(rand, 14, 26) : band === 'fair' ? between(rand, 8, 15) : between(rand, 2, 7)
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

  return { creator, posts, niche, band }
}

export const built: Built[] = Array.from({ length: 1_600 }, (_, i) => build(i))
export const creators: Creator[] = built.map((b) => b.creator)
export const posts: CreatorPost[] = built.flatMap((b) => b.posts)
export const creatorById = new Map(creators.map((c) => [c.id, c]))
export const postsByCreator = new Map(built.map((b) => [b.creator.id, b.posts]))
