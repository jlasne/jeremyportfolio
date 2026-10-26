// PLACEHOLDER (UI shell track). The map track replaces this file wholesale with the PixiJS map.
// Contract: default export, no props; it fills `.map-area` (position: relative, full size).
// Stores: useGame (state, meId, last for resolution effects), useDraft (decision.builds,
// decision.upgrades, toggleUpgrade, addBuild/moveBuild for drag placement), useUi (selected,
// select, drag). The real map also exports `mapApi` (DESIGN.md section 6).
// This version draws the plot as a plain grid of lots with building cards, the links as a strip,
// and a building card for the selected building, so the game is fully playable without art.

import { useMemo } from 'react'
import { capacity, companyById, plotRows, upgradeCost } from '../engine'
import type { Building, LinkUse, Tile } from '../engine'
import { useDraft } from '../store/draft'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { Button, Icon, IconButton, KIND_META, LINK_META, Mw, fmtMoney, fmtPct } from '../ui/kit'

const key = (t: Tile) => `${t[0]},${t[1]}`

export default function CompanyMap() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const phase = useGame((s) => s.phase)
  const decision = useDraft((s) => s.decision)
  const toggleUpgrade = useDraft((s) => s.toggleUpgrade)
  const selected = useUi((s) => s.selected)
  const select = useUi((s) => s.select)

  const me = state && meId ? companyById(state, meId) : null
  const pendingTiles = useMemo(() => decision.builds.filter((b) => b.kind !== 'link' && b.tile).map((b) => b.tile as Tile), [decision.builds])
  if (!state || !me) return null

  const cols = config.plot.lotsPerRow
  const rows = plotRows(me, pendingTiles, config)
  const byTile = new Map(me.buildings.map((b) => [key(b.tile), b]))
  const pendingByTile = new Map(decision.builds.flatMap((b, i) => (b.kind !== 'link' && b.tile ? [[key(b.tile), { order: b, index: i }] as const] : [])))
  const cap = capacity(me)
  const pendingLinks: Record<LinkUse, number> = { internal: 0, town: 0, import: 0 }
  for (const b of decision.builds) if (b.kind === 'link' && b.use) pendingLinks[b.use] += b.mw ?? 0
  const last = me.history[me.history.length - 1]
  const sel = selected ? me.buildings.find((b) => b.id === selected) ?? null : null

  const lots = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t: Tile = [c, r]
      const b = byTile.get(key(t))
      const p = pendingByTile.get(key(t))
      if (b) lots.push(<BuildingLot key={key(t)} b={b} upgrading={decision.upgrades.includes(b.id)} selected={selected === b.id} onSelect={() => select(selected === b.id ? null : b.id)} />)
      else if (p)
        lots.push(
          <div key={key(t)} className="lot lot-pending" style={{ ['--hue' as string]: KIND_META[p.order.kind as 'plant' | 'dc'].hue }}>
            <Icon name="crane" size={32} />
            <span className="lot-name">
              {p.order.size === 'big' ? 'Big' : 'Small'} {KIND_META[p.order.kind as 'plant' | 'dc'].label.toLowerCase()}
            </span>
            <span className="lot-meta">Ordered this round</span>
          </div>,
        )
      else
        lots.push(
          <div key={key(t)} className="lot lot-empty" aria-label={`Empty lot ${c + 1}, row ${r + 1}`}>
            <span className="lot-meta">Free lot</span>
          </div>,
        )
    }
  }

  return (
    <div className="pmap">
      <div className="pmap-inner">
        <ul className="pmap-links" aria-label="Grid links">
          {(Object.keys(LINK_META) as LinkUse[]).map((use) => (
            <li key={use} className={`pmap-link${cap.links[use] > 0 ? '' : ' is-none'}`}>
              <Icon name={LINK_META[use].icon} size={16} />
              <span>{LINK_META[use].label}</span>
              <Mw value={cap.links[use]} className="strong" />
              {pendingLinks[use] > 0 ? <span className="pmap-pending num">+{pendingLinks[use]} next round</span> : null}
              {me.links.some((l) => l.use === use && l.roundsLeft > 0) ? <span className="pmap-pending">building</span> : null}
            </li>
          ))}
        </ul>
        <div className="pmap-plot" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="list" aria-label="Company plot">
          {lots}
        </div>
        {last ? (
          <p className="pmap-foot muted">
            Last round: plants used <Mw value={last.plantUsed} /> of <Mw value={last.plantMw} />, datacenters <Mw value={last.dcUsed} /> of <Mw value={last.dcMw} />, idle {fmtPct(last.idle)}.
          </p>
        ) : (
          <p className="pmap-foot muted">Tap a building for its card. Open Build to add plants, datacenters and links.</p>
        )}
      </div>

      {sel ? (
        <aside className="bcard" aria-label="Building card">
          <header className="bcard-head">
            <h3>
              <Icon name={KIND_META[sel.kind].icon} size={24} /> {sel.size === 'big' ? 'Big' : 'Small'} {KIND_META[sel.kind].label.toLowerCase()}
            </h3>
            <IconButton icon="close" label="Close building card" size="sm" onClick={() => select(null)} />
          </header>
          <dl className="facts">
            <div>
              <dt>Output</dt>
              <dd>
                <Mw value={sel.mw} />
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{statusText(sel)}</dd>
            </div>
            <div>
              <dt>Price paid</dt>
              <dd className="num">{fmtMoney(sel.pricePaid)}</dd>
            </div>
            <div>
              <dt>Maintenance</dt>
              <dd className="num">{fmtMoney(sel.pricePaid * config.maintenanceRate)} / round</dd>
            </div>
            {last ? (
              <div>
                <dt>{sel.kind === 'plant' ? 'Plants used' : 'Datacenters used'}</dt>
                <dd>
                  <Mw value={sel.kind === 'plant' ? last.plantUsed : last.dcUsed} /> of <Mw value={sel.kind === 'plant' ? last.plantMw : last.dcMw} />
                </dd>
              </div>
            ) : null}
          </dl>
          {sel.size === 'small' && sel.status === 'online' ? (
            <Button
              variant={decision.upgrades.includes(sel.id) ? 'secondary' : 'primary'}
              icon={decision.upgrades.includes(sel.id) ? 'undo' : 'arrowUp'}
              block
              disabled={phase !== 'decide'}
              onClick={() => toggleUpgrade(sel.id)}
            >
              {decision.upgrades.includes(sel.id) ? 'Cancel upgrade' : `Upgrade to big · ${fmtMoney(upgradeCost(sel, config))}`}
            </Button>
          ) : null}
        </aside>
      ) : null}
    </div>
  )
}

function statusText(b: Building): string {
  if (b.status === 'building') return `Building, online in ${b.roundsLeft} round${b.roundsLeft === 1 ? '' : 's'}`
  if (b.status === 'upgrading') return `Upgrading, big in ${b.roundsLeft} round${b.roundsLeft === 1 ? '' : 's'}`
  return 'Online'
}

function BuildingLot({ b, upgrading, selected, onSelect }: { b: Building; upgrading: boolean; selected: boolean; onSelect: () => void }) {
  const meta = KIND_META[b.kind]
  return (
    <button
      type="button"
      role="listitem"
      className={`lot lot-building lot-${b.kind}${selected ? ' is-selected' : ''}${b.status !== 'online' ? ' is-busy' : ''}`}
      style={{ ['--hue' as string]: meta.hue }}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <Icon name={b.status === 'online' ? meta.icon : 'crane'} size={32} />
      <span className="lot-name">
        {b.size === 'big' ? 'Big' : 'Small'} {meta.label.toLowerCase()}
      </span>
      <span className="lot-meta num">
        {b.status === 'online' ? `${b.mw} MW` : `${b.mw} MW · ${b.roundsLeft} left`}
        {upgrading ? ' · upgrade ordered' : ''}
      </span>
    </button>
  )
}
