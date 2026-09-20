import { useState } from 'react'

// Volume, and the shares that explain it, in one frame.
//
// Two y axes, which is a thing to do carefully: a reader who cannot tell which
// mark belongs to which side reads the chart backwards. So the sides are tied
// to their marks by colour, the left axis is captioned in the bars' colour and
// the right in the lines', and every line carries its name at its end. The
// hover reads every series at once, which is the honest way to compare two
// scales: by the numbers, not by where the marks happen to cross.
//
// The bars stack, so the height is the day's whole volume and each band is who
// it was for. Two pixels of surface between bands, because two fills touching
// read as one band of a colour nobody chose.
//
// The colours are a fixed order, never cycled. They pass the six checks on a
// white card: lightness band, chroma floor, colour-blind separation on every
// adjacent pair, normal-vision separation, and 3:1 against the surface.

export const SERIES = ['#ff5c2b', '#2a78d6', '#199e70', '#4a3aa7']
const LINES = ['#1d1d1f', '#8c2a08']

export interface BarSeries {
  id: string
  name: string
  values: number[]
}

export interface LineSeries {
  id: string
  name: string
  /** A share from 0 to 1 a day. */
  values: number[]
}

export type Window = 7 | 30 | 0

const WINDOWS: { id: Window; label: string }[] = [
  { id: 7, label: 'Last 7 days' },
  { id: 30, label: 'Last 30 days' },
  { id: 0, label: 'All' },
]

const W = 720
const PAD_L = 40
const PAD_R = 44
const PAD_T = 10
const PLOT_H = 148
const H = PAD_T + PLOT_H + 22

/**
 * A round ceiling that sits just above the data.
 *
 * The old one could put the top at half again the tallest bar, which left the
 * upper half of the frame empty and made every bar look small. This walks a
 * 1, 2, 5 ladder and stops at the first rung that clears the data.
 */
function niceTop(n: number): number {
  if (n <= 5) return 5
  const mag = Math.pow(10, Math.floor(Math.log10(n)))
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    if (mag * step >= n) return mag * step
  }
  return mag * 10
}

function short(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`
  return String(Math.round(n))
}

export function Activity({
  title, dates, bars, barsLabel, lines, windowed = true,
}: {
  title: string
  /** ISO days, oldest first. */
  dates: string[]
  bars: BarSeries[]
  barsLabel: string
  lines: LineSeries[]
  /** False when the caller has already chosen the window. */
  windowed?: boolean
}) {
  const [at, setAt] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const [win, setWin] = useState<Window>(30)

  const keep = windowed && win ? Math.min(win, dates.length) : dates.length
  const from = dates.length - keep
  const days = dates.slice(from)
  const barSeries = bars.map((s) => ({ ...s, values: s.values.slice(from) }))
  const lineSeries = lines.map((s) => ({ ...s, values: s.values.slice(from) }))

  if (days.length < 2) return null
  const totals = days.map((_, i) => barSeries.reduce((n, s) => n + (s.values[i] ?? 0), 0))
  if (totals.every((n) => n === 0)) return null

  const topBar = niceTop(Math.max(1, ...totals))
  // With one line the axis hugs it. With two, one of them is usually a
  // setting and the other a rate, and they live decades apart: the axis then
  // runs the whole way to a hundred so neither is stretched to fill a frame
  // it does not fill.
  const topLine = lineSeries.length > 1
    ? 1
    : Math.max(0.05, Math.min(1, Math.max(...lineSeries.flatMap((s) => s.values), 0.01) * 1.3))
  const plotW = W - PAD_L - PAD_R
  const band = plotW / days.length
  const x = (i: number) => PAD_L + band * (i + 0.5)
  const yBar = (v: number) => PAD_T + PLOT_H - (v / topBar) * PLOT_H
  const yLine = (v: number) => PAD_T + PLOT_H - (v / topLine) * PLOT_H
  // Slimmer than the slot it sits in, and never fat: a bar wider than about a
  // finger reads as a block of colour rather than as a measurement.
  const barW = Math.max(3, Math.min(14, band * 0.56))
  const every = Math.max(1, Math.round(days.length / 7))
  const many = barSeries.length > 1

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h2>{title}</h2>
        <div className="chart-acts">
          {windowed && (
            <div className="chart-range">
              {WINDOWS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`chip${win === w.id ? ' on' : ''}`}
                  onClick={() => { setWin(w.id); setAt(null) }}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn small quiet" onClick={() => setTable(!table)}>
            {table ? 'Chart' : 'Numbers'}
          </button>
        </div>
      </div>

      <ul className="chart-legend">
        {barSeries.map((s, i) => (
          <li key={s.id}>
            <i style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
            <span>{s.name}</span>
            <b className="num">{s.values.reduce((n, v) => n + v, 0).toLocaleString('en-GB')}</b>
          </li>
        ))}
        {lineSeries.map((s, i) => (
          <li key={s.id}>
            <i className="dash" style={{ background: LINES[i % LINES.length] }} aria-hidden="true" />
            <span>{s.name}</span>
          </li>
        ))}
      </ul>

      {table ? (
        <div className="compare-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th>Day</th>
                {barSeries.map((s) => <th key={s.id}>{s.name}</th>)}
                {lineSeries.map((s) => <th key={s.id}>{s.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d}>
                  <th>{d}</th>
                  {barSeries.map((s) => <td key={s.id} className="num">{(s.values[i] ?? 0).toLocaleString('en-GB')}</td>)}
                  {lineSeries.map((s) => <td key={s.id} className="num">{Math.round((s.values[i] ?? 0) * 100)}%</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${barsLabel} a day, with ${lineSeries.map((s) => s.name).join(' and ')}`}>
            {/* One set of rules, read left for the counts and right for the
                shares. Each side is captioned in the colour of its own marks. */}
            {[0, 0.5, 1].map((f) => (
              <g key={`g${f}`}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yBar(topBar * f)} y2={yBar(topBar * f)} className="chart-grid" />
                <text x={PAD_L - 8} y={yBar(topBar * f) + 3} className="chart-tick left" textAnchor="end">
                  {short(topBar * f)}
                </text>
                <text x={W - PAD_R + 8} y={yBar(topBar * f) + 3} className="chart-tick right" textAnchor="start">
                  {Math.round(topLine * f * 100)}%
                </text>
              </g>
            ))}

            {days.map((d, i) => {
              let base = yBar(0)
              return (
                <g key={`bar-${d}`}>
                  {barSeries.map((s, si) => {
                    const v = s.values[i] ?? 0
                    if (v <= 0) return null
                    const h = Math.max(1, yBar(0) - yBar(v))
                    const y = base - h
                    base = y - (many ? 2 : 0)
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

            {lineSeries.map((s, si) => (
              <g key={s.id}>
                <path
                  d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yLine(v).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke={LINES[si % LINES.length]}
                  strokeWidth={2}
                  strokeDasharray={si ? '5 4' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle
                  cx={x(days.length - 1)}
                  cy={yLine(s.values[s.values.length - 1])}
                  r={4}
                  fill={LINES[si % LINES.length]}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </g>
            ))}

            {days.map((d, i) =>
              i % every === 0 ? (
                <text key={d} x={x(i)} y={H - 6} className="chart-tick" textAnchor="middle">
                  {String(Number(d.slice(8, 10)))}
                </text>
              ) : null,
            )}

            {at !== null && <line x1={x(at)} x2={x(at)} y1={PAD_T - 6} y2={yBar(0)} className="chart-cross" />}
            {days.map((d, i) => (
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
              <b>{days[at]}</b>
              <ul>
                {barSeries.map((s, i) => (
                  <li key={s.id}>
                    <i style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
                    <span>{s.name}</span>
                    <b className="num">{(s.values[at] ?? 0).toLocaleString('en-GB')}</b>
                  </li>
                ))}
                {lineSeries.map((s, i) => (
                  <li key={s.id}>
                    <i className="dash" style={{ background: LINES[i % LINES.length] }} aria-hidden="true" />
                    <span>{s.name}</span>
                    <b className="num">{Math.round((s.values[at] ?? 0) * 100)}%</b>
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
