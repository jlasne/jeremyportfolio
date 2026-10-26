import { describe, expect, it } from 'vitest'
import { allocatePool } from './index'

describe('allocatePool edge cases', () => {
  it('zero demand: nobody sells, everything offered is idle', () => {
    const r = allocatePool(0, { a: 4, b: 2 }, { a: 3, b: 1 }, 0.8)
    expect(r.used).toEqual({ a: 0, b: 0 })
    expect(r.idle).toEqual({ a: 4, b: 2 })
  })

  it('no offers: an empty result', () => {
    const r = allocatePool(10, {}, { a: 5 }, 0.8)
    expect(r).toEqual({ reserved: {}, open: {}, used: {}, idle: {} })
  })

  it('all incumbents offering what they used: growth is shared by spare, nobody loses', () => {
    const r = allocatePool(22, { a: 10, b: 10 }, { a: 10, b: 10 }, 0.8)
    expect(r.reserved).toEqual({ a: 8, b: 8 })
    expect(r.used.a).toBeCloseTo(10, 10)
    expect(r.used.b).toBeCloseTo(10, 10)
  })

  it('a company that offers less than its reserve keeps only what it offers', () => {
    const r = allocatePool(20, { a: 3, b: 10 }, { a: 10, b: 5 }, 0.8)
    expect(r.reserved.a).toBe(3)
    expect(r.used.a).toBe(3)
    expect(r.used.b).toBeCloseTo(10, 10)
  })

  it('spare that fits the open MW is served in full', () => {
    const r = allocatePool(30, { a: 6, b: 6 }, { a: 5, b: 0 }, 0.8)
    expect(r.used).toEqual({ a: 6, b: 6 })
    expect(r.idle).toEqual({ a: 0, b: 0 })
  })

  it('never hands out more than demand, never more than offered', () => {
    const offers = { a: 7, b: 3.5, c: 12, d: 0 }
    const last = { a: 6, b: 4, c: 1, d: 3 }
    for (const demand of [0, 1, 4, 8, 11, 15, 22.5, 40]) {
      const r = allocatePool(demand, offers, last, 0.8)
      const total = Object.values(r.used).reduce((x, y) => x + y, 0)
      expect(total).toBeLessThanOrEqual(demand + 1e-9)
      for (const id of Object.keys(offers)) {
        expect(r.used[id]).toBeLessThanOrEqual(offers[id as keyof typeof offers] + 1e-9)
        expect(r.used[id]).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
