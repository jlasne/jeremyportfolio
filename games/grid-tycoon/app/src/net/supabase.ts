// The live transport: plain fetch to the grid-tycoon edge function for actions, and Supabase
// Realtime (postgres_changes on gt_rooms / gt_players + presence on gt:CODE) for pushes.
// supabase-js is imported lazily on the first subscription, so solo players never download it.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { FUNCTION_NAME, netConfig } from './config'
import { playerFromRow, roomFromRow } from './rows'
import type { Backend, BackendHandlers, PresenceEntry, RoomAction, WireResponse } from './types'

const REQUEST_TIMEOUT_MS = 15_000
const RETRY_BASE_MS = 1_000
const RETRY_MAX_MS = 30_000

let clientPromise: Promise<SupabaseClient> | null = null

function realtimeClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(netConfig.url, netConfig.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
    }),
  )
  // A failed download (offline) should not poison every later attempt.
  clientPromise.catch(() => {
    clientPromise = null
  })
  return clientPromise
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', apikey: netConfig.anonKey }
  // Legacy anon keys are JWTs and the gateway accepts them as a bearer; new publishable keys are not.
  if (netConfig.anonKey.startsWith('eyJ')) h.Authorization = `Bearer ${netConfig.anonKey}`
  return h
}

function presenceEntries(state: Record<string, unknown[]>): PresenceEntry[] {
  const bySeat = new Map<number, PresenceEntry>()
  for (const metas of Object.values(state)) {
    for (const m of metas) {
      const meta = m as { seat?: unknown; name?: unknown }
      if (typeof meta.seat === 'number' && typeof meta.name === 'string') bySeat.set(meta.seat, { seat: meta.seat, name: meta.name })
    }
  }
  return [...bySeat.values()].sort((a, b) => a.seat - b.seat)
}

export function createSupabaseBackend(): Backend {
  return {
    async call(action: RoomAction, body: Record<string, unknown>): Promise<WireResponse> {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch(`${netConfig.url}/functions/v1/${FUNCTION_NAME}`, {
          method: 'POST',
          headers: headers(),
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
      let attempt = 0
      let channel: RealtimeChannel | null = null
      let client: SupabaseClient | null = null
      let retryTimer: ReturnType<typeof setTimeout> | null = null

      const drop = (): void => {
        const ch = channel
        channel = null
        if (ch && client) void client.removeChannel(ch)
      }

      const retry = (): void => {
        if (stopped || retryTimer) return
        drop()
        handlers.onStatus('reconnecting')
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt) * (0.75 + Math.random() * 0.5)
        attempt++
        retryTimer = setTimeout(() => {
          retryTimer = null
          void open()
        }, delay)
      }

      const open = async (): Promise<void> => {
        try {
          client = await realtimeClient()
        } catch {
          retry()
          return
        }
        if (stopped) return
        handlers.onStatus(attempt === 0 ? 'connecting' : 'reconnecting')
        const ch = client.channel(`gt:${code}`, { config: { presence: { key: me ? String(me.seat) : '', enabled: true } } })
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'gt_rooms', filter: `code=eq.${code}` }, (payload) => {
          const room = roomFromRow(payload.new)
          if (room) handlers.onRoom(room)
        })
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'gt_players', filter: `room_code=eq.${code}` }, (payload) => {
          const player = playerFromRow(payload.new)
          if (player) handlers.onPlayer(player)
        })
        ch.on('presence', { event: 'sync' }, () => handlers.onPresence(presenceEntries(ch.presenceState())))
        channel = ch
        ch.subscribe((status) => {
          if (stopped || channel !== ch) return
          if (status === 'SUBSCRIBED') {
            attempt = 0
            handlers.onStatus('live')
            if (me) void ch.track({ seat: me.seat, name: me.name })
          } else {
            retry()
          }
        })
      }

      void open()
      return () => {
        stopped = true
        if (retryTimer) clearTimeout(retryTimer)
        retryTimer = null
        // Removing the channel also ends this client's presence.
        drop()
        handlers.onStatus('closed')
      }
    },
  }
}
