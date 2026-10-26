// A stacked slider: one horizontal bar whose length is a capacity in MW, split into coloured
// segments plus the idle remainder. Each segment has a knob at its right edge (hanging under the
// bar, fanned out when several edges meet, with a leader line to the true edge) that resizes that
// segment only: growing takes idle MW first, then MW from the segments to its right; shrinking
// gives MW back to idle. Values snap to whole MW. Link caps are drawn as markers on the bar and a
// knob stops at its cap with the reason in a status line.
//
// Keyboard (each knob is a role="slider"): Left/Down −1 MW, Right/Up +1, Shift or PageUp/PageDown
// ±5, Home 0, End as far as it can go. Pointer and touch: drag the knob (relative drag, no jump).
// The legend rows under the bar repeat each segment with its live numbers and −/+ buttons.

import { useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Icon, Mw, fmtMw } from '../kit'
import type { IconName } from '../kit'
import { useWidth } from './common'

export interface SliderSegment {
  key: string
  label: string
  icon: IconName
  /** Fill colour (a palette token). */
  color: string
  /** Icon / label colour on the fill. */
  ink?: string
  value: number
  /** Most MW this segment may hold (a link capacity). */
  cap?: number
  /** Marker label on the bar, e.g. "link 4". */
  capLabel?: string
  /** Why the knob stops at the cap. */
  capReason?: string
  /** The segment cannot take any MW (e.g. no town link); shown in its legend row. */
  lockedReason?: string
  /** Second line of the legend row (margin, projected use...). */
  detail?: ReactNode
  /** Added to aria-valuetext after the MW. */
  valueText?: string
}

interface StackedSliderProps {
  /** Accessible name of the whole slider, e.g. "Power". */
  label: string
  /** Bar length in MW. */
  total: number
  /** MW that can be assigned (≤ total); the rest is drawn hatched as unavailable. */
  allocatable?: number
  unavailableLabel?: string
  unavailableReason?: string
  segments: SliderSegment[]
  idleLabel?: string
  idleDetail?: ReactNode
  onChange: (values: Record<string, number>, key: string) => void
  disabled?: boolean
  emptyText?: string
}

const EPS = 1e-6
const KNOB = 32
const GAP = 4
const r2 = (x: number): number => Math.round(x * 100) / 100

/** Spreads knob centres so they never overlap, keeping each as close to its edge as possible. */
function spread(xs: number[], min: number, max: number, gap: number): number[] {
  const out = xs.map((x) => Math.min(max, Math.max(min, x)))
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap)
  if (out.length && out[out.length - 1] > max) {
    out[out.length - 1] = max
    for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - gap)
  }
  return out
}

export function StackedSlider({
  label,
  total,
  allocatable,
  unavailableLabel,
  unavailableReason,
  segments,
  idleLabel = 'Idle',
  idleDetail,
  onChange,
  disabled,
  emptyText,
}: StackedSliderProps) {
  const id = useId()
  const [trackRef, width] = useWidth<HTMLDivElement>(300)
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const drag = useRef<{ i: number; x0: number; v0: number; pid: number } | null>(null)

  const values = segments.map((s) => Math.max(0, s.value))
  const sum = values.reduce((a, b) => a + b, 0)
  const alloc = Math.max(0, Math.min(total, allocatable ?? total))
  const idle = alloc - sum
  const scale = Math.max(total, sum)
  const px = scale > 0 ? width / scale : 0

  const upper = (i: number): number => {
    const seg = segments[i]
    if (seg.lockedReason) return 0
    const right = values.slice(i + 1).reduce((a, b) => a + b, 0)
    const room = values[i] + Math.max(0, idle) + right
    return Math.max(0, Math.min(seg.cap ?? Number.POSITIVE_INFINITY, room))
  }

  const blockedReason = (i: number): string => {
    const seg = segments[i]
    if (seg.lockedReason) return seg.lockedReason
    const right = values.slice(i + 1).reduce((a, b) => a + b, 0)
    const room = values[i] + Math.max(0, idle) + right
    if (seg.cap != null && seg.cap <= room + EPS) return seg.capReason ?? `${seg.label} is capped at ${fmtMw(seg.cap)}.`
    if (alloc < total - EPS && unavailableReason) return unavailableReason
    return i === segments.length - 1 ? `No idle MW left for ${seg.label.toLowerCase()}: shrink another segment first.` : `Every MW is already assigned: shrink a segment first.`
  }

  /** Sets segment i to `want` MW (already snapped), within its bounds; reports why when it stops short. */
  const setValue = (i: number, want: number) => {
    if (disabled) return
    const cur = values[i]
    let target = want
    let stopped = false
    if (target > cur) {
      const up = upper(i)
      if (target > up + EPS) {
        stopped = true
        target = Math.max(cur, up)
      }
    }
    setMsg(stopped ? { text: blockedReason(i), n: (msg?.n ?? 0) + 1 } : null)
    target = r2(Math.max(0, target))
    if (Math.abs(target - cur) < EPS) return
    const next = [...values]
    next[i] = target
    let need = target - cur - Math.max(0, idle)
    for (let j = i + 1; j < next.length && need > EPS; j++) {
      const take = Math.min(next[j], need)
      next[j] = r2(next[j] - take)
      need -= take
    }
    const out: Record<string, number> = {}
    segments.forEach((s, k) => (out[s.key] = next[k]))
    onChange(out, segments[i].key)
  }
  const stepTo = (i: number, dir: 1 | -1, size: number) => {
    const cur = values[i]
    const next = dir > 0 ? Math.floor(cur + EPS) + size : Math.ceil(cur - EPS) - size
    setValue(i, next)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    const big = e.shiftKey ? 5 : 1
    let handled = true
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') stepTo(i, 1, big)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') stepTo(i, -1, big)
    else if (e.key === 'PageUp') stepTo(i, 1, 5)
    else if (e.key === 'PageDown') stepTo(i, -1, 5)
    else if (e.key === 'Home') setValue(i, 0)
    else if (e.key === 'End') setValue(i, Math.floor(upper(i) + EPS))
    else handled = false
    if (handled) e.preventDefault()
  }

  const onDown = (e: ReactPointerEvent<HTMLDivElement>, i: number) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
    drag.current = { i, x0: e.clientX, v0: values[i], pid: e.pointerId }
    setDragging(i)
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pid !== e.pointerId || px <= 0) return
    const want = Math.round(d.v0 + (e.clientX - d.x0) / px)
    if (want !== Math.round(values[d.i] * 100) / 100) setValue(d.i, want)
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pid === e.pointerId) {
      drag.current = null
      setDragging(null)
    }
  }

  if (total <= EPS) {
    return (
      <div className="ss ss-empty">
        <p className="muted">{emptyText ?? 'Nothing to allocate yet.'}</p>
      </div>
    )
  }

  // Geometry in px.
  const starts: number[] = []
  let acc = 0
  for (const v of values) {
    starts.push(acc)
    acc += v
  }
  const edges = values.map((v, i) => (starts[i] + v) * px)
  const knobX = spread(edges, KNOB / 2, width - KNOB / 2, KNOB + GAP)
  const idleW = Math.max(0, idle) * px
  const unavailW = Math.max(0, total - alloc) * px

  const markers = segments
    .map((s, i) => ({ s, i, at: s.cap != null && !s.lockedReason && s.cap > EPS ? starts[i] + s.cap : null }))
    .filter((m): m is { s: SliderSegment; i: number; at: number } => m.at != null && m.at < scale - EPS)
  let lastLabel = -Infinity

  const segStyle = (s: SliderSegment, left: number, w: number): CSSProperties => ({
    left,
    width: Math.max(0, w),
    background: s.color,
    color: s.ink ?? 'var(--ink-dark)',
  })

  return (
    <div className={`ss${disabled ? ' is-disabled' : ''}`} role="group" aria-label={label}>
      <div className={`ss-markers${markers.length ? '' : ' is-empty'}`} aria-hidden="true">
        {markers.map((m) => {
          const x = m.at * px
          const showLabel = m.s.capLabel && x - lastLabel > 64 && x > 20 && x < width - 20
          if (showLabel) lastLabel = x
          return (
            <span key={m.s.key} className="ss-marker-label num" style={{ left: x, visibility: showLabel ? 'visible' : 'hidden' }}>
              {m.s.capLabel}
            </span>
          )
        })}
      </div>
      <div className="ss-track" ref={trackRef}>
        {unavailW > 0.5 ? (
          <div className="ss-unavail" style={{ left: alloc * px, width: unavailW }} title={unavailableReason}>
            {unavailW >= 70 && unavailableLabel ? <span className="ss-seg-text">{unavailableLabel}</span> : null}
          </div>
        ) : null}
        {idleW > 0.5 ? (
          <div className="ss-idle" style={{ left: sum * px, width: idleW }}>
            {idleW >= 64 ? <span className="ss-seg-text">{idleLabel}</span> : null}
          </div>
        ) : null}
        {segments.map((s, i) => {
          const w = values[i] * px
          if (w < 0.5) return null
          return (
            <div key={s.key} className={`ss-seg${dragging === i ? ' is-active' : ''}`} style={segStyle(s, starts[i] * px, w)}>
              {w >= 30 ? <Icon name={s.icon} size={16} /> : null}
              {w >= 58 ? <span className="ss-seg-num num">{fmtMw(values[i], { unit: false })}</span> : null}
            </div>
          )
        })}
        {markers.map((m) => (
          <span key={m.s.key} className="ss-marker" style={{ left: m.at * px }} aria-hidden="true" />
        ))}
      </div>

      <div className="ss-knobs">
        <svg className="ss-leaders" width={width} height={14} aria-hidden="true">
          {edges.map((x, i) => (
            <line key={segments[i].key} x1={Math.min(width - 1, Math.max(1, x))} y1={0} x2={knobX[i]} y2={14} />
          ))}
        </svg>
        {segments.map((s, i) => {
          const locked = !!s.lockedReason
          const max = Math.max(values[i], upper(i))
          return (
            <div
              key={s.key}
              className={`ss-knob${dragging === i ? ' is-dragging' : ''}${locked ? ' is-locked' : ''}`}
              style={{ left: knobX[i], background: s.color, color: s.ink ?? 'var(--ink-dark)' }}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label={`${label}: ${s.label}`}
              aria-valuemin={0}
              aria-valuemax={r2(max)}
              aria-valuenow={r2(values[i])}
              aria-valuetext={`${fmtMw(values[i])}${locked ? `, ${s.lockedReason}` : s.valueText ? `, ${s.valueText}` : ''}`}
              aria-disabled={disabled || locked || undefined}
              aria-describedby={msg ? `${id}-msg` : undefined}
              onKeyDown={(e) => onKey(e, i)}
              onPointerDown={(e) => onDown(e, i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onLostPointerCapture={onUp}
            >
              <Icon name={s.icon} size={16} />
            </div>
          )
        })}
      </div>

      <p id={`${id}-msg`} className={`ss-msg${msg ? ' is-shown' : ''}`} role="status" aria-live="polite">
        {msg ? (
          <>
            <Icon name="warn" size={16} className="ss-msg-icon" />
            <span key={msg.n}>{msg.text}</span>
          </>
        ) : null}
      </p>

      <ul className="ss-legend">
        {segments.map((s, i) => {
          const locked = !!s.lockedReason
          const canDown = !disabled && values[i] > EPS
          const canUp = !disabled && !locked
          return (
            <li key={s.key} className={`ss-row${locked ? ' is-locked' : ''}${dragging === i ? ' is-active' : ''}`}>
              <span className="ss-swatch" style={{ background: s.color, color: s.ink ?? 'var(--ink-dark)' }} aria-hidden="true">
                <Icon name={s.icon} size={16} />
              </span>
              <span className="ss-row-text">
                <span className="ss-row-label">{s.label}</span>
                <span className="ss-row-detail">{locked ? s.lockedReason : s.detail}</span>
              </span>
              <Mw value={values[i]} tween className="ss-row-value" />
              <span className="ss-row-btns">
                <button type="button" tabIndex={-1} className="ss-btn" aria-label={`${s.label}: 1 MW less`} disabled={!canDown} onClick={() => stepTo(i, -1, 1)}>
                  <Icon name="minus" size={16} />
                </button>
                <button type="button" tabIndex={-1} className="ss-btn" aria-label={`${s.label}: 1 MW more`} disabled={!canUp} onClick={() => stepTo(i, 1, 1)}>
                  <Icon name="plus" size={16} />
                </button>
              </span>
            </li>
          )
        })}
        <li className="ss-row ss-row-idle">
          <span className="ss-swatch ss-swatch-idle" aria-hidden="true" />
          <span className="ss-row-text">
            <span className="ss-row-label">{idleLabel}</span>
            {idleDetail ? <span className="ss-row-detail">{idleDetail}</span> : null}
          </span>
          <Mw value={Math.max(0, idle)} tween className={`ss-row-value${idle < -EPS ? ' is-negative' : ''}`} />
          <span className="ss-row-btns" />
        </li>
      </ul>
    </div>
  )
}
