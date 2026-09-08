// Shared shapes for every entity in the app.
// The mock folder produces these today. The real crawl will produce the same shapes later.

export type Country = 'US' | 'UK' | 'CA' | 'AU' | 'FR' | 'DE'
export type Language = 'en' | 'fr' | 'de'
export type Stars = 0 | 1 | 2 | 3

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
 * One score per creator, 0 to 3 stars, built from three facts.
 * 0 outside the niche, 1 niche, 2 niche and selling, 3 niche, selling and a signal in the last 30 days.
 */
export interface Score {
  stars: Stars
  /** Content, audience and follower band fit the brief. */
  niche: boolean
  /** Sells a program, coaching, an ebook, an app, or runs a link hub or media kit. */
  active: boolean
  /** A dated brand signal fired in the last 30 days. */
  intent: boolean
  /** One plain sentence, written at scoring time. */
  why: string
  /** The rung name: Outside, Niche fit, Selling, Ready now. */
  rung: string
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
  /** Content, audience and follower band fit the brief. */
  niche: boolean
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
  brief: Brief
  filters: Filters
  /** How many leads a day this agent should deliver. */
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
  /** Leads kept after the filters. */
  leads: number
  /** Leads at 2 or 3 stars. */
  high: number
}

export interface SavedList {
  id: string
  name: string
  creatorIds: string[]
  /** ISO date */
  createdAt: string
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

export interface FollowUpQuestion {
  id: string
  text: string
  chips: string[]
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
