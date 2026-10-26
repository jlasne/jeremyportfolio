// A number stepper: − / value / +. Arrow keys step by `step` (Shift ×10), Home/End jump to the
// bounds, typing commits on Enter or blur. Holding a button repeats. Values clamp to [min, max].

import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { Icon } from './icons'

export interface StepperProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  /** Shown after the value, e.g. "MW". */
  unit?: string
  /** Formats the value in the field when it is not being edited. */
  format?: (v: number) => string
  disabled?: boolean
  /** Hide the visible label (still announced). */
  hideLabel?: boolean
  hint?: string
  id?: string
}

const roundTo = (x: number, step: number): number => {
  const decimals = step < 1 ? Math.min(4, String(step).split('.')[1]?.length ?? 2) : 0
  return Number(x.toFixed(Math.max(decimals, 2)))
}

export function Stepper({ label, value, onChange, min = 0, max = Number.POSITIVE_INFINITY, step = 1, unit, format, disabled, hideLabel, hint, id }: StepperProps) {
  const autoId = useId()
  const inputId = id ?? `stepper-${autoId}`
  const hintId = hint ? `${inputId}-hint` : undefined
  const show = (v: number) => (format ? format(v) : String(Number(v.toFixed(2))))
  const [text, setText] = useState(show(value))
  const [editing, setEditing] = useState(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!editing) setText(show(value))
  }, [value, editing])

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const commit = (v: number) => {
    const next = roundTo(clamp(Number.isFinite(v) ? v : valueRef.current), step)
    if (next !== valueRef.current) onChange(next)
    valueRef.current = next
  }
  const bump = (dir: 1 | -1, mult = 1) => {
    // Step from the grid, so 2.37 + 1 lands on 3 and 2.37 - 1 on 2.
    const base = valueRef.current
    const next = dir > 0 ? Math.floor(base / step + 1e-9) * step + step * mult : Math.ceil(base / step - 1e-9) * step - step * mult
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
    const mult = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      bump(1, mult)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      bump(-1, mult)
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      bump(1, 10)
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      bump(-1, 10)
    } else if (e.key === 'Home' && Number.isFinite(min)) {
      e.preventDefault()
      commit(min)
    } else if (e.key === 'End' && Number.isFinite(max)) {
      e.preventDefault()
      commit(max)
    } else if (e.key === 'Enter') {
      commit(parseFloat(text.replace(',', '.')))
      setEditing(false)
    } else if (e.key === 'Escape' && editing) {
      e.stopPropagation()
      setEditing(false)
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
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            commit(parseFloat(text.replace(',', '.')))
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
