// ARIA tabs with automatic activation: arrows (and Home/End) move and select, the tab panel is
// linked by id. Clicking the selected tab again calls onSelect(null) when `collapsible`.

import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon } from './icons'
import type { IconName } from './icons'

export interface TabItem<T extends string> {
  id: T
  label: string
  icon?: IconName
  /** Keyboard shortcut hint, e.g. "1". */
  kbd?: string
  disabled?: boolean
  /** Small badge (count of pending orders, a warning dot...). */
  badge?: ReactNode
}

interface TabsProps<T extends string> {
  label: string
  items: TabItem<T>[]
  selected: T | null
  onSelect: (id: T | null) => void
  /** Prefix for element ids: tab `${prefix}-tab-${id}`, panel `${prefix}-panel-${id}`. */
  idPrefix: string
  orientation?: 'horizontal' | 'vertical'
  collapsible?: boolean
  className?: string
}

export const tabId = (prefix: string, id: string): string => `${prefix}-tab-${id}`
export const tabPanelId = (prefix: string, id: string): string => `${prefix}-panel-${id}`

export function Tabs<T extends string>({ label, items, selected, onSelect, idPrefix, orientation = 'horizontal', collapsible, className }: TabsProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const enabled = items.filter((i) => !i.disabled)
  const focusIndex = Math.max(0, enabled.findIndex((i) => i.id === selected))

  const onKey = (e: KeyboardEvent, id: T) => {
    const pos = enabled.findIndex((i) => i.id === id)
    const prevKeys = orientation === 'vertical' ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft', 'ArrowUp']
    const nextKeys = orientation === 'vertical' ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight', 'ArrowDown']
    let next: TabItem<T> | undefined
    if (nextKeys.includes(e.key)) next = enabled[(pos + 1) % enabled.length]
    else if (prevKeys.includes(e.key)) next = enabled[(pos - 1 + enabled.length) % enabled.length]
    else if (e.key === 'Home') next = enabled[0]
    else if (e.key === 'End') next = enabled[enabled.length - 1]
    if (!next) return
    e.preventDefault()
    onSelect(next.id)
    refs.current[next.id]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} aria-orientation={orientation} className={`tabs tabs-${orientation}${className ? ` ${className}` : ''}`}>
      {items.map((item) => {
        const isSel = item.id === selected
        const roving = enabled[focusIndex]?.id === item.id
        return (
          <button
            key={item.id}
            ref={(el) => void (refs.current[item.id] = el)}
            id={tabId(idPrefix, item.id)}
            type="button"
            role="tab"
            aria-selected={isSel}
            aria-controls={isSel ? tabPanelId(idPrefix, item.id) : undefined}
            aria-keyshortcuts={item.kbd}
            tabIndex={roving ? 0 : -1}
            disabled={item.disabled}
            className={`tab${isSel ? ' is-selected' : ''}`}
            data-tut={`tab-${item.id}`}
            onClick={() => onSelect(isSel && collapsible ? null : item.id)}
            onKeyDown={(e) => onKey(e, item.id)}
          >
            {item.icon ? <Icon name={item.icon} size={24} className="tab-icon" /> : null}
            <span className="tab-label">{item.label}</span>
            {item.kbd ? (
              <kbd className="tab-kbd" aria-hidden="true">
                {item.kbd}
              </kbd>
            ) : null}
            {item.badge != null ? <span className="tab-badge num">{item.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
