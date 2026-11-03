// The allocation flow of the Allocate terminal, as pure functions over a draft decision.
//
// Plants (MW) feed three things: my datacenters (internal link), citizens (town link) and the
// other datacenters pool. Datacenters (MW) are powered by the internal link plus rented MW and
// sell compute to cloud, bitcoin and AI. The player sets compute per pool, rent, citizens and other
// datacenters; the internal link MW is set for them:
//
//   internal = clamp(compute total − rent, 0, min(internal link, plant MW − citizens − other DCs))
//
// Compute and rent never go below the commitment floors (30% drop a round at most). Every edit goes
// through settle(), which keeps the draft valid whenever the floors allow it.

import type { ComputePool, Decision, Floors, PoolId } from '../../engine'

export const COMPUTE: ComputePool[] = ['cloud', 'btc', 'ai']
/** When compute has to give way, the lowest margin goes first. */
const TRIM_ORDER: ComputePool[] = ['btc', 'cloud', 'ai']
const EPS = 1e-6

export const r2 = (x: number): number => Math.round(x * 100) / 100
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

export interface FlowCaps {
  plantMw: number
  dcMw: number
  links: { internal: number; town: number; import: number }
  floors: Floors
}

export type FlowKey = 'town' | 'otherDc' | 'rent' | ComputePool

export const computeTotal = (d: Decision): number => d.compute.cloud + d.compute.btc + d.compute.ai
const floorTotal = (c: FlowCaps): number => c.floors.compute.cloud + c.floors.compute.btc + c.floors.compute.ai

/** Most plant MW the internal link can carry once citizens and other datacenters are served. */
export function internalMax(d: Decision, c: FlowCaps): number {
  return Math.max(0, Math.min(c.links.internal, c.plantMw - d.power.town - d.power.otherDc))
}

/** The internal link MW the terminal sets: what compute needs beyond rent, within the link and the plants. */
export function autoInternal(d: Decision, c: FlowCaps): number {
  return r2(clamp(computeTotal(d) - d.rentMw, 0, internalMax(d, c)))
}

/** Most compute the datacenters can offer: their MW, and the power that reaches them. */
export function computeCap(d: Decision, c: FlowCaps): number {
  return Math.max(0, Math.min(c.dcMw, internalMax(d, c) + d.rentMw))
}

/** Plant MW that goes nowhere (same rule as the engine, with the internal link set automatically). */
export function unallocated(d: Decision, c: FlowCaps): number {
  const used = Math.min(Math.max(0, computeTotal(d) - d.rentMw), d.power.internal)
  return r2(Math.max(0, c.plantMw - d.power.town - d.power.otherDc - used))
}

/** Internal MW the committed compute needs at least, whatever the player does. */
function floorInternal(d: Decision, c: FlowCaps): number {
  return clamp(floorTotal(c) - d.rentMw, 0, c.links.internal)
}

/** Bounds of one control, for the sliders: lowest and highest value it can take now. */
export function bounds(d: Decision, c: FlowCaps, key: FlowKey): { min: number; max: number } {
  const need = floorInternal(d, c)
  switch (key) {
    case 'town':
      return { min: 0, max: r2(Math.max(d.power.town, Math.min(c.links.town, c.plantMw - d.power.otherDc - need))) }
    case 'otherDc':
      return { min: 0, max: r2(Math.max(d.power.otherDc, c.plantMw - d.power.town - need)) }
    case 'rent': {
      // Lowering rent moves compute onto the plants; below this the committed compute loses power.
      const lo = Math.max(c.floors.rentMw, floorTotal(c) - internalMax(d, c))
      return { min: r2(Math.max(0, lo)), max: r2(Math.max(d.rentMw, c.links.import)) }
    }
    default: {
      const room = Math.max(0, computeCap(d, c) - computeTotal(d))
      return { min: r2(c.floors.compute[key]), max: r2(Math.max(d.compute[key], d.compute[key] + room)) }
    }
  }
}

/**
 * Brings the draft back to a valid shape after an edit of `changed` (null: just tidy up): floors,
 * link caps, plant MW, compute within the powered MW (lowest margin trimmed first, never below its
 * floor), then the internal link set automatically. Mutates `d`.
 */
export function settle(d: Decision, c: FlowCaps, changed: FlowKey | null = null): void {
  for (const p of COMPUTE) d.compute[p] = Math.max(c.floors.compute[p], d.compute[p] || 0)
  d.rentMw = Math.max(c.floors.rentMw, Math.min(d.rentMw || 0, Math.max(c.links.import, c.floors.rentMw)))
  d.power.town = clamp(d.power.town || 0, 0, c.links.town)
  d.power.otherDc = Math.max(0, d.power.otherDc || 0)

  // Power sold must leave room for the committed compute.
  let excess = d.power.town + d.power.otherDc + floorInternal(d, c) - c.plantMw
  const giveFirst: ('town' | 'otherDc')[] = changed === 'town' ? ['town', 'otherDc'] : ['otherDc', 'town']
  for (const k of giveFirst) {
    if (excess <= EPS) break
    const cut = Math.min(d.power[k], excess)
    d.power[k] -= cut
    excess -= cut
  }

  // Compute must fit the powered MW.
  let over = computeTotal(d) - computeCap(d, c)
  const order = changed && (COMPUTE as string[]).includes(changed) ? [...TRIM_ORDER.filter((p) => p !== changed), changed as ComputePool] : TRIM_ORDER
  for (const p of order) {
    if (over <= EPS) break
    const cut = Math.min(Math.max(0, d.compute[p] - c.floors.compute[p]), over)
    d.compute[p] -= cut
    over -= cut
  }

  for (const p of COMPUTE) d.compute[p] = r2(d.compute[p])
  d.rentMw = r2(d.rentMw)
  d.power.town = r2(d.power.town)
  d.power.otherDc = r2(d.power.otherDc)
  d.power.internal = autoInternal(d, c)
}

/** Sets one control and settles the rest. */
export function setFlow(d: Decision, c: FlowCaps, key: FlowKey, mw: number): void {
  const v = Math.max(0, Number.isFinite(mw) ? mw : 0)
  if (key === 'town' || key === 'otherDc') d.power[key] = v
  else if (key === 'rent') d.rentMw = v
  else d.compute[key] = v
  settle(d, c, key)
}

/** True when the draft's internal link MW is not what the terminal would set. */
export function needsSettle(d: Decision, c: FlowCaps): boolean {
  const probe = structuredClone(d)
  settle(probe, c)
  return (
    Math.abs(probe.power.internal - d.power.internal) > 0.005 ||
    Math.abs(probe.power.town - d.power.town) > 0.005 ||
    Math.abs(probe.power.otherDc - d.power.otherDc) > 0.005 ||
    Math.abs(probe.rentMw - d.rentMw) > 0.005 ||
    COMPUTE.some((p) => Math.abs(probe.compute[p] - d.compute[p]) > 0.005)
  )
}

/**
 * The "Fill" helper: puts unallocated plant MW into the pools with the best margin that still have
 * room. First pass: only up to what last round's demand would take (projected use). Second pass:
 * whatever capacity is left, so no plant MW pays the unallocated penalty. Mutates `d`; returns the
 * MW it placed.
 */
export function fill(d: Decision, c: FlowCaps, margin: Record<PoolId, number>, demandRoom: (p: PoolId, d: Decision) => number): number {
  const start = unallocated(d, c)
  const order = (Object.keys(margin) as PoolId[]).sort((a, b) => margin[b] - margin[a])
  for (const byDemand of [true, false]) {
    for (const p of order) {
      const free = unallocated(d, c)
      if (free <= 0.005) break
      const want = byDemand ? demandRoom(p, d) : Number.POSITIVE_INFINITY
      if (p === 'citizens' || p === 'otherDc') {
        const key = p === 'citizens' ? 'town' : 'otherDc'
        const room = key === 'town' ? c.links.town - d.power.town : Number.POSITIVE_INFINITY
        const add = Math.min(free, room, want)
        if (add > 0.005) d.power[key] = r2(d.power[key] + add)
      } else {
        // Rent already pays for some powered MW: compute first uses that slack, then plant MW.
        const slack = Math.max(0, d.rentMw - computeTotal(d))
        const room = computeCap(d, c) - computeTotal(d)
        const add = Math.min(free + slack, room, want)
        if (add > 0.005) d.compute[p] = r2(d.compute[p] + add)
      }
      settle(d, c)
    }
  }
  return r2(Math.max(0, start - unallocated(d, c)))
}
