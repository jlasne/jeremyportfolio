import { useEffect, useState } from 'react'

// Hash routes. No library, no server config needed.

export type Route =
  | { name: 'home' }
  | { name: 'onboarding'; step: 'who' | 'details' | 'filters' | 'running' }
  | { name: 'dashboard' }
  | { name: 'feed'; creatorId: string | null }
  | { name: 'groups'; agentId: string | null }
  | { name: 'contacts' }
  | { name: 'agents'; agentId: string | null }
  | { name: 'lists'; listId: string | null }
  | { name: 'settings' }

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
    case 'dashboard':
      return { name: 'dashboard' }
    case 'feed':
      return { name: 'feed', creatorId: id }
    case 'groups':
      return { name: 'groups', agentId: id }
    case 'contacts':
      return { name: 'contacts' }
    case 'agents':
      return { name: 'agents', agentId: id }
    case 'lists':
      return { name: 'lists', listId: id }
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
