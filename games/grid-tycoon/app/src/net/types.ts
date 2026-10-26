// Client-side names for the room server's wire types, bound to the engine's GameState.
// The server's own definitions live in supabase/functions/grid-tycoon/rooms.ts (type-only import:
// nothing from outside the app is bundled by this file).

import type { GameState, ValidationIssue } from '../engine'
import type {
  ActionResults,
  PlayerRow,
  RoomAction,
  RoomHead,
  RoomErrorCode,
  RoomRow,
  RoomStatus,
} from '../../../supabase/functions/grid-tycoon/rooms'

export type { RoomAction, RoomErrorCode, RoomHead, RoomStatus }

/** A room as the server and Realtime deliver it. Times are epoch ms on the server clock. */
export type RoomView = RoomRow<GameState>
/** A seat. `lockedRound === room.round` means locked in for the current round. */
export type PlayerView = PlayerRow

export type NetErrorCode = RoomErrorCode | 'offline' | 'network' | 'no_token'

export interface NetFailure {
  ok: false
  error: NetErrorCode
  message: string
  /** invalid_decision: the engine's validation issues. */
  issues?: ValidationIssue[]
  /** wrong_round: the round the room is on. */
  round?: number
}

export type NetResult<T> = ({ ok: true } & T) | NetFailure

type Results = ActionResults<GameState>
export type CreateRoomResult = Results['create']
export type JoinRoomResult = Results['join']
export type StartGameResult = Results['start']
export type SubmitResult = Results['lock']
export type TickResult = Results['tick']
export type RoomStateResult = Results['state']
export type PingResult = Results['ping']

/** Who is connected right now (Realtime presence on channel gt:CODE). */
export interface PresenceEntry {
  seat: number
  name: string
}

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'closed'

/** Raw server response, before the client strips `now`. */
export type WireResponse = { ok: true; now: number; [k: string]: unknown } | { ok: false; error: RoomErrorCode; message: string; now?: number; issues?: unknown[]; round?: number }

/** What a transport must do: answer actions and push room / player changes. */
export interface Backend {
  call(action: RoomAction, body: Record<string, unknown>): Promise<WireResponse>
  /** Starts pushing changes for one room; returns a stop function. Presence is tracked when `me` is set. */
  subscribe(code: string, handlers: BackendHandlers, me: PresenceEntry | null): () => void
}

/** A room change as pushed. `state` is undefined when Realtime dropped the large field; the client refetches then. */
export type RoomPush = Omit<RoomView, 'state'> & { state: GameState | null | undefined }

export interface BackendHandlers {
  onRoom(room: RoomPush): void
  onPlayer(player: PlayerView): void
  onPresence(entries: PresenceEntry[]): void
  onStatus(status: ConnectionStatus): void
}
