// PLACEHOLDER (UI shell track). The panels track replaces this file wholesale with stacked sliders.
// Contract: default export, no props; rendered inside the dock's Sheet body (it scrolls).
// Stores: useDraft (decision.power/compute/rentMw, setPower, setCompute, setRent), useDerived
// (preview capacities, projection.usedByPool / revenueByPool / marginPerMw), useGame (phase).

import { COMPUTE_POOLS } from '../../engine'
import type { ComputePool, Decision } from '../../engine'
import { useDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { Icon, Mw, POOL_META, Panel, Stepper, fmtMoney, fmtMw } from '../kit'
import type { IconName } from '../kit'

const POWER_ROWS: { key: keyof Decision['power']; label: string; icon: IconName; pool: 'citizens' | 'otherDc' | null }[] = [
  { key: 'internal', label: 'To my datacenters', icon: 'dc', pool: null },
  { key: 'town', label: 'To citizens', icon: 'town', pool: 'citizens' },
  { key: 'otherDc', label: 'To other datacenters', icon: 'rivals', pool: 'otherDc' },
]

export default function AllocatePanel() {
  const d = useDraft((s) => s.decision)
  const setPower = useDraft((s) => s.setPower)
  const setCompute = useDraft((s) => s.setCompute)
  const setRent = useDraft((s) => s.setRent)
  const disabled = useGame((s) => s.phase !== 'decide')
  const { preview, projection } = useDerived()

  const assigned = d.power.internal + d.power.town + d.power.otherDc
  const unassigned = Math.max(0, preview.plantMw - assigned)
  const powered = Math.min(preview.dcMw, d.power.internal + d.rentMw)
  const computeTotal = d.compute.cloud + d.compute.btc + d.compute.ai
  const linkCap: Record<keyof Decision['power'], number> = { internal: preview.links.internal, town: preview.links.town, otherDc: Number.POSITIVE_INFINITY }

  return (
    <div className="panel-stack">
      <Panel
        title="Power"
        icon="plant"
        tone="plant"
        aside={
          <span className="num muted">
            {fmtMw(assigned)} of {fmtMw(preview.plantMw)}
          </span>
        }
      >
        {POWER_ROWS.map((row) => {
          const others = assigned - d.power[row.key]
          const max = Math.max(0, Math.min(linkCap[row.key], preview.plantMw - others))
          return (
            <div key={row.key} className="alloc-row">
              <Stepper label={row.label} value={d.power[row.key]} onChange={(v) => setPower(row.key, v)} max={Math.max(max, d.power[row.key])} unit="MW" disabled={disabled} />
              <span className="alloc-note">
                <Icon name={row.icon} size={16} />
                {row.pool ? (
                  <>
                    <span className="num">{fmtMoney(projection.marginPerMw[row.pool], { sign: true })}/MW</span>
                    <span className="muted num">≈ {fmtMw(projection.usedByPool[row.pool])} used</span>
                  </>
                ) : (
                  <span className="muted num">link {fmtMw(preview.links.internal)}</span>
                )}
                {row.key === 'town' ? <span className="muted num">link {fmtMw(preview.links.town)}</span> : null}
              </span>
            </div>
          )
        })}
        <p className={`alloc-sum${unassigned > 0 ? ' is-idle' : ''}`}>
          <Icon name={unassigned > 0 ? 'warn' : 'ok'} size={16} /> {unassigned > 0 ? `${fmtMw(unassigned)} unassigned (idle)` : 'All plant MW assigned'}
        </p>
      </Panel>

      <Panel
        title="Compute"
        icon="dc"
        tone="dc"
        aside={
          <span className="num muted">
            {fmtMw(computeTotal)} of {fmtMw(powered)} powered
          </span>
        }
      >
        {COMPUTE_POOLS.map((p: ComputePool) => {
          const others = computeTotal - d.compute[p]
          const max = Math.max(0, powered - others)
          return (
            <div key={p} className="alloc-row">
              <Stepper label={POOL_META[p].label} value={d.compute[p]} onChange={(v) => setCompute(p, v)} max={Math.max(max, d.compute[p])} unit="MW" disabled={disabled} />
              <span className="alloc-note">
                <Icon name={POOL_META[p].icon} size={16} />
                <span className="num">{fmtMoney(projection.marginPerMw[p], { sign: true })}/MW</span>
                <span className="muted num">≈ {fmtMw(projection.usedByPool[p])} used</span>
              </span>
            </div>
          )
        })}
        <p className="field-desc">
          Datacenters <Mw value={preview.dcMw} />, powered by <Mw value={d.power.internal} /> internal + <Mw value={d.rentMw} /> rented.
        </p>
      </Panel>

      <Panel title="Rent power" icon="bolt" tone="power" aside={<span className="num muted">import link {fmtMw(preview.links.import)}</span>}>
        <Stepper
          label="Rented MW"
          value={d.rentMw}
          onChange={setRent}
          max={Math.max(preview.links.import, d.rentMw)}
          unit="MW"
          disabled={disabled}
          hint="Paid on every MW requested: 1.3 from rivals first, 1.6 from the market."
        />
      </Panel>
    </div>
  )
}
