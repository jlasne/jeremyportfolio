// Build panel (SPEC "Screens and interactions"): building cards with their pixel sprite, cost, MW,
// build time and upkeep; drag a card onto a free lot of the map, or tap / click / Enter it to
// place it (the map track implements both behind src/map/drag.ts). Upgrades of small online
// buildings, the three grid links with a "+MW" order each, and this round's orders with their
// cost, a remove button and the total. Every change goes through the draft store (undoable).

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { buildCost, capacity, upgradeCost } from '../../engine'
import type { BuildOrder, Building, BuildingKind, LinkUse, Size } from '../../engine'
import { startBuildDrag, startBuildPlacement } from '../../map/drag'
import { useDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { useUi } from '../../store/ui'
import { Icon, IconButton, KIND_META, LINK_META, Mw, NumberTween, Panel, Toggle, fmtMoney, fmtMw } from '../kit'
import { Note, TreasuryStrip, rounds, usePanelCtx } from './common'
import { PanelStepper } from './PanelStepper'
import { Sprite } from './Sprite'

const CARDS: { kind: BuildingKind; size: Size }[] = [
  { kind: 'plant', size: 'small' },
  { kind: 'plant', size: 'big' },
  { kind: 'dc', size: 'small' },
  { kind: 'dc', size: 'big' },
]
const LINK_ROWS: { use: LinkUse; title: string; route: string }[] = [
  { use: 'internal', title: 'Internal', route: 'Plants → my datacenters' },
  { use: 'town', title: 'Town', route: 'Plants → citizens' },
  { use: 'import', title: 'Import', route: 'Rented MW → my datacenters' },
]

const sizeWord = (s: Size) => (s === 'big' ? 'Big' : 'Small')
const kindWord = (k: BuildingKind) => KIND_META[k].label.toLowerCase()

function orderName(o: BuildOrder): string {
  if (o.kind === 'link') return `${LINK_META[o.use ?? 'internal'].label} +${o.mw ?? 0} MW`
  return `${sizeWord(o.size ?? 'small')} ${kindWord(o.kind)}`
}

/** "Plant 2", numbered in the order the company owns them, so a row reads the same as the map. */
function buildingName(b: Building, all: Building[]): string {
  const same = all.filter((x) => x.kind === b.kind)
  return `${KIND_META[b.kind].label} ${same.indexOf(b) + 1}`
}

// ---------- One draggable build card ----------

interface CardProps {
  kind: BuildingKind
  size: Size
  cost: number
  mw: number
  buildRounds: number
  onlineRound: number
  upkeep: number
  ordered: number
  short: number
  disabled: boolean
}

const UPGRADES_SHOWN = 4
const DRAG_PX = 6
const TOUCH_MOVE_CANCEL = 10
const LONG_PRESS_MS = 260

function BuildCard({ kind, size, cost, mw, buildRounds, onlineRound, upkeep, ordered, short, disabled }: CardProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const suppressClick = useRef(false)
  const cleanup = useRef<(() => void) | null>(null)
  const blocked = disabled || short > 0
  const order: BuildOrder = { kind, size }
  const name = `${sizeWord(size)} ${kindWord(kind)}`
  const reasonId = `build-reason-${kind}-${size}`

  useEffect(() => () => cleanup.current?.(), [])

  // Mouse and pen: the map's drag starts on pointerdown and only turns into a drag after a few px.
  // Touch: a long press hands the press to the map (so a swipe still scrolls the sheet). A press
  // that never moved is a tap: the click handler starts tap-to-place.
  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (blocked || (e.pointerType === 'mouse' && e.button !== 0)) return
    cleanup.current?.()
    suppressClick.current = false
    const el = e.currentTarget
    const down = e.nativeEvent
    const x0 = e.clientX
    const y0 = e.clientY
    const pid = e.pointerId
    const touch = e.pointerType === 'touch'
    let armed = !touch
    let moved = false
    let timer = 0
    const stopTouchScroll = (te: TouchEvent) => {
      if (armed && te.cancelable) te.preventDefault()
    }
    const done = () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      el.removeEventListener('touchmove', stopTouchScroll)
      el.classList.remove('is-armed')
      cleanup.current = null
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0)
      if (!armed && dist > TOUCH_MOVE_CANCEL) return done() // a swipe before the long press: scroll
      if (armed && dist > DRAG_PX) {
        moved = true
        suppressClick.current = true
      }
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      const longPressTap = touch && armed && !moved
      done()
      if (longPressTap) {
        // A long press released in place: browsers often skip the click after it.
        suppressClick.current = true
        startBuildPlacement(order)
      }
    }
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId === pid) done()
    }
    if (touch) {
      el.addEventListener('touchmove', stopTouchScroll, { passive: false })
      timer = window.setTimeout(() => {
        armed = true
        el.classList.add('is-armed')
        startBuildDrag(order, down)
      }, LONG_PRESS_MS)
    } else {
      startBuildDrag(order, down)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    cleanup.current = done
  }

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (blocked) return
    startBuildPlacement(order)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Space and Enter both activate; keep Space from scrolling the sheet.
    if (e.key === ' ' && blocked) e.preventDefault()
  }

  const frame = `${kind}_${size}`
  return (
    <button
      ref={ref}
      type="button"
      className={`bcard-build bcard-${kind}${blocked ? ' is-blocked' : ''}`}
      style={{ ['--hue' as string]: KIND_META[kind].hue }}
      aria-disabled={blocked || undefined}
      aria-describedby={reasonId}
      aria-label={`${name}: ${fmtMoney(cost)}, ${mw} MW, ready in ${rounds(buildRounds)}. ${blocked ? '' : 'Press to place it on the map, or drag it onto a free lot.'}`}
      data-tut={kind === 'plant' && size === 'small' ? 'build-card-plant-small' : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={`bcard-art bcard-art-${size}`}>
        <Sprite frame={frame} size={size === 'big' ? { w: 96, h: 96 } : { w: 64, h: 64 }} fallback={<Icon name={KIND_META[kind].icon} size={32} />} />
        {ordered > 0 ? <span className="bcard-count num">×{ordered}</span> : null}
      </span>
      <span className="bcard-name">{name}</span>
      <span className="bcard-cost pixel num">{fmtMoney(cost)}</span>
      <span className="bcard-facts">
        <span>
          <Icon name="bolt" size={16} /> <span className="num">{mw} MW</span>
        </span>
        <span>
          <Icon name="crane" size={16} /> ready in <span className="num">{rounds(buildRounds)}</span>
        </span>
        <span className="muted">
          upkeep <span className="num">{fmtMoney(upkeep)}/round</span>
        </span>
      </span>
      <span id={reasonId} className={`bcard-foot${short > 0 ? ' is-short' : ''}`}>
        {disabled ? (
          'Orders are closed'
        ) : short > 0 ? (
          <>
            <Icon name="lock" size={16} /> short by <span className="num">{fmtMoney(short)}</span>
          </>
        ) : (
          <>online round {onlineRound}</>
        )}
      </span>
    </button>
  )
}

// ---------- The panel ----------

export default function BuildPanel() {
  const ctx = usePanelCtx()
  const d = useDraft((s) => s.decision)
  const setDraft = useDraft((s) => s.set)
  const removeBuild = useDraft((s) => s.removeBuild)
  const toggleUpgrade = useDraft((s) => s.toggleUpgrade)
  const placing = useUi((s) => s.drag)
  const [allUpgrades, setAllUpgrades] = useState(false)
  const { preview } = useDerived()
  if (!ctx) return null
  const { state, me, config, disabled } = ctx
  const left = preview.treasuryLeft
  const round = state.round

  const linkOrderMw = (use: LinkUse) => d.builds.filter((b) => b.kind === 'link' && b.use === use).reduce((s, b) => s + (b.mw ?? 0), 0)
  /** Sets this round's order for one link to `mw` (one entry per use; 0 removes it). */
  const setLinkMw = (use: LinkUse, mw: number) =>
    setDraft((dd) => {
      const n = Math.max(0, Math.round(mw))
      const isUse = (b: BuildOrder) => b.kind === 'link' && b.use === use
      const first = dd.builds.findIndex(isUse)
      // Only entries after `first` are dropped, so its index still holds.
      dd.builds = dd.builds.filter((b, k) => !isUse(b) || k === first)
      if (first < 0) {
        if (n > 0) dd.builds.push({ kind: 'link', use, mw: n })
      } else if (n > 0) dd.builds[first] = { kind: 'link', use, mw: n }
      else dd.builds.splice(first, 1)
    }, `link.${use}`)

  const nowCap = capacity(me)
  const earlierPending = (use: LinkUse) => me.links.filter((l) => l.use === use && l.roundsLeft > 0).reduce((s, l) => s + l.mw, 0)
  // What the internal link should carry once everything ordered is online.
  const internalNeed = Math.min(preview.pendingPlantMw, preview.pendingDcMw)
  const internalGap = Math.max(0, Math.ceil(internalNeed - preview.pendingLinks.internal))

  const upgradable = me.buildings.filter((b) => b.size === 'small' && (b.status === 'online' || b.status === 'upgrading'))
  // Ordered and upgrading ones first, then the rest; long lists fold after a few rows.
  const rank = (b: Building) => (d.upgrades.includes(b.id) ? 0 : b.status === 'upgrading' ? 1 : 2)
  const sortedUpgrades = [...upgradable].sort((a, b) => rank(a) - rank(b))
  const shownUpgrades = allUpgrades ? sortedUpgrades : sortedUpgrades.slice(0, Math.max(UPGRADES_SHOWN, upgradable.filter((b) => rank(b) < 2).length))
  const building = me.buildings.filter((b) => b.status === 'building')
  const orderCount = d.builds.length + d.upgrades.length

  return (
    <div className="panel-stack build-panel">
      <TreasuryStrip />

      <p className="panel-lead">{placing ? 'Pick a free lot on the map (Esc cancels).' : 'Drag a card onto a free lot, or press it and pick a lot. Cost leaves the treasury now.'}</p>

      <div className="bcards" role="group" aria-label="Buildings to order">
        {CARDS.map(({ kind, size }) => {
          const spec = config.buildings[kind][size]
          const cost = buildCost({ kind, size }, config)
          return (
            <BuildCard
              key={`${kind}-${size}`}
              kind={kind}
              size={size}
              cost={cost}
              mw={spec.mw}
              buildRounds={spec.rounds}
              onlineRound={round + spec.rounds}
              upkeep={Math.round(cost * config.maintenanceRate * 100) / 100}
              ordered={d.builds.filter((b) => b.kind === kind && b.size === size).length}
              short={Math.max(0, Math.round((cost - Math.max(0, left)) * 100) / 100)}
              disabled={disabled}
            />
          )
        })}
      </div>

      {building.length > 0 ? (
        <Note level="info" icon="crane">
          Under construction:{' '}
          {building
            .map((b) => `${sizeWord(b.size).toLowerCase()} ${kindWord(b.kind)} (${rounds(b.roundsLeft)} left)`)
            .join(', ')}
          .
        </Note>
      ) : null}

      <Panel title="Upgrades" icon="arrowUp" tone="plant" aside={<span className="muted num">small → big</span>}>
        {upgradable.length === 0 ? (
          <p className="muted">No small building online to upgrade.</p>
        ) : (
          <>
            <p className="field-desc">
              Plant <span className="num">{fmtMoney(config.buildings.plant.upgrade.cost)}</span>, datacenter{' '}
              <span className="num">{fmtMoney(config.buildings.dc.upgrade.cost)}</span>. Takes {rounds(config.buildings.plant.upgrade.rounds)}; it keeps
              running at <span className="num">{fmtMw(config.buildings.plant.small.mw)}</span> meanwhile, then makes{' '}
              <span className="num">{fmtMw(config.buildings.plant.big.mw)}</span>.
            </p>
            <ul className="plain-list upg-list">
              {shownUpgrades.map((b) => {
                const on = d.upgrades.includes(b.id)
                const busy = b.status === 'upgrading'
                const cost = upgradeCost(b, config)
                const short = !on && cost > left
                const name = buildingName(b, me.buildings)
                return (
                  <li key={b.id} className={`upg-row${on ? ' is-on' : ''}`}>
                    <span className="upg-icon" style={{ ['--hue' as string]: KIND_META[b.kind].hue }} aria-hidden="true">
                      <Icon name={busy ? 'crane' : KIND_META[b.kind].icon} size={16} />
                    </span>
                    <Toggle
                      label={`Upgrade ${name.toLowerCase()}`}
                      checked={on || busy}
                      onChange={() => toggleUpgrade(b.id)}
                      disabled={disabled || busy || short}
                      description={busy ? `Upgrading: big in ${rounds(b.roundsLeft)}` : short ? `${fmtMoney(cost)} · short by ${fmtMoney(cost - Math.max(0, left))}` : `${fmtMoney(cost)} · big from round ${round + config.buildings[b.kind].upgrade.rounds}`}
                    />
                  </li>
                )
              })}
            </ul>
            {upgradable.length > UPGRADES_SHOWN ? (
              <button type="button" className="link-btn" aria-expanded={allUpgrades} onClick={() => setAllUpgrades((v) => !v)}>
                {allUpgrades ? 'Show fewer' : `Show all ${upgradable.length}`}
              </button>
            ) : null}
          </>
        )}
      </Panel>

      <Panel title="Grid links" icon="link" tone="grid" aside={<span className="muted num">{fmtMoney(config.link.costPerMw)} per MW · next round</span>}>
        <ul className="plain-list link-list">
          {LINK_ROWS.map(({ use, title, route }) => {
            const cur = linkOrderMw(use)
            const earlier = earlierPending(use)
            const carrying = nowCap.links[use]
            const max = Math.max(cur, Math.floor(cur + Math.max(0, left) / config.link.costPerMw))
            return (
              <li key={use} className="link-row">
                <div className="link-head">
                  <span className="link-icon" aria-hidden="true">
                    <Icon name={LINK_META[use].icon} size={16} />
                  </span>
                  <span className="link-title">
                    <strong>{title}</strong>
                    <span className="muted">{route}</span>
                  </span>
                  <span className="link-now">
                    <Mw value={carrying} tween className="strong" />
                    <span className="muted">carrying</span>
                  </span>
                </div>
                <div className="link-controls">
                  <PanelStepper label={`${title} link: add MW`} value={cur} onChange={(v) => setLinkMw(use, v)} max={max} step={1} unit="MW" disabled={disabled} hideLabel />
                  <span className="link-pending num">
                    {earlier + cur > 0 ? (
                      <>
                        <Icon name="crane" size={16} /> +{fmtMw(earlier + cur)} next round
                      </>
                    ) : (
                      <span className="muted">no MW pending</span>
                    )}
                  </span>
                </div>
                {use === 'internal' && internalGap > 0 && !disabled ? (
                  <button type="button" className="link-btn link-match" onClick={() => setLinkMw('internal', cur + Math.min(internalGap, Math.max(0, Math.floor(left / config.link.costPerMw))))} disabled={left < config.link.costPerMw}>
                    Match my datacenters: +{internalGap} MW
                  </button>
                ) : null}
                {use === 'town' && carrying + earlier + cur === 0 ? <p className="field-desc">Needed to sell power to citizens and government.</p> : null}
                {use === 'import' && carrying + earlier + cur === 0 ? <p className="field-desc">Needed to rent power when your plants fall short.</p> : null}
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title="This round's orders" icon="lock" tone="sunken" aside={<Money0 value={preview.buildSpend} />}>
        {orderCount === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          <ul className="plain-list order-list">
            {d.builds.map((b, i) => (
              <li key={i} className="order-row">
                <Icon name={b.kind === 'link' ? 'link' : KIND_META[b.kind].icon} size={16} className="order-icon" />
                <span className="order-name">{orderName(b)}</span>
                <span className="num order-cost">{fmtMoney(buildCost(b, config))}</span>
                <IconButton icon="close" size="sm" label={`Remove ${orderName(b)}`} onClick={() => removeBuild(i)} disabled={disabled} />
              </li>
            ))}
            {d.upgrades.map((id) => {
              const b = me.buildings.find((x) => x.id === id)
              if (!b) return null
              const name = `Upgrade ${buildingName(b, me.buildings).toLowerCase()}`
              return (
                <li key={id} className="order-row">
                  <Icon name="arrowUp" size={16} className="order-icon" />
                  <span className="order-name">{name}</span>
                  <span className="num order-cost">{fmtMoney(upgradeCost(b, config))}</span>
                  <IconButton icon="close" size="sm" label={`Cancel ${name}`} onClick={() => toggleUpgrade(id)} disabled={disabled} />
                </li>
              )
            })}
            <li className="order-row order-total">
              <span />
              <span className="order-name">Total spend</span>
              <span className="num order-cost">{fmtMoney(preview.buildSpend)}</span>
              <span />
            </li>
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Money0({ value }: { value: number }) {
  return <NumberTween value={value} format={(v) => fmtMoney(v)} className="num strong" />
}
