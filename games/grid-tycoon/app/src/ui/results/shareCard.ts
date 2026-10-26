// The end-of-game share card: a 1200 × 630 PNG drawn on a canvas in the game's pixel style. Pixel
// faces for the headings, a strip of atlas sprites at integer scale along the bottom, the player's
// rank and final price on the left, every company's price line on the right.

import type { Series } from './PriceChart'

export const CARD_W = 1200
export const CARD_H = 630

const BASE = import.meta.env.BASE_URL

const C = {
  ink: '#1b1a24',
  slate: '#2d2f40',
  slate2: '#3b3f54',
  cream: '#fffdf6',
  stone: '#9aa1b8',
  stoneLight: '#d4d8e4',
  power: '#ffd23f',
  powerDark: '#c99a1a',
  money: '#8fe6dc',
  good: '#8fe0a8',
  bad: '#ff9a9d',
  grassDark: '#4f7d32',
}
const COMPANY = ['#e07a2f', '#4a8ad8', '#7b5fd0', '#34b36a', '#e5484d', '#2fb8b0']

export interface CardInput {
  name: string
  rank: number
  of: number
  price: number
  startPrice: number
  seed: number
  rounds: number
  series: Series[]
  meId: string | null
}

interface Atlas {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>
  points?: Record<string, { foot?: [number, number] }>
}

let atlasPromise: Promise<{ json: Atlas; img: HTMLImageElement } | null> | null = null
function loadAtlas() {
  if (!atlasPromise) {
    atlasPromise = (async () => {
      try {
        const res = await fetch(`${BASE}sprites/atlas.json`)
        if (!res.ok) return null
        const json = (await res.json()) as Atlas
        const img = new Image()
        img.src = `${BASE}sprites/atlas.png`
        await img.decode()
        return { json, img }
      } catch {
        return null
      }
    })()
  }
  return atlasPromise
}

async function loadFonts(): Promise<void> {
  if (!document.fonts?.load) return
  await Promise.all(
    ['700 64px "Pixelify Sans"', '600 32px "Pixelify Sans"', '400 32px "Silkscreen"', '700 24px "Nunito Sans"', '800 24px "Nunito Sans"'].map((f) => document.fonts.load(f).catch(() => [])),
  )
}

/** A 7 × 11 pixel bolt, the logo mark. */
const BOLT = ['....###', '...###.', '..###..', '.######', '######.', '...##..', '..##...', '..#....', '.#.....', '#......', '.......']

function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, px: number) {
  ctx.fillStyle = C.powerDark
  BOLT.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && ctx.fillRect(x + i * px + px, y + j * px + px, px, px)))
  ctx.fillStyle = C.power
  BOLT.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && ctx.fillRect(x + i * px, y + j * px, px, px)))
}

const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}`

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawStrip(ctx: CanvasRenderingContext2D, atlas: { json: Atlas; img: HTMLImageElement } | null) {
  const top = 486
  // ground: grass tiles at 2×, a road along the top edge
  if (!atlas) {
    ctx.fillStyle = C.grassDark
    ctx.fillRect(0, top, CARD_W, CARD_H - top)
    return
  }
  const { json, img } = atlas
  const put = (name: string, dx: number, dy: number, s: number) => {
    const f = json.frames[name]?.frame
    if (!f) return 0
    ctx.drawImage(img, f.x, f.y, f.w, f.h, Math.round(dx), Math.round(dy), f.w * s, f.h * s)
    return f.w * s
  }
  const S = 2
  for (let y = top, row = 0; y < CARD_H; y += 32 * S, row++)
    for (let x = 0, col = 0; x < CARD_W; x += 32 * S, col++) put(`grass_summer_${(col * 7 + row * 3) % 4 === 0 ? 2 : (col + row) % 4}`, x, y, S)
  ctx.fillStyle = 'rgba(27,26,36,0.55)'
  ctx.fillRect(0, top, CARD_W, 4)

  // a row of buildings and props standing on a common baseline
  const base = 606
  const row: [string, number][] = [
    ['tree_summer', 6],
    ['house_0', 2],
    ['house_3', 18],
    ['plant_small', 4],
    ['lamp', 10],
    ['plant_big', 6],
    ['pylon', 14],
    ['dc_small', 4],
    ['lamp', 10],
    ['dc_big', 8],
    ['bush_0', 4],
    ['house_2', 4],
    ['tree_summer', 4],
    ['house_5', 4],
    ['tree_summer', 4],
  ]
  let x = -8
  for (const [name, gap] of row) {
    const f = json.frames[name]?.frame
    if (!f) continue
    const foot = json.points?.[name]?.foot ?? [f.w / 2, f.h - 4]
    const w = put(name, x, base - foot[1] * S, S)
    x += w + gap
    if (x > CARD_W) break
  }
}

function drawChart(ctx: CanvasRenderingContext2D, input: CardInput, bx: number, by: number, bw: number, bh: number) {
  ctx.fillStyle = C.slate
  roundRect(ctx, bx, by, bw, bh, 16)
  ctx.fill()
  ctx.font = '400 20px "Silkscreen", monospace'
  ctx.fillStyle = C.stone
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('SHARE PRICE BY ROUND', bx + 24, by + 38)

  const px = bx + 24
  const pw = bw - 48 - 96
  const py = by + 58
  const ph = bh - 58 - 28
  const n = Math.max(1, ...input.series.map((s) => s.prices.length)) - 1
  const max = Math.max(1, ...input.series.flatMap((s) => s.prices)) * 1.08
  const X = (i: number) => px + (i / n) * pw
  const Y = (v: number) => py + ph - (Math.max(0, v) / max) * ph

  ctx.strokeStyle = C.slate2
  ctx.lineWidth = 2
  for (let k = 0; k <= 4; k++) {
    const yy = Math.round(py + (ph * k) / 4) + 0.5
    ctx.beginPath()
    ctx.moveTo(px, yy)
    ctx.lineTo(px + pw, yy)
    ctx.stroke()
  }
  ctx.fillStyle = C.stone
  ctx.font = '400 16px "Silkscreen", monospace'
  ctx.fillText('START', px, by + bh - 8)
  ctx.textAlign = 'right'
  ctx.fillText(`R${n}`, px + pw, by + bh - 8)
  ctx.textAlign = 'left'

  const ordered = [...input.series].sort((a, b) => (a.id === input.meId ? 1 : b.id === input.meId ? -1 : 0))
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const s of ordered) {
    const me = s.id === input.meId
    ctx.beginPath()
    s.prices.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))))
    ctx.strokeStyle = C.slate
    ctx.lineWidth = me ? 10 : 8
    ctx.stroke()
    ctx.strokeStyle = COMPANY[s.color % 6]
    ctx.lineWidth = me ? 6 : 3
    ctx.stroke()
  }
  // end labels, pushed apart
  const ends = input.series.map((s) => ({ s, y: Y(s.prices[s.prices.length - 1] ?? 0) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 26) ends[i].y = ends[i - 1].y + 26
  const over = ends.length ? ends[ends.length - 1].y - (py + ph) : 0
  if (over > 0) for (const e of ends) e.y -= over
  for (const { s, y } of ends) {
    const lx = px + pw + 14
    const me = s.id === input.meId
    ctx.fillStyle = COMPANY[s.color % 6]
    ctx.fillRect(lx, Math.round(y) - 7, 12, 12)
    ctx.fillStyle = me ? C.cream : C.stoneLight
    ctx.font = me ? '700 20px "Nunito Sans", sans-serif' : '600 18px "Nunito Sans", sans-serif'
    ctx.fillText(me ? 'You' : fmt(s.prices[s.prices.length - 1] ?? 0), lx + 18, Math.round(y) + 5)
  }
}

export async function drawShareCard(input: CardInput): Promise<HTMLCanvasElement> {
  const [atlas] = await Promise.all([loadAtlas(), loadFonts()])
  const cv = document.createElement('canvas')
  cv.width = CARD_W
  cv.height = CARD_H
  const ctx = cv.getContext('2d')
  if (!ctx) return cv
  ctx.imageSmoothingEnabled = false

  // background: dusk slate with a faint pixel dither
  ctx.fillStyle = C.ink
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  ctx.fillStyle = 'rgba(255,255,255,0.025)'
  for (let y = 0; y < 486; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < CARD_W; x += 8) ctx.fillRect(x, y, 2, 2)

  drawStrip(ctx, atlas)

  // logo
  drawBolt(ctx, 56, 44, 4)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.cream
  ctx.font = '700 40px "Pixelify Sans", monospace'
  ctx.fillText('Grid Tycoon', 98, 82)

  // rank
  const winner = input.rank === 1
  ctx.font = '400 22px "Silkscreen", monospace'
  ctx.fillStyle = winner ? C.power : C.stone
  ctx.fillText(winner ? 'WINNER AFTER ' + input.rounds + ' ROUNDS' : 'FINAL RANK AFTER ' + input.rounds + ' ROUNDS', 56, 150)
  ctx.font = '400 128px "Silkscreen", monospace'
  ctx.fillStyle = winner ? C.power : C.cream
  const rankText = `#${input.rank}`
  ctx.fillText(rankText, 50, 270)
  const rw = ctx.measureText(rankText).width
  ctx.font = '400 32px "Silkscreen", monospace'
  ctx.fillStyle = C.stone
  ctx.fillText(`OF ${input.of}`, 50 + rw + 14, 270)

  // name, clipped to the column
  ctx.font = '600 38px "Pixelify Sans", monospace'
  ctx.fillStyle = C.cream
  let name = input.name
  while (ctx.measureText(name).width > 440 && name.length > 4) name = name.slice(0, -2) + '…'
  ctx.fillText(name, 56, 326)

  // price
  ctx.font = '400 20px "Silkscreen", monospace'
  ctx.fillStyle = C.stone
  ctx.fillText('FINAL SHARE PRICE', 56, 380)
  ctx.font = '400 56px "Silkscreen", monospace'
  ctx.fillStyle = C.money
  const priceText = fmt(input.price)
  ctx.fillText(priceText, 52, 440)
  const pw = ctx.measureText(priceText).width
  const change = input.price - input.startPrice
  ctx.font = '800 24px "Nunito Sans", sans-serif'
  ctx.fillStyle = change >= 0 ? C.good : C.bad
  ctx.fillText(`${signed(change)} since the start`, 52 + pw + 18, 432)

  drawChart(ctx, input, 560, 44, 596, 372)

  // seed tag on the strip
  const tag = `SEED ${input.seed}`
  ctx.font = '400 20px "Silkscreen", monospace'
  const tw = ctx.measureText(tag).width
  ctx.fillStyle = 'rgba(27,26,36,0.82)'
  roundRect(ctx, CARD_W - tw - 56, 440, tw + 32, 34, 8)
  ctx.fill()
  ctx.fillStyle = C.cream
  ctx.fillText(tag, CARD_W - tw - 40, 464)
  return cv
}

export function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'))
}
