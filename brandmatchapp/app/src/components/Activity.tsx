import { useState } from 'react'

// Volume, and the share of it that was worth keeping.
//
// Two measures at two scales: a count and a percentage. They go in two panels
// over one set of dates rather than against two y axes in one frame, which is
// the oldest way to make a chart lie, because the reader has no way to know
// which mark belongs to which side.
//
// The bars stack, so the height is the day's whole volume and each band is who
// it was for. Two pixels of surface between bands, because two fills touching
// read as one band of a colour nobody chose.
//
// The colours are a fixed order, never cycled. They pass the six checks on a
// white card: lightness band, chroma floor, colour-blind separation on every
// adjacent pair, normal-vision separation, and 3:1 against the surface.

export const SERIES = ['#ff5c2b', '#2a78d6', '#199e70', '#4a3aa7']

export interface BarSeries {
  id: string
  name: string
  values: number[]
}

const W = 720
const PAD_L = 38
const PAD_R = 16
const BAR_H = 128
const GAP = 34
const LINE_H = 66
const H = BAR_H + GAP + LINE_H + 22

function niceTop(n: number): number {
  if (n <= 5) return 5
  const step = Math.pow(10, Math.floor(Math.log10(n)))
  return Math.ceil(n / (step / 2)) * (step / 2)
}

function short(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`
  return String(Math.round(n))
}

export function Activity({
  title, dates, bars, barsLabel, line, lineLabel, action,
}: {
  title: string
  /** ISO days, oldest first. */
  dates: string[]
  bars: BarSeries[]
  barsLabel: string
  /** A share from 0 to 1 a day, drawn under the bars. */
  line: number[]
  lineLabel: string
  action?: React.ReactNode
}) {
  const [at, setAt] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  if (dates.length < 2) return null
  const totals = dates.map((_, i) => bars.reduce((n, s) => n + (s.values[i] ?? 0), 0))
  if (totals.every((n) => n === 0)) return null

  const topBar = niceTop(Math.max(1, ...totals))
  const topLine = Math.max(0.05, Math.min(1, Math.max(...line) * 1.25))
  const plotW = W - PAD_L - PAD_R
  const band = plotW / dates.length
  const x = (i: number) => PAD_L + band * (i + 0.5)
  const yBar = (v: number) => BAR_H - (v / topBar) * (BAR_H - 18)
  const yLine = (v: number) => BAR_H + GAP + LINE_H - (v / topLine) * LINE_H
  const barW = Math.max(2, Math.min(26, band - 4))
  const every = Math.max(1, Math.round(dates.length / 7))
  const many = bars.length > 1

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h2>{title}</h2>
        <div className="chart-acts">
          {action}
          <button type="button" className="btn small quiet" onClick={() => setTable(!table)}>
            {table ? 'Show the chart' : 'Show the numbers'}
          </button>
        </div>
      </div>

      {many && (
        <ul className="chart-legend">
          {bars.map((s, i) => (
            <li key={s.id}>
              <i style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
              <span>{s.name}</span>
              <b className="num">{s.values.reduce((n, v) => n + v, 0).toLocaleString('en-GB')}</b>
            </li>
          ))}
        </ul>
      )}

      {table ? (
        <div className="compare-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th>Day</th>
                {bars.map((s) => <th key={s.id}>{s.name}</th>)}
                <th>{lineLabel}</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d}>
                  <th>{d}</th>
                  {bars.map((s) => <td key={s.id} className="num">{(s.values[i] ?? 0).toLocaleString('en-GB')}</td>)}
                  <td className="num">{Math.round(line[i] * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${barsLabel} a day, and ${lineLabel}`}>
            {[0, 0.5, 1].map((f) => (
              <g key={`b${f}`}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yBar(topBar * f)} y2={yBar(topBar * f)} className="chart-grid" />
                <text x={PAD_L - 8} y={yBar(topBar * f) + 3} className="chart-tick" textAnchor="end">{short(topBar * f)}</text>
              </g>
            ))}
            {[0, 1].map((f) => (
              <g key={`l${f}`}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yLine(topLine * f)} y2={yLine(topLine * f)} className="chart-grid" />
                <text x={PAD_L - 8} y={yLine(topLine * f) + 3} className="chart-tick" textAnchor="end">
                  {Math.round(topLine * f * 100)}%
                </text>
              </g>
            ))}

            <text x={PAD_L} y={11} className="chart-axis">{barsLabel}</text>
            <text x={PAD_L} y={BAR_H + GAP - 8} className="chart-axis">{lineLabel}</text>

            {/* Stacked, with a two pixel gap between bands. */}
            {dates.map((d, i) => {
              let base = yBar(0)
              return (
                <g key={`bar-${d}`}>
                  {bars.map((s, si) => {
                    const v = s.values[i] ?? 0
                    if (v <= 0) return null
                    const h = Math.max(1, yBar(0) - yBar(v))
                    const top = base - h
                    const y = top
                    base = top - (many ? 2 : 0)
                    return (
                      <rect
                        key={s.id}
                        x={x(i) - barW / 2}
                        y={y}
                        width={barW}
                        height={h}
                        rx={Math.min(3, barW / 2)}
                        fill={SERIES[si % SERIES.length]}
                      />
                    )
                  })}
                </g>
              )
            })}

            {/* The share, on its own scale. */}
            <path
              d={line.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yLine(v).toFixed(1)}`).join(' ')}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={x(dates.length - 1)} cy={yLine(line[line.length - 1])} r={4} fill="var(--ink)" stroke="#fff" strokeWidth={2} />

            {dates.map((d, i) =>
              i % every === 0 ? (
                <text key={d} x={x(i)} y={H - 6} className="chart-tick" textAnchor="middle">
                  {String(Number(d.slice(8, 10)))}
                </text>
              ) : null,
            )}

            {at !== null && <line x1={x(at)} x2={x(at)} y1={6} y2={yLine(0)} className="chart-cross" />}
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
            <div className="chart-tip" style={{ left: `${((x(at) - PAD_L) / plotW) * 100}%` }}>
              <b>{dates[at]}</b>
              <ul>
                {bars.map((s, i) => (
                  <li key={s.id}>
                    <i style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
                    <span>{s.name}</span>
                    <b className="num">{(s.values[at] ?? 0).toLocaleString('en-GB')}</b>
                  </li>
                ))}
                <li>
                  <i style={{ background: 'var(--ink)' }} aria-hidden="true" />
                  <span>{lineLabel}</span>
                  <b className="num">{Math.round(line[at] * 100)}%</b>
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
