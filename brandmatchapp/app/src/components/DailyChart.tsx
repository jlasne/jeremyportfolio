import { useState } from 'react'
import type { DailyStat } from '../types'

// New contacts per day, one line, 14 days. A crosshair follows the pointer and
// the newest point carries a direct label.

const W = 720
const H = 128
const PAD = { top: 18, bottom: 20, left: 4, right: 22 }

export function DailyChart({ data }: { data: DailyStat[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2) return null

  const max = Math.max(...data.map((d) => d.leads))
  const min = Math.min(...data.map((d) => d.leads))
  const span = Math.max(1, max - min)
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (data.length - 1)
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - min) / span)

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d.leads).toFixed(1)}`).join(' ')
  const active = hover ?? data.length - 1
  const point = data[active]
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span className="chart-value num">{point.leads}</span>
        <span className="muted">new contacts on {day(point.date)} · {point.gathered} profiles crawled</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`New contacts per day over ${data.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        <line x1="0" y1={H - PAD.bottom} x2={W} y2={H - PAD.bottom} className="axis" />
        <path d={line} className="chart-line" />
        <line x1={x(active)} y1={PAD.top - 6} x2={x(active)} y2={H - PAD.bottom} className="crosshair" />
        <circle cx={x(active)} cy={y(point.leads)} r="5" className="chart-dot" />
        <text x={x(active)} y={y(point.leads) - 11} textAnchor="middle" className="chart-label num">{point.leads}</text>
        {data.map((d, i) => (
          <g key={d.date} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - 12} y="0" width="24" height={H - PAD.bottom} fill="transparent" />
            <text x={x(i)} y={H - 6} textAnchor="middle" className="tick">{new Date(d.date).getDate()}</text>
          </g>
        ))}
      </svg>
      <table className="sr-only">
        <caption>New contacts per day</caption>
        <thead>
          <tr><th>Date</th><th>Profiles crawled</th><th>New contacts</th><th>At 2 stars or more</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{day(d.date)}</td>
              <td>{d.gathered}</td>
              <td>{d.leads}</td>
              <td>{d.high}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
