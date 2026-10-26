// A pixel sprite from the atlas as a CSS background: integer scale only, nearest-neighbour
// (image-rendering: pixelated), so build cards show the same art as the map. The atlas JSON is
// fetched once and shared; until it arrives (or if it fails) the box keeps its size and shows a
// kind icon instead.

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number }
}
interface Atlas {
  frames: Record<string, AtlasFrame>
  meta: { image: string; size: { w: number; h: number } }
}

const BASE = import.meta.env.BASE_URL
let atlas: Atlas | null = null
let loading: Promise<Atlas | null> | null = null

function loadAtlas(): Promise<Atlas | null> {
  if (!loading) {
    loading = fetch(`${BASE}sprites/atlas.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Atlas>) : null))
      .then((a) => (atlas = a))
      .catch(() => null)
  }
  return loading
}

function useAtlas(): Atlas | null {
  const [a, setA] = useState<Atlas | null>(atlas)
  useEffect(() => {
    if (a) return
    let alive = true
    void loadAtlas().then((x) => {
      if (alive && x) setA(x)
    })
    return () => {
      alive = false
    }
  }, [a])
  return a
}

interface SpriteProps {
  frame: string
  /** Integer scale (1, 2, 3). */
  scale?: number
  /** Size of the box before the atlas loads. */
  size?: { w: number; h: number }
  fallback?: ReactNode
  className?: string
}

export function Sprite({ frame, scale = 1, size, fallback, className }: SpriteProps) {
  const a = useAtlas()
  const f = a?.frames[frame]?.frame
  const s = Math.max(1, Math.round(scale))
  const w = (f?.w ?? size?.w ?? 64) * s
  const h = (f?.h ?? size?.h ?? 64) * s
  const style: CSSProperties = { width: w, height: h }
  if (a && f) {
    style.backgroundImage = `url(${BASE}sprites/${a.meta.image})`
    style.backgroundPosition = `${-f.x * s}px ${-f.y * s}px`
    style.backgroundSize = `${a.meta.size.w * s}px ${a.meta.size.h * s}px`
  }
  return (
    <span className={`sprite${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      {a && f ? null : fallback}
    </span>
  )
}
