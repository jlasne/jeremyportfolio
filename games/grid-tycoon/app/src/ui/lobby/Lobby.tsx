// The multiplayer waiting room (screen 'lobby'): the room code big in the pixel font with Copy
// code / Copy invite link, the seats (name, you, host, bot, here / away from presence), the room's
// settings, Start for the host and a waiting line for guests, Leave, and connection chips. With the
// local test server (?mp=local) a small test panel can seat simulated players.
//
// The controller (src/net/controller.ts) moves everyone to the game screen when the room starts.

import { useState } from 'react'
import { useGame } from '../../store/game'
import { addTestPlayer, inviteLink, leaveRoom, localRole, startHostedGame } from '../../net/controller'
import { useNet } from '../../net/session'
import { describePlan, seatRows, startPlan, type SeatRow } from '../../net/view'
import { Button, Icon } from '../kit'
import { Logo } from '../title/Logo'
import { useCopy, useNow } from './hooks'
import { NetIcon } from './netIcons'
import { NetChips } from './NetChips'
import './lobby.css'

function SeatItem({ row }: { row: SeatRow }) {
  if (row.name === null) {
    return (
      <li className="lobby-seat is-open">
        <span className="lobby-avatar is-open" aria-hidden="true">
          <NetIcon name="user" size={16} />
        </span>
        <span className="lobby-seat-name muted">Open seat</span>
      </li>
    )
  }
  const presenceWord = row.presence === 'bot' ? 'Bot' : row.presence === 'here' ? 'Here' : 'Away'
  return (
    <li className={`lobby-seat${row.isMe ? ' is-me' : ''}`}>
      <span className="lobby-avatar" style={{ ['--seat' as string]: `var(--company-${row.color % 6})` }} aria-hidden="true">
        <NetIcon name={row.isBot ? 'robot' : 'user'} size={16} />
      </span>
      <span className="lobby-seat-name">{row.name}</span>
      <span className="lobby-seat-tags">
        {row.isMe ? <span className="lobby-tag is-me">You</span> : null}
        {row.isHost ? (
          <span className="lobby-tag is-host">
            <NetIcon name="crown" size={16} /> Host
          </span>
        ) : null}
        <span className={`lobby-presence is-${row.presence}`}>
          <span className="lobby-dot" aria-hidden="true" />
          {presenceWord}
        </span>
      </span>
    </li>
  )
}

function TestTools() {
  const local = useNet((s) => s.local)
  const status = useNet((s) => s.room?.status)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const now = useNow(2000, !!local)
  if (!local || status !== 'lobby') return null
  void now
  const role = localRole()
  const add = async (auto: boolean) => {
    setBusy(true)
    const err = await addTestPlayer(auto)
    setBusy(false)
    setMsg(err ?? (auto ? 'Test player seated. It locks in a few seconds into every round.' : 'Idle player seated. It never locks in, so the timer decides.'))
  }
  return (
    <section className="lobby-test" aria-labelledby="lobby-test-title">
      <h3 id="lobby-test-title" className="lobby-test-title">
        <NetIcon name="robot" size={16} /> Local test tools
      </h3>
      <p className="field-desc">
        {local.timerSeconds} s per round. {role === 'host' ? 'This tab runs the local server.' : role === 'proxy' ? 'Another tab runs the local server.' : 'Starting…'} Open the invite link in another tab to play as a second human.
      </p>
      <div className="lobby-test-actions">
        <Button size="sm" icon="plus" disabled={busy} onClick={() => void add(true)}>
          Add test player
        </Button>
        <Button size="sm" icon="plus" disabled={busy} onClick={() => void add(false)}>
          Add idle player
        </Button>
      </div>
      {msg ? (
        <p className="field-desc" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  )
}

export default function Lobby() {
  const room = useNet((s) => s.room)
  const players = useNet((s) => s.players)
  const presence = useNet((s) => s.presence)
  const seat = useNet((s) => s.seat)
  const code = useNet((s) => s.code)
  const quit = useGame((s) => s.quitToTitle)
  const roundTimer = useGame((s) => s.config.multiplayer.roundTimer)
  const local = useNet((s) => s.local)
  const now = useNow(5000)
  const { copied, failed, copy } = useCopy()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  if (!room || !code) {
    return (
      <div className="screen-center">
        <section className="card card-wide" aria-labelledby="lobby-title">
          <Logo size="small" />
          <h2 id="lobby-title" className="card-title">
            <Icon name="rivals" size={24} /> Waiting room
          </h2>
          <p className="card-desc">You are not in a room. Host or join one from the title screen.</p>
          <Button icon="close" onClick={quit}>
            Back to title
          </Button>
        </section>
      </div>
    )
  }

  const rows = seatRows(room, players, presence, seat, now)
  const plan = startPlan(room, players)
  const isHost = seat === room.hostSeat
  const host = players.find((p) => p.seat === room.hostSeat)
  const humans = players.filter((p) => !p.isBot).length
  const link = inviteLink(code)

  const onStart = async () => {
    setStarting(true)
    setStartError(null)
    const failure = await startHostedGame()
    setStarting(false)
    if (failure) setStartError(failure.message)
  }

  return (
    <div className="lobby">
      <header className="lobby-top">
        <Logo size="small" />
        <Button variant="ghost" onClick={() => leaveRoom()} title="Leave the waiting room. Your seat stays yours: rejoin from the title screen.">
          <NetIcon name="door" size={16} /> Leave
        </Button>
      </header>

      <main className="lobby-card card" aria-labelledby="lobby-title">
        <div className="lobby-head">
          <h2 id="lobby-title" className="card-title">
            <Icon name="rivals" size={24} /> Waiting room
          </h2>
          <NetChips />
        </div>

        <div className="lobby-grid">
          <section className="lobby-code-block" aria-labelledby="lobby-code-label">
            <span id="lobby-code-label" className="caps lobby-label">
              Room code
            </span>
            <p className="lobby-code" aria-label={`Room code ${code.split('').join(' ')}`}>
              {code.split('').map((ch, i) => (
                <span key={i} className="lobby-code-tile" aria-hidden="true">
                  {ch}
                </span>
              ))}
            </p>
            <div className="lobby-copy">
              <Button icon={copied === 'code' ? undefined : 'copy'} onClick={() => copy('code', code, 'Room code')}>
                {copied === 'code' ? (
                  <>
                    <NetIcon name="check" size={16} /> Copied
                  </>
                ) : (
                  'Copy code'
                )}
              </Button>
              <Button icon={copied === 'link' ? undefined : 'copy'} onClick={() => copy('link', link, 'Invite link')}>
                {copied === 'link' ? (
                  <>
                    <NetIcon name="check" size={16} /> Copied
                  </>
                ) : (
                  'Copy invite link'
                )}
              </Button>
            </div>
            {failed ? (
              <p className="field-desc lobby-link-fallback">
                Copy did not work here. {failed === 'code' ? 'Code' : 'Link'}: <span className="num">{failed === 'code' ? code : link}</span>
              </p>
            ) : (
              <p className="field-desc">Friends open the link, or type the code under Join on the title screen.</p>
            )}

            <dl className="lobby-facts">
              <div>
                <dt className="caps">Seats</dt>
                <dd className="num">{room.seats}</dd>
              </div>
              <div>
                <dt className="caps">Bots</dt>
                <dd>{room.fillBots ? 'Fill seats' : 'Off'}</dd>
              </div>
              <div>
                <dt className="caps">Timer</dt>
                <dd className="num">{fmtTimer(local?.timerSeconds ?? roundTimer)}</dd>
              </div>
            </dl>
          </section>

          <section className="lobby-seats" aria-labelledby="lobby-seats-title">
            <h3 id="lobby-seats-title" className="lobby-seats-title">
              Players <span className="num muted">{humans} of {room.seats}</span>
            </h3>
            <ul className="lobby-seat-list">
              {rows.map((r) => (
                <SeatItem key={r.seat} row={r} />
              ))}
            </ul>
            {room.fillBots && plan.bots > 0 ? <p className="field-desc">Open seats fill with bots at the start.</p> : null}
          </section>
        </div>

        <footer className="lobby-foot">
          {isHost ? (
            <>
              <div className="lobby-plan">
                <span className="field-label">{plan.canStart ? `Starts with ${describePlan(plan)}` : plan.reason}</span>
                <span className="field-desc">{plan.canStart ? 'Late arrivals can still join until you start.' : room.fillBots ? '' : 'Turn on bots when you host, or wait for a friend.'}</span>
              </div>
              <Button variant="primary" size="lg" icon="play" disabled={!plan.canStart || starting} onClick={() => void onStart()} aria-describedby={startError ? 'lobby-start-error' : undefined}>
                {starting ? 'Starting…' : 'Start game'}
              </Button>
            </>
          ) : (
            <p className="lobby-wait" role="status">
              <NetIcon name="hourglass" size={16} className="lobby-wait-icon" />
              Waiting for {host?.name ?? 'the host'} to start the game…
            </p>
          )}
        </footer>
        {startError ? (
          <p id="lobby-start-error" className="mp-error" role="alert">
            <Icon name="critical" size={16} />
            <span>{startError}</span>
          </p>
        ) : null}

        <TestTools />
      </main>
      <p className="lobby-rules">
        <Icon name="info" size={16} />
        <span>A round resolves when everyone has locked in, or when the timer runs out. Miss the timer and last round's allocations repeat.</span>
      </p>
    </div>
  )
}

function fmtTimer(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} min`
  if (seconds > 60) return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
  return `${seconds} s`
}
