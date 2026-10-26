// The title screen's multiplayer card. Offline (production until a Supabase project exists): Host
// and Join are disabled with the one-line reason. With a backend (or the local test server,
// ?mp=local): Host (name, seats 2-6, fill empty seats with bots) and Join (6-letter code, name).
// An invite link ?room=ABCDEF prefills Join, and a seat this browser already holds offers Rejoin.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { MAX_SEATS, MIN_SEATS, NAME_MAX, OFFLINE_MESSAGE, ROOM_CODE_ALPHABET, forgetSeat, getState, isOnline, lastSeat, normalizeRoomCode, roomCodeFromUrl, savedSeat } from '../../net/client'
import { hostGame, initNet, joinGame, localModeRequested, rejoinGame } from '../../net/controller'
import { useNet } from '../../net/session'
import type { NetFailure } from '../../net/types'
import { cleanCodeInput } from '../../net/view'
import { Button, Icon, Segmented, Toggle } from '../kit'
import { NetIcon } from '../lobby/netIcons'
import '../lobby/lobby.css'

type Tab = 'host' | 'join'

interface RejoinInfo {
  code: string
  name: string
  /** What the server says about the room ("Round 5 of 40"), once known. */
  detail: string | null
}

function failureMessage(f: NetFailure): string {
  return f.message || 'Something went wrong. Try again.'
}

/** Six seats, coloured like companies; the last ones show the bots that can fill empty seats. */
function SeatsPreview() {
  return (
    <ul className="mp-preview" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className={i < 2 ? 'is-human' : 'is-bot'} style={{ ['--seat' as string]: `var(--company-${i})` }}>
          <NetIcon name={i < 2 ? 'user' : 'robot'} size={16} />
        </li>
      ))}
    </ul>
  )
}

export default function MultiplayerCard() {
  const ready = useNet((s) => s.ready)
  const local = useNet((s) => s.local)
  const wantsLocal = useMemo(() => localModeRequested(), [])
  const invite = useMemo(() => roomCodeFromUrl(), [])

  useEffect(() => {
    void initNet()
  }, [])

  // isOnline() depends on the backend that initNet may install; re-read once it is ready.
  const online = ready && isOnline()
  const loading = wantsLocal && !ready

  const [tab, setTab] = useState<Tab>(invite ? 'join' : 'host')
  const [name, setName] = useState(() => lastSeat()?.name ?? '')
  const [seats, setSeats] = useState(4)
  const [fillBots, setFillBots] = useState(true)
  const [code, setCode] = useState(invite ?? '')
  const [busy, setBusy] = useState<'host' | 'join' | 'rejoin' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)
  const [codeError, setCodeError] = useState(false)
  const [rejoin, setRejoin] = useState<RejoinInfo | null>(null)

  const ids = useId()
  const errorId = `${ids}-error`
  const reasonId = `${ids}-reason`
  const codeHintId = `${ids}-code-hint`
  const nameHintId = `${ids}-name-hint`
  const sectionRef = useRef<HTMLElement>(null)
  const rejoinRef = useRef<HTMLButtonElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // The token store can switch to per-tab storage once initNet runs (local test mode).
  useEffect(() => {
    if (ready) setName((n) => n || lastSeat()?.name || '')
  }, [ready])

  // A seat this browser holds: the invited room first, else the last room played.
  useEffect(() => {
    if (!online) {
      setRejoin(null)
      return
    }
    const seat = invite ? savedSeat(invite) : lastSeat()
    if (!seat) {
      setRejoin(null)
      return
    }
    setRejoin({ code: seat.code, name: seat.name, detail: null })
    let alive = true
    void getState(seat.code).then((res) => {
      if (!alive) return
      if (!res.ok) {
        if (res.error === 'room_not_found') {
          forgetSeat(seat.code)
          setRejoin(null)
        }
        return
      }
      const r = res.room
      const detail = r.status === 'lobby' ? 'In the waiting room' : r.status === 'finished' ? 'Game over: see the results' : `Round ${Math.min(r.round, r.state?.rounds ?? 40)} of ${r.state?.rounds ?? 40}`
      setRejoin({ code: seat.code, name: seat.name, detail })
    })
    return () => {
      alive = false
    }
  }, [online, invite])

  // Arriving from an invite link: bring the card into view and put focus where the next step is.
  const focused = useRef(false)
  useEffect(() => {
    if (!invite || !online || focused.current) return
    focused.current = true
    const t = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
      if (savedSeat(invite)) rejoinRef.current?.focus()
      else if (!name.trim()) nameRef.current?.focus()
      else codeRef.current?.focus()
    }, 60)
    return () => window.clearTimeout(t)
  }, [invite, online, name])

  const run = async (kind: 'host' | 'join' | 'rejoin', action: () => Promise<NetFailure | null>) => {
    setBusy(kind)
    setError(null)
    const failure = await action().catch(() => ({ ok: false, error: 'network', message: 'Could not reach the game server.' }) as NetFailure)
    setBusy(null)
    if (failure) {
      setError(failureMessage(failure))
      if (failure.error === 'invalid_name') {
        setNameError(true)
        nameRef.current?.focus()
      }
      if (failure.error === 'invalid_code' || failure.error === 'room_not_found') {
        setCodeError(true)
        codeRef.current?.focus()
      }
    }
  }

  const checkName = (): boolean => {
    const ok = name.trim().length > 0
    setNameError(!ok)
    if (!ok) {
      setError('Pick a name for your company (1 to 20 characters).')
      nameRef.current?.focus()
    }
    return ok
  }

  const onHost = (e: FormEvent) => {
    e.preventDefault()
    if (busy || !checkName()) return
    void run('host', () => hostGame({ name: name.trim(), seats, fillBots }))
  }

  const onJoin = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const normalized = normalizeRoomCode(code)
    if (!normalized) {
      setCodeError(true)
      setError('A room code is 6 letters.')
      codeRef.current?.focus()
      return
    }
    if (!checkName()) return
    void run('join', () => joinGame({ code: normalized, name: name.trim() }))
  }

  const nameField = (
    <label className="field">
      <span className="field-label">Your name</span>
      <input
        ref={nameRef}
        className="input"
        value={name}
        maxLength={NAME_MAX}
        placeholder="Company name"
        autoComplete="nickname"
        aria-invalid={nameError || undefined}
        aria-describedby={nameError ? errorId : nameHintId}
        onChange={(e) => {
          setName(e.target.value)
          if (nameError && e.target.value.trim()) {
            setNameError(false)
            setError(null)
          }
        }}
      />
      <span id={nameHintId} className="visually-hidden">
        Other players see this name. 1 to 20 characters.
      </span>
    </label>
  )

  const badge = local ? (
    <span className="mp-badge" title={`Rooms live in this browser only, shared by its tabs. ${local.timerSeconds} s per round.`}>
      <NetIcon name="robot" size={16} /> Local test server
    </span>
  ) : null

  // ---- Offline: what production shows until the backend exists. -------------------------------
  if (!online) {
    return (
      <section ref={sectionRef} className="card card-multi mp-card is-offline" aria-labelledby="multi-title" aria-busy={loading || undefined}>
        <h2 id="multi-title" className="card-title">
          <Icon name="rivals" size={24} /> Multiplayer
        </h2>
        <p className="card-desc">2 to 6 players on one shared market, 3 minutes per round. Empty seats can fill with bots.</p>
        <SeatsPreview />
        <div className="multi-actions">
          <Button icon="plus" disabled block aria-describedby={reasonId}>
            Host
          </Button>
          <Button icon="play" disabled block aria-describedby={reasonId}>
            Join
          </Button>
        </div>
        <p id={reasonId} className="mp-offline" role="note">
          <Icon name="info" size={16} />
          <span>{loading ? 'Starting the local test server…' : OFFLINE_MESSAGE}</span>
        </p>
      </section>
    )
  }

  // ---- Online ---------------------------------------------------------------------------------
  return (
    <section ref={sectionRef} className="card card-multi mp-card" aria-labelledby="multi-title">
      <div className="mp-card-head">
        <h2 id="multi-title" className="card-title">
          <Icon name="rivals" size={24} /> Multiplayer
        </h2>
        {badge}
      </div>
      <p className="card-desc">2 to 6 players on one shared market, {local ? `${local.timerSeconds} seconds` : '3 minutes'} per round.</p>

      {rejoin ? (
        <div className="mp-rejoin">
          <div className="mp-rejoin-text">
            <span className="caps mp-rejoin-label">Your seat</span>
            <span className="mp-rejoin-room">
              <span className="pixel num mp-code-inline">{rejoin.code}</span>
              <span className="mp-rejoin-name">as {rejoin.name}</span>
            </span>
            {rejoin.detail ? <span className="field-desc">{rejoin.detail}</span> : null}
          </div>
          <Button ref={rejoinRef} variant="primary" icon="play" disabled={busy != null} onClick={() => void run('rejoin', () => rejoinGame(rejoin.code))}>
            {busy === 'rejoin' ? 'Rejoining…' : 'Rejoin'}
          </Button>
        </div>
      ) : null}

      <Segmented<Tab>
        label="Host or join"
        hideLabel
        value={tab}
        onChange={(v) => {
          setTab(v)
          setError(null)
          setNameError(false)
          setCodeError(false)
        }}
        options={[
          { value: 'host', label: 'Host', icon: 'plus' },
          { value: 'join', label: 'Join', icon: 'play' },
        ]}
      />

      {tab === 'host' ? (
        <form className="mp-form" onSubmit={onHost} noValidate aria-label="Host a room">
          {nameField}
          <Segmented<string>
            label="Seats"
            value={String(seats)}
            onChange={(v) => setSeats(Number(v))}
            options={Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => ({ value: String(MIN_SEATS + i), label: String(MIN_SEATS + i) }))}
          />
          <Toggle label="Fill empty seats with bots" description="Bots take the seats nobody joins when you start." checked={fillBots} onChange={setFillBots} />
          <Button type="submit" variant={rejoin ? 'secondary' : 'primary'} size="lg" icon="plus" block disabled={busy != null} aria-describedby={error ? errorId : undefined}>
            {busy === 'host' ? 'Creating room…' : 'Host a room'}
          </Button>
        </form>
      ) : (
        <form className="mp-form" onSubmit={onJoin} noValidate aria-label="Join a room">
          <label className="field">
            <span className="field-label">Room code</span>
            <input
              ref={codeRef}
              className="input mp-code-input"
              value={code}
              maxLength={6}
              placeholder="ABCDEF"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={codeError || undefined}
              aria-describedby={codeError ? `${errorId} ${codeHintId}` : codeHintId}
              onChange={(e) => {
                const next = cleanCodeInput(e.target.value, ROOM_CODE_ALPHABET)
                setCode(next)
                if (codeError) {
                  setCodeError(false)
                  setError(null)
                }
              }}
            />
            <span id={codeHintId} className="field-desc">
              6 letters, from the host's invite. There is no I or O.
            </span>
          </label>
          {nameField}
          <Button type="submit" variant={rejoin ? 'secondary' : 'primary'} size="lg" icon="play" block disabled={busy != null} aria-describedby={error ? errorId : undefined}>
            {busy === 'join' ? 'Joining…' : 'Join room'}
          </Button>
        </form>
      )}

      <p id={errorId} className="mp-error" role="alert" aria-live="assertive">
        {error ? (
          <>
            <Icon name="critical" size={16} />
            <span>{error}</span>
          </>
        ) : null}
      </p>
    </section>
  )
}
