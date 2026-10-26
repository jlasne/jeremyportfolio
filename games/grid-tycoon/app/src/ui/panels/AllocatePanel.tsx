// Allocate panel (SPEC "Screens and interactions": one stacked slider per building type, segments
// draggable, live margin per segment, snap to 1 MW). Power splits plant MW between my
// datacenters (internal link), citizens (town link), other datacenters and idle. Compute splits
// powered datacenter MW between cloud, bitcoin, AI and idle. Rent adds powered MW through the
// import link. Every change is one draft step (undoable); lowering the power that reaches the
// datacenters trims compute in the same step (cheapest margin first) so the draft stays valid.

import { useMemo } from 'react'
import type { ComputePool, Decision, WarningCode } from '../../engine'
import { useDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { Chip, Icon, Money, NumberTween, POOL_META, Panel, fmtMoney, fmtMw, fmtPct } from '../kit'
import { Note, usePanelCtx } from './common'
import { PanelStepper } from './PanelStepper'
import { StackedSlider } from './StackedSlider'
import type { SliderSegment } from './StackedSlider'

const ALLOC_WARNINGS: WarningCode[] = ['idle_high', 'link_short', 'no_town_link', 'rent_over_import', 'compute_unpowered']
/** When powered MW drops, compute gives way in this order: lowest margin first. */
const TRIM_ORDER: ComputePool[] = ['btc', 'cloud', 'ai']
const COMPUTE_ORDER: ComputePool[] = ['cloud', 'btc', 'ai']

/** Shrinks compute to fit `powered`, lowest-margin pool first. Mutates the draft copy. */
function fitCompute(d: Decision, dcMw: number) {
  const powered = Math.min(dcMw, d.power.internal + d.rentMw)
  let over = d.compute.cloud + d.compute.btc + d.compute.ai - powered
  for (const p of TRIM_ORDER) {
    if (over <= 1e-6) break
    const cut = Math.min(d.compute[p], over)
    d.compute[p] = Math.round((d.compute[p] - cut) * 100) / 100
    over -= cut
  }
}

export default function AllocatePanel() {
  const ctx = usePanelCtx()
  const d = useDraft((s) => s.decision)
  const setDraft = useDraft((s) => s.set)
  const { preview, projection, warnings } = useDerived()
  const relevant = useMemo(() => warnings.filter((w) => ALLOC_WARNINGS.includes(w.code)), [warnings])
  if (!ctx) return null
  const { config, disabled } = ctx

  const links = preview.links
  const m = projection.marginPerMw
  const used = projection.usedByPool
  const rev = projection.revenueByPool
  const powered = Math.min(preview.dcMw, d.power.internal + d.rentMw)
  const computeTotal = d.compute.cloud + d.compute.btc + d.compute.ai
  const rentCost = projection.costs.rent
  const rentPerMw = d.rentMw > 0 ? rentCost / d.rentMw : config.cost.rentMarket

  const usedLine = (pool: keyof typeof used, offered: number) =>
    offered > 0 ? `≈ ${fmtMw(used[pool], { unit: false })} used · ${fmtMoney(rev[pool], { sign: true })}` : 'nothing offered'

  // ---- Power ----
  const powerSegs: SliderSegment[] = [
    {
      key: 'internal',
      label: 'To my datacenters',
      icon: 'dc',
      color: 'var(--dc-light)',
      value: d.power.internal,
      cap: links.internal,
      capLabel: `internal ${fmtMw(links.internal, { unit: false })}`,
      capReason:
        links.internal > 0
          ? `The internal link carries ${fmtMw(links.internal)}: add internal link MW in Build to send more.`
          : 'You have no internal link: buy one in Build to power your datacenters.',
      lockedReason: links.internal <= 0 ? 'Needs an internal link (Build)' : undefined,
      detail: (
        <>
          <span className="num">link {fmtMw(links.internal)}</span> · feeds compute below
        </>
      ),
      valueText: `internal link ${fmtMw(links.internal)}`,
    },
    {
      key: 'town',
      label: 'To citizens',
      icon: POOL_META.citizens.icon,
      color: POOL_META.citizens.hue,
      value: d.power.town,
      cap: links.town,
      capLabel: `town ${fmtMw(links.town, { unit: false })}`,
      capReason: `The town link carries ${fmtMw(links.town)}: add town link MW in Build to sell more to citizens.`,
      lockedReason: links.town <= 0 ? 'Needs a town link (Build)' : undefined,
      detail: (
        <>
          <span className="num">{fmtMoney(m.citizens, { sign: true })}/MW</span> · <span className="num">{usedLine('citizens', d.power.town)}</span>
        </>
      ),
      valueText: `${fmtMoney(m.citizens, { sign: true })} per MW, about ${fmtMw(used.citizens)} used`,
    },
    {
      key: 'otherDc',
      label: 'To other datacenters',
      icon: POOL_META.otherDc.icon,
      color: POOL_META.otherDc.hue,
      ink: 'var(--cream-light)',
      value: d.power.otherDc,
      detail: (
        <>
          <span className="num">{fmtMoney(m.otherDc, { sign: true })}/MW</span> · <span className="num">{usedLine('otherDc', d.power.otherDc)}</span>
        </>
      ),
      valueText: `${fmtMoney(m.otherDc, { sign: true })} per MW, about ${fmtMw(used.otherDc)} used, no link needed`,
    },
  ]

  const onPower = (v: Record<string, number>, key: string) =>
    setDraft((dd) => {
      dd.power.internal = v.internal
      dd.power.town = v.town
      dd.power.otherDc = v.otherDc
      fitCompute(dd, preview.dcMw)
    }, `alloc.power.${key}`)

  // ---- Compute ----
  const computeSegs: SliderSegment[] = COMPUTE_ORDER.map((p) => ({
    key: p,
    label: POOL_META[p].short,
    icon: POOL_META[p].icon,
    color: POOL_META[p].hue,
    ink: p === 'ai' ? 'var(--cream-light)' : 'var(--ink-dark)',
    value: d.compute[p],
    detail: (
      <>
        <span className="num">{fmtMoney(m[p], { sign: true })}/MW</span> · <span className="num">{usedLine(p, d.compute[p])}</span>
      </>
    ),
    valueText: `${fmtMoney(m[p], { sign: true })} per MW, about ${fmtMw(used[p])} used`,
  }))

  const onCompute = (v: Record<string, number>, key: string) =>
    setDraft((dd) => {
      dd.compute.cloud = v.cloud
      dd.compute.btc = v.btc
      dd.compute.ai = v.ai
    }, `alloc.compute.${key}`)

  const onRent = (mw: number) =>
    setDraft((dd) => {
      dd.rentMw = Math.max(0, mw)
      fitCompute(dd, preview.dcMw)
    }, 'alloc.rent')

  const unpowered = Math.max(0, preview.dcMw - powered)
  const powerIdle = Math.max(0, preview.plantMw - d.power.internal - d.power.town - d.power.otherDc)
  const wasted = Math.max(0, d.power.internal + d.rentMw - preview.dcMw)

  return (
    <div className="panel-stack alloc-panel">
      <div className="alloc-summary" role="group" aria-label="Projection for next round">
        <div className="alloc-summary-main">
          <span className="alloc-summary-label">Next round ≈</span>
          <NumberTween value={projection.profit} format={(v) => fmtMoney(v, { sign: true })} className={`pixel num alloc-profit ${projection.profit >= 0 ? 'is-up' : 'is-down'}`} />
          <span className="muted">profit</span>
        </div>
        <div className="alloc-summary-sub">
          <span>
            revenue <Money value={projection.revenue} tween />
          </span>
          <span>
            idle <NumberTween value={projection.idle} format={(v) => fmtPct(v)} className="num" />
          </span>
          <span className="muted">from last round's demand</span>
        </div>
      </div>

      {relevant.length > 0 ? (
        <div className="row-gap" role="list" aria-label="Allocation warnings">
          {relevant.map((w) => (
            <span role="listitem" key={w.code} className="chip-wrap">
              <Chip level={w.level} label={w.label} detail={w.detail} />
              <span className="chip-detail">{w.detail}</span>
            </span>
          ))}
        </div>
      ) : null}

      <Panel
        title="Power"
        icon="plant"
        tone="plant"
        aside={
          <span className="num muted">
            {fmtMw(preview.plantMw - powerIdle)} of {fmtMw(preview.plantMw)}
          </span>
        }
      >
        <StackedSlider
          label="Power"
          total={preview.plantMw}
          segments={powerSegs}
          idleLabel="Idle"
          idleDetail={powerIdle > 0 ? 'earns nothing, counts as idle capacity' : 'every plant MW has a use'}
          onChange={onPower}
          disabled={disabled}
          emptyText="No plant is online yet. Build one in the Build panel."
        />
      </Panel>

      <Panel
        title="Compute"
        icon="dc"
        tone="dc"
        data-tut="allocate-compute"
        aside={
          <span className="num muted">
            {fmtMw(computeTotal)} of {fmtMw(powered)} powered
          </span>
        }
      >
        <StackedSlider
          label="Compute"
          total={preview.dcMw}
          allocatable={powered}
          unavailableLabel="No power"
          unavailableReason={`Only ${fmtMw(powered)} of power reaches your datacenters: send more power to them above, or rent some below.`}
          segments={computeSegs}
          idleLabel="Idle"
          idleDetail={powered - computeTotal > 0.005 ? 'powered but not sold' : 'all powered MW offered'}
          onChange={onCompute}
          disabled={disabled}
          emptyText="No datacenter is online yet. Build one in the Build panel."
        />
        {unpowered > 0.005 && preview.dcMw > 0 ? (
          <Note level="info" icon="bolt">
            <span className="num">{fmtMw(unpowered)}</span> of datacenter capacity has no power: raise “To my datacenters” or rent MW.
          </Note>
        ) : null}
        {wasted > 0.005 ? (
          <Note level="warn">
            <span className="num">{fmtMw(wasted)}</span> of power sent to your datacenters has no rack to use it.
          </Note>
        ) : null}
      </Panel>

      <Panel title="Rent power" icon="bolt" tone="power" aside={<span className="num muted">import link {fmtMw(links.import)}</span>}>
        <PanelStepper
          label="Rented MW"
          value={d.rentMw}
          onChange={onRent}
          max={Math.max(links.import, d.rentMw)}
          step={1}
          unit="MW"
          disabled={disabled || (links.import <= 0 && d.rentMw <= 0)}
          hint={
            links.import > 0
              ? `Raises the power your datacenters get, up to the import link. Paid on every MW asked: ${fmtMoney(config.cost.rentRival)} from rivals first, ${fmtMoney(config.cost.rentMarket)} from the market.`
              : 'Needs an import link: buy import link MW in Build (ready next round).'
          }
        />
        <div className="rent-cost">
          <Icon name="coin" size={16} />
          <span>
            Costs ≈ <Money value={rentCost} tween /> a round
            {d.rentMw > 0 ? (
              <span className="muted num">
                {' '}
                ({fmtMoney(rentPerMw)}/MW)
              </span>
            ) : null}
          </span>
        </div>
        {d.rentMw > 0 ? (
          <p className="field-desc">
            On rented power AI keeps <span className="num">{fmtMoney(config.rate.ai - rentPerMw, { sign: true })}</span>/MW, cloud{' '}
            <span className="num">{fmtMoney(config.rate.cloud - rentPerMw, { sign: true })}</span>, bitcoin{' '}
            <span className="num">{fmtMoney(config.rate.btc - rentPerMw, { sign: true })}</span>.
          </p>
        ) : null}
      </Panel>
    </div>
  )
}
