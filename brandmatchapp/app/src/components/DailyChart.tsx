import { useMemo, useState } from 'react'
import type { DailyStat } from '../types'

// Leads a day. One stacked column per day, one colour per campaign, and a line
// for the share of those leads that qualified. Bars read on the left axis in
// leads, the line on the right axis in percent. The legend under the chart is
// also the campaign picker: click one to keep it, click again for all of them.

const W = 760
const H = 208
const PAD = { top: 22, bottom: 30, left: 42, right: 46 }

/** One colour per campaign, in the order the campaigns come in. */
export const CAMPAIGN_COLOURS = ['#ff5c2b', '#7c5cff', '#2aa17a', '#e0a100', '#d94a8c', '#3b7dd8', '#ff9e6b', '#00a4b8']

/** Monotone cubic, so the curve bends without overshooting a point. */
function smooth(points: [number, number][]): string {
  const n = points.length
  if (n < 2) return ''
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0])
    slope.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]))
  }
  const m: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  m.push(slope[n - 2])
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    d += ` C${(points[i][0] + dx[i] / 3).toFixed(1)} ${(points[i][1] + (m[i] * dx[i]) / 3).toFixed(1)},` +
      ` ${(points[i + 1][0] - dx[i] / 3).toFixed(1)} ${(points[i + 1][1] - (m[i + 1] * dx[i]) / 3).toFixed(1)},` +
      ` ${points[i + 1][0].toFixed(1)} ${points[i + 1][1].toFixed(1)}`
  }
  return d
}

function nice(v: number): number {
  if (v <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(v))
  const step = pow / 2
  return Math.ceil(v / step) * step
}

export interface ChartCampaign {
  id: string
  name: string
  /** How many agents run under it, for the legend's title. */
  agents: number
  /** Its place on the account, which fixes its colour. */
  colourIndex: number
  /** What it brought over the period, whatever is selected, for the legend. */
  leads: number
}

export function DailyChart({
  rows, campaigns, selected, onSelect,
}: {
  rows: DailyStat[]
  campaigns: ChartCampaign[]
  /** The campaign kept on its own, or null for every campaign. */
  selected: string | null
  onSelect: (campaignId: string | null) => void
}) {
  const [hover, setHover] = useState<number | null>(null)

  const { dates, byDate, totals, shares } = useMemo(() => {
    const dates = [...new Set(rows.map((r) => r.date))].sort()
    // Agents fill their quota one row each, so a day adds them up per campaign.
    const byDate = new Map<string, Map<string, DailyStat>>()
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, new Map())
      const at = byDate.get(r.date)!
      const sum = at.get(r.campaignId)
      if (sum) {
        sum.leads += r.leads
        sum.qualified += r.qualified
        sum.gathered += r.gathered
      } else {
        at.set(r.campaignId, { ...r, agentId: 'all' })
      }
    }
    const totals = dates.map((d) => [...(byDate.get(d)?.values() ?? [])].reduce((s, r) => s + r.leads, 0))
    const shares = dates.map((d, i) => {
      const q = [...(byDate.get(d)?.values() ?? [])].reduce((s, r) => s + r.qualified, 0)
      return totals[i] ? (q / totals[i]) * 100 : 0
    })
    return { dates, byDate, totals, shares }
  }, [rows])

  const colour = (c: ChartCampaign) => CAMPAIGN_COLOURS[c.colourIndex % CAMPAIGN_COLOURS.length]

  if (dates.length < 2) return null

  const max = nice(Math.max(...totals, 1))
  const slot = (W - PAD.left - PAD.right) / dates.length
  const x = (i: number) => PAD.left + slot * (i + 0.5)
  const base = H - PAD.bottom
  const plot = base - PAD.top
  const y = (v: number) => PAD.top + plot * (1 - v / max)
  /** The line rides its own 0 to 100 axis on the right. */
  const yPct = (v: number) => PAD.top + plot * (1 - v / 100)
  const h = (v: number) => plot * (v / max)
  const barW = Math.max(2, slot * (dates.length > 45 ? 0.72 : 0.62))

  const active = hover ?? dates.length - 1
  const date = dates[active]
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const total = totals[active]
  const share = Math.round(shares[active])
  const tickEvery = dates.length > 45 ? 10 : dates.length > 20 ? 5 : 2
  const gridAt = [0, 0.5, 1]

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span className="chart-value num">{total.toLocaleString('en-US')}</span>
        <span className="muted">leads on {day(date)}</span>
        <span className="chart-value num rate">{share}%</span>
        <span className="muted">qualified</span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`Leads a day over ${dates.length} days, stacked by campaign, with the qualified share as a line`} onMouseLeave={() => setHover(null)}>
        {gridAt.map((f) => (
          <g key={f}>
            <line x1={PAD.left} y1={PAD.top + plot * (1 - f)} x2={W - PAD.right} y2={PAD.top + plot * (1 - f)} className={f === 0 ? 'axis' : 'grid'} />
            <text x={PAD.left - 8} y={PAD.top + plot * (1 - f) + 3.5} textAnchor="end" className="axis-label leads">
              {f === 0 ? '0' : Math.round(max * f).toLocaleString('en-US')}
            </text>
            <text x={W - PAD.right + 8} y={PAD.top + plot * (1 - f) + 3.5} textAnchor="start" className="axis-label rate">
              {Math.round(100 * f)}%
            </text>
          </g>
        ))}

        {dates.map((d, i) => {
          let stack = 0
          const at = byDate.get(d) ?? new Map<string, DailyStat>()
          return (
            <g key={d}>
              {campaigns.map((c) => {
                const r = at.get(c.id)
                if (!r || r.leads === 0) return null
                const top = stack + r.leads
                const el = (
                  <rect
                    key={c.id}
                    x={x(i) - barW / 2}
                    y={y(top)}
                    width={barW}
                    height={Math.max(0, h(r.leads) - 1)}
                    rx={Math.min(3, barW / 3)}
                    fill={colour(c)}
                    opacity={i === active ? 1 : 0.5}
                  />
                )
                stack = top
                return el
              })}
            </g>
          )
        })}

        <path d={smooth(dates.map((_, i) => [x(i), yPct(shares[i])]))} className="chart-line rate" />
        <line x1={x(active)} y1={PAD.top - 8} x2={x(active)} y2={base} className="crosshair" />
        <circle cx={x(active)} cy={yPct(shares[active])} r="4.5" className="chart-dot rate" />

        {dates.map((d, i) => (
          <g key={d + 't'} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - slot / 2} y="0" width={slot} height={base} fill="transparent" />
            {(i % tickEvery === 0 || i === dates.length - 1) && (
              <text x={x(i)} y={H - 10} textAnchor="middle" className="tick">{new Date(d).getDate()}</text>
            )}
          </g>
        ))}
      </svg>

      {/* The legend is the campaign picker. One click keeps one, a second lets them all back. */}
      <div className="chart-legend" role="group" aria-label="Campaigns in this chart">
        <button
          type="button"
          className={`legend-pick${selected === null ? ' on' : ''}`}
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
        >
          Every campaign
        </button>
        {campaigns.map((c) => {
          const at = selected === c.id
          return (
            <button
              key={c.id}
              type="button"
              className={`legend-pick${at ? ' on' : ''}${c.leads === 0 ? ' quiet' : ''}`}
              aria-pressed={at}
              title={`${c.name}, ${c.agents} agent${c.agents === 1 ? '' : 's'}`}
              onClick={() => onSelect(at ? null : c.id)}
            >
              <i className="swatch" style={{ background: colour(c) }} />
              <span className="legend-name">{c.name}</span>
              <span className="legend-count num">{c.leads.toLocaleString('en-US')}</span>
            </button>
          )
        })}
        <span className="legend-pick static"><i className="line-swatch" />Qualified %</span>
      </div>

      <table className="sr-only">
        <caption>Leads a day by campaign, and the share of them qualified</caption>
        <thead>
          <tr><th>Date</th>{campaigns.map((c) => <th key={c.id}>{c.name}</th>)}<th>Total</th><th>Qualified</th><th>Qualified share</th></tr>
        </thead>
        <tbody>
          {dates.map((d, i) => {
            const at = byDate.get(d) ?? new Map<string, DailyStat>()
            return (
              <tr key={d}>
                <td>{day(d)}</td>
                {campaigns.map((c) => <td key={c.id}>{at.get(c.id)?.leads ?? 0}</td>)}
                <td>{totals[i]}</td>
                <td>{[...at.values()].reduce((s, r) => s + r.qualified, 0)}</td>
                <td>{Math.round(shares[i])}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </figure>
  )
}
