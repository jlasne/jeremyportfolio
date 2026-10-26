import { describe, expect, it } from 'vitest'
import {
  BASE_HOUSES,
  CORE,
  PLOT_X0,
  PLOT_X1,
  TOWN_SNAPS,
  WORLD_W,
  clampCam,
  dotGap,
  ensureVisible,
  flowSpeed,
  frameX,
  houseCount,
  houseSpots,
  laneCount,
  laneShift,
  lotRect,
  pairUp,
  pickScale,
  polyline,
  routeFromSubstation,
  routeLots,
  routeToSubstation,
  routeToTown,
  tileAt,
  worldRows,
} from './layout'

describe('map layout', () => {
  it('places lots 4 per row, 96 px pads, a road row between lot rows', () => {
    expect(lotRect([0, 0])).toEqual({ x: PLOT_X0, y: 64, w: 96, h: 96 })
    expect(lotRect([3, 1])).toEqual({ x: PLOT_X0 + 288, y: 192, w: 96, h: 96 })
  })

  it('maps art points back to lots and ignores roads and the town', () => {
    expect(tileAt(PLOT_X0 + 10, 70, 2)).toEqual([0, 0])
    expect(tileAt(PLOT_X0 + 100, 200, 2)).toEqual([1, 1])
    expect(tileAt(PLOT_X0 + 10, 165, 2)).toBeNull() // road row between lot rows
    expect(tileAt(40, 100, 2)).toBeNull() // town
    expect(tileAt(PLOT_X0 + 10, 200, 1)).toBeNull() // past the last lot row
  })

  it('grows the town with the citizens share: base houses + 1 per 0.5 MW', () => {
    expect(houseCount(0)).toBe(BASE_HOUSES)
    expect(houseCount(0.49)).toBe(BASE_HOUSES)
    expect(houseCount(2)).toBe(BASE_HOUSES + 4)
    expect(houseCount(Number.NaN)).toBe(BASE_HOUSES)
    expect(laneCount(2)).toBe(1)
    expect(laneCount(6)).toBe(2)
    expect(houseSpots(7).map((h) => h.lane)).toEqual([0, 0, 1, 1, 1, 1, 2])
    expect(worldRows(2, 4)).toBe(12)
    expect(worldRows(10, 4)).toBe(44)
    expect(worldRows(2, houseCount(20))).toBeGreaterThan(12)
  })

  it('routes along roads with axis-aligned segments only', () => {
    for (const pts of [routeLots([0, 0], [3, 2]), routeLots([1, 0], [2, 0]), routeToTown([2, 1]), routeFromSubstation([0, 3]), routeToSubstation([3, 0])]) {
      for (let i = 1; i < pts.length; i++) expect(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1]).toBe(true)
      expect(polyline(pts).length).toBeGreaterThan(0)
    }
    expect(routeToSubstation([3, 0])[0]).toEqual(routeFromSubstation([3, 0], -9).at(-1))
  })

  it('pairs every plant and datacenter at least once', () => {
    expect(pairUp([1, 2, 3], ['a'])).toEqual([[1, 'a'], [2, 'a'], [3, 'a']])
    expect(pairUp([1], ['a', 'b'])).toEqual([[1, 'a'], [1, 'b']])
    expect(pairUp([], ['a'])).toEqual([])
  })

  it('speeds dots up with MW, stops at 0, caps the speed', () => {
    expect(flowSpeed(0)).toBe(0)
    expect(flowSpeed(10)).toBeGreaterThan(flowSpeed(2))
    expect(flowSpeed(10000)).toBe(140)
    // a log scale: doubling the MW is a visible step anywhere in the game's range
    expect(flowSpeed(16) - flowSpeed(8)).toBeGreaterThan(10)
    expect(flowSpeed(80) - flowSpeed(40)).toBeGreaterThan(10)
    expect(flowSpeed(150)).toBeLessThan(140)
    expect(dotGap(0.5)).toBeGreaterThan(dotGap(10))
    expect(dotGap(10)).toBeGreaterThan(dotGap(60))
    expect(dotGap(1000)).toBe(10)
  })

  it('gives each direction its own lane', () => {
    // east (south of the line), then south (west of it), then west (north of it)
    const pts = laneShift([[0, 0], [100, 0], [100, 50], [20, 50]], 5)
    expect(pts).toEqual([[0, 5], [95, 5], [95, 45], [20, 45]])
    // the same road driven both ways lands on two lanes
    const a = laneShift([[0, 0], [100, 0]])
    const b = laneShift([[100, 0], [0, 0]])
    expect(a[0][1]).not.toBe(b[0][1])
    for (const pts of [routeLots([0, 0], [3, 2], 0), routeToTown([2, 1], 0), routeFromSubstation([0, 3], 0)]) {
      const sh = laneShift(pts)
      for (let i = 1; i < sh.length; i++) expect(sh[i][0] === sh[i - 1][0] || sh[i][1] === sh[i - 1][1]).toBe(true)
    }
  })

  it('frames the town with the plot and never slices a house column', () => {
    expect(frameX(WORLD_W + 100)).toBeLessThan(0)
    expect(frameX(700)).toBe(0)
    expect(frameX(PLOT_X1 + 12)).toBe(0)
    const x = frameX(560)
    expect(TOWN_SNAPS).toContain(x)
    expect(x + 560).toBeGreaterThanOrEqual(PLOT_X1)
    // too narrow for any of the town: the lots are centred
    expect(frameX(400)).toBe((PLOT_X0 + PLOT_X1) / 2 - 200)
  })

  it('picks integer device scales: 2-3 CSS px on desktop, about 1 on phones', () => {
    expect(pickScale({ viewW: 1196, viewH: 686, dpr: 1, sheetW: 404, phone: false })).toBe(2)
    expect(pickScale({ viewW: 1356, viewH: 786, dpr: 2, sheetW: 404, phone: false })).toBe(4)
    expect(pickScale({ viewW: 1836, viewH: 980, dpr: 1, sheetW: 404, phone: false })).toBe(3)
    expect(pickScale({ viewW: 390, viewH: 600, dpr: 3, sheetW: 0, phone: true })).toBe(3)
    expect(pickScale({ viewW: 375, viewH: 600, dpr: 2, sheetW: 0, phone: true })).toBe(2)
    expect(pickScale({ viewW: 300, viewH: 400, dpr: 1, sheetW: 0, phone: true })).toBe(1)
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) expect(Number.isInteger(pickScale({ viewW: 1000, viewH: 700, dpr, sheetW: 404, phone: false }))).toBe(true)
  })

  it('clamps the camera to the world, centres a narrow world and hangs a short one from the top', () => {
    const safe = { x0: 0, y0: 0, x1: 400, y1: 300 }
    expect(clampCam(-50, -50, 1, safe, WORLD_W, 1000)).toEqual([0, 0])
    expect(clampCam(9999, 9999, 1, safe, WORLD_W, 1000)).toEqual([WORLD_W - 400, 700])
    const [x, y] = clampCam(0, 50, 2, { x0: 0, y0: 0, x1: 2000, y1: 1000 }, WORLD_W, 384)
    expect(x).toBeCloseTo(-(2000 - WORLD_W * 2) / 2 / 2)
    expect(y).toBe(0)
    // a top margin above the world, and a short world centred on request
    expect(clampCam(0, -50, 1, safe, WORLD_W, 1000, { top: 20 })[1]).toBe(-20)
    expect(clampCam(0, 0, 1, safe, WORLD_W, 100, { centreY: true })[1]).toBe(-100)
  })

  it('moves the camera just enough to show a rect', () => {
    const safe = { x0: 0, y0: 0, x1: 400, y1: 300 }
    expect(ensureVisible(0, 0, 1, safe, { x: 20, y: 20, w: 50, h: 50 })).toEqual([0, 0])
    const [, y] = ensureVisible(0, 0, 1, safe, { x: 10, y: 900, w: 50, h: 96 })
    expect(y).toBe(900 + 96 + 12 - 300)
    expect(CORE.x1 - CORE.x0).toBe(448)
  })
})
