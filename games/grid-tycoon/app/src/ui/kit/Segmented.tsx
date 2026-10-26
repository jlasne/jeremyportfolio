// Segmented control (a radio group that looks like one pill) and an on/off switch.

import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon } from './icons'
import type { IconName } from './icons'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: IconName
  disabled?: boolean
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (v: T) => void
  hideLabel?: boolean
  size?: 'sm' | 'md'
}

export function Segmented<T extends string>({ label, value, options, onChange, hideLabel, size = 'md' }: SegmentedProps<T>) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)

  const onKey = (e: KeyboardEvent, index: number) => {
    const pos = enabled.indexOf(index)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = enabled[(pos + 1) % enabled.length]
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = enabled[(pos - 1 + enabled.length) % enabled.length]
    else if (e.key === 'Home') next = enabled[0]
    else if (e.key === 'End') next = enabled[enabled.length - 1]
    if (next < 0) return
    e.preventDefault()
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div className={`segmented-field segmented-${size}`}>
      <span id={`${id}-label`} className={hideLabel ? 'visually-hidden' : 'field-label'}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={`${id}-label`}>
        {options.map((o, i) => {
          const checked = o.value === value
          return (
            <button
              key={o.value}
              ref={(el) => void (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={o.disabled}
              className={`segmented-option${checked ? ' is-checked' : ''}`}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {o.icon ? <Icon name={o.icon} size={16} /> : null}
              <span>{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  description?: string
  disabled?: boolean
}

export function Toggle({ label, checked, onChange, description, disabled }: ToggleProps) {
  const id = useId()
  return (
    <div className="toggle-field">
      <div className="toggle-text">
        <span id={`${id}-label`} className="field-label">
          {label}
        </span>
        {description ? (
          <span id={`${id}-desc`} className="field-desc">
            {description}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        className={`toggle${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-thumb" />
        </span>
        <span className="toggle-state" aria-hidden="true">
          {checked ? 'On' : 'Off'}
        </span>
      </button>
    </div>
  )
}
