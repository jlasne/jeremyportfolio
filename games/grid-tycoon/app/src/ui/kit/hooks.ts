// Media-query hooks used by the shell and the kit.

import { useSyncExternalStore } from 'react'
import { useUi } from '../../store/ui'

function subscribeQuery(query: string) {
  return (cb: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const mq = window.matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }
}

function matches(query: string): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches
}

const subscribers = new Map<string, (cb: () => void) => () => void>()

export function useMediaQuery(query: string): boolean {
  let sub = subscribers.get(query)
  if (!sub) {
    sub = subscribeQuery(query)
    subscribers.set(query, sub)
  }
  return useSyncExternalStore(sub, () => matches(query), () => false)
}

/** Phones: ≤ 640 px wide gets the bottom sheet and the bottom tab bar. */
export const PHONE_QUERY = '(max-width: 640px)'
export const usePhone = (): boolean => useMediaQuery(PHONE_QUERY)

/** The reduced-motion setting resolved against the system preference. */
export function useReducedMotion(): boolean {
  const pref = useUi((s) => s.settings.reducedMotion)
  const system = useMediaQuery('(prefers-reduced-motion: reduce)')
  return pref === 'on' ? true : pref === 'off' ? false : system
}

/** Non-hook version for code outside React (map, audio). */
export function prefersReducedMotion(): boolean {
  const pref = useUi.getState().settings.reducedMotion
  return pref === 'on' ? true : pref === 'off' ? false : matches('(prefers-reduced-motion: reduce)')
}

export function useResolvedTheme(): 'light' | 'dark' {
  const pref = useUi((s) => s.settings.theme)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}
