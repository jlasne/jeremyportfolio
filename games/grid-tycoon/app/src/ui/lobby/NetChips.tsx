// Connection and network problems as chips (never pop-ups): connecting, reconnecting, offline,
// a failed Lock in, a lost seat, a room that no longer exists. Renders nothing while all is well.

import { useEffect, useState } from 'react'
import { leaveRoom } from '../../net/controller'
import { useNet } from '../../net/session'
import { Chip } from '../kit'

function useBrowserOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

/** True once `on` has held for `ms` (so a quick connect never flashes a chip). */
function useSettled(on: boolean, ms: number): boolean {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!on) {
      setSettled(false)
      return
    }
    const t = window.setTimeout(() => setSettled(true), ms)
    return () => window.clearTimeout(t)
  }, [on, ms])
  return settled
}

export function NetChips() {
  const status = useNet((s) => s.status)
  const problem = useNet((s) => s.problem)
  const code = useNet((s) => s.code)
  const browserOnline = useBrowserOnline()
  const slowConnect = useSettled(status === 'connecting', 2500)
  if (!code) return null

  const chips = []
  if (!browserOnline) {
    chips.push(<Chip key="offline" level="critical" label="Offline" detail="Your device has no network. The game catches up when it returns." />)
  } else if (status === 'reconnecting' || (status === 'closed' && !problem)) {
    chips.push(<Chip key="status" level="warn" label="Reconnecting…" detail="Live updates paused. The game catches up when the connection returns." />)
  } else if (slowConnect) {
    chips.push(<Chip key="status" level="info" label="Connecting…" detail="Joining the room's live updates." />)
  }
  if (problem) {
    const level = problem.kind === 'network' ? 'warn' : 'critical'
    const leave = problem.kind === 'room_gone' || problem.kind === 'seat_lost'
    chips.push(
      <Chip
        key="problem"
        level={level}
        label={problem.kind === 'network' ? 'Connection trouble' : problem.kind === 'submit' ? 'Not locked in' : problem.kind === 'seat_lost' ? 'Seat lost' : 'Room closed'}
        detail={leave ? `${problem.message} Select to leave.` : problem.message}
        onClick={leave ? () => leaveRoom() : undefined}
      />,
    )
  }
  if (chips.length === 0) return null
  return (
    <div className="net-chips" role="status">
      {chips}
    </div>
  )
}
