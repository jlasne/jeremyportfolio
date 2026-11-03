// The panel dock: a tab rail (right edge on desktop, bottom bar on phones) and what opens from it.
// Finance and Build open as a sheet over the map; Allocate and Market open as a full-screen
// terminal that covers the map area (the map is only on screen for building). In a losing round
// the forced sale replaces the panels until confirmed.
//
// Keyboard: arrows move along the rail; Tab past the last control of a panel moves into the next
// panel (Shift+Tab before the first goes back); keys 1-4 and Esc are handled in useGameKeys.
// Opening a terminal moves focus to its title, except while arrowing along the rail.

import { useEffect, useRef } from 'react'
import type { ComponentType, KeyboardEvent } from 'react'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { selectLosingRound } from '../../store/selectors'
import { PANELS, isTerminal, useUi } from '../../store/ui'
import type { PanelId } from '../../store/ui'
import { Sheet, Tabs, tabId, tabPanelId } from '../kit'
import type { IconName, TabItem } from '../kit'
import AllocatePanel from '../panels/AllocatePanel'
import BuildPanel from '../panels/BuildPanel'
import FinancePanel from '../panels/FinancePanel'
import MarketPanel from '../panels/MarketPanel'
import ForcedSale from '../results/ForcedSale'
import { Terminal } from '../terminal/Terminal'

export const DOCK_ID = 'dock'

export const PANEL_INFO: Record<PanelId, { label: string; icon: IconName }> = {
  finance: { label: 'Finance', icon: 'coin' },
  build: { label: 'Build', icon: 'crane' },
  allocate: { label: 'Allocate', icon: 'sliders' },
  market: { label: 'Market', icon: 'chart' },
}

const CONTENT: Record<PanelId, ComponentType> = {
  finance: FinancePanel,
  build: BuildPanel,
  allocate: AllocatePanel,
  market: MarketPanel,
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/** Elements Tab actually stops on, in DOM order (skips tabindex -1 and hidden ones). */
function tabbable(root: Element | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0 && el.offsetParent !== null)
}

/** Where focus should land after the panel changes: set by keyboard moves, consumed by the dock. */
let pendingFocus: 'first' | 'last' | 'heading' | null = null
export function focusPanelOnOpen(where: 'first' | 'last' | 'heading'): void {
  pendingFocus = where
}
/** Time of the last arrow key on the rail (automatic tab activation): focus then stays on the tab. */
let railArrowAt = -Infinity

const TERMINAL_SUB: Partial<Record<PanelId, string>> = {
  allocate: 'Plant power to your datacenters, citizens and other datacenters; datacenter MW to cloud, bitcoin and AI.',
  market: 'Every company and every pool: who offered what, who got served, and how full each pool is.',
}

/** True while a terminal covers the map (the map is then hidden and inert). */
export function useTerminalOpen(): boolean {
  const panel = useUi((s) => s.panel)
  const losing = useGame(selectLosingRound)
  const confirmed = useUi((s) => s.forcedSaleConfirmed)
  const phase = useGame((s) => s.phase)
  return isTerminal(panel) && !(losing && !confirmed && phase === 'decide')
}

export function PanelDock() {
  const panel = useUi((s) => s.panel)
  const open = useUi((s) => s.open)
  const close = useUi((s) => s.close)
  const losing = useGame(selectLosingRound)
  const confirmed = useUi((s) => s.forcedSaleConfirmed)
  const phase = useGame((s) => s.phase)
  const builds = useDraft((s) => s.decision.builds.length + s.decision.upgrades.length)
  const sheetRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const forced = losing && !confirmed && phase === 'decide'
  const locked = forced || phase !== 'decide'

  useEffect(() => {
    let where = pendingFocus
    pendingFocus = null
    const arrowing = performance.now() - railArrowAt < 600
    railArrowAt = -Infinity
    if (!where && !arrowing && !forced && isTerminal(panel)) where = 'heading'
    if (!where || !sheetRef.current) return
    if (where === 'heading') return headingRef.current?.focus({ preventScroll: true })
    const list = tabbable(sheetRef.current.querySelector('.sheet-body, .term-body'))
    const el = where === 'first' ? list[0] : list[list.length - 1]
    ;(el ?? headingRef.current)?.focus()
  }, [panel, forced])

  const items: TabItem<PanelId>[] = PANELS.map((id, i) => ({
    id,
    label: PANEL_INFO[id].label,
    icon: PANEL_INFO[id].icon,
    kbd: String(i + 1),
    disabled: forced,
    badge: id === 'build' && builds > 0 ? builds : undefined,
  }))

  const onSheetKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab' || !panel || !sheetRef.current) return
    const list = tabbable(sheetRef.current)
    if (list.length === 0) return
    const i = PANELS.indexOf(panel)
    const atEnd = document.activeElement === list[list.length - 1]
    const atStart = document.activeElement === list[0] || document.activeElement === headingRef.current
    if (!e.shiftKey && atEnd && i < PANELS.length - 1) {
      e.preventDefault()
      focusPanelOnOpen('first')
      open(PANELS[i + 1])
    } else if (e.shiftKey && atStart && i > 0) {
      e.preventDefault()
      focusPanelOnOpen('last')
      open(PANELS[i - 1])
    }
  }

  const Content = panel ? CONTENT[panel] : null
  const term = !forced && isTerminal(panel)
  const closeAndReturn = (p: PanelId) => {
    close()
    document.getElementById(tabId(DOCK_ID, p))?.focus()
  }

  return (
    <div className={`dock${(panel && !term) || forced ? ' has-sheet' : ''}${term ? ' has-term' : ''}`}>
      {forced ? (
        <Sheet ref={sheetRef} headingRef={headingRef} className="sheet-forced" title="Losing round" icon="warn" locked onClose={() => {}} aria-label="Losing round">
          <ForcedSale />
        </Sheet>
      ) : panel && Content && term ? (
        <Terminal
          key={panel}
          ref={sheetRef}
          headingRef={headingRef}
          id={tabPanelId(DOCK_ID, panel)}
          role="tabpanel"
          aria-labelledby={tabId(DOCK_ID, panel)}
          title={PANEL_INFO[panel].label}
          icon={PANEL_INFO[panel].icon}
          sub={TERMINAL_SUB[panel]}
          onClose={() => closeAndReturn(panel)}
          onKeyDown={onSheetKey}
          className={`term-${panel}${locked ? ' is-locked' : ''}`}
        >
          <Content />
        </Terminal>
      ) : panel && Content ? (
        <Sheet
          key={panel}
          ref={sheetRef}
          headingRef={headingRef}
          id={tabPanelId(DOCK_ID, panel)}
          role="tabpanel"
          aria-labelledby={tabId(DOCK_ID, panel)}
          title={PANEL_INFO[panel].label}
          icon={PANEL_INFO[panel].icon}
          onClose={() => closeAndReturn(panel)}
          onKeyDown={onSheetKey}
          className={locked ? 'is-locked' : undefined}
        >
          <Content />
        </Sheet>
      ) : null}
      <nav
        className="rail"
        aria-label="Decision panels"
        onKeyDownCapture={(e) => {
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) railArrowAt = performance.now()
        }}
      >
        <Tabs label="Decision panels" idPrefix={DOCK_ID} items={items} selected={forced ? null : panel} onSelect={(id) => (id ? open(id) : close())} orientation="vertical" collapsible className="rail-tabs" />
      </nav>
    </div>
  )
}
