import type { FollowUpQuestion } from '../types'

// In the real product these 3 questions are generated from the first answer.
// The mock hardcodes the set that follows the placeholder example.
export const followUpQuestions: FollowUpQuestion[] = [
  { id: 'sells', text: 'What do they need to already sell?', chips: ['online program', 'coaching', 'ebook', 'app', 'anything'] },
  { id: 'content', text: 'What should their content look like?', chips: ['technique tutorials', 'transformations', 'workout routines', 'food and training'] },
  { id: 'audience', text: 'Who follows them?', chips: ['beginner women', 'competitive lifters', 'women 40+', 'postpartum'] },
]
