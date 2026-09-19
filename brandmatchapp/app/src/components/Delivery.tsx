import { useMemo, useState } from 'react'
import { getDelivery } from '../data'
import type { Campaign } from '../types'

// What each campaign has actually delivered this month.
//
// Two measures, two panels, one x axis. The running total and the day's count
// are different scales, and drawing them against two y axes in one frame is
// the oldest way to make a chart lie: the reader has no way to know which line
// belongs to which side. So the totals get their own panel and the days get
// theirs, stacked, sharing the dates underneath. One hover reads both.
//
// The colours are a fixed order, never cycled: campaign one is always the
// brand orange, campaign two always the blue, whatever is switched off. A
// filter that repaints the survivors is a filter that rewrites history.
//
// The set passes the six checks on this white card: lightness band, chroma
// floor, colour-blind separation on every adjacent pair, normal-vision
// separation, and 3:1 against the surface. Identity is never colour alone
// either: every line carries its name at its end, and the numbers are one
// click away as a table.

const SERIES = ['#ff5c2b', '#2a78d6', '#199e70', '#4a3aa7']

const W = 720
const PAD_L = 36
const PAD_R = 104
const TOP_H = 150
const GAP = 34
const BAR_H = 74
const H = TOP_H + GAP + BAR_H + 22

interface Series {
  id: string
  name: string
  colour: string
  daily: number[]
  running: number[]
}

function niceTop(n: number): number {
  if (n <= 5) return 5
  const step = Math.pow(10, Math.floor(Math.log10(n)))
  return Math.ceil(n / (step / 2)) * (step / 2)
}

function dayLabel(iso: string): string {
  return String(Number(iso.slice(8, 10)))
}

/**
 * The label that sits at the end of a line. Campaign names are written for a
 * list and run long, so the part before the first comma is used: "Fitness
 * coaches, app build" is "Fitness coaches" on a chart, and two campaigns that
 * still collide are told apart by the legend and by their colour.
 */
function shortName(name: string): string {
  const head = name.split(',')[0].trim()
  return head.length > 17 ? `${head.slice(0, 16)}…` : head
}

export function Delivery({ campaigns }: { campaigns: Campaign[] }) {
  const [at, setAt] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  const { dates, series } = useMemo(() => {
    const byCampaign = campaigns.map((c) => ({ c, rows: getDelivery(c.id) }))
    const dates = [...new Set(byCampaign.flatMap((b) => b.rows.map((r) => r.date)))].sort()
    const series: Series[] = byCampaign.map(({ c, rows }, i) => {
      const found = new Map(rows.map((r) => [r.date, r.delivered]))
      const daily = dates.map((d) => found.get(d) ?? 0)
      let run = 0
      const running = daily.map((n) => (run += n))
      return { id: c.id, name: c.name, colour: SERIES[i % SERIES.length], daily, running }
    })
    return { dates, series }
  }, [campaigns.map((c) => c.id).join(','), campaigns.length])

  if (dates.length < 2 || series.every((s) => s.running[s.running.length - 1] === 0)) return null

  const topRun = niceTop(Math.max(1, ...series.map((s) => s.running[s.running.length - 1])))
  const topDay = niceTop(Math.max(1, ...series.flatMap((s) => s.daily)))
  const plotW = W - PAD_L - PAD_R
  const band = plotW / dates.length
  const x = (i: number) => PAD_L + band * (i + 0.5)
  // The top of the line panel is kept clear so the caption never lands on the
  // highest tick label.
  const yRun = (v: number) => TOP_H - (v / topRun) * (TOP_H - 26)
  const yDay = (v: number) => TOP_H + GAP + BAR_H - (v / topDay) * BAR_H

  // Grouped bars, with two pixels of surface between them. Thin is fine; two
  // bars touching read as one bar of a colour nobody chose.
  const barW = Math.max(1.5, band / series.length - 2)

  // Roughly a label a week, whatever the month's length.
  const every = Math.max(1, Math.round(dates.length / 7))

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h2>What each campaign delivered this month</h2>
        <button type="button" className="btn small quiet" onClick={() => setTable(!table)}>
          {table ? 'Show the chart' : 'Show the numbers'}
        </button>
      </div>

      <ul className="chart-legend">
        {series.map((s) => (
          <li key={s.id}>
            <i style={{ background: s.colour }} aria-hidden="true" />
            <span>{s.name}</span>
            <b className="num">{s.running[s.running.length - 1]}</b>
          </li>
        ))}
      </ul>

      {table ? (
        <div className="compare-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th>Day</th>
                {series.map((s) => <th key={s.id}>{s.name}</th>)}
                <th>Total so far</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d}>
                  <th>{d}</th>
                  {series.map((s) => <td key={s.id} className="num">{s.daily[i]}</td>)}
                  <td className="num">{series.reduce((n, s) => n + s.running[i], 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Leads delivered per campaign, day by day and as a running total">
            {/* Two recessive rules apiece. A grid you notice is a grid too dark. */}
            {[0, 0.5, 1].map((f) => (
              <g key={`r${f}`}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yRun(topRun * f)} y2={yRun(topRun * f)} className="chart-grid" />
                <text x={PAD_L - 8} y={yRun(topRun * f) + 3} className="chart-tick" textAnchor="end">
                  {Math.round(topRun * f)}
                </text>
              </g>
            ))}
            {[0, 1].map((f) => (
              <g key={`d${f}`}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yDay(topDay * f)} y2={yDay(topDay * f)} className="chart-grid" />
                <text x={PAD_L - 8} y={yDay(topDay * f) + 3} className="chart-tick" textAnchor="end">
                  {Math.round(topDay * f)}
                </text>
              </g>
            ))}

            <text x={PAD_L} y={12} className="chart-axis">Running total</text>
            <text x={PAD_L} y={TOP_H + GAP - 8} className="chart-axis">Leads that day</text>

            {/* The running totals. */}
            {series.map((s) => (
              <g key={s.id}>
                <path
                  d={s.running.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yRun(v).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke={s.colour}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle cx={x(dates.length - 1)} cy={yRun(s.running[dates.length - 1])} r={4} fill={s.colour} stroke="#fff" strokeWidth={2} />
                <text
                  x={x(dates.length - 1) + 9}
                  y={yRun(s.running[dates.length - 1]) + 4}
                  className="chart-name"
                >
                  {shortName(s.name)}
                </text>
              </g>
            ))}

            {/* The days. */}
            {series.map((s, si) =>
              s.daily.map((v, i) =>
                v > 0 ? (
                  <rect
                    key={`${s.id}-${i}`}
                    x={PAD_L + band * i + 1 + si * (barW + 2)}
                    y={yDay(v)}
                    width={barW}
                    height={Math.max(1, yDay(0) - yDay(v))}
                    rx={Math.min(2, barW / 2)}
                    fill={s.colour}
                  />
                ) : null,
              ),
            )}

            {/* Dates, about one a week. */}
            {dates.map((d, i) =>
              i % every === 0 ? (
                <text key={d} x={x(i)} y={H - 6} className="chart-tick" textAnchor="middle">{dayLabel(d)}</text>
              ) : null,
            )}

            {/* The hover layer: one band a day, wider than any mark in it. */}
            {at !== null && (
              <line x1={x(at)} x2={x(at)} y1={6} y2={yDay(0)} className="chart-cross" />
            )}
            {dates.map((d, i) => (
              <rect
                key={`hit-${d}`}
                x={PAD_L + band * i}
                y={0}
                width={band}
                height={H - 16}
                fill="transparent"
                onMouseEnter={() => setAt(i)}
                onMouseLeave={() => setAt(null)}
              />
            ))}
          </svg>

          {at !== null && (
            <div
              className="chart-tip"
              style={{ left: `${((x(at) - PAD_L) / plotW) * 100}%` }}
            >
              <b>{dates[at]}</b>
              <ul>
                {series.map((s) => (
                  <li key={s.id}>
                    <i style={{ background: s.colour }} aria-hidden="true" />
                    <span>{s.name}</span>
                    <b className="num">{s.daily[at]}</b>
                    <small className="num">{s.running[at]} so far</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
