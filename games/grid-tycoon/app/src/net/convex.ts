// The Convex transport: plain fetch to the HTTP door (convex-server/convex/http.ts) for actions, and a
// reactive query (game:watch) for pushes. Presence comes from the players' heartbeat (lastSeen).
// The Convex client is imported lazily on the first subscription, so solo players never download it.

import type { ConvexClient } from 'convex/browser'
import { serverNow } from './clock'
import { netConfig } from './config'
import type { Backend, BackendHandlers, PlayerView, PresenceEntry, RoomAction, RoomPush, WireResponse } from './types'

const REQUEST_TIMEOUT_MS = 15_000
/** A seat counts as connected while its heartbeat (every 20 s) is this recent. */
const PRESENT_MS = 45_000

let clientPromise: Promise<ConvexClient> | null = null

function convexClient(): Promise<ConvexClient> {
  clientPromise ??= import('convex/browser').then(({ ConvexClient }) => new ConvexClient(netConfig.convexUrl))
  clientPromise.catch(() => {
    clientPromise = null
  })
  return clientPromise
}

/** https://x.eu-west-1.convex.cloud -> https://x.eu-west-1.convex.site (where HTTP actions live). */
export function convexSiteUrl(cloudUrl: string): string {
  return cloudUrl.replace(/\.convex\.cloud\/?$/, '.convex.site')
}

interface WatchResult {
  room: Omit<RoomPush, 'state'> & { stateRound: number | null }
  players: PlayerView[]
}

function presenceOf(players: PlayerView[]): PresenceEntry[] {
  const now = serverNow()
  return players.filter((p) => !p.isBot && now - p.lastSeen < PRESENT_MS).map((p) => ({ seat: p.seat, name: p.name }))
}

export function createConvexBackend(): Backend {
  return {
    async call(action: RoomAction, body: Record<string, unknown>): Promise<WireResponse> {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch(`${convexSiteUrl(netConfig.convexUrl)}/grid-tycoon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, action }),
          signal: ctrl.signal,
        })
        const json = (await res.json().catch(() => null)) as WireResponse | null
        if (json && typeof json === 'object' && 'ok' in json) return json
        throw new Error(`grid-tycoon: HTTP ${res.status}`)
      } finally {
        clearTimeout(timer)
      }
    },

    subscribe(code: string, handlers: BackendHandlers, me: PresenceEntry | null): () => void {
      let stopped = false
      let unsubscribe: (() => void) | null = null
      void me
      handlers.onStatus('connecting')
      void convexClient()
        .then(async (client) => {
          if (stopped) return
          const { makeFunctionReference } = await import('convex/server')
          const watch = makeFunctionReference<'query', { code: string }, WatchResult | null>('game:watch')
          const sub = client.onUpdate(
            watch,
            { code },
            (result) => {
              if (stopped || !result) return
              handlers.onStatus('live')
              const { stateRound, ...head } = result.room
              void stateRound
              // The state is not pushed (it can be large): undefined makes the client keep or refetch it.
              handlers.onRoom({ ...head, state: undefined })
              for (const p of result.players) handlers.onPlayer(p)
              handlers.onPresence(presenceOf(result.players))
            },
            () => {
              if (!stopped) handlers.onStatus('reconnecting')
            },
          )
          unsubscribe = () => sub()
        })
        .catch(() => {
          if (!stopped) handlers.onStatus('reconnecting')
        })
      return () => {
        stopped = true
        unsubscribe?.()
        handlers.onStatus('closed')
      }
    },
  }
}
