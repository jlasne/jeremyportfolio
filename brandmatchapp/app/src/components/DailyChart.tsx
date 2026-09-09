import { useState } from 'react'
import type { DailyStat } from '../types'

// Leads gathered per day, one series, 14 days. Bars sit on the baseline with a
// 2px gap and a 3px rounded top. The newest bar carries a direct label.

const W = 720
const H = 132
const PAD_B = 18
const PAD_T = 16

export function DailyChart({ data, field = 'leads' }: { data: DailyStat[]; field?: 'leads' | 'gathered' | 'high' }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d[field]))
  const slot = W / data.length
  const barW = slot - 2
  const scale = (v: number) => ((H - PAD_B - PAD_T) * v) / max

  const active = hover === null ? data.length - 1 : hover
  const point = data[active]

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span className="chart-value num">{point[field]}</span>
        <span className="muted">
          contacts on {new Date(point.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {' · '}
          {point.gathered} profiles crawled
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`Contacts gathered per day over ${data.length} days`}>
        <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B} className="axis" />
        {data.map((d, i) => {
          const h = scale(d[field])
          const x = i * slot
          const on = i === active
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={PAD_T} width={slot} height={H - PAD_B - PAD_T} fill="transparent" />
              <rect x={x + 1} y={H - PAD_B - h} width={barW} height={h} rx="3" className={on ? 'chart-bar on' : 'chart-bar'} />
              <text x={x + slot / 2} y={H - 5} textAnchor="middle" className="tick">
                {new Date(d.date).getDate()}
              </text>
            </g>
          )
        })}
        <text x={active * slot + slot / 2} y={H - PAD_B - scale(point[field]) - 5} textAnchor="middle" className="chart-bar-label num">
          {point[field]}
        </text>
      </svg>
      <table className="sr-only">
        <caption>Contacts gathered per day</caption>
        <thead>
          <tr><th>Date</th><th>Profiles crawled</th><th>Contacts</th><th>At 2 stars or more</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{new Date(d.date).toLocaleDateString('en-GB')}</td>
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
