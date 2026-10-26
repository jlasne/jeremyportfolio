// The multiplayer session as the screens see it: which room this browser sits in, the latest room
// and seats from the server, presence, the connection status and the one problem worth showing
// (as a chip, never a pop-up). src/net/controller.ts is the only writer.

import { create } from 'zustand'
import type { ConnectionStatus, PlayerView, PresenceEntry, RoomView } from './types'

export type NetProblemKind = 'network' | 'submit' | 'seat_lost' | 'room_gone'

export interface NetProblem {
  kind: NetProblemKind
  message: string
}

export interface LocalInfo {
  /** Seconds per round on the local server. */
  timerSeconds: number
  role: 'pending' | 'host' | 'proxy'
}

export interface NetSession {
  code: string | null
  seat: number | null
  room: RoomView | null
  players: PlayerView[]
  presence: PresenceEntry[]
  status: ConnectionStatus | 'idle'
  problem: NetProblem | null
  /** Set when the local test server (?mp=local) is installed. */
  local: LocalInfo | null
  /** True once initNet() has run (the local server, when asked for, is installed). */
  ready: boolean
}

export const INITIAL_SESSION: NetSession = {
  code: null,
  seat: null,
  room: null,
  players: [],
  presence: [],
  status: 'idle',
  problem: null,
  local: null,
  ready: false,
}

export const useNet = create<NetSession>()(() => ({ ...INITIAL_SESSION }))
