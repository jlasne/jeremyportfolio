// The panels' number stepper: the kit Stepper's look and keys (same CSS classes), plus a custom
// large step for Shift / PageUp / PageDown, and a fix for keyboard use: arrow keys update the
// field's text while it is focused, so leaving the field never commits a stale typed value.
// (The kit Stepper keeps the text it had at focus while arrows change the value, and its blur
// then reverts the change; reported to the shell owner.)

import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { Icon } from '../kit'

export interface PanelStepperProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  /** Shift+arrows, PageUp / PageDown (default 10 × step). */
  bigStep?: number
  unit?: string
  format?: (v: number) => string
  disabled?: boolean
  hideLabel?: boolean
  hint?: string
  id?: string
}

const decimalsOf = (step: number): number => (step < 1 ? Math.min(4, String(step).split('.')[1]?.length ?? 2) : 0)

export function PanelStepper({ label, value, onChange, min = 0, max = Number.POSITIVE_INFINITY, step = 1, bigStep, unit, format, disabled, hideLabel, hint, id }: PanelStepperProps) {
  const autoId = useId()
  const inputId = id ?? `pstep-${autoId}`
  const hintId = hint ? `${inputId}-hint` : undefined
  const show = (v: number) => (format ? format(v) : String(Number(v.toFixed(2))))
  const [text, setText] = useState(show(value))
  const [editing, setEditing] = useState(false)
  const dirty = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const timer = useRef<number | null>(null)
  const big = bigStep ?? step * 10

  useEffect(() => {
    if (!editing || !dirty.current) setText(show(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editing])

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const commit = (v: number) => {
    const next = Number(clamp(Number.isFinite(v) ? v : valueRef.current).toFixed(Math.max(decimalsOf(step), 2)))
    dirty.current = false
    setText(show(next))
    if (next !== valueRef.current) onChange(next)
    valueRef.current = next
  }
  /** Steps from the grid of `size`, so 23 + 5 lands on 25 and 23 − 5 on 20. */
  const bump = (dir: 1 | -1, size = step) => {
    const base = valueRef.current
    const next = dir > 0 ? Math.floor(base / size + 1e-9) * size + size : Math.ceil(base / size - 1e-9) * size - size
    commit(next)
  }

  const stopRepeat = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stopRepeat, [])
  const startRepeat = (dir: 1 | -1) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    bump(dir)
    let delay = 380
    const tick = () => {
      bump(dir)
      delay = Math.max(60, delay * 0.8)
      timer.current = window.setTimeout(tick, delay)
    }
    timer.current = window.setTimeout(tick, delay)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const k = e.key
    if (k === 'ArrowUp' || k === 'ArrowRight' || k === 'ArrowDown' || k === 'ArrowLeft') {
      e.preventDefault()
      bump(k === 'ArrowUp' || k === 'ArrowRight' ? 1 : -1, e.shiftKey ? big : step)
    } else if (k === 'PageUp' || k === 'PageDown') {
      e.preventDefault()
      bump(k === 'PageUp' ? 1 : -1, big)
    } else if (k === 'Home' && Number.isFinite(min)) {
      e.preventDefault()
      commit(min)
    } else if (k === 'End' && Number.isFinite(max)) {
      e.preventDefault()
      commit(max)
    } else if (k === 'Enter') {
      commit(parseFloat(text.replace(',', '.')))
    } else if (k === 'Escape' && dirty.current) {
      e.stopPropagation()
      dirty.current = false
      setText(show(value))
    }
  }

  const atMin = value <= min + 1e-9
  const atMax = value >= max - 1e-9
  return (
    <div className={`stepper${disabled ? ' is-disabled' : ''}`}>
      <label htmlFor={inputId} className={hideLabel ? 'visually-hidden' : 'stepper-label'}>
        {label}
      </label>
      <div className="stepper-control">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Decrease ${label}`}
          tabIndex={-1}
          disabled={disabled || atMin}
          onPointerDown={startRepeat(-1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
        >
          <Icon name="minus" size={16} />
        </button>
        <input
          id={inputId}
          className="stepper-input num"
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-valuenow={value}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuetext={`${show(value)}${unit ? ` ${unit}` : ''}`}
          aria-describedby={hintId}
          value={text}
          disabled={disabled}
          onFocus={(e) => {
            setEditing(true)
            e.currentTarget.select()
          }}
          onChange={(e) => {
            dirty.current = true
            setText(e.target.value)
          }}
          onBlur={() => {
            if (dirty.current) commit(parseFloat(text.replace(',', '.')))
            setEditing(false)
          }}
          onKeyDown={onKey}
        />
        {unit ? (
          <span className="stepper-unit" aria-hidden="true">
            {unit}
          </span>
        ) : null}
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Increase ${label}`}
          tabIndex={-1}
          disabled={disabled || atMax}
          onPointerDown={startRepeat(1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="stepper-hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
