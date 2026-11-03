// Allocate terminal (owner: "simple, shows more data, power, grid and compute easier to manage").
// Built as the flow it is:
//   Plants (MW)       → my datacenters (internal link, set automatically) | citizens (town link) | other datacenters
//   Datacenters (MW)  → cloud | bitcoin | AI, powered by the internal link + rented MW
// The player sets citizens, other datacenters, compute per pool and rent. The internal link MW is
// clamp(compute − rent, 0, min(internal link, plant MW − citizens − other DCs)), so plant power is
// never left on a link nobody uses. Each pool row shows rate and margin, last round's demand,
// everyone's offer, my use, the committed floor (a marker the value cannot go below) and the
// projection. Budget bars show plant MW (unallocated in red, with its penalty) and datacenter MW.
// "Fill" puts unallocated plant MW into the best-margin pool that still has room.
// Every change is one draft step (undoable) and goes through settle(), so the draft stays valid.

import { useEffect, useMemo, useRef } from 'react'
import { POOLS, commitmentFloors } from '../../engine'
import type { ComputePool, Decision, PoolId, WarningCode } from '../../engine'
import { useDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { useUi } from '../../store/ui'
import { Button, Chip, Icon, Money, NumberTween, POOL_META, fmtMoney, fmtMw, fmtPct, useReducedMotion } from '../kit'
import { BudgetBar } from '../terminal/BudgetBar'
import type { BudgetPart } from '../terminal/BudgetBar'
import { bounds, computeTotal, fill, internalMax, needsSettle, setFlow, settle, unallocated } from '../terminal/flow'
import type { FlowCaps, FlowKey } from '../terminal/flow'
import { MwSlider } from '../terminal/MwSlider'
import { Note, usePanelCtx } from './common'
import { panelForIssue } from '../game/panelFor'

/** power_unallocated has its own red callout under the plant budget bar. */
const ALLOC_WARNINGS: WarningCode[] = ['idle_high', 'link_short', 'no_town_link', 'rent_over_import', 'compute_unpowered']
const COMPUTE_ROWS: ComputePool[] = ['ai', 'cloud', 'btc']

const sumValues = (r: Record<string, number> | undefined): number => (r ? Object.values(r).reduce((s, v) => s + (v > 0 ? v : 0), 0) : 0)

interface PoolMarket {
  demand: number
  offered: number | null
  myUsed: number
  /** Offer level past which last round's demand would not use more (my use + open MW). */
  demandAt: number
}

export default function AllocatePanel() {
  const ctx = usePanelCtx()
  const d = useDraft((s) => s.decision)
  const canUndo = useDraft((s) => s.past.length > 0)
  const setDraft = useDraft((s) => s.set)
  const undo = useDraft((s) => s.undo)
  const announce = useUi((s) => s.announce)
  const tutorialStep = useUi((s) => s.tutorialStep)
  const reduced = useReducedMotion()
  const { preview, projection, warnings, validation } = useDerived()
  const state = ctx?.state
  const meId = ctx?.meId
  const config = ctx?.config

  const floors = useMemo(() => (state && meId && config ? commitmentFloors(state, meId, config) : null), [state, meId, config])
  const market = useMemo(() => {
    if (!state || !meId) return null
    const summary = state.history.at(-1)
    const out = {} as Record<PoolId, PoolMarket>
    for (const p of POOLS) {
      const s = summary?.pools[p]
      const demand = s ? s.demand : state.pools[p].demand
      const used = s ? s.used : 0
      const mine = state.pools[p].lastUsed[meId] ?? 0
      out[p] = { demand, offered: s ? sumValues(s.offered) : null, myUsed: mine, demandAt: mine + Math.max(0, demand - used) }
    }
    return out
  }, [state, meId])

  const caps: FlowCaps | null = floors ? { plantMw: preview.plantMw, dcMw: preview.dcMw, links: preview.links, floors } : null

  // The internal link is automatic: bring a draft made elsewhere (last round's defaults) in line
  // once, without an undo step.
  const fixedFor = useRef<Decision | null>(null)
  const disabled = ctx?.disabled ?? true
  useEffect(() => {
    if (!caps || disabled || fixedFor.current === d) return
    fixedFor.current = d
    if (!needsSettle(d, caps)) return
    const next = structuredClone(d)
    settle(next, caps)
    fixedFor.current = next
    useDraft.setState({ decision: next })
  })

  // Tutorial step 0 points at the AI row: scroll the terminal (only the terminal) to it.
  useEffect(() => {
    if (tutorialStep !== 0) return
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-tut="allocate-compute"]')
      const body = el?.closest<HTMLElement>('.term-body')
      if (!el || !body) return
      const r = el.getBoundingClientRect()
      const b = body.getBoundingClientRect()
      const top = body.scrollTop + r.top - b.top - Math.max(16, (b.height - r.height) / 2)
      body.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' })
    }, 260)
    return () => window.clearTimeout(t)
  }, [tutorialStep, reduced])

  const relevant = useMemo(() => warnings.filter((w) => ALLOC_WARNINGS.includes(w.code)), [warnings])
  if (!ctx || !caps || !market || !config || !floors) return null
  const { me } = ctx

  const links = preview.links
  const m = projection.marginPerMw
  const free = unallocated(d, caps)
  const penalty = projection.costs.unallocated
  const cTotal = computeTotal(d)
  const powered = Math.min(caps.dcMw, d.power.internal + d.rentMw)
  const idleDc = Math.max(0, powered - cTotal)
  const unpowered = Math.max(0, caps.dcMw - powered)
  const rentPerMw = d.rentMw > 0 ? projection.costs.rent / d.rentMw : config.cost.rentMarket
  const errors = validation.errors.filter((e) => panelForIssue(e) === 'allocate')
  const costs = projection.costs
  const costTotal = costs.power + costs.rent + costs.maintenance + costs.interest + costs.unallocated

  const change = (key: FlowKey) => (mw: number) => setDraft((dd) => setFlow(dd, caps, key, mw), `alloc.${key}`)

  const demandRoom = (p: PoolId, dd: Decision): number => {
    const offer = p === 'citizens' ? dd.power.town : p === 'otherDc' ? dd.power.otherDc : dd.compute[p]
    return Math.max(0, market[p].demandAt - offer)
  }
  const onFill = () => {
    let placed = 0
    setDraft((dd) => {
      placed = fill(dd, caps, m, demandRoom)
    }, 'alloc.fill')
    announce(placed > 0 ? `Fill placed ${fmtMw(placed)} of plant power.` : 'Nothing to place: every pool with room is full.')
  }
  const fillable = !disabled && free > 0.005

  // ---- bounds and reasons ----
  const iMax = internalMax(d, caps)
  const computeReason =
    caps.dcMw <= iMax + d.rentMw + 1e-6
      ? `Your datacenters hold ${fmtMw(caps.dcMw)}: build or upgrade one in Build to sell more compute.`
      : iMax >= links.internal - 1e-6
        ? `The internal link carries ${fmtMw(links.internal)}: add internal link MW in Build, or rent MW.`
        : 'No free plant MW for your datacenters: sell less to citizens or other datacenters, or rent MW.'
  const townB = bounds(d, caps, 'town')
  const otherB = bounds(d, caps, 'otherDc')
  const rentB = bounds(d, caps, 'rent')
  const plantFullReason = 'Every plant MW is in use: lower another pool first (committed compute cannot drop below its floor).'

  // ---- budget bars ----
  const plantParts: BudgetPart[] = [
    { key: 'internal', label: 'My datacenters', value: d.power.internal, color: 'var(--dc-light)', icon: 'dc', note: 'auto' },
    { key: 'town', label: 'Citizens', value: d.power.town, color: POOL_META.citizens.hue, icon: POOL_META.citizens.icon },
    { key: 'otherDc', label: 'Other DCs', value: d.power.otherDc, color: POOL_META.otherDc.hue, icon: POOL_META.otherDc.icon },
    {
      key: 'free',
      label: 'Unallocated',
      value: free,
      tone: 'bad',
      icon: 'critical',
      note: free > 0.005 ? <span className="num delta-down">−{fmtMoney(penalty)} penalty</span> : null,
    },
  ]
  const dcParts: BudgetPart[] = [
    ...COMPUTE_ROWS.map((p) => ({ key: p, label: POOL_META[p].short, value: d.compute[p], color: POOL_META[p].hue, icon: POOL_META[p].icon })),
    { key: 'idle', label: 'Rented, not sold', value: idleDc, tone: 'idle' as const },
    { key: 'off', label: 'Not offered', value: unpowered, tone: 'off' as const },
  ]

  return (
    <div className="aterm">
      <div className="aterm-bar" role="group" aria-label="Projection for next round">
        <div className="aterm-profit">
          <span className="aterm-k">Next round ≈</span>
          <NumberTween value={projection.profit} format={(v) => fmtMoney(v, { sign: true })} className={`pixel num aterm-profit-v ${projection.profit >= 0 ? 'is-up' : 'is-down'}`} />
          <span className="muted">profit</span>
        </div>
        <dl className="aterm-stats">
          <div>
            <dt>Revenue</dt>
            <dd>
              <Money value={projection.revenue} tween />
            </dd>
          </div>
          <div>
            <dt>Costs</dt>
            <dd className="num">−{fmtMoney(costTotal)}</dd>
          </div>
          <div className={penalty > 0.005 ? 'is-bad' : undefined}>
            <dt>Unallocated</dt>
            <dd className="num">
              {fmtMw(free)}
              {penalty > 0.005 ? <span className="delta-down"> −{fmtMoney(penalty)}</span> : null}
            </dd>
          </div>
          <div>
            <dt>Idle</dt>
            <dd className="num">{fmtPct(projection.idle)}</dd>
          </div>
        </dl>
        <div className="aterm-actions">
          <Button size="sm" icon="undo" onClick={undo} disabled={disabled || !canUndo} aria-keyshortcuts="Control+Z">
            Undo
          </Button>
          <Button
            size="sm"
            variant={fillable ? 'primary' : 'secondary'}
            icon="bolt"
            onClick={onFill}
            disabled={!fillable}
            title="Puts unallocated plant MW into the best-margin pool that still has room"
          >
            {free > 0.005 ? `Fill ${fmtMw(free)}` : 'Fill'}
          </Button>
        </div>
        <p className="aterm-from muted">From last round's demand. Rivals also bid for open MW, so real use can be lower.</p>
      </div>

      {relevant.length > 0 || errors.length > 0 ? (
        <div className="aterm-alerts">
          {errors.map((e) => (
            <Note key={`${e.code}-${e.field}`} level="critical">
              {e.message}
            </Note>
          ))}
          {relevant.length > 0 ? (
            <div className="row-gap" role="list" aria-label="Allocation warnings">
              {relevant.map((w) => (
                <span role="listitem" key={w.code}>
                  <Chip level={w.level} label={w.label} detail={w.detail} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="aterm-key" aria-hidden="true">
        <span>
          <span className="aterm-key-floor" /> committed minimum (30% drop a round at most)
        </span>
        <span>
          <span className="aterm-key-demand" /> last round's demand: more is not expected to sell
        </span>
        <span>
          <span className="aterm-key-block" /> out of reach now (link, racks or plant MW)
        </span>
      </p>

      <div className="aflow">
        {/* ---------------- Plants ---------------- */}
        <section className="panel panel-plant aflow-col" aria-labelledby="aflow-plants">
          <header className="aflow-head">
            <h3 id="aflow-plants" className="panel-title">
              <Icon name="plant" size={16} /> Plants
            </h3>
            <span className="aflow-total">
              <span className="num strong">{fmtMw(caps.plantMw)}</span> <span className="muted">online</span>
            </span>
          </header>
          {caps.plantMw <= 0 ? (
            <p className="muted">No plant is online yet. Build one in the Build panel.</p>
          ) : (
            <>
              <BudgetBar label="Plant MW" total={caps.plantMw} parts={plantParts} />
              {free > 0.005 ? (
                <div className="aflow-free">
                  <Icon name="critical" size={16} className="aflow-free-icon" />
                  <p>
                    <strong className="num">{fmtMw(free)}</strong> goes nowhere and costs <strong className="num">{fmtMoney(penalty)}</strong> this round ({config.unallocatedPenalty}× the power cost).
                  </p>
                  <Button size="sm" variant="primary" icon="bolt" onClick={onFill} disabled={!fillable}>
                    Fill
                  </Button>
                </div>
              ) : null}
            </>
          )}
          <ul className="arows">
            <li className="arow arow-auto">
              <div className="arow-head">
                <span className="arow-icon" style={{ background: 'var(--dc-light)' }} aria-hidden="true">
                  <Icon name="dc" size={16} />
                </span>
                <span className="arow-name">
                  <h4>To my datacenters</h4>
                  <span className="arow-rate">internal link, set for you</span>
                </span>
                <span className="arow-proj">
                  <Icon name="arrowUp" size={16} className="aflow-to" />
                  <span className="num strong">{fmtMw(d.power.internal)}</span>
                </span>
              </div>
              <div className="arow-auto-bar" aria-hidden="true">
                <span style={{ width: `${links.internal > 0 ? Math.min(100, (d.power.internal / links.internal) * 100) : 0}%` }} />
              </div>
              <p className="arow-auto-note">
                <span className="tag tag-plain">auto</span> compute <span className="num">{fmtMw(cTotal)}</span> − rent <span className="num">{fmtMw(d.rentMw)}</span>, within the internal link{' '}
                <span className="num">{fmtMw(links.internal)}</span>
                {links.internal <= 0 ? '. You have no internal link: buy one in Build.' : '.'}
              </p>
            </li>
            <PoolRow
              pool="citizens"
              value={d.power.town}
              min={townB.min}
              max={townB.max}
              scale={caps.plantMw}
              market={market.citizens}
              rate={config.rate.citizens}
              margin={m.citizens}
              used={projection.usedByPool.citizens}
              revenue={projection.revenueByPool.citizens}
              linkNote={links.town > 0 ? `town link ${fmtMw(links.town)}` : 'needs a town link'}
              maxReason={links.town <= 0 ? 'Selling to citizens needs a town link: buy one in Build.' : townB.max >= links.town - 1e-6 ? `The town link carries ${fmtMw(links.town)}: add town link MW in Build.` : plantFullReason}
              disabled={disabled || (links.town <= 0 && d.power.town <= 0)}
              onChange={change('town')}
            />
            <PoolRow
              pool="otherDc"
              value={d.power.otherDc}
              min={otherB.min}
              max={otherB.max}
              scale={caps.plantMw}
              market={market.otherDc}
              rate={config.rate.otherDc}
              margin={m.otherDc}
              used={projection.usedByPool.otherDc}
              revenue={projection.revenueByPool.otherDc}
              linkNote="no link needed"
              maxReason={plantFullReason}
              disabled={disabled || caps.plantMw <= 0}
              onChange={change('otherDc')}
            />
          </ul>
        </section>

        <div className="aflow-link" aria-hidden="true">
          <Icon name="arrowUp" size={16} />
          <span className="num">{fmtMw(d.power.internal)}</span>
        </div>

        {/* ---------------- Datacenters ---------------- */}
        <section className="panel panel-dc aflow-col" aria-labelledby="aflow-dcs">
          <header className="aflow-head">
            <h3 id="aflow-dcs" className="panel-title">
              <Icon name="dc" size={16} /> Datacenters
            </h3>
            <span className="aflow-total">
              <span className="num strong">{fmtMw(caps.dcMw)}</span> <span className="muted">online ·</span> <span className="num">{fmtMw(powered)}</span> <span className="muted">powered</span>
            </span>
          </header>
          {caps.dcMw <= 0 ? (
            <p className="muted">No datacenter is online yet. Build one in the Build panel.</p>
          ) : (
            <BudgetBar label="Datacenter MW" total={caps.dcMw} parts={dcParts} />
          )}
          <p className="apower">
            Powered by <span className="num strong">{fmtMw(d.power.internal)}</span> from your plants + <span className="num strong">{fmtMw(d.rentMw)}</span> rented = <span className="num strong">{fmtMw(d.power.internal + d.rentMw)}</span>
            {d.power.internal + d.rentMw > caps.dcMw + 0.005 ? <span className="delta-down"> (more than the racks hold)</span> : null}. Raising a pool takes free MW first, then the lowest-margin pool above its floor.
          </p>
          <ul className="arows">
            {COMPUTE_ROWS.map((p) => {
              const b = bounds(d, caps, p)
              const last = me.lastDecision?.compute[p] ?? 0
              return (
                <PoolRow
                  key={p}
                  tut={p === 'ai' ? 'allocate-compute' : undefined}
                  pool={p}
                  value={d.compute[p]}
                  min={b.min}
                  max={b.max}
                  scale={caps.dcMw}
                  market={market[p]}
                  rate={config.rate[p]}
                  margin={m[p]}
                  rentMargin={d.rentMw > 0 ? config.rate[p] - rentPerMw : undefined}
                  used={projection.usedByPool[p]}
                  revenue={projection.revenueByPool[p]}
                  floor={floors.compute[p]}
                  maxReason={computeReason}
                  minReason={`Committed: you offered ${fmtMw(last)} last round, so at least ${fmtMw(b.min)} this round (an offer drops ${fmtPct(config.commitment.maxDropPerRound)} a round at most).`}
                  disabled={disabled || caps.dcMw <= 0}
                  onChange={change(p)}
                />
              )
            })}
          </ul>
          <div className="arow arow-rent">
            <div className="arow-head">
              <span className="arow-icon" style={{ background: 'var(--power-mid)' }} aria-hidden="true">
                <Icon name="bolt" size={16} />
              </span>
              <span className="arow-name">
                <h4>Rent power</h4>
                <span className="arow-rate num">
                  {fmtMoney(config.cost.rentRival)} from rivals, {fmtMoney(config.cost.rentMarket)} from the market, per MW asked
                </span>
              </span>
              <span className="arow-proj">
                {projection.costs.rent > 0.005 ? <span className="num delta-down">−{fmtMoney(projection.costs.rent)}</span> : <span className="muted">no rent</span>}
              </span>
            </div>
            <MwSlider
              label="Rented MW"
              value={d.rentMw}
              min={rentB.min}
              max={rentB.max}
              scale={Math.max(links.import, caps.dcMw)}
              color="var(--power-mid)"
              maxReason={links.import <= 0 ? 'Renting needs an import link: buy one in Build (ready next round).' : `The import link carries ${fmtMw(links.import)}: add import link MW in Build.`}
              minReason={
                rentB.min > floors.rentMw + 0.005
                  ? 'Your committed compute needs this power: sell less plant power first, so your plants carry it.'
                  : `Rent is a contract: at least ${fmtMw(rentB.min)} this round (it drops ${fmtPct(config.commitment.maxDropPerRound)} a round at most).`
              }
              valueText={`costs about ${fmtMoney(projection.costs.rent)} a round`}
              disabled={disabled || (links.import <= 0 && d.rentMw <= 0)}
              onChange={change('rent')}
            />
            <dl className="arow-facts">
              <div>
                <dt>Import link</dt>
                <dd className="num">{fmtMw(links.import)}</dd>
              </div>
              <div>
                <dt>Per MW now</dt>
                <dd className="num">{fmtMoney(rentPerMw)}</dd>
              </div>
              {floors.rentMw > 0 ? (
                <div className="is-floor">
                  <dt>Committed</dt>
                  <dd className="num">≥ {fmtMw(floors.rentMw)}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      </div>
    </div>
  )
}

interface PoolRowProps {
  /** Tutorial anchor (data-tut). */
  tut?: string
  pool: PoolId
  value: number
  min: number
  max: number
  scale: number
  market: PoolMarket
  rate: number
  margin: number
  rentMargin?: number
  used: number
  revenue: number
  floor?: number
  linkNote?: string
  maxReason: string
  minReason?: string
  disabled: boolean
  onChange: (mw: number) => void
}

function PoolRow({ tut, pool, value, min, max, scale, market, rate, margin, rentMargin, used, revenue, floor, linkNote, maxReason, minReason, disabled, onChange }: PoolRowProps) {
  const meta = POOL_META[pool]
  const over = value - market.demandAt
  return (
    <li className={`arow pool-${pool}`} data-tut={tut}>
      <div className="arow-head">
        <span className="arow-icon" style={{ background: meta.hue }} aria-hidden="true">
          <Icon name={meta.icon} size={16} />
        </span>
        <span className="arow-name">
          <h4>{meta.short}</h4>
          <span className="arow-rate num">
            {fmtMoney(rate)}/MW · margin <strong>{fmtMoney(margin, { sign: true })}</strong>
            {rentMargin != null ? <span className="muted"> ({fmtMoney(rentMargin, { sign: true })} rented)</span> : null}
            {linkNote ? <span className="muted"> · {linkNote}</span> : null}
          </span>
        </span>
        <span className="arow-proj">
          <span className="arow-proj-k">≈</span> <span className="num strong">{fmtMw(used)}</span> <span className="muted">used</span>
          <span className={`num ${revenue > 0 ? 'money' : 'muted'}`}>{fmtMoney(revenue, { sign: true })}</span>
        </span>
      </div>
      <MwSlider
        label={meta.short}
        value={value}
        min={min}
        max={max}
        scale={scale}
        color={meta.hue}
        demandAt={market.demandAt}
        maxReason={maxReason}
        minReason={minReason}
        valueText={`about ${fmtMw(used)} used, ${fmtMoney(revenue, { sign: true })}`}
        disabled={disabled}
        onChange={onChange}
      />
      <dl className="arow-facts">
        <div>
          <dt>Demand</dt>
          <dd className="num">{fmtMw(market.demand)}</dd>
        </div>
        <div>
          <dt>All offered</dt>
          <dd className="num">{market.offered == null ? '—' : fmtMw(market.offered)}</dd>
        </div>
        <div>
          <dt>You used</dt>
          <dd className="num">{fmtMw(market.myUsed)}</dd>
        </div>
        {floor != null && floor > 0 ? (
          <div className="is-floor">
            <dt>Committed</dt>
            <dd className="num">≥ {fmtMw(floor)}</dd>
          </div>
        ) : null}
        {value > 0.005 && over > 0.005 ? (
          <div className="is-over">
            <dt>Past demand</dt>
            <dd className="num">{fmtMw(over)}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  )
}
