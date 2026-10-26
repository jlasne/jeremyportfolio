// The game screen: top bar, chips, the company map, the panel dock, and the overlay slots
// (round results, tutorial). The map is home; every decision opens as a panel over it.

import { useGame } from '../../store/game'
import CompanyMap from '../../map/CompanyMap'
import ResultsOverlay from '../results/ResultsOverlay'
import Tutorial from '../tutorial/Tutorial'
import { ChipsRow } from './ChipsRow'
import { PanelDock } from './PanelDock'
import { TopBar } from './TopBar'
import { useGameKeys } from './useGameKeys'

export function GameScreen() {
  const phase = useGame((s) => s.phase)
  const hasLast = useGame((s) => s.last != null)
  useGameKeys()

  const showResults = phase === 'results' && hasLast
  return (
    <div className="game" data-phase={phase}>
      <div className="game-chrome" inert={showResults || undefined}>
        <TopBar />
        <ChipsRow />
      </div>
      <div className="game-main" inert={showResults || undefined}>
        <main className="map-area" aria-label="Company map">
          <CompanyMap />
        </main>
        <PanelDock />
      </div>
      {showResults ? <ResultsOverlay /> : null}
      <Tutorial />
    </div>
  )
}
