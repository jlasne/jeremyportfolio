import { useState } from 'react'
import type { DailyStat } from '../types'

// Two lines over 14 days: every lead delivered, and the qualified share of them.
// Smooth monotone curves, a crosshair on hover, and each line labelled at its end.

const W = 760
const H = 150
const PAD = { top: 22, bottom: 22, left: 6, right: 50 }

const SERIES = [
  { key: 'leads' as const, label: 'Leads', className: 'leads' },
  { key: 'qualified' as const, label: 'Qualified', className: 'qualified' },
]

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
  for (let i = 1; i < n - 1; i++) {
    m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  }
  m.push(slope[n - 2])
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = points[i][0] + dx[i] / 3
    const c1y = points[i][1] + (m[i] * dx[i]) / 3
    const c2x = points[i + 1][0] - dx[i] / 3
    const c2y = points[i + 1][1] - (m[i + 1] * dx[i]) / 3
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${points[i + 1][0].toFixed(1)} ${points[i + 1][1].toFixed(1)}`
  }
  return d
}

export function DailyChart({ data }: { data: DailyStat[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2) return null

  const max = Math.max(...data.map((d) => d.leads))
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (data.length - 1)
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / max)

  const active = hover ?? data.length - 1
  const point = data[active]
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span className="chart-value num">{point.leads}</span>
        <span className="muted">leads on {day(point.date)}</span>
        <span className="chart-value num qualified">{point.qualified}</span>
        <span className="muted">qualified, {Math.round((point.qualified / point.leads) * 100)}%</span>
        <span className="spacer" />
        <span className="legend">
          {SERIES.map((s) => (
            <span key={s.key} className="legend-item">
              <i className={s.className} />
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Leads and qualified leads per day over 14 days" onMouseLeave={() => setHover(null)}>
        <line x1="0" y1={H - PAD.bottom} x2={W - PAD.right + 8} y2={H - PAD.bottom} className="axis" />
        <line x1={x(active)} y1={PAD.top - 8} x2={x(active)} y2={H - PAD.bottom} className="crosshair" />
        {SERIES.map((s) => (
          <g key={s.key}>
            <path d={smooth(data.map((d, i) => [x(i), y(d[s.key])]))} className={`chart-line ${s.className}`} />
            <circle cx={x(active)} cy={y(point[s.key])} r="4.5" className={`chart-dot ${s.className}`} />
            <text x={W - PAD.right + 12} y={y(data[data.length - 1][s.key]) + 4} className={`chart-label ${s.className}`}>
              {s.label}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.date} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - 12} y="0" width="24" height={H - PAD.bottom} fill="transparent" />
            <text x={x(i)} y={H - 7} textAnchor="middle" className="tick">{new Date(d.date).getDate()}</text>
          </g>
        ))}
      </svg>
      <table className="sr-only">
        <caption>Leads and qualified leads per day</caption>
        <thead>
          <tr><th>Date</th><th>Leads</th><th>Qualified</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{day(d.date)}</td>
              <td>{d.leads}</td>
              <td>{d.qualified}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
