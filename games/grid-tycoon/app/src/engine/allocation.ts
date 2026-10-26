// The per-pool allocation algorithm of SPEC.md (80% incumbent rule).

export interface AllocationResult {
  reserved: Record<string, number>
  open: Record<string, number>
  used: Record<string, number>
  idle: Record<string, number>
}

export function allocatePool(
  demand: number,
  offers: Record<string, number>,
  lastUsed: Record<string, number>,
  incumbentShare: number,
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
  let spareTotal = 0
  for (const id of ids) spareTotal += Math.max(0, offers[id]) - reserved[id]
  const fits = spareTotal <= openMw
  for (const id of ids) {
    const spare = Math.max(0, offers[id]) - reserved[id]
    open[id] = fits ? spare : spareTotal > 0 ? (openMw * spare) / spareTotal : 0
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
