import { useSyncExternalStore } from 'react'
import { getState, subscribe, type State } from './store'

/** Re-render when the store changes. Read through the data functions inside the component. */
export function useStore(): State {
  return useSyncExternalStore(subscribe, getState, getState)
}
