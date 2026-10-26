// Small SVG charts for the Market panel, drawn at their real pixel width (crisp lines, undistorted
// text) and themed through CSS custom properties. Each chart has a <title>/<desc>, a visually
// hidden data table, and a crosshair readout on hover and on keyboard focus (arrow keys).

import { useId, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { fmtMoney, fmtMw, fmtPct } from '../kit'
import { useWidth } from './common'

/** A clean axis maximum: 1, 2, 2.5 or 5 × 10^k at or above x. */
export function niceMax(x: number): number {
  if (!(x > 0)) return 1
  const k = Math.pow(10, Math.floor(Math.log10(x)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * k >= x - 1e-9) return m * k
  return 10 * k
}

const compact = (v: number): string => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : Number.isInteger(v) ? String(v) : v.toFixed(1))

interface PoolChartProps {
  /** Pool name for the title, e.g. "AI". */
  name: string
  /** CSS class suffix of the pool (citizens, otherDc...), picks the themed line / band colours. */
  pool: string
  /** Round of each point (0 = start). */
  rounds: number[]
  demand: number[]
  mine: number[]
  height?: number
}

const PAD = { l: 34, r: 10, t: 10, b: 22 }

export function PoolChart({ name, pool, rounds, demand, mine, height = 104 }: PoolChartProps) {
  const id = useId()
  const [boxRef, width] = useWidth<HTMLDivElement>(300)
  const [hover, setHover] = useState<number | null>(null)
  const n = rounds.length
  const plotW = Math.max(10, width - PAD.l - PAD.r)
  const plotH = height - PAD.t - PAD.b
  const yMax = niceMax(Math.max(...demand, ...mine, 0.1) * 1.08)
  const x = (i: number) => PAD.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => PAD.t + plotH - (Math.max(0, v) / yMax) * plotH
  const base = PAD.t + plotH

  const line = demand.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')
  const band =
    n > 1
      ? `M${x(0).toFixed(1)} ${base}` + mine.map((v, i) => `L${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('') + `L${x(n - 1).toFixed(1)} ${base}Z`
      : ''
  const bandTop = mine.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')
  const ticks = [0, yMax / 2, yMax]

  const last = n - 1
  const desc =
    n > 1
      ? `Demand went from ${fmtMw(demand[0])} at the start to ${fmtMw(demand[last])} in round ${rounds[last]}. You used ${fmtMw(mine[last])} last round.`
      : `Start demand ${fmtMw(demand[0] ?? 0)}. History appears after round 1.`

  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (n === 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const i = n <= 1 ? 0 : Math.round(((px - PAD.l) / plotW) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (n === 0) return
    const cur = hover ?? n - 1
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = Math.max(0, cur - 1)
    else if (e.key === 'ArrowRight') next = Math.min(n - 1, cur + 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else if (e.key === 'Escape' && hover != null) {
      e.stopPropagation()
      setHover(null)
      return
    }
    if (next == null) return
    e.preventDefault()
    setHover(next)
  }

  const h = hover
  const tipLeft = h != null ? Math.min(Math.max(x(h), 70), width - 70) : 0

  return (
    <div className={`pchart pchart-${pool}`} ref={boxRef}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        tabIndex={0}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => {
          // Touch keeps the readout after a tap; mouse clears it when leaving.
          if (e.pointerType === 'mouse') setHover(null)
        }}
        onFocus={() => setHover((v) => v ?? n - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
      >
        <title id={`${id}-t`}>{`${name}: demand per round and your used MW`}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line className="pchart-grid" x1={PAD.l} x2={width - PAD.r} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            <text className="pchart-tick" x={PAD.l - 6} y={y(t)} dy="0.35em" textAnchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        {n > 0 ? (
          <>
            <text className="pchart-tick" x={x(0)} y={height - 4} textAnchor={n > 1 ? 'start' : 'middle'}>
              {rounds[0] === 0 ? 'Start' : `R${rounds[0]}`}
            </text>
            {n > 1 ? (
              <text className="pchart-tick" x={x(last)} y={height - 4} textAnchor="end">
                R{rounds[last]}
              </text>
            ) : null}
          </>
        ) : null}
        {band ? <path className="pchart-band" d={band} /> : null}
        {n > 1 && mine.some((v) => v > 0) ? <path className="pchart-band-top" d={bandTop} /> : null}
        {n > 1 ? <path className="pchart-line" d={line} /> : null}
        {n > 0 ? <circle className="pchart-dot" cx={x(last)} cy={y(demand[last])} r={4} /> : null}
        {n > 0 && mine[last] > 0 ? <circle className="pchart-dot-me" cx={x(last)} cy={y(mine[last])} r={3.5} /> : null}
        {h != null ? (
          <g className="pchart-cross" aria-hidden="true">
            <line x1={Math.round(x(h)) + 0.5} x2={Math.round(x(h)) + 0.5} y1={PAD.t} y2={base} />
            <circle className="pchart-dot" cx={x(h)} cy={y(demand[h])} r={4} />
            {mine[h] > 0 ? <circle className="pchart-dot-me" cx={x(h)} cy={y(mine[h])} r={3.5} /> : null}
          </g>
        ) : null}
      </svg>
      {h != null ? (
        <div className="pchart-tip" style={{ left: tipLeft }} aria-hidden="true">
          <span className="pchart-tip-head">{rounds[h] === 0 ? 'Start' : `Round ${rounds[h]}`}</span>
          <span className="pchart-tip-row">
            <span className="key key-line" />
            <strong className="num">{fmtMw(demand[h])}</strong> demand
          </span>
          <span className="pchart-tip-row">
            <span className="key key-band" />
            <strong className="num">{fmtMw(mine[h])}</strong> you{demand[h] > 0 ? <span className="num"> · {fmtPct(mine[h] / demand[h])}</span> : null}
          </span>
        </div>
      ) : null}
      <table className="visually-hidden">
        <caption>{name}: demand and your used MW per round</caption>
        <thead>
          <tr>
            <th scope="col">Round</th>
            <th scope="col">Demand (MW)</th>
            <th scope="col">You (MW)</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r, i) => (
            <tr key={r}>
              <th scope="row">{r === 0 ? 'Start' : r}</th>
              <td>{fmtMw(demand[i], { unit: false })}</td>
              <td>{fmtMw(mine[i], { unit: false })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface SparklineProps {
  values: number[]
  color: string
  label: string
  width?: number
  height?: number
}

/** A price sparkline: one 2 px line in the company colour with an end dot. */
export function Sparkline({ values, color, label, width = 76, height = 28 }: SparklineProps) {
  const n = values.length
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || Math.max(1, hi * 0.1)
  const pad = 4
  const x = (i: number) => pad + (n <= 1 ? (width - 2 * pad) / 2 : (i / (n - 1)) * (width - 2 * pad))
  const y = (v: number) => pad + (height - 2 * pad) * (1 - (v - lo) / span) - (hi === lo ? (height - 2 * pad) / 2 : 0)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')
  const first = values[0] ?? 0
  const lastV = values[n - 1] ?? 0
  return (
    <svg className="spark" width={width} height={height} role="img" aria-label={`${label}: ${fmtMoney(first)} at the start, ${fmtMoney(lastV)} now`}>
      {n > 1 ? <path d={d} stroke={color} /> : null}
      {n > 0 ? <circle cx={x(n - 1)} cy={y(lastV)} r={3.5} fill={color} /> : null}
    </svg>
  )
}
