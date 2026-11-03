// One MW control of the Allocate terminal: a track (its length is a fixed scale, so rows of one
// building type compare at a glance), a hatched zone under the committed floor that the value
// cannot enter, a greyed zone past what is reachable now, an optional "demand" tick (offering past
// it is not expected to be used), and −/+ buttons with the value.
//
// Keyboard (the track is role="slider"): Left/Down −1 MW, Right/Up +1, Shift or PageUp/PageDown
// ±5, Home to the floor, End as far as it can go. Pointer and touch: press or drag on the track.
// Values snap to whole MW, except at the floor and the cap, which may be fractional.

import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Icon, Mw, fmtMw } from '../kit'

interface MwSliderProps {
  label: string
  value: number
  /** Committed floor: the value cannot go below it. */
  min: number
  /** Highest value reachable now. */
  max: number
  /** Track length in MW. */
  scale: number
  /** Fill colour (a palette token). */
  color: string
  /** Where last round's demand would stop using more MW (marker only). */
  demandAt?: number
  /** Why the value cannot go higher. */
  maxReason: string
  /** Why the value cannot go lower (the floor), when the floor is above 0. */
  minReason?: string
  /** Added to aria-valuetext. */
  valueText?: string
  disabled?: boolean
  onChange: (mw: number) => void
}

const EPS = 1e-6
const r2 = (x: number): number => Math.round(x * 100) / 100

export function MwSlider({ label, value, min, max, scale, color, demandAt, maxReason, minReason, valueText, disabled, onChange }: MwSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const lo = Math.max(0, Math.min(min, max))
  const hi = Math.max(lo, max)
  const span = Math.max(scale, hi, value, 1)
  const pct = (x: number): string => `${(Math.max(0, Math.min(span, x)) / span) * 100}%`

  const setTo = (want: number) => {
    if (disabled) return
    let next = want
    let note: string | null = null
    if (next > hi + EPS) {
      next = hi
      note = maxReason
    } else if (next < lo - EPS) {
      next = lo
      note = lo > EPS ? (minReason ?? `At least ${fmtMw(lo)} this round.`) : null
    }
    setMsg(note)
    next = r2(next)
    if (Math.abs(next - value) > EPS) onChange(next)
  }
  const step = (dir: 1 | -1, size: number) => {
    const next = dir > 0 ? Math.floor(value + EPS) + size : Math.ceil(value - EPS) - size
    setTo(next)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const big = e.shiftKey ? 5 : 1
    let handled = true
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1, big)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1, big)
    else if (e.key === 'PageUp') step(1, 5)
    else if (e.key === 'PageDown') step(-1, 5)
    else if (e.key === 'Home') setTo(lo)
    else if (e.key === 'End') setTo(hi)
    else handled = false
    if (handled) e.preventDefault()
  }

  const fromPointer = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const raw = ((clientX - r.left) / Math.max(1, r.width)) * span
    // Snap to whole MW, but let the floor and the cap be reached exactly.
    let v = Math.round(raw)
    if (raw <= lo + 0.5 && lo > 0) v = Math.max(v, lo)
    if (raw >= hi - 0.5) v = Math.min(Math.max(v, hi), Math.ceil(hi))
    setTo(v)
  }
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus({ preventScroll: true })
    drag.current = e.pointerId
    fromPointer(e.clientX)
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current === e.pointerId) fromPointer(e.clientX)
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current === e.pointerId) drag.current = null
  }

  const style = { '--mws': color } as CSSProperties
  const showDemand = demandAt != null && demandAt > EPS && demandAt < span - EPS
  // The two labels under the track would collide: keep the floor's, the dashed tick stays.
  const demandLabel = showDemand && !(lo > EPS && Math.abs((demandAt ?? 0) - lo) / span < 0.16)
  return (
    <div className={`mws${disabled ? ' is-disabled' : ''}`} style={style}>
      <div className="mws-main">
        <div
          ref={trackRef}
          className="mws-track"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          aria-valuemin={r2(lo)}
          aria-valuemax={r2(hi)}
          aria-valuenow={r2(value)}
          aria-valuetext={`${fmtMw(value)}${lo > EPS ? `, at least ${fmtMw(lo)}` : ''}${valueText ? `, ${valueText}` : ''}`}
          aria-disabled={disabled || undefined}
          onKeyDown={onKey}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        >
          <span className="mws-fill" style={{ width: pct(value) }} />
          {lo > EPS ? <span className="mws-floor" style={{ width: pct(lo) }} /> : null}
          {hi < span - EPS ? <span className="mws-block" style={{ left: pct(Math.max(hi, value)) }} /> : null}
          {showDemand ? <span className="mws-demand" style={{ left: pct(demandAt) }} /> : null}
          <span className="mws-thumb" style={{ left: pct(value) }} />
        </div>
        <div className="mws-scale" aria-hidden="true">
          {lo > EPS ? (
            <span className="mws-scale-floor num" style={{ left: pct(lo) }}>
              min {fmtMw(lo, { unit: false })}
            </span>
          ) : null}
          {demandLabel ? (
            <span className="mws-scale-demand num" style={{ left: pct(demandAt) }}>
              demand
            </span>
          ) : null}
        </div>
      </div>
      <div className="mws-ctl">
        <button type="button" tabIndex={-1} className="ss-btn" aria-label={`${label}: 1 MW less`} disabled={disabled || value <= lo + EPS} onClick={() => step(-1, 1)}>
          <Icon name="minus" size={16} />
        </button>
        <Mw value={value} tween className="mws-value" />
        <button type="button" tabIndex={-1} className="ss-btn" aria-label={`${label}: 1 MW more`} disabled={disabled || value >= hi - EPS} onClick={() => step(1, 1)}>
          <Icon name="plus" size={16} />
        </button>
      </div>
      <p className={`mws-msg${msg ? ' is-shown' : ''}`} role="status">
        {msg ? (
          <>
            <Icon name="info" size={16} />
            <span>{msg}</span>
          </>
        ) : null}
      </p>
    </div>
  )
}
