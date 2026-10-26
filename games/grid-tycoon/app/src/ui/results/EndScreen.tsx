// PLACEHOLDER (UI shell track). The results track replaces this file wholesale with the price
// chart, replay seed copy and share card. Contract: default export, no props; rendered full screen
// when useGame.screen === 'end'. Stores: useGame (state: finished, history, companies, seed;
// meId; startSolo({ seed }) to replay; quitToTitle).

import { rankCompanies } from '../../engine'
import { useGame } from '../../store/game'
import { Button, Icon, fmtMoney } from '../kit'
import { Logo } from '../title/Logo'

export default function EndScreen() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const startSolo = useGame((s) => s.startSolo)
  const quit = useGame((s) => s.quitToTitle)
  if (!state) return null
  const order = rankCompanies(state)
  const myRank = meId ? order.indexOf(meId) + 1 : 0
  const me = state.companies.find((c) => c.id === meId)

  return (
    <div className="screen-center">
      <section className="card card-wide" aria-labelledby="end-title">
        <Logo size="small" />
        <h2 id="end-title" className="card-title">
          <Icon name="flag" size={24} /> {myRank === 1 ? 'You win!' : `You finished #${myRank} of ${order.length}`}
        </h2>
        <ol className="rank-list">
          {order.map((id, i) => {
            const c = state.companies.find((x) => x.id === id)!
            return (
              <li key={id} className={id === meId ? 'is-me' : undefined}>
                <span className="rank-pos pixel num">#{i + 1}</span>
                <span className="rank-swatch" style={{ background: `var(--company-${c.color % 6})` }} aria-hidden="true" />
                <span className="rank-name">{c.name}</span>
                <span className="rank-price num">{fmtMoney(c.sharePrice)}</span>
              </li>
            )
          })}
        </ol>
        <p className="field-desc num">
          Seed {state.seed}
          {me ? ` · final treasury ${fmtMoney(me.treasury)}` : ''}
        </p>
        <div className="row-gap">
          <Button variant="primary" icon="play" onClick={() => startSolo({ seed: state.seed, name: me?.name })}>
            Replay this seed
          </Button>
          <Button icon="bolt" onClick={() => startSolo({ name: me?.name })}>
            New game
          </Button>
          <Button variant="ghost" icon="close" onClick={quit}>
            Title
          </Button>
        </div>
      </section>
    </div>
  )
}
