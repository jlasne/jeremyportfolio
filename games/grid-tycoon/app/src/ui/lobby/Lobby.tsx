// PLACEHOLDER (UI shell track). The multiplayer track replaces this file wholesale.
// Contract: default export, no props, rendered full screen when useGame.screen === 'lobby'.
// Stores: useGame (quitToTitle to leave; src/net calls useGame.getState().setRemote(state, meId)
// when the game starts, which switches the screen to 'game').

import { useGame } from '../../store/game'
import { Button, Icon } from '../kit'
import { Logo } from '../title/Logo'

export default function Lobby() {
  const quit = useGame((s) => s.quitToTitle)
  return (
    <div className="screen-center">
      <section className="card card-wide" aria-labelledby="lobby-title">
        <Logo size="small" />
        <h2 id="lobby-title" className="card-title">
          <Icon name="rivals" size={24} /> Waiting room
        </h2>
        <p className="card-desc">Multiplayer is offline for now. Rooms, codes and the round timer arrive with the multiplayer release.</p>
        <Button icon="close" onClick={quit}>
          Back to title
        </Button>
      </section>
    </div>
  )
}
