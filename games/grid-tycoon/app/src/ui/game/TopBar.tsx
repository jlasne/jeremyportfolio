// The always-visible status bar: round + season, treasury, share price and its move, rank, the
// projection line, undo, mute, menu, and the Lock in button (disabled with its reason).

import { useMemo } from 'react'
import { useDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { displayRound, priceChange, rankOf, selectLosingRound, selectMe, seasonName } from '../../store/selectors'
import { useUi } from '../../store/ui'
import { seasonOf } from '../../engine'
import { Button, Icon, IconButton, NumberTween, SEASON_ICONS, fmtMoney, trend } from '../kit'
import { GameMenu } from './GameMenu'
import { unlockToEdit } from '../../net/controller'
import { RoundClock, useWaitingText } from '../lobby/RoundClock'

/** The chip that shows why Lock in is disabled (rendered by ChipsRow). */
export const LOCK_REASON_ID = 'lock-reason'

/** Why Lock in is disabled right now, or null when it is enabled. */
export function useLockBlock(): string | null {
  const phase = useGame((s) => s.phase)
  const me = useGame(selectMe)
  const losing = useGame(selectLosingRound)
  const confirmed = useUi((s) => s.forcedSaleConfirmed)
  const { validation } = useDerived()
  const waiting = useWaitingText()
  if (phase === 'waiting') return waiting ?? 'Waiting for the other players.'
  if (phase !== 'decide') return 'Round is resolving.'
  if (me?.bankrupt) return null
  if (losing && !confirmed) return 'Confirm the forced sale first.'
  if (!validation.ok) return validation.errors[0]?.message ?? 'This decision is not valid yet.'
  return null
}

export function TopBar() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const me = useGame(selectMe)
  const phase = useGame((s) => s.phase)
  const lockIn = useGame((s) => s.lockIn)
  const mode = useGame((s) => s.mode)
  const undo = useDraft((s) => s.undo)
  const undoCount = useDraft((s) => s.past.length)
  const music = useUi((s) => s.settings.music)
  const sfx = useUi((s) => s.settings.sfx)
  const setSetting = useUi((s) => s.setSetting)
  const { projection, preview } = useDerived()
  const block = useLockBlock()

  const rank = useMemo(() => (state && meId ? rankOf(state, meId) : { rank: 1, of: 1 }), [state, meId])
  if (!state || !me) return null

  const round = displayRound(state)
  const season = seasonOf(round)
  const change = priceChange(me)
  const dir = trend(change)
  const muted = !music && !sfx
  const profit = projection.profit
  const spent = preview.treasuryLeft !== me.treasury

  const toggleMute = () => {
    setSetting('music', muted)
    setSetting('sfx', muted)
  }

  // Multiplayer: after Lock in the button unlocks the draft again (re-locking replaces the decision).
  const canUnlock = mode === 'multi' && phase === 'waiting' && !me.bankrupt
  const lockLabel = canUnlock ? 'Unlock' : phase === 'waiting' ? 'Waiting…' : me.bankrupt ? 'Next round' : 'Lock in'

  return (
    <header className="topbar">
      <div className="tb-stats">
        <div className="stat stat-round">
          <span className="stat-label caps">Round</span>
          <span className="stat-value">
            <Icon name={SEASON_ICONS[season]} size={16} className={`season-icon season-${season}`} title={seasonName(round)} />
            <span className="pixel num">
              {round}
              <span className="stat-of"> of {state.rounds}</span>
            </span>
          </span>
        </div>

        <div className="stat stat-money" title={spent ? `${fmtMoney(me.treasury)} now, ${fmtMoney(preview.treasuryLeft)} after this round's orders` : undefined}>
          <span className="stat-label caps">Treasury</span>
          <span className="stat-value">
            <Icon name="coin" size={16} />
            <NumberTween value={preview.treasuryLeft} format={(v) => fmtMoney(v)} className={`pixel num${preview.treasuryLeft < 0 ? ' is-negative' : ''}`} />
          </span>
          {spent ? <span className="stat-sub num">of {fmtMoney(me.treasury)}</span> : null}
        </div>

        <div className="stat stat-price">
          <span className="stat-label caps">Share price</span>
          <span className="stat-value">
            <NumberTween value={me.sharePrice} format={(v) => fmtMoney(v)} className="pixel num" />
            {me.history.length > 0 ? (
              <span className={`delta delta-${dir > 0 ? 'up' : dir < 0 ? 'down' : 'flat'}`}>
                {dir !== 0 ? <Icon name={dir > 0 ? 'arrowUp' : 'arrowDown'} size={16} /> : null}
                <span className="num">{fmtMoney(change, { sign: true })}</span>
                <span className="visually-hidden">{dir > 0 ? ' up since last round' : dir < 0 ? ' down since last round' : ' unchanged'}</span>
              </span>
            ) : null}
          </span>
        </div>

        <div className="stat stat-rank">
          <span className="stat-label caps">Rank</span>
          <span className="stat-value pixel num">
            #{rank.rank}
            <span className="stat-of"> of {rank.of}</span>
          </span>
        </div>
      </div>

      <div className="tb-actions">
        <RoundClock />
        {!me.bankrupt ? (
          <div className={`projection ${trend(profit) >= 0 ? 'is-up' : 'is-down'}`} title="Estimated profit next round from your current draft, using last round's demand">
            <span className="projection-label">Next round</span>
            <span className="projection-value num">≈ {fmtMoney(profit, { sign: true })}</span>
          </div>
        ) : (
          <div className="projection is-down">
            <span className="projection-label">Bankrupt</span>
          </div>
        )}
        <div className="tb-buttons">
          <IconButton icon="undo" label="Undo" title="Undo (Ctrl+Z)" aria-keyshortcuts="Control+Z Meta+Z" onClick={undo} disabled={undoCount === 0 || phase !== 'decide'} badge={undoCount > 0 ? undoCount : undefined} />
          <IconButton icon={muted ? 'mute' : 'music'} label={muted ? 'Unmute music and sound' : 'Mute music and sound'} pressed={muted} onClick={toggleMute} />
          <GameMenu />
          <div className="lock-wrap">
            <Button
              variant={canUnlock ? 'secondary' : 'primary'}
              size="lg"
              icon={canUnlock ? 'undo' : 'lock'}
              className="lock-btn"
              data-tut="lock-in"
              disabled={block != null && !canUnlock}
              aria-describedby={block ? LOCK_REASON_ID : undefined}
              aria-keyshortcuts={canUnlock ? undefined : 'Control+Enter Meta+Enter'}
              title={canUnlock ? 'Unlock to edit. Your locked decision stands until you lock in again.' : undefined}
              onClick={canUnlock ? unlockToEdit : lockIn}
            >
              {lockLabel}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
