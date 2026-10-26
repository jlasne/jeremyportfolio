// Title: the logo, New solo game (optional company name and seed for replays), Resume when a solo
// save exists, the multiplayer card slot, and Settings.

import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useGame } from '../../store/game'
import { loadSolo } from '../../store/save'
import { rankOf } from '../../store/selectors'
import { useUi } from '../../store/ui'
import { Button, Icon, IconButton, fmtMoney } from '../kit'
import { Logo } from './Logo'
import MultiplayerCard from './MultiplayerCard'
import { TitleScene } from './TitleScene'

export function TitleScreen() {
  const startSolo = useGame((s) => s.startSolo)
  const resumeSolo = useGame((s) => s.resumeSolo)
  const openSettings = useUi((s) => s.setSettingsOpen)
  const [name, setName] = useState('')
  const [seed, setSeed] = useState('')
  const [seedOpen, setSeedOpen] = useState(false)

  const save = useMemo(() => {
    const s = loadSolo()
    if (!s || s.state.finished) return null
    const me = s.state.companies.find((c) => c.id === s.meId)
    return me ? { round: s.state.round, rounds: s.state.rounds, name: me.name, price: me.sharePrice, rank: rankOf(s.state, s.meId), seed: s.state.seed } : null
  }, [])

  const seedValue = seed.trim() === '' ? undefined : Number(seed)
  const seedBad = seedValue !== undefined && (!Number.isInteger(seedValue) || seedValue < 0 || seedValue > 0xffffffff)

  const onStart = (e: FormEvent) => {
    e.preventDefault()
    if (seedBad) return
    startSolo({ name, seed: seedValue })
  }

  return (
    <div className="title">
      <div className="title-top">
        <IconButton icon="gear" label="Settings" onClick={() => openSettings(true)} variant="secondary" />
      </div>

      <header className="title-hero">
        <Logo />
        <p className="title-tagline">
          Build power plants, grid links and datacenters. Sell electricity and compute to five client pools. After 40 rounds, the highest share price wins.
        </p>
      </header>

      <TitleScene />

      <div className="title-cards">
        {save ? (
          <section className="card card-resume" aria-labelledby="resume-title">
            <h2 id="resume-title" className="card-title">
              <Icon name="play" size={24} /> Resume
            </h2>
            <dl className="resume-facts">
              <div>
                <dt className="caps">Company</dt>
                <dd>{save.name}</dd>
              </div>
              <div>
                <dt className="caps">Round</dt>
                <dd className="num">
                  {save.round} of {save.rounds}
                </dd>
              </div>
              <div>
                <dt className="caps">Share price</dt>
                <dd className="num">{fmtMoney(save.price)}</dd>
              </div>
              <div>
                <dt className="caps">Rank</dt>
                <dd className="num">
                  #{save.rank.rank} of {save.rank.of}
                </dd>
              </div>
            </dl>
            <Button variant="primary" size="lg" icon="play" block onClick={() => resumeSolo()} autoFocus>
              Resume solo game
            </Button>
          </section>
        ) : null}

        <section className="card card-solo" aria-labelledby="solo-title">
          <h2 id="solo-title" className="card-title">
            <Icon name="bolt" size={24} /> New solo game
          </h2>
          <p className="card-desc">You against Volta Utility, Nimbus Compute and Hashfield Mining. About 25 minutes.</p>
          <form className="solo-form" onSubmit={onStart} noValidate>
            <label className="field">
              <span className="field-label">Company name</span>
              <input className="input" value={name} maxLength={28} placeholder="You" autoComplete="organization" onChange={(e) => setName(e.target.value)} />
            </label>
            {seedOpen ? (
              <label className="field">
                <span className="field-label">Seed</span>
                <input
                  className="input num"
                  value={seed}
                  inputMode="numeric"
                  placeholder="Random"
                  aria-invalid={seedBad || undefined}
                  aria-describedby="seed-hint"
                  onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, ''))}
                  autoFocus
                />
                <span id="seed-hint" className={`field-desc${seedBad ? ' is-error' : ''}`}>
                  {seedBad ? 'A seed is a whole number up to 4294967295.' : 'Same seed, same demand: replay a game from its end screen.'}
                </span>
              </label>
            ) : (
              <button type="button" className="link-btn" onClick={() => setSeedOpen(true)}>
                Replay a seed…
              </button>
            )}
            <Button type="submit" variant={save ? 'secondary' : 'primary'} size="lg" icon="bolt" block disabled={seedBad} autoFocus={!save}>
              Start solo game
            </Button>
            {save ? <p className="field-desc">Starting a new game replaces your saved one.</p> : null}
          </form>
        </section>

        <MultiplayerCard />
      </div>

      <footer className="title-foot">
        <span>
          A game by <a href="https://www.jeremylasne.com/">Jeremy Lasne</a>
        </span>
        <span className="muted">Keys: 1–4 panels · Tab between panels · Ctrl+Z undo · Ctrl+Enter lock in</span>
      </footer>
    </div>
  )
}
