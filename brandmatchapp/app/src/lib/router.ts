import { useEffect, useState } from 'react'

// Hash routes. No library, no server config.
//
// Five product zones, each answering one question:
//
//   dashboard    how many today, and where is my pipeline
//   leads        who do I contact now
//   brief        who do I want to reach, and what do I sell
//   gates        which criteria decide
//   feasibility  does it hold my quota
//   room         how long these rules keep delivering
//
// Two surfaces sit outside them: the account, and the internal admin.

export type CampaignTab = 'brief' | 'gates' | 'feasibility' | 'room'

export type Route =
  | { name: 'home' }
  | { name: 'dashboard' }
  | { name: 'newCampaign' }
  | { name: 'leads'; leadId: string | null; query: Query }
  | { name: 'campaigns' }
  | { name: 'campaign'; campaignId: string; tab: CampaignTab }
  | { name: 'account' }
  | { name: 'admin' }

const TABS: CampaignTab[] = ['brief', 'gates', 'feasibility', 'room']

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
    case 'leads':
      return { name: 'leads', leadId: id, query }
    case 'campaigns':
      return { name: 'campaigns' }
    case 'campaign':
      if (id === 'new') return { name: 'newCampaign' }
      if (!id) return { name: 'campaigns' }
      return { name: 'campaign', campaignId: id, tab: TABS.includes(third as CampaignTab) ? (third as CampaignTab) : 'brief' }
    case 'account':
    case 'settings':
      return { name: 'account' }
    case 'admin':
      return { name: 'admin' }
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
