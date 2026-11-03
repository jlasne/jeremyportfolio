import type { Config } from './types'

// The per-pool allocation algorithm of SPEC.md (80% incumbent rule).

export interface AllocationResult {
  reserved: Record<string, number>
  open: Record<string, number>
  used: Record<string, number>
  idle: Record<string, number>
}

export type AllocationWeights = Record<string, number>

/**
 * Priority on a pool's open MW. A company that already holds a large share of the pool, and has served
 * it for many rounds in a row, gets its spare MW in first: weight = (1 + shareWeight × last share)
 * × (1 + tenurePerRound × min(tenure, tenureCap)). A newcomer has weight 1.
 */
export function priorityWeights(
  pool: { lastUsed: Record<string, number>; tenure?: Record<string, number> },
  ids: string[],
  config: Config,
): AllocationWeights {
  const a = config.allocation
  let total = 0
  for (const id of ids) total += Math.max(0, pool.lastUsed[id] ?? 0)
  const out: AllocationWeights = {}
  for (const id of ids) {
    const share = total > 0 ? Math.max(0, pool.lastUsed[id] ?? 0) / total : 0
    const tenure = Math.min(a.tenureCap, Math.max(0, pool.tenure?.[id] ?? 0))
    out[id] = (1 + a.shareWeight * share) * (1 + a.tenurePerRound * tenure)
  }
  return out
}

export function allocatePool(
  demand: number,
  offers: Record<string, number>,
  lastUsed: Record<string, number>,
  incumbentShare: number,
  weights?: AllocationWeights,
): AllocationResult {
  const ids = Object.keys(offers)
  const d = Math.max(0, demand)
  const reserved: Record<string, number> = {}
  const open: Record<string, number> = {}
  const used: Record<string, number> = {}
  const idle: Record<string, number> = {}

  let reservedTotal = 0
  for (const id of ids) {
    const r = Math.min(Math.max(0, offers[id]), incumbentShare * Math.max(0, lastUsed[id] ?? 0))
    reserved[id] = r
    reservedTotal += r
  }

  if (reservedTotal > d) {
    // The pool shrank below what incumbents hold: everyone keeps the same fraction of its reserve.
    const scale = reservedTotal > 0 ? d / reservedTotal : 0
    for (const id of ids) {
      reserved[id] *= scale
      open[id] = 0
      used[id] = reserved[id]
      idle[id] = Math.max(0, offers[id]) - used[id]
    }
    return { reserved, open, used, idle }
  }

  const openMw = d - reservedTotal
  const spare: Record<string, number> = {}
  let spareTotal = 0
  for (const id of ids) {
    spare[id] = Math.max(0, offers[id]) - reserved[id]
    spareTotal += spare[id]
  }
  if (spareTotal <= openMw) {
    for (const id of ids) open[id] = spare[id]
  } else {
    // Weighted water filling: open MW split by spare × weight, a company never above its spare;
    // what a capped company cannot take goes to the others by the same rule.
    const w = (id: string): number => Math.max(0, weights?.[id] ?? 1) * spare[id]
    for (const id of ids) open[id] = 0
    let left = openMw
    let active = ids.filter((id) => spare[id] > 0)
    for (let guard = 0; guard < ids.length + 1 && left > 1e-12 && active.length > 0; guard++) {
      const total = active.reduce((s, id) => s + w(id), 0)
      if (total <= 0) break
      const capped = active.filter((id) => (left * w(id)) / total >= spare[id] - open[id])
      if (capped.length === 0) {
        for (const id of active) open[id] += (left * w(id)) / total
        left = 0
        break
      }
      for (const id of capped) {
        left -= spare[id] - open[id]
        open[id] = spare[id]
      }
      active = active.filter((id) => !capped.includes(id))
    }
  }
  for (const id of ids) {
    used[id] = reserved[id] + open[id]
    idle[id] = Math.max(0, offers[id]) - used[id]
  }
  return { reserved, open, used, idle }
}

/**
 * Rent matching (SPEC Round flow step 3): each renter takes MW sold to the other datacenters pool
 * by OTHER companies first, never its own sales. Returns the MW each renter gets from rivals.
 *
 * The most rivals can fill is min(total rent, total sold, and for each company k the rent of the
 * others plus the sales of the others). Any split where no renter gets more than it asked or more
 * than the others sold is reachable, so that total is shared pro rata to the requests, with
 * renters whose rivals sold too little capped at what they sold and the rest shared again.
 */
export function matchRent(rent: Record<string, number>, sold: Record<string, number>): Record<string, number> {
  const ids = Object.keys(rent)
  const r = (id: string): number => Math.max(0, rent[id] ?? 0)
  const s = (id: string): number => Math.max(0, sold[id] ?? 0)
  let totalRent = 0
  let totalSold = 0
  for (const id of ids) totalRent += r(id)
  for (const id of Object.keys(sold)) totalSold += s(id)

  let fill = Math.min(totalRent, totalSold)
  for (const id of ids) fill = Math.min(fill, totalRent - r(id) + totalSold - s(id))
  const out: Record<string, number> = {}
  for (const id of ids) out[id] = 0
  if (fill <= 0) return out

  // Water filling: renters with the lowest cap per MW asked are capped first.
  const renters = ids
    .filter((id) => r(id) > 0)
    .map((id) => ({ id, ask: r(id), cap: Math.min(r(id), Math.max(0, totalSold - s(id))) }))
    .sort((a, b) => a.cap / a.ask - b.cap / b.ask)
  let left = fill
  let askLeft = totalRent
  let i = 0
  for (; i < renters.length; i++) {
    const x = renters[i]
    if (x.cap / x.ask > left / askLeft) break
    out[x.id] = x.cap
    left -= x.cap
    askLeft -= x.ask
  }
  const share = askLeft > 0 ? Math.max(0, left) / askLeft : 0
  for (; i < renters.length; i++) out[renters[i].id] = renters[i].ask * share
  return out
}
