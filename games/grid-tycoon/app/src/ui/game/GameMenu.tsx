// The top bar's menu: Settings and Quit to title. A small ARIA menu button: arrows move, Esc
// closes and returns focus, a click outside closes.

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Icon, IconButton } from '../kit'
import type { IconName } from '../kit'

interface Item {
  id: string
  label: string
  icon: IconName
  hint?: string
  run: () => void
}

export function GameMenu() {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const mode = useGame((s) => s.mode)
  const quit = useGame((s) => s.quitToTitle)
  const openSettings = useUi((s) => s.setSettingsOpen)

  const entries: Item[] = [
    { id: 'settings', label: 'Settings', icon: 'gear', run: () => openSettings(true) },
    { id: 'quit', label: 'Quit to title', icon: 'close', hint: mode === 'solo' ? 'Your game is saved' : undefined, run: quit },
  ]

  useEffect(() => {
    if (!open) return
    items.current[0]?.focus()
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const close = (focusButton = true) => {
    setOpen(false)
    if (focusButton) button.current?.focus()
  }

  const onKey = (e: KeyboardEvent) => {
    const list = items.current.filter(Boolean) as HTMLButtonElement[]
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[(i + 1) % list.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      list[(i - 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') close(false)
  }

  return (
    <div className="menu-wrap">
      <IconButton
        ref={button}
        icon="menu"
        label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'game-menu' : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      />
      {open ? (
        <div ref={menu} id="game-menu" className="menu" role="menu" aria-label="Game menu" onKeyDown={onKey}>
          {entries.map((it, i) => (
            <button
              key={it.id}
              ref={(el) => void (items.current[i] = el)}
              type="button"
              role="menuitem"
              className="menu-item"
              tabIndex={-1}
              onClick={() => {
                close(it.id !== 'settings')
                it.run()
              }}
            >
              <Icon name={it.icon} size={16} />
              <span className="menu-item-text">
                <span>{it.label}</span>
                {it.hint ? <span className="menu-item-hint">{it.hint}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
