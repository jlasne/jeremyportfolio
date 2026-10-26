// Tiny pixel-art labels drawn on a canvas at 1 art px per pixel, so they scale with the world by
// integers and stay as sharp as the sprites: the crane countdown badge and the coin amounts.
// Textures are cached by content and shared by every map instance.

import { Texture } from 'pixi.js'

// 5 x 7 glyphs (rows of bits, most significant bit = leftmost column). '.' is 2 columns wide.
const GLYPHS: Record<string, { w: number; rows: number[] }> = {
  '0': { w: 5, rows: [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110] },
  '1': { w: 5, rows: [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110] },
  '2': { w: 5, rows: [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111] },
  '3': { w: 5, rows: [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110] },
  '4': { w: 5, rows: [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010] },
  '5': { w: 5, rows: [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110] },
  '6': { w: 5, rows: [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110] },
  '7': { w: 5, rows: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000] },
  '8': { w: 5, rows: [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110] },
  '9': { w: 5, rows: [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100] },
  '+': { w: 5, rows: [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0] },
  '-': { w: 5, rows: [0, 0, 0, 0b11111, 0, 0, 0] },
  '.': { w: 2, rows: [0, 0, 0, 0, 0, 0b11, 0b11] },
  S: { w: 5, rows: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110] },
  E: { w: 5, rows: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111] },
  L: { w: 5, rows: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111] },
}

// 7 x 7 clock face for the countdown badge.
const CLOCK = [0b0011100, 0b0100010, 0b1001001, 0b1001101, 0b1000001, 0b0100010, 0b0011100]
// 7 x 7 kind glyphs, so a plant and a datacenter under construction differ by shape, not only hue:
// a lightning bolt for a plant, a server rack for a datacenter.
const BOLT = [0b0000110, 0b0001100, 0b0011000, 0b0111110, 0b0001100, 0b0011000, 0b0110000]
const RACK = [0b1111111, 0b1000001, 0b1111111, 0b1000001, 0b1111111, 0b1000001, 0b1111111]

const INK = '#1b1a24'
const INK_EDGE = '#3b3f54'
const CREAM = '#fffdf6'
const POWER = '#ffd23f'
const MONEY = '#8fe6dc'
const PLANT = '#ff9e66'
const DC = '#c4b0ff'
const RED = '#e5484d'
const RED_EDGE = '#8f1f24'

const cache = new Map<string, Texture>()

function textWidth(s: string): number {
  let w = 0
  for (const ch of s) w += (GLYPHS[ch]?.w ?? 3) + 1
  return Math.max(0, w - 1)
}

function drawText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string): void {
  ctx.fillStyle = color
  for (const ch of s) {
    const g = GLYPHS[ch]
    if (g) g.rows.forEach((bits, j) => {
      for (let i = 0; i < g.w; i++) if (bits & (1 << (g.w - 1 - i))) ctx.fillRect(x + i, y + j, 1, 1)
    })
    x += (g?.w ?? 3) + 1
  }
}

function make(key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): Texture {
  const hit = cache.get(key)
  if (hit && !hit.destroyed) return hit
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  if (ctx) paint(ctx)
  const tex = Texture.from(cv)
  tex.source.scaleMode = 'nearest'
  cache.set(key, tex)
  return tex
}

function glyph(ctx: CanvasRenderingContext2D, rows: number[], x: number, y: number, color: string): void {
  ctx.fillStyle = color
  rows.forEach((bits, j) => {
    for (let i = 0; i < 7; i++) if (bits & (1 << (6 - i))) ctx.fillRect(x + i, y + j, 1, 1)
  })
}

/**
 * Countdown badge: a dark plate with the kind glyph (bolt = plant, rack = datacenter, when given),
 * a yellow clock and the rounds left in cream.
 */
export function badgeTexture(rounds: number, kind?: 'plant' | 'dc'): Texture {
  const s = String(Math.max(0, Math.min(99, Math.round(rounds))))
  const lead = kind ? 9 : 0
  const w = 3 + lead + 7 + 2 + textWidth(s) + 3
  const h = 11
  return make(`badge:${kind ?? ''}:${s}`, w, h, (ctx) => {
    ctx.fillStyle = INK_EDGE
    ctx.fillRect(1, 0, w - 2, h)
    ctx.fillRect(0, 1, w, h - 2)
    ctx.fillStyle = INK
    ctx.fillRect(1, 1, w - 2, h - 2)
    if (kind) {
      glyph(ctx, kind === 'plant' ? BOLT : RACK, 3, 2, kind === 'plant' ? PLANT : DC)
      ctx.fillStyle = INK_EDGE
      ctx.fillRect(3 + 7 + 1, 2, 1, 7)
    }
    glyph(ctx, CLOCK, 3 + lead, 2, POWER)
    drawText(ctx, s, 12 + lead, 2, CREAM)
  })
}

/** "SELL" tag for a building marked for a forced sale: cream on a red plate with a dark edge. */
export function sellTagTexture(): Texture {
  const s = 'SELL'
  const w = textWidth(s) + 6
  const h = 11
  return make('sell', w, h, (ctx) => {
    ctx.fillStyle = RED_EDGE
    ctx.fillRect(1, 0, w - 2, h)
    ctx.fillRect(0, 1, w, h - 2)
    ctx.fillStyle = RED
    ctx.fillRect(1, 1, w - 2, h - 2)
    drawText(ctx, s, 3, 2, CREAM)
  })
}

/** Coin amount: "+5.2" in light teal with a 1 px ink outline, readable on grass, roads and roofs. */
export function amountTexture(amount: number): Texture {
  const v = Math.abs(amount)
  const s = (amount < 0 ? '-' : '+') + (v >= 100 ? Math.round(v).toString() : v.toFixed(1))
  const w = textWidth(s) + 2
  const h = 9
  return make(`amt:${s}`, w, h, (ctx) => {
    for (const [dx, dy] of [
      [0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 2], [0, 2], [2, 0],
    ])
      drawText(ctx, s, dx, dy, INK)
    drawText(ctx, s, 1, 1, MONEY)
  })
}

/** A 2 x 2 flow dot: electricity yellow with a light top-left pixel (the scene preview's dot). */
export function dotTexture(): Texture {
  return make('dot', 2, 2, (ctx) => {
    ctx.fillStyle = POWER
    ctx.fillRect(0, 0, 2, 2)
    ctx.fillStyle = '#fff1a8'
    ctx.fillRect(0, 0, 1, 1)
  })
}
