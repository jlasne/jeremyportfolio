// Public surface of the multiplayer client. The offline room server is not re-exported on purpose:
// load it with `await import('./net/memory')` so it never lands in the solo bundle.

export * from './client'
export { isConfigured, netConfig } from './config'
export type * from './types'
