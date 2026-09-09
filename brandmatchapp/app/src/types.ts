// Shared shapes for every entity in the app.
// The mock folder produces these today. The real crawl will produce the same shapes later.

export type Country =
  | 'US' | 'UK' | 'CA' | 'AU' | 'IE' | 'NZ'
  | 'FR' | 'DE' | 'ES' | 'IT' | 'NL' | 'SE' | 'PL'
  | 'BR' | 'MX' | 'IN' | 'JP' | 'ZA'
export type Language = 'en' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'nl' | 'sv' | 'pl' | 'ja'
/** 0 to 3 in half steps. */
export type Stars = number
/** How far one criterion is met: none, half, full. */
export type Level = 0 | 0.5 | 1

export type SignalType =
  | 'sponsored_post'
  | 'promoted_supplement'
  | 'collab_bio'
  | 'media_kit'
  | 'launched_program'
  | 'launched_merch'
  | 'posted_rates'

export interface Signal {
  type: SignalType
  label: string
  /** A paid post or a public rate card is strong. Bio wording or a launch is soft. */
  strength: 'strong' | 'soft'
  /** ISO date */
  date: string
}

export interface Post {
  id: string
  creatorId: string
  kind: 'reel' | 'post'
  thumbnail: string
  views: number
  comments: number
  /** ISO date */
  date: string
}

/**
 * One score per creator, 0 to 3 stars in half steps. One star each for niche,
 * selling and signal. Each pays a half star when it half fits and a full star
 * when it fits. The three are independent of each other.
 */
export interface Score {
  stars: Stars
  niche: Level
  active: Level
  intent: Level
  /** What each criterion earned, in order, for the row label and the panel. */
  earned: { label: string; level: Level; note: string }[]
  /** One plain sentence, written at scoring time. */
  why: string
}

export interface Creator {
  id: string
  handle: string
  name: string
  avatar: string
  bio: string
  followers: number
  /** 0.034 means 3.4% */
  engagementRate: number
  medianReelViews: number
  postsPerMonth: number
  /** ISO date */
  lastPostAt: string
  country: Country
  language: Language
  email: string | null
  signals: Signal[]
  /** How well content, audience and follower band fit the brief. */
  niche: Level
  /** Why the niche call went that way, one plain sentence. */
  nicheWhy: string
  /** What the creator sells today, or an empty string. */
  sells: string
  /** The agent that found this creator. */
  agentId: string
  /** ISO date */
  firstSeenAt: string
  /** ISO date */
  lastCrawlAt: string
}

export interface Agent {
  id: string
  name: string
  /** The brand's own site. The audience below is written from it. */
  website: string
  brief: Brief
  filters: Filters
  /** How many leads a day this search should deliver. */
  leadsPerDay: number
  /** Local time the daily batch lands, "07:00". */
  runAt: string
  active: boolean
  /** ISO date */
  createdAt: string
}

export interface DailyStat {
  /** ISO date, midnight */
  date: string
  /** Profiles crawled. */
  gathered: number
  /** The agent that delivered this day. */
  agentId: string
  /** Leads delivered to the list. Every one of them shows. */
  leads: number
  /** Of those, the ones at 2 stars or more. Around 1 in 10. */
  qualified: number
}

export interface Note {
  creatorId: string
  text: string
  /** ISO date */
  updatedAt: string
}

export interface Rejection {
  creatorId: string
  /** ISO date */
  date: string
}

export interface BriefAnswer {
  questionId: string
  value: string | null
}

export interface Brief {
  who: string
  answers: BriefAnswer[]
  /** One plain sentence shown back to the brand. */
  summary: string
}

export interface Filters {
  followersMin: number
  followersMax: number
  /** 0.01 means 1% */
  engagementMin: number
  reelViewsMin: number | null
  emailInBio: 'any' | 'yes'
  lastPostWithin: 7 | 30 | 90
  postsPerMonthMin: number
  countries: Country[]
  languages: Language[]
}

export type FilterKey = keyof Filters

export interface Settings {
  timezone: string
  onboarded: boolean
}
