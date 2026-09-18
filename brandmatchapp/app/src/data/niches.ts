import type { Niche } from '../types'

// Niches: the slices of a target a campaign looks in.
//
// A campaign is not one audience, it is several. "Fitness coaches" is really
// strength coaches, runners, postnatal specialists and rehab people, and they
// do not answer at the same rate. Naming them is what lets the dashboard say
// which slice replies, and switching one off is what lets the client act on it.
//
// Suggested from the brief and then the client's. We never quietly add one.
//
// In production the model proposes these from the brief in the same call that
// writes the rules. This dictionary is the browser's stand in, and it returns
// the same shape.

interface Domain {
  test: RegExp
  niches: string[]
}

const DOMAINS: Domain[] = [
  {
    test: /fitness|lift|gym|strength|coach|train|workout|muscle|athlete|运动|crossfit|pilates|yoga/,
    niches: [
      'Strength and lifting',
      'Running and endurance',
      'Hybrid and functional',
      'Postnatal and womens health',
      'Rehab and physio',
      'Nutrition and body composition',
    ],
  },
  {
    test: /finance|invest|money|trading|stock|budget|wealth|portfolio|crypto|tax|accounting/,
    niches: [
      'Index and long term investing',
      'Stock research and earnings',
      'Personal budgeting',
      'Small business finance',
      'Options and derivatives',
      'Property and rentals',
    ],
  },
  {
    test: /skincare|beauty|makeup|cosmetic|hair|skin|derm/,
    niches: [
      'Skincare routines',
      'Makeup and colour',
      'Ingredient science',
      'Hair care',
      'Clean and sensitive skin',
      'Aesthetics and treatments',
    ],
  },
  {
    test: /food|cook|recipe|chef|bake|meal|kitchen|nutrition|vegan/,
    niches: [
      'Weeknight cooking',
      'Baking and pastry',
      'Meal prep and planning',
      'Plant based',
      'Regional and traditional',
      'Budget cooking',
    ],
  },
  {
    test: /business|agency|founder|saas|startup|marketing|sales|freelance|ecommerce/,
    niches: [
      'Agency and services',
      'Ecommerce and DTC',
      'Software and SaaS',
      'Freelancing and solo',
      'Sales and outreach',
      'Marketing and content',
    ],
  },
  {
    test: /parent|mum|mom|dad|baby|kids|family|pregnan/,
    niches: [
      'Newborn and baby',
      'Toddlers and preschool',
      'School age',
      'Pregnancy and birth',
      'Family organisation',
      'Single and blended families',
    ],
  },
  {
    test: /travel|hotel|flight|trip|nomad|destination/,
    niches: ['Budget travel', 'Luxury and hotels', 'Family travel', 'Solo and nomad', 'Road trips', 'Adventure and outdoors'],
  },
  {
    test: /fashion|style|outfit|clothing|wardrobe|thrift/,
    niches: ['Everyday style', 'Tailoring and formal', 'Thrift and secondhand', 'Streetwear', 'Modest fashion', 'Sustainable brands'],
  },
]

/** A last resort, when the brief names no field we recognise. */
const GENERIC = ['Educators and how to', 'Reviews and comparisons', 'Behind the scenes', 'Community and coaching']

export function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
}

/**
 * Reads the brief and proposes the slices worth looking in. Five to six, all
 * switched on, because a proposal the client has to turn on is not a proposal.
 */
export function suggestNiches(audience: string, offer: string): Niche[] {
  const text = `${audience} ${offer}`.toLowerCase()
  const hit = DOMAINS.find((d) => d.test.test(text))
  const labels = (hit?.niches ?? GENERIC).slice(0, 6)
  return labels.map((label) => ({ id: slug(label), label, enabled: true }))
}

export function activeNiches(niches: Niche[]): Niche[] {
  return niches.filter((n) => n.enabled)
}

export function nicheLabel(niches: Niche[], id: string | null): string {
  if (!id) return 'Something else'
  return niches.find((n) => n.id === id)?.label ?? 'Something else'
}
