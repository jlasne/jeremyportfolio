// Game-wide shortcuts: 1-4 open panels, Esc closes the open one, Tab from nowhere enters the
// panels, Ctrl/Cmd+Z undoes a draft change, Ctrl/Cmd+Enter locks in. Typing in a field keeps its
// native keys.

import { useEffect } from 'react'
import { computeDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { selectLosingRound } from '../../store/selectors'
import { PANELS, useUi } from '../../store/ui'
import { tabId } from '../kit'
import { DOCK_ID, focusPanelOnOpen } from './PanelDock'

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useGameKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const game = useGame.getState()
      const ui = useUi.getState()
      if (game.screen !== 'game' || game.phase === 'results' || ui.settingsOpen) return
      const mod = e.ctrlKey || e.metaKey
      const typing = isTyping(e.target)
      const forced = selectLosingRound(game) && !ui.forcedSaleConfirmed

      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        useDraft.getState().undo()
        return
      }
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        if (typing) (e.target as HTMLElement).blur()
        const { state, meId, config } = useGame.getState()
        if (!state || !meId || forced) return
        const me = state.companies.find((c) => c.id === meId)
        if (me?.bankrupt || computeDerived(state, meId, useDraft.getState().decision, config).validation.ok) game.lockIn()
        return
      }
      if (mod || e.altKey) return

      if (!typing && !forced && e.key >= '1' && e.key <= String(PANELS.length)) {
        e.preventDefault()
        const p = PANELS[Number(e.key) - 1]
        if (ui.panel === p) document.querySelector<HTMLElement>('.sheet-title')?.focus()
        else {
          focusPanelOnOpen('heading')
          ui.open(p)
        }
        return
      }
      if (e.key === 'Escape' && ui.panel) {
        e.preventDefault()
        const p = ui.panel
        ui.close()
        document.getElementById(tabId(DOCK_ID, p))?.focus()
        return
      }
      if (e.key === 'Tab' && !forced && (document.activeElement === document.body || document.activeElement == null)) {
        e.preventDefault()
        const current = ui.panel ?? (e.shiftKey ? PANELS[PANELS.length - 1] : PANELS[0])
        if (ui.panel) document.querySelector<HTMLElement>('.sheet-title')?.focus()
        else {
          focusPanelOnOpen(e.shiftKey ? 'last' : 'first')
          ui.open(current)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
