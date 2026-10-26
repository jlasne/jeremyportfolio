// Shared pieces of the four decision panels: the panel context hook, the treasury strip that sits
// at the top of Finance and Build, a width hook for crisp charts, and small formatting helpers.

import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { companyById } from '../../engine'
import type { Company, Config, GameState } from '../../engine'
import { useDerived } from '../../store/derived'
import { useGame } from '../../store/game'
import { Icon, NumberTween, fmtMoney } from '../kit'
import type { IconName } from '../kit'

export interface PanelCtx {
  state: GameState
  meId: string
  me: Company
  config: Config
  /** Controls are read-only outside the decision phase (waiting for others, resolving) or when bankrupt. */
  disabled: boolean
}

/** The game, my company and whether the panel can be edited. Null while the game screen tears down. */
export function usePanelCtx(): PanelCtx | null {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const phase = useGame((s) => s.phase)
  if (!state || !meId) return null
  const me = companyById(state, meId)
  return { state, meId, me, config, disabled: phase !== 'decide' || me.bankrupt || state.finished }
}

/** Width of an element in CSS px, kept current with a ResizeObserver (charts draw at real size). */
export function useWidth<T extends HTMLElement>(fallback = 300): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setWidth(w)
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

interface MoveItem {
  label: string
  amount: number
}

/**
 * Treasury left after every draft action, always visible at the top of the panel (it sticks while
 * the panel scrolls), with what moved it this round.
 */
export function TreasuryStrip({ extra }: { extra?: ReactNode }) {
  const ctx = usePanelCtx()
  const { preview } = useDerived()
  if (!ctx) return null
  const { me } = ctx
  const left = preview.treasuryLeft
  const finance = preview.financeCash
  const moves: MoveItem[] = []
  if (Math.abs(finance) >= 0.005) moves.push({ label: 'finance', amount: finance })
  if (preview.buildSpend >= 0.005) moves.push({ label: 'builds', amount: -preview.buildSpend })
  const negative = left < 0
  return (
    <div className={`tstrip${negative ? ' is-negative' : ''}`} role="group" aria-label="Treasury after this round's orders">
      <div className="tstrip-main">
        <span className="tstrip-label">
          <Icon name="coin" size={16} /> Treasury left
        </span>
        <NumberTween value={left} format={(v) => fmtMoney(v)} className={`tstrip-value pixel num${negative ? ' is-negative' : ''}`} />
      </div>
      <div className="tstrip-sub">
        <span className="num">now {fmtMoney(me.treasury)}</span>
        {moves.map((m) => (
          <span key={m.label} className={`num ${m.amount >= 0 ? 'delta-up' : 'delta-down'}`}>
            {fmtMoney(m.amount, { sign: true })} {m.label}
          </span>
        ))}
        {extra}
      </div>
      {negative ? (
        <p className="tstrip-warn">
          <Icon name="critical" size={16} /> Orders spend more than the treasury holds: remove one or raise cash in Finance.
        </p>
      ) : null}
    </div>
  )
}

/** A short status line (cap reached, needs a link...): icon + words, never colour alone. */
export function Note({ level = 'info', icon, children, id, live }: { level?: 'info' | 'warn' | 'critical' | 'ok'; icon?: IconName; children: ReactNode; id?: string; live?: boolean }) {
  const name: IconName = icon ?? (level === 'ok' ? 'ok' : level === 'warn' ? 'warn' : level === 'critical' ? 'critical' : 'info')
  return (
    <p className={`pnote pnote-${level}`} id={id} role={live ? 'status' : undefined}>
      <Icon name={name} size={16} className="pnote-icon" />
      <span>{children}</span>
    </p>
  )
}

/** "1 round" / "3 rounds". */
export const rounds = (n: number): string => `${n} round${n === 1 ? '' : 's'}`
