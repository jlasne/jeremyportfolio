import { useMemo, useState } from 'react'
import type { DailyStat } from '../types'

// Leads a day. One stacked column per day, one colour per campaign, and a line
// for the total across them. Campaign colours sit in a fixed order.

const W = 760
const H = 180
const PAD = { top: 26, bottom: 24, left: 36, right: 12 }
export const CAMPAIGN_COLOURS = ['#f2662a', '#7c5cff', '#2aa17a', '#e0a100', '#d94a8c', '#3b7dd8']

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
  return Math.ceil(v / pow) * pow
}

export interface ChartCampaign {
  id: string
  name: string
}

export function DailyChart({ rows, campaigns }: { rows: DailyStat[]; campaigns: ChartCampaign[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const { dates, byDate, totals } = useMemo(() => {
    const dates = [...new Set(rows.map((r) => r.date))].sort()
    const byDate = new Map<string, Map<string, DailyStat>>()
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, new Map())
      byDate.get(r.date)!.set(r.campaignId, r)
    }
    const totals = dates.map((d) => [...(byDate.get(d)?.values() ?? [])].reduce((s, r) => s + r.leads, 0))
    return { dates, byDate, totals }
  }, [rows])

  if (dates.length < 2) return null

  const max = nice(Math.max(...totals, 1))
  const slot = (W - PAD.left - PAD.right) / dates.length
  const x = (i: number) => PAD.left + slot * (i + 0.5)
  const base = H - PAD.bottom
  const y = (v: number) => PAD.top + (base - PAD.top) * (1 - v / max)
  const h = (v: number) => (base - PAD.top) * (v / max)
  const barW = Math.max(2, slot * (dates.length > 45 ? 0.7 : 0.6))

  const active = hover ?? dates.length - 1
  const date = dates[active]
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const atActive = byDate.get(date) ?? new Map<string, DailyStat>()
  const total = totals[active]
  const qualified = [...atActive.values()].reduce((s, r) => s + r.qualified, 0)
  const tickEvery = dates.length > 45 ? 10 : dates.length > 20 ? 5 : 2
  const colour = (id: string) => CAMPAIGN_COLOURS[Math.max(0, campaigns.findIndex((c) => c.id === id)) % CAMPAIGN_COLOURS.length]

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span className="chart-value num">{total.toLocaleString('en-US')}</span>
        <span className="muted">leads on {day(date)}</span>
        <span className="chart-value num qualified">{qualified.toLocaleString('en-US')}</span>
        <span className="muted">qualified, {total ? Math.round((qualified / total) * 100) : 0}%</span>
        <span className="spacer" />
        <span className="legend">
          {campaigns.map((c) => (
            <span key={c.id} className="legend-item">
              <i className="bar" style={{ background: colour(c.id) }} />
              {c.name}
            </span>
          ))}
          <span className="legend-item"><i className="line-swatch" />Total</span>
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`Leads a day over ${dates.length} days, stacked by campaign`} onMouseLeave={() => setHover(null)}>
        <line x1={PAD.left - 8} y1={base} x2={W - PAD.right} y2={base} className="axis" />
        <text x={PAD.left - 10} y={PAD.top + 4} textAnchor="end" className="axis-label total">{max.toLocaleString('en-US')}</text>

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
                    fill={colour(c.id)}
                    opacity={i === active ? 1 : 0.55}
                  />
                )
                stack = top
                return el
              })}
            </g>
          )
        })}

        <path d={smooth(dates.map((_, i) => [x(i), y(totals[i])]))} className="chart-line total" />
        <line x1={x(active)} y1={PAD.top - 10} x2={x(active)} y2={base} className="crosshair" />
        <circle cx={x(active)} cy={y(total)} r="4.5" className="chart-dot total" />

        {dates.map((d, i) => (
          <g key={d + 't'} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - slot / 2} y="0" width={slot} height={base} fill="transparent" />
            {(i % tickEvery === 0 || i === dates.length - 1) && (
              <text x={x(i)} y={H - 8} textAnchor="middle" className="tick">{new Date(d).getDate()}</text>
            )}
          </g>
        ))}
      </svg>

      <table className="sr-only">
        <caption>Leads a day by campaign</caption>
        <thead>
          <tr><th>Date</th>{campaigns.map((c) => <th key={c.id}>{c.name}</th>)}<th>Total</th><th>Qualified</th></tr>
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </figure>
  )
}
