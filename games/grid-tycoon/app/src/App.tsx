// One page, state-driven screens (no router): Title, Lobby, Game, End. Settings, theme sync and
// the live region sit above every screen.

import { useEffect } from 'react'
import { useGame } from './store/game'
import { useUi } from './store/ui'
import { GameScreen } from './ui/game/GameScreen'
import Lobby from './ui/lobby/Lobby'
import EndScreen from './ui/results/EndScreen'
import { SettingsDialog } from './ui/settings/SettingsDialog'
import { LiveRegion } from './ui/shell/LiveRegion'
import { ThemeSync } from './ui/shell/ThemeSync'
import { TitleScreen } from './ui/title/TitleScreen'

export default function App() {
  const screen = useGame((s) => s.screen)

  // Moving between screens starts focus and scroll at the top of the new one.
  useEffect(() => {
    window.scrollTo(0, 0)
    if (screen !== 'title') (document.activeElement as HTMLElement | null)?.blur?.()
    useUi.getState().setSettingsOpen(false)
  }, [screen])

  return (
    <>
      <ThemeSync />
      <div className="app" data-screen={screen}>
        {screen === 'title' ? <TitleScreen /> : null}
        {screen === 'lobby' ? <Lobby /> : null}
        {screen === 'game' ? <GameScreen /> : null}
        {screen === 'end' ? <EndScreen /> : null}
      </div>
      <SettingsDialog />
      <LiveRegion />
    </>
  )
}
