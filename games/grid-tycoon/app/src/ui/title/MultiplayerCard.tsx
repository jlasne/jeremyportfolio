// PLACEHOLDER (UI shell track). The multiplayer track replaces this file wholesale.
// Contract: default export, no props. Rendered inside the title screen's `.title-cards` grid, so
// use the `card` class to match its neighbours. Stores: none yet; the real card is expected to
// read src/net isOnline(), create/join rooms, and call useGame.getState().goToLobby().
// Invite links arrive as ?room=ABCDEF (DESIGN.md section 1).

import { Button, Icon } from '../kit'

export default function MultiplayerCard() {
  return (
    <section className="card card-multi" aria-labelledby="multi-title">
      <h2 id="multi-title" className="card-title">
        <Icon name="rivals" size={24} /> Multiplayer
      </h2>
      <p className="card-desc">2 to 6 players on one shared market, 3 minutes per round.</p>
      <div className="multi-actions">
        <Button icon="plus" disabled block>
          Host
        </Button>
        <Button icon="play" disabled block>
          Join
        </Button>
      </div>
      <p className="field-desc">
        <Icon name="info" size={16} className="inline-icon" /> Multiplayer is offline for now.
      </p>
    </section>
  )
}
