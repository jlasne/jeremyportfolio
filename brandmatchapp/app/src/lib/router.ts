import { useEffect, useState } from 'react'

// Hash routes. No library, no server config.
//
// The zones, each answering one question:
//
//   dashboard    does today need me
//   campaigns    what am I running, and how is the day shared
//   leads        who do I contact now
//   brief        who do I want to reach, and what do I sell
//   gates        which criteria decide
//   feasibility  how much do my rules filter, and what would I open up
//
// Five surfaces sit outside them: the sign in, the account, the API, the
// roadmap, and the internal admin.

export type CampaignTab = 'brief' | 'gates' | 'feasibility'

export type Route =
  | { name: 'home' }
  | { name: 'demo' }
  | { name: 'dashboard' }
  | { name: 'newCampaign' }
  | { name: 'leads'; leadId: string | null; query: Query }
  | { name: 'campaigns' }
  | { name: 'campaign'; campaignId: string; tab: CampaignTab }
  | { name: 'account' }
  | { name: 'outreach' }
  | { name: 'ai' }
  | { name: 'roadmap' }
  | { name: 'admin' }
  | { name: 'signin' }

const TABS: CampaignTab[] = ['brief', 'gates', 'feasibility']

/** Whatever follows a question mark. The list screen reads a filter from it. */
export type Query = Record<string, string>

export function parse(hash: string): Route {
  const [raw, search] = hash.replace(/^#/, '').split('?')
  const path = raw.replace(/^\/+/, '')
  const query: Query = Object.fromEntries(new URLSearchParams(search ?? ''))
  const [head, second, third] = path.split('/')
  const id = second ? decodeURIComponent(second) : null
  switch (head) {
    case '':
      return { name: 'home' }
    case 'app':
    case 'dashboard':
      return { name: 'dashboard' }
    // The sample, filled, at one address. For a visitor it is what they see
    // anyway; for an account it swaps the data until the click back.
    case 'demo':
      return { name: 'demo' }
    case 'leads':
      return { name: 'leads', leadId: id, query }
    case 'campaigns':
      return { name: 'campaigns' }
    case 'campaign':
      if (id === 'new') return { name: 'newCampaign' }
      if (!id) return { name: 'campaigns' }
      // "room" was its own tab once. Old links land on the test, where it lives now.
      return {
        name: 'campaign',
        campaignId: id,
        tab: third === 'room' ? 'feasibility' : TABS.includes(third as CampaignTab) ? (third as CampaignTab) : 'brief',
      }
    case 'account':
    case 'settings':
      return { name: 'account' }
    case 'outreach':
      return { name: 'outreach' }
    case 'ai':
      return { name: 'ai' }
    case 'roadmap':
    case 'ideas':
      return { name: 'roadmap' }
    case 'admin':
      return { name: 'admin' }
    case 'signin':
    case 'key':
      return { name: 'signin' }
    default:
      return { name: 'home' }
  }
}

export function navigate(path: string): void {
  const next = '#/' + path.replace(/^#?\/?/, '')
  if (window.location.hash === next) return
  window.location.hash = next
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
