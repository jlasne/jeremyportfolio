// Status chips: icon + word + value, coloured by level. Colour is never the only signal: every
// level has its own icon, and the word is always visible.

import type { ReactNode } from 'react'
import { Icon } from './icons'
import type { IconName } from './icons'

export type ChipLevel = 'info' | 'warn' | 'critical' | 'ok'

const LEVEL_ICON: Record<ChipLevel, IconName> = { info: 'info', warn: 'warn', critical: 'critical', ok: 'ok' }
const LEVEL_WORD: Record<ChipLevel, string> = { info: 'Note', warn: 'Warning', critical: 'Problem', ok: 'OK' }

export interface ChipProps {
  level?: ChipLevel
  /** Overrides the level icon (e.g. a pool icon on an info chip). */
  icon?: IconName
  label: ReactNode
  value?: ReactNode
  /** One sentence shown on hover/focus and read by screen readers. */
  detail?: string
  onClick?: () => void
  id?: string
}

export function Chip({ level = 'info', icon, label, value, detail, onClick, id }: ChipProps) {
  const body = (
    <>
      <Icon name={icon ?? LEVEL_ICON[level]} size={16} className="chip-icon" />
      <span className="visually-hidden">{LEVEL_WORD[level]}: </span>
      <span className="chip-label">{label}</span>
      {value != null ? <span className="chip-value num">{value}</span> : null}
      {detail ? <span className="visually-hidden">. {detail}</span> : null}
    </>
  )
  const cls = `chip chip-${level}${onClick ? ' chip-action' : ''}`
  if (onClick)
    return (
      <button type="button" id={id} className={cls} onClick={onClick} title={detail} data-detail={detail}>
        {body}
      </button>
    )
  return (
    <span id={id} className={cls} title={detail} data-detail={detail}>
      {body}
    </span>
  )
}
