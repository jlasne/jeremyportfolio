// The game screen: top bar, chips, the company map, the panel dock, and the overlay slots
// (round results, tutorial). The map is home: Finance and Build open as a sheet over it, Allocate
// and Market as a full-screen terminal that hides it (still mounted, inert) until closed.

import { useGame } from '../../store/game'
import CompanyMap from '../../map/CompanyMap'
import ResultsOverlay from '../results/ResultsOverlay'
import Tutorial from '../tutorial/Tutorial'
import { ChipsRow } from './ChipsRow'
import { PanelDock, useTerminalOpen } from './PanelDock'
import { TopBar } from './TopBar'
import { useGameKeys } from './useGameKeys'

export function GameScreen() {
  const phase = useGame((s) => s.phase)
  const hasLast = useGame((s) => s.last != null)
  const covered = useTerminalOpen()
  useGameKeys()

  const showResults = phase === 'results' && hasLast
  return (
    <div className="game" data-phase={phase}>
      <div className="game-chrome" inert={showResults || undefined}>
        <TopBar />
        <ChipsRow />
      </div>
      <div className="game-main" inert={showResults || undefined}>
        <main className={`map-area${covered ? ' is-covered' : ''}`} aria-label="Company map" inert={covered || undefined} aria-hidden={covered || undefined}>
          <CompanyMap />
        </main>
        <PanelDock />
      </div>
      {showResults ? <ResultsOverlay /> : null}
      <Tutorial />
    </div>
  )
}
