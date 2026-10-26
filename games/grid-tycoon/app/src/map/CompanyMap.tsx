// The company map (SPEC "Company map (home)", DESIGN.md section 6): a PixiJS pixel world that fills
// `.map-area`, an accessible DOM layer of one button per lot over it, the building card, and the
// tap-to-place banner. The Pixi side lives in view.ts and reads the stores itself; this component
// only mounts it and renders the DOM parts (which re-render on store changes, never per frame).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { companyById, plotRows } from '../engine'
import type { Tile } from '../engine'
import { useDraft } from '../store/draft'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { Button, Icon, useMediaQuery } from '../ui/kit'
import BuildingCard from './BuildingCard'
import { cancelPlacement, orderLabel, placeAt } from './drag'
import { lotRect, tileKey } from './layout'
import { freeTiles, usePlacement } from './placement'
import { kindName } from './stats'
import { MapView } from './view'
import './map.css'

export { mapApi } from './placement'

export default function CompanyMap() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<MapView | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let alive = true
    let made: MapView | null = null
    MapView.create(host, () => alive)
      .then((v) => {
        if (!v) return
        if (!alive) return v.destroy()
        made = v
        if (import.meta.env.DEV) (window as unknown as { __gtMap?: MapView }).__gtMap = v
        setView(v)
      })
      .catch((err: unknown) => {
        console.warn('Company map could not start', err)
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
      made?.destroy()
      setView(null)
      cancelPlacement()
    }
  }, [])

  // a new phase (lock in, results) ends any placement in progress
  const phase = useGame((s) => s.phase)
  useEffect(() => {
    if (phase !== 'decide') cancelPlacement()
  }, [phase])

  return (
    // tabIndex -1: a click on the canvas focuses the map (not <body>), so Tab goes on to the lots
    <div ref={hostRef} className="cmap" tabIndex={-1}>
      {view ? <LotLayer view={view} /> : null}
      {view ? <BuildingCard view={view} /> : null}
      <PlacementBanner view={view} />
      {failed ? (
        <p className="cmap-failed" role="status">
          <Icon name="warn" size={16} /> The map could not start on this device (WebGL is off). Every decision still works from the panels.
        </p>
      ) : null}
    </div>
  )
}

interface LotItem {
  tile: Tile
  key: string
  kind: 'building' | 'pending' | 'free'
  id: string | null
  label: string
}

/**
 * One focusable button per lot, positioned over the canvas. They take no pointer events (the canvas
 * handles mouse and touch); they exist for keyboard and screen-reader users. One tab stop for the
 * whole plot (roving tabindex): arrows move between lots, Enter selects or places.
 */
function LotLayer({ view }: { view: MapView }) {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const decision = useDraft((s) => s.decision)
  const selected = useUi((s) => s.selected)
  const select = useUi((s) => s.select)
  const open = useUi((s) => s.open)
  const mode = usePlacement((s) => s.mode)
  const tapping = mode === 'tap'
  const [scale, setScale] = useState(view.cssScale)
  const [active, setActive] = useState<string | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => view.onLayout(() => setScale(view.cssScale)), [view])
  useLayoutEffect(() => {
    const el = layerRef.current
    if (!el) return
    const apply = () => {
      const [x, y] = view.offset
      el.style.transform = `translate(${x}px, ${y}px)`
    }
    apply()
    return view.onCamera(apply)
  }, [view])

  const items = useMemo<LotItem[]>(() => {
    if (!state || !meId) return []
    const me = companyById(state, meId)
    const pendingTiles = decision.builds.filter((b) => b.kind !== 'link' && b.tile).map((b) => b.tile as Tile)
    const rows = plotRows(me, pendingTiles, config)
    const byTile = new Map(me.buildings.map((b) => [tileKey(b.tile), b]))
    const pend = new Map(decision.builds.flatMap((b) => (b.kind !== 'link' && b.tile ? [[tileKey(b.tile), b] as const] : [])))
    const out: LotItem[] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < config.plot.lotsPerRow; c++) {
        const tile: Tile = [c, r]
        const key = tileKey(tile)
        const where = `lot ${c + 1}, row ${r + 1}`
        const b = byTile.get(key)
        const p = pend.get(key)
        if (b) {
          const st =
            b.status === 'building'
              ? `building, ${b.roundsLeft} round${b.roundsLeft === 1 ? '' : 's'} left`
              : b.status === 'upgrading'
                ? `upgrading, ${b.roundsLeft} round${b.roundsLeft === 1 ? '' : 's'} left`
                : `online, ${b.mw} MW`
          out.push({ tile, key, kind: 'building', id: b.id, label: `${kindName(b.kind, b.size)}, ${st}${decision.upgrades.includes(b.id) ? ', upgrade ordered' : ''}, ${where}` })
        } else if (p && p.kind !== 'link') out.push({ tile, key, kind: 'pending', id: `pending:${key}`, label: `${kindName(p.kind, p.size ?? 'small')} ordered this round, ${where}` })
        else out.push({ tile, key, kind: 'free', id: null, label: `Free ${where}` })
      }
    return out
  }, [state, meId, decision, config])

  const free = useMemo(() => {
    if (!tapping || !state || !meId) return null
    return new Set(freeTiles(state, meId, decision, config).map(tileKey))
  }, [tapping, state, meId, decision, config])

  // the roving tab stop: the selected lot, else the first (or the first free lot while placing)
  const fallback = (tapping ? items.find((i) => free?.has(i.key)) : (selected ? items.find((i) => i.id === selected) : undefined) ?? items[0])?.key ?? null
  const current = active && items.some((i) => i.key === active) && (!tapping || free?.has(active)) ? active : fallback

  // placing from the keyboard: focus moves onto the plot
  useEffect(() => {
    if (!tapping || !fallback) return
    setActive(fallback)
    const t = window.setTimeout(() => layerRef.current?.querySelector<HTMLButtonElement>(`[data-lot="${fallback}"]`)?.focus({ preventScroll: true }), 30)
    return () => window.clearTimeout(t)
  }, [tapping])

  const focusLot = (key: string) => {
    setActive(key)
    layerRef.current?.querySelector<HTMLButtonElement>(`[data-lot="${key}"]`)?.focus({ preventScroll: true })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const d = dirs[e.key]
    if (!d && e.key !== 'Home' && e.key !== 'End') return
    const pool = items.filter((i) => !tapping || free?.has(i.key))
    if (!pool.length) return
    e.preventDefault()
    if (e.key === 'Home') return focusLot(pool[0].key)
    if (e.key === 'End') return focusLot(pool[pool.length - 1].key)
    const from = items.find((i) => i.key === current)?.tile ?? pool[0].tile
    // nearest lot in that direction (Manhattan, preferring the straight line)
    let best: LotItem | null = null
    let bestScore = Infinity
    for (const it of pool) {
      const dx = it.tile[0] - from[0]
      const dy = it.tile[1] - from[1]
      const along = dx * d[0] + dy * d[1]
      if (along <= 0) continue
      const across = Math.abs(d[0] ? dy : dx)
      const score = along + across * 3
      if (score < bestScore) {
        bestScore = score
        best = it
      }
    }
    if (best) focusLot(best.key)
  }

  const activate = (it: LotItem) => {
    if (tapping) {
      if (free?.has(it.key)) placeAt(it.tile)
      return
    }
    if (it.kind === 'free') {
      open('build')
      return
    }
    select(selected === it.id ? null : it.id)
  }

  const placingOrder = usePlacement((s) => s.order)
  return (
    <div
      ref={layerRef}
      className={`map-lots${tapping ? ' is-placing' : ''}`}
      role="group"
      aria-label={tapping && placingOrder ? `Choose a free lot for the ${orderLabel(placingOrder).toLowerCase()}. Arrow keys move, Enter places, Escape cancels.` : 'Company plot. Arrow keys move between lots, Enter opens a building.'}
      onKeyDown={onKeyDown}
    >
      {items.map((it) => {
        const r = lotRect(it.tile)
        const disabled = tapping && !free?.has(it.key)
        return (
          <button
            key={it.key}
            type="button"
            data-lot={it.key}
            className={`map-lot is-${it.kind}`}
            tabIndex={it.key === current ? 0 : -1}
            aria-pressed={it.kind === 'free' ? undefined : selected === it.id}
            aria-disabled={disabled || undefined}
            aria-label={tapping && free?.has(it.key) ? `Place here: ${it.label}` : it.label}
            style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }}
            onFocus={() => {
              setActive(it.key)
              view.revealTile(it.tile)
              if (tapping) usePlacement.setState({ hover: free?.has(it.key) ? it.tile : null })
            }}
            onClick={() => activate(it)}
          />
        )
      })}
    </div>
  )
}

/** "Tap a free lot · Cancel" while placing from a card tap or the keyboard; a hint while dragging. */
function PlacementBanner({ view }: { view: MapView | null }) {
  const mode = usePlacement((s) => s.mode)
  const active = usePlacement((s) => s.active)
  const order = usePlacement((s) => s.order)
  const touch = useMediaQuery('(hover: none)')
  const ref = useRef<HTMLDivElement>(null)
  const shown = !!mode && !!order && order.kind !== 'link' && (mode === 'tap' || active)
  // centred on the part of the map the sheet leaves visible, not on the whole map
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !view || !shown) return
    const place = () => {
      const safe = view.safeRect
      el.style.left = `${Math.round((safe.x0 + safe.x1) / 2)}px`
      el.style.maxWidth = `${Math.max(160, Math.round(safe.x1 - safe.x0 - 24))}px`
    }
    place()
    return view.onCamera(place)
  }, [view, shown])
  if (!shown || !order || order.kind === 'link') return null
  const name = orderLabel(order).toLowerCase()
  return (
    <div ref={ref} className="cmap-banner" role="status">
      <Icon name="crane" size={16} />
      {mode === 'tap' ? (
        <>
          <span>
            {touch ? 'Tap' : 'Click'} a free lot for the {name}
          </span>
          <Button size="sm" variant="ghost" onClick={() => cancelPlacement()}>
            Cancel
          </Button>
        </>
      ) : (
        <span>Drop on a free lot · Esc cancels</span>
      )}
    </div>
  )
}
