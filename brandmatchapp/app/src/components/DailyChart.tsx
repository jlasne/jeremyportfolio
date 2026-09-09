import { useState } from 'react'
import type { DailyStat } from '../types'

// Two marks over 14 days. Qualified leads are columns on the right scale.
// Every lead delivered is a smooth line on the left scale.
//
// The two scales differ by about ten times, so each axis is printed in its own
// series colour and the marks never share a gridline. Where the marks cross
// means nothing.

const W = 760
const H = 168
const PAD = { top: 26, bottom: 24, left: 34, right: 34 }

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

export function DailyChart({ data }: { data: DailyStat[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2) return null

  const maxLeads = nice(Math.max(...data.map((d) => d.leads), 1))
  const maxQual = nice(Math.max(...data.map((d) => d.qualified), 1))
  const slot = (W - PAD.left - PAD.right) / data.length
  const x = (i: number) => PAD.left + slot * (i + 0.5)
  const base = H - PAD.bottom
  const yLeads = (v: number) => PAD.top + (base - PAD.top) * (1 - v / maxLeads)
  const hQual = (v: number) => (base - PAD.top) * (v / maxQual)

  const active = hover ?? data.length - 1
  const point = data[active]
  const rate = point.leads ? Math.round((point.qualified / point.leads) * 100) : 0
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span className="chart-value num">{point.leads}</span>
        <span className="muted">leads on {day(point.date)}</span>
        <span className="chart-value num qualified">{point.qualified}</span>
        <span className="muted">qualified of {point.leads}, {rate}%</span>
        <span className="spacer" />
        <span className="legend">
          <span className="legend-item"><i className="bar qualified" />Qualified, right scale</span>
          <span className="legend-item"><i className="leads" />Leads, left scale</span>
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Leads and qualified leads per day over 14 days" onMouseLeave={() => setHover(null)}>
        <line x1={PAD.left - 8} y1={base} x2={W - PAD.right + 8} y2={base} className="axis" />
        <text x={PAD.left - 10} y={PAD.top + 4} textAnchor="end" className="axis-label leads">{maxLeads}</text>
        <text x={W - PAD.right + 10} y={PAD.top + 4} className="axis-label qualified">{maxQual}</text>

        {data.map((d, i) => (
          <rect
            key={d.date + 'q'}
            x={x(i) - slot * 0.28}
            y={base - hQual(d.qualified)}
            width={slot * 0.56}
            height={hQual(d.qualified)}
            rx="3"
            className={`chart-bar${i === active ? ' on' : ''}`}
          />
        ))}

        <path d={smooth(data.map((d, i) => [x(i), yLeads(d.leads)]))} className="chart-line leads" />
        <line x1={x(active)} y1={PAD.top - 10} x2={x(active)} y2={base} className="crosshair" />
        <circle cx={x(active)} cy={yLeads(point.leads)} r="4.5" className="chart-dot leads" />

        {data.map((d, i) => (
          <g key={d.date} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - slot / 2} y="0" width={slot} height={base} fill="transparent" />
            <text x={x(i)} y={H - 8} textAnchor="middle" className="tick">{new Date(d.date).getDate()}</text>
          </g>
        ))}
      </svg>

      <table className="sr-only">
        <caption>Leads and qualified leads per day</caption>
        <thead>
          <tr><th>Date</th><th>Leads</th><th>Qualified</th><th>Share</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{day(d.date)}</td>
              <td>{d.leads}</td>
              <td>{d.qualified}</td>
              <td>{d.leads ? Math.round((d.qualified / d.leads) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
