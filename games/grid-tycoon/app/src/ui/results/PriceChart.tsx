// Every company's share price over the game, as an SVG line chart sized to its box. Identity is
// never colour alone: each company also has a marker shape (legend, line ends, hover dots) and the
// line ends carry direct labels on wide screens. A crosshair follows the pointer or the arrow keys
// and a table view sits under the chart for screen readers and anyone who prefers numbers.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { fmtMoney } from '../kit'

export interface Series {
  id: string
  name: string
  color: number
  /** Index 0 = start price, then one per resolved round. */
  prices: number[]
  bankrupt?: boolean
}

export const MARKERS = ['circle', 'square', 'diamond', 'triangle', 'down', 'cross'] as const

/** A marker shape of `size` px centred on (x, y), as an SVG path. */
export function markerPath(shape: (typeof MARKERS)[number], x: number, y: number, size: number): string {
  const r = size / 2
  switch (shape) {
    case 'square':
      return `M${x - r * 0.85} ${y - r * 0.85}h${r * 1.7}v${r * 1.7}h${-r * 1.7}z`
    case 'diamond':
      return `M${x} ${y - r * 1.1}L${x + r * 1.1} ${y}L${x} ${y + r * 1.1}L${x - r * 1.1} ${y}z`
    case 'triangle':
      return `M${x} ${y - r * 1.1}L${x + r * 1.05} ${y + r * 0.8}L${x - r * 1.05} ${y + r * 0.8}z`
    case 'down':
      return `M${x} ${y + r * 1.1}L${x + r * 1.05} ${y - r * 0.8}L${x - r * 1.05} ${y - r * 0.8}z`
    case 'cross': {
      const t = r * 0.4
      return `M${x - t} ${y - r}h${2 * t}v${r - t}h${r - t}v${2 * t}h${t - r}v${r - t}h${-2 * t}v${t - r}h${t - r}v${-2 * t}h${r - t}z`
    }
    default:
      return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
  }
}

export const markerOf = (color: number) => MARKERS[color % MARKERS.length]
export const companyVar = (color: number) => `var(--company-${color % 6})`

function niceMax(v: number): { max: number; step: number } {
  const raw = Math.max(1, v) / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  return { max: Math.ceil(v / step) * step, step }
}

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.round(el.clientWidth)))
    ro.observe(el)
    setW(Math.round(el.clientWidth))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

interface Props {
  series: Series[]
  meId: string | null
  /** Accessible title of the chart. */
  title: string
}

export function PriceChart({ series, meId, title }: Props) {
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const n = Math.max(1, ...series.map((s) => s.prices.length)) - 1
  const narrow = width < 520
  const H = narrow ? 230 : 300
  const M = { top: 14, right: narrow ? 18 : 132, bottom: 32, left: 46 }
  const W = Math.max(280, width)
  const iw = W - M.left - M.right
  const ih = H - M.top - M.bottom
  const top = Math.max(1, ...series.flatMap((s) => s.prices))
  const { max, step } = niceMax(top * 1.05)
  const x = (i: number) => M.left + (n === 0 ? 0 : (i / n) * iw)
  const y = (v: number) => M.top + ih - (Math.max(0, v) / max) * ih

  // me drawn last (on top)
  const ordered = useMemo(() => [...series].sort((a, b) => (a.id === meId ? 1 : b.id === meId ? -1 : 0)), [series, meId])

  // direct labels at the line ends, pushed apart so they never overlap
  const labels = useMemo(() => {
    const items = series.map((s) => ({ s, y: y(s.prices[s.prices.length - 1] ?? 0) })).sort((a, b) => a.y - b.y)
    const gap = 30
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap
    const overflow = items.length ? items[items.length - 1].y - (M.top + ih) : 0
    if (overflow > 0) for (const it of items) it.y -= overflow
    for (let i = items.length - 2; i >= 0; i--) if (items[i + 1].y - items[i].y < gap) items[i].y = items[i + 1].y - gap
    return items
  }, [series, max, H, W])

  const xTicks: number[] = []
  const xStep = n > 20 ? 10 : n > 8 ? 5 : 1
  for (let i = 0; i <= n; i += xStep) xTicks.push(i)
  if (xTicks[xTicks.length - 1] !== n) xTicks.push(n)
  const yTicks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) yTicks.push(v)

  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - M.left) / iw) * n)
    setHover(Math.max(0, Math.min(n, i)))
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setHover((h) => Math.max(0, Math.min(n, (h ?? (e.key === 'ArrowRight' ? -1 : n + 1)) + (e.key === 'ArrowRight' ? 1 : -1))))
    } else if (e.key === 'Home') setHover(0)
    else if (e.key === 'End') setHover(n)
    else if (e.key === 'Escape') setHover(null)
  }

  const tip = hover != null ? [...series].map((s) => ({ s, v: s.prices[Math.min(hover, s.prices.length - 1)] ?? 0 })).sort((a, b) => b.v - a.v) : null
  const tipLeft = hover != null ? (x(hover) / W) * 100 : 0

  return (
    <div className="es-chart" ref={boxRef}>
      {width > 0 ? (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}. Use the left and right arrow keys to read each round.`}
          tabIndex={0}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          <g className="es-grid-lines">
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} className={v === 0 ? 'is-base' : undefined} />
                <text x={M.left - 8} y={y(v)} dy="0.35em" textAnchor="end">
                  {v % 1 === 0 ? v : v.toFixed(1)}
                </text>
              </g>
            ))}
            {xTicks.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n ? 'end' : 'middle'}>
                {i === 0 ? 'Start' : `R${i}`}
              </text>
            ))}
          </g>
          {ordered.map((s) => {
            const d = s.prices.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')
            const last = s.prices.length - 1
            const me = s.id === meId
            return (
              <g key={s.id} className={me ? 'es-line is-me' : 'es-line'} style={{ color: companyVar(s.color) }}>
                <path d={d} className="es-line-halo" />
                <path d={d} className="es-line-path" />
                <path d={markerPath(markerOf(s.color), x(last), y(s.prices[last]), me ? 12 : 10)} className="es-marker" />
              </g>
            )
          })}
          {!narrow
            ? labels.map(({ s, y: ly }) => {
                const last = s.prices.length - 1
                return (
                  <g key={s.id} className={`es-end-label${s.id === meId ? ' is-me' : ''}`}>
                    <line x1={x(last) + 8} x2={x(last) + 16} y1={y(s.prices[last])} y2={ly} style={{ stroke: companyVar(s.color) }} />
                    <text x={x(last) + 20} y={ly - 3}>
                      {s.id === meId ? 'You' : s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}
                    </text>
                    <text x={x(last) + 20} y={ly + 13} className="es-end-price">
                      {fmtMoney(s.prices[last])}
                    </text>
                  </g>
                )
              })
            : null}
          {hover != null ? (
            <g className="es-cross" aria-hidden="true">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} />
              {series.map((s) => {
                const v = s.prices[Math.min(hover, s.prices.length - 1)] ?? 0
                return <path key={s.id} d={markerPath(markerOf(s.color), x(hover), y(v), 10)} style={{ color: companyVar(s.color) }} className="es-marker" />
              })}
            </g>
          ) : null}
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}
      {tip && hover != null ? (
        <div className={`es-tip${tipLeft > 60 ? ' is-left' : ''}`} style={{ left: `${tipLeft}%` }} aria-live="polite">
          <p className="es-tip-title">{hover === 0 ? 'Start' : `Round ${hover}`}</p>
          <ul>
            {tip.map(({ s, v }) => (
              <li key={s.id} className={s.id === meId ? 'is-me' : undefined}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ color: companyVar(s.color) }}>
                  <path d={markerPath(markerOf(s.color), 6, 6, 9)} fill="currentColor" />
                </svg>
                <span className="es-tip-name">{s.id === meId ? 'You' : s.name}</span>
                <span className="num">{fmtMoney(v)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** Legend with marker shapes, names and final prices (always shown, since the chart has several series). */
export function ChartLegend({ series, meId }: { series: Series[]; meId: string | null }) {
  return (
    <ul className="es-legend">
      {series.map((s) => (
        <li key={s.id} className={s.id === meId ? 'is-me' : undefined}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ color: companyVar(s.color) }}>
            <path d={markerPath(markerOf(s.color), 7, 7, 11)} fill="currentColor" />
          </svg>
          <span>{s.id === meId ? `${s.name} (you)` : s.name}</span>
          {s.bankrupt ? <span className="muted">bankrupt</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** The same numbers as a table, every few rounds plus the last. */
export function ChartTable({ series, meId }: { series: Series[]; meId: string | null }) {
  const n = Math.max(1, ...series.map((s) => s.prices.length)) - 1
  const rows: number[] = []
  for (let i = 0; i <= n; i += 4) rows.push(i)
  if (rows[rows.length - 1] !== n) rows.push(n)
  return (
    <details className="es-table">
      <summary>Show the prices as a table</summary>
      <div className="es-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Round</th>
              {series.map((s) => (
                <th key={s.id} scope="col">
                  {s.id === meId ? 'You' : s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i}>
                <th scope="row">{i === 0 ? 'Start' : i}</th>
                {series.map((s) => (
                  <td key={s.id} className="num">
                    {fmtMoney(s.prices[Math.min(i, s.prices.length - 1)] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
