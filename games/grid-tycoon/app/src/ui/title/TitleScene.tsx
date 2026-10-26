// A decorative strip of the company map under the title: grass, a road, a power station, pylons,
// datacenters, houses and trees, drawn from the generated sprite atlas at an integer scale. If the
// atlas is missing it simply renders nothing.

import { useEffect, useRef, useState } from 'react'

interface Frame {
  frame: { x: number; y: number; w: number; h: number }
}
interface Atlas {
  frames: Record<string, Frame>
}

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const

/** Sprite placements on a 32 px tile grid: [frame, column, bottom row]. */
function layout(season: (typeof SEASONS)[number]): [string, number, number][] {
  return [
    [`tree_${season}`, 0, 3],
    ['house_0', 1, 3],
    ['house_2', 2, 3],
    ['townhall', 3, 3],
    ['house_4', 5, 3],
    [`tree_${season}`, 6, 3],
    ['pylon', 7, 3],
    ['plant_big', 8, 3],
    ['plant_small', 11, 3],
    ['pylon', 13, 3],
    ['dc_big', 14, 3],
    ['crane', 17, 3],
    ['dc_small', 19, 3],
    [`tree_${season}`, 21, 3],
    ['substation', 22, 3],
    ['house_1', 24, 3],
    [`tree_${season}`, 25, 3],
  ]
}

const COLS = 27
const ROWS = 4
const TILE = 32

export function TitleScene() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [ok, setOk] = useState(true)

  useEffect(() => {
    let cancelled = false
    const base = import.meta.env.BASE_URL
    // Northern-hemisphere season of today: March to May is spring.
    const season = SEASONS[Math.floor(((new Date().getMonth() + 10) % 12) / 3)]
    Promise.all([
      fetch(`${base}sprites/atlas.json`).then((r) => (r.ok ? (r.json() as Promise<Atlas>) : Promise.reject(new Error('atlas')))),
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = `${base}sprites/atlas.png`
      }),
    ])
      .then(([atlas, img]) => {
        if (cancelled || !ref.current) return
        const ctx = ref.current.getContext('2d')
        if (!ctx) return
        ctx.imageSmoothingEnabled = false
        const draw = (name: string, x: number, y: number) => {
          const f = atlas.frames[name]?.frame
          if (f) ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y - f.h, f.w, f.h)
        }
        for (let c = 0; c < COLS; c++) {
          for (let r = 0; r < ROWS; r++) draw(r === ROWS - 1 ? `road_h` : `grass_${season}_${(c * 7 + r * 3) % 4}`, c * TILE, (r + 1) * TILE)
        }
        for (const [name, col, row] of layout(season)) draw(name, col * TILE, row * TILE)
      })
      .catch(() => !cancelled && setOk(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (!ok) return null
  return (
    <div className="title-scene" aria-hidden="true">
      <canvas ref={ref} width={COLS * TILE} height={ROWS * TILE} />
    </div>
  )
}
