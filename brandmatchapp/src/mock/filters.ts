import type { Filters } from '../types'

// The defaults from the spec. Filters cut the volume. Stars set the order.
export const defaultFilters: Filters = {
  followersMin: 10_000,
  followersMax: 1_000_000,
  engagementMin: 0.01,
  reelViewsMin: null,
  emailInBio: 'any',
  lastPostWithin: 30,
  postsPerMonthMin: 3,
  countries: [],
  languages: [],
}
