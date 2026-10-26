// The multiplayer cluster in the top bar: the round countdown on the server clock (amber under
// 30 s, red under 10 s, each with its own icon and the words "0:28 left", never colour alone), who
// has locked in, and connection chips. Also the text of the "waiting" chip for useLockBlock.

import { useEffect, useRef } from 'react'
import { msLeft } from '../../net/client'
import { useNet } from '../../net/session'
import { clockAnnouncement, clockLevel, clockText, formatClock, lockSummary, waitingText } from '../../net/view'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Icon } from '../kit'
import { useNow } from './hooks'
import { NetChips } from './NetChips'
import { NetIcon } from './netIcons'
import './lobby.css'

/** "Waiting for 2 players" while this seat is locked in (multiplayer), else null. */
export function useWaitingText(): string | null {
  const mode = useGame((s) => s.mode)
  const state = useGame((s) => s.state)
  const room = useNet((s) => s.room)
  const players = useNet((s) => s.players)
  const seat = useNet((s) => s.seat)
  if (mode !== 'multi') return null
  return waitingText(lockSummary(state, room, players, seat))
}

function Countdown() {
  const room = useNet((s) => s.room)
  const playing = room?.status === 'playing' && room.deadline !== null
  useNow(500, playing)
  const ms = msLeft(room)
  const level = clockLevel(ms)
  const prev = useRef(ms)

  useEffect(() => {
    const msg = clockAnnouncement(prev.current, ms)
    prev.current = ms
    if (msg) useUi.getState().announce(msg)
  }, [ms])

  if (!playing) return null
  const icon =
    level === 'warn' ? <Icon name="warn" size={16} /> : level === 'critical' ? <Icon name="critical" size={16} /> : level === 'over' ? <NetIcon name="hourglass" size={16} /> : <NetIcon name="clock" size={16} />
  return (
    <span className={`mp-clock is-${level}`} role="timer" aria-label={level === 'over' ? "Time's up: the round is resolving" : `${clockText(ms)} in this round`} title="Time left in this round. Miss it and last round's allocations repeat.">
      {icon}
      <span className="mp-clock-time num" aria-hidden="true">
        {level === 'over' ? "Time's up" : formatClock(ms)}
      </span>
      {level === 'over' ? null : (
        <span className="mp-clock-word" aria-hidden="true">
          left
        </span>
      )}
    </span>
  )
}

function Locks() {
  const state = useGame((s) => s.state)
  const room = useNet((s) => s.room)
  const players = useNet((s) => s.players)
  const seat = useNet((s) => s.seat)
  const summary = lockSummary(state, room, players, seat)
  if (room?.status !== 'playing' || summary.total === 0) return null
  const names = summary.entries.map((e) => `${e.isMe ? 'You' : e.name}: ${e.locked ? 'locked in' : 'deciding'}`).join(', ')
  return (
    <span className="mp-locks" title={names}>
      <span className="visually-hidden">
        {summary.locked} of {summary.total} locked in. {names}.
      </span>
      <ul className="mp-lock-list" aria-hidden="true">
        {summary.entries.map((e) => (
          <li key={e.seat} className={`mp-lock${e.locked ? ' is-locked' : ''}${e.isMe ? ' is-me' : ''}`} style={{ ['--seat' as string]: `var(--company-${e.color % 6})` }}>
            <span className="mp-lock-initial">{e.name.trim().charAt(0).toUpperCase() || '?'}</span>
            {e.locked ? (
              <span className="mp-lock-badge">
                <NetIcon name="check" size={16} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <span className="mp-lock-count" aria-hidden="true">
        <Icon name="lock" size={16} />
        <span className="num">
          {summary.locked}/{summary.total}
        </span>
      </span>
    </span>
  )
}

export function RoundClock() {
  const mode = useGame((s) => s.mode)
  if (mode !== 'multi') return null
  return (
    <div className="mp-status" role="group" aria-label="Multiplayer round">
      <Countdown />
      <Locks />
      <NetChips />
    </div>
  )
}
