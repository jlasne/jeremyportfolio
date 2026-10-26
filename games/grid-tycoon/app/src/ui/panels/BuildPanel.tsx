// PLACEHOLDER (UI shell track). The panels track replaces this file wholesale with draggable build
// cards. Contract: default export, no props; rendered inside the dock's Sheet body.
// Stores: useDraft (decision.builds/upgrades, addBuild, removeBuild, toggleUpgrade, set for link
// MW), useDerived (preview.treasuryLeft, links, pendingLinks), useGame (state, meId, config, phase).

import { buildCost, companyById, upgradeCost } from '../../engine'
import type { BuildOrder, BuildingKind, LinkUse, Size } from '../../engine'
import { useDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { Button, Icon, IconButton, KIND_META, LINK_META, Mw, Panel, Stepper, fmtMoney } from '../kit'

const CARDS: { kind: BuildingKind; size: Size }[] = [
  { kind: 'plant', size: 'small' },
  { kind: 'plant', size: 'big' },
  { kind: 'dc', size: 'small' },
  { kind: 'dc', size: 'big' },
]

function orderName(o: BuildOrder): string {
  if (o.kind === 'link') return `${LINK_META[o.use ?? 'internal'].label} +${o.mw ?? 0} MW`
  return `${o.size === 'big' ? 'Big' : 'Small'} ${KIND_META[o.kind].label.toLowerCase()}`
}

export default function BuildPanel() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const disabled = useGame((s) => s.phase !== 'decide')
  const d = useDraft((s) => s.decision)
  const addBuild = useDraft((s) => s.addBuild)
  const removeBuild = useDraft((s) => s.removeBuild)
  const toggleUpgrade = useDraft((s) => s.toggleUpgrade)
  const setDraft = useDraft((s) => s.set)
  const { preview } = useDerived()
  if (!state || !meId) return null
  const me = companyById(state, meId)
  const left = preview.treasuryLeft

  const linkOrderMw = (use: LinkUse) => d.builds.filter((b) => b.kind === 'link' && b.use === use).reduce((s, b) => s + (b.mw ?? 0), 0)
  const setLinkMw = (use: LinkUse, mw: number) =>
    setDraft((dd) => {
      dd.builds = dd.builds.filter((b) => !(b.kind === 'link' && b.use === use))
      const n = Math.max(0, Math.round(mw))
      if (n > 0) dd.builds.push({ kind: 'link', use, mw: n })
    }, `link.${use}`)

  const upgradable = me.buildings.filter((b) => b.size === 'small' && b.status === 'online')

  return (
    <div className="panel-stack">
      <p className="panel-lead">
        Treasury left <strong className="num money">{fmtMoney(left)}</strong>. Cost leaves the treasury now; buildings come online after their build time.
      </p>

      <Panel title="Buildings" icon="crane">
        <div className="build-cards">
          {CARDS.map(({ kind, size }) => {
            const spec = config.buildings[kind][size]
            const cost = buildCost({ kind, size }, config)
            const short = cost > left
            return (
              <div key={`${kind}-${size}`} className={`build-card build-${kind}`} style={{ ['--hue' as string]: KIND_META[kind].hue }}>
                <Icon name={KIND_META[kind].icon} size={32} />
                <span className="build-name">
                  {size === 'big' ? 'Big' : 'Small'} {KIND_META[kind].label.toLowerCase()}
                </span>
                <span className="build-meta num">
                  {spec.mw} MW · {spec.rounds} round{spec.rounds === 1 ? '' : 's'}
                </span>
                <Button size="sm" variant={short ? 'secondary' : 'primary'} disabled={disabled || short} onClick={() => addBuild({ kind, size })} aria-label={`Order a ${size} ${KIND_META[kind].label.toLowerCase()} for ${fmtMoney(cost)}`}>
                  <span className="num">{fmtMoney(cost)}</span>
                </Button>
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel title="Grid links" icon="link" tone="grid" aside={<span className="muted">{fmtMoney(config.link.costPerMw)} per MW, ready next round</span>}>
        {(Object.keys(LINK_META) as LinkUse[]).map((use) => {
          const cur = linkOrderMw(use)
          return (
            <div key={use} className="alloc-row">
              <Stepper
                label={`${LINK_META[use].label}: add`}
                value={cur}
                onChange={(v) => setLinkMw(use, v)}
                max={Math.max(cur, Math.floor(cur + Math.max(0, left) / config.link.costPerMw))}
                unit="MW"
                disabled={disabled}
              />
              <span className="alloc-note">
                <Icon name={LINK_META[use].icon} size={16} />
                <span className="muted">
                  now <Mw value={preview.links[use]} />
                </span>
                <span className="muted">{LINK_META[use].detail}</span>
              </span>
            </div>
          )
        })}
      </Panel>

      {upgradable.length > 0 ? (
        <Panel title="Upgrades" icon="arrowUp">
          <ul className="plain-list">
            {upgradable.map((b) => {
              const on = d.upgrades.includes(b.id)
              const cost = upgradeCost(b, config)
              return (
                <li key={b.id} className="row-between">
                  <span>
                    <Icon name={KIND_META[b.kind].icon} size={16} className="inline-icon" /> Small {KIND_META[b.kind].label.toLowerCase()} → big ({config.buildings[b.kind].upgrade.rounds} rounds)
                  </span>
                  <Button size="sm" variant={on ? 'secondary' : 'primary'} disabled={disabled || (!on && cost > left)} onClick={() => toggleUpgrade(b.id)}>
                    {on ? 'Cancel' : <span className="num">{fmtMoney(cost)}</span>}
                  </Button>
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : null}

      <Panel title="This round's orders" icon="lock" tone="sunken" aside={<strong className="num">{fmtMoney(preview.buildSpend)}</strong>}>
        {d.builds.length === 0 && d.upgrades.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          <ul className="plain-list">
            {d.builds.map((b, i) => (
              <li key={i} className="row-between">
                <span>
                  {orderName(b)} <span className="muted num">· {fmtMoney(buildCost(b, config))}</span>
                </span>
                <IconButton icon="close" size="sm" label={`Remove ${orderName(b)}`} onClick={() => removeBuild(i)} disabled={disabled} />
              </li>
            ))}
            {d.upgrades.map((id) => {
              const b = me.buildings.find((x) => x.id === id)
              return b ? (
                <li key={id} className="row-between">
                  <span>
                    Upgrade {KIND_META[b.kind].label.toLowerCase()} <span className="muted num">· {fmtMoney(upgradeCost(b, config))}</span>
                  </span>
                  <IconButton icon="close" size="sm" label="Cancel upgrade" onClick={() => toggleUpgrade(id)} disabled={disabled} />
                </li>
              ) : null
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
