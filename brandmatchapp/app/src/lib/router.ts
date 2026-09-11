import { useEffect, useState } from 'react'

// Hash routes. No library, no server config needed.

export type Route =
  | { name: 'home' }
  | { name: 'onboarding'; campaignId: string | null; running: boolean }
  /** The scope is a campaign id or one agent id inside a campaign. */
  | { name: 'contacts'; scopeId: string | null }
  | { name: 'campaign'; campaignId: string | null }
  | { name: 'connect' }
  | { name: 'settings' }

export function parse(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '')
  const [head, second, third] = path.split('/')
  const id = second ? decodeURIComponent(second) : null
  switch (head) {
    case '':
      return { name: 'home' }
    case 'onboarding':
      return { name: 'onboarding', campaignId: id, running: third === 'running' }
    case 'contacts':
      return { name: 'contacts', scopeId: id }
    case 'campaign':
    case 'campaigns':
    case 'leads':
      return { name: 'campaign', campaignId: id }
    case 'connect':
      return { name: 'connect' }
    case 'settings':
      return { name: 'settings' }
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
