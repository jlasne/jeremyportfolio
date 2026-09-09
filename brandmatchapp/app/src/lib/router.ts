import { useEffect, useState } from 'react'

// Hash routes. No library, no server config needed.

export type Route =
  | { name: 'home' }
  | { name: 'onboarding'; step: 'who' | 'details' | 'filters' | 'running' }
  | { name: 'contacts'; agentId: string | null }
  | { name: 'agents'; agentId: string | null }

export function parse(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '')
  const [head, second] = path.split('/')
  const id = second ? decodeURIComponent(second) : null
  switch (head) {
    case '':
      return { name: 'home' }
    case 'onboarding': {
      const step = second === 'details' || second === 'filters' || second === 'running' ? second : 'who'
      return { name: 'onboarding', step }
    }
    case 'contacts':
      return { name: 'contacts', agentId: id }
    case 'agents':
      return { name: 'agents', agentId: id }
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
