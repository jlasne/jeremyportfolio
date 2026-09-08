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

export interface Score {
  stars: Stars
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
  intent: Score
  match: Score
  /** ISO date */
  firstSeenAt: string
  /** ISO date */
  lastCrawlAt: string
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
