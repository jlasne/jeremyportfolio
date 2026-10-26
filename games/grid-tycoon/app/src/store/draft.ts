// The player's draft decision for the current decision phase, with an undo stack.
// Every change goes through set(), which pushes the previous decision on `past`; reset() starts the
// phase over from defaultDecision and clears the stack.

import { create } from 'zustand'
import { companyById, defaultDecision, emptyDecision, findFreeTile } from '../engine'
import type { BuildOrder, ComputePool, Decision, Tile } from '../engine'
import { useGame } from './game'

type PowerKey = keyof Decision['power']

/** Changes with the same key within this window merge into one undo step (typing, holding +). */
const COALESCE_MS = 700
const MAX_UNDO = 200

export interface DraftStore {
  decision: Decision
  past: Decision[]
  reset(): void
  /** Applies `mutate` to a copy of the decision. Pass a `coalesceKey` to merge rapid repeats into one undo step. */
  set(mutate: (d: Decision) => void, coalesceKey?: string): void
  undo(): void

  setPower(key: PowerKey, mw: number): void
  setCompute(key: ComputePool, mw: number): void
  setRent(mw: number): void
  /** Plants and datacenters without a tile get the first free lot; link orders of the same use merge. */
  addBuild(order: BuildOrder): void
  removeBuild(index: number): void
  /** Moves a pending plant/dc order to another lot (map drag). */
  moveBuild(index: number, tile: Tile): void
  toggleUpgrade(buildingId: string): void
  setLoanTake(amount: number): void
  setRepay(loanId: string, amount: number): void
  toggleRefinance(loanId: string): void
  setShares(mode: Decision['shares']['mode'], count: number): void
  toggleForcedSale(buildingId: string): void
}

let lastKey: string | null = null
let lastAt = 0

const clone = (d: Decision): Decision => structuredClone(d)
const clean = (x: number): number => (Number.isFinite(x) ? Math.max(0, x) : 0)

export const useDraft = create<DraftStore>()((set, get) => ({
  decision: emptyDecision(),
  past: [],

  reset: () => {
    const { state, meId, config } = useGame.getState()
    lastKey = null
    set({ decision: state && meId ? defaultDecision(state, meId, config) : emptyDecision(), past: [] })
  },

  set: (mutate, coalesceKey) => {
    const prev = get().decision
    const next = clone(prev)
    mutate(next)
    const now = Date.now()
    const merge = coalesceKey != null && coalesceKey === lastKey && now - lastAt < COALESCE_MS && get().past.length > 0
    lastKey = coalesceKey ?? null
    lastAt = now
    set({ decision: next, past: merge ? get().past : [...get().past, prev].slice(-MAX_UNDO) })
  },

  undo: () => {
    const past = get().past
    if (past.length === 0) return
    lastKey = null
    set({ decision: past[past.length - 1], past: past.slice(0, -1) })
  },

  setPower: (key, mw) => get().set((d) => void (d.power[key] = clean(mw)), `power.${key}`),
  setCompute: (key, mw) => get().set((d) => void (d.compute[key] = clean(mw)), `compute.${key}`),
  setRent: (mw) => get().set((d) => void (d.rentMw = clean(mw)), 'rent'),

  addBuild: (order) => {
    const { state, meId, config } = useGame.getState()
    get().set((d) => {
      if (order.kind === 'link') {
        const same = d.builds.find((b) => b.kind === 'link' && b.use === order.use)
        if (same) same.mw = (same.mw ?? 0) + (order.mw ?? 1)
        else d.builds.push({ kind: 'link', use: order.use, mw: order.mw ?? 1 })
        return
      }
      const placed: BuildOrder = { ...order }
      if (!placed.tile && state && meId) {
        const taken = d.builds.filter((b) => b.tile).map((b) => b.tile as Tile)
        placed.tile = findFreeTile(companyById(state, meId), taken, config)
      }
      d.builds.push(placed)
    })
  },

  removeBuild: (index) =>
    get().set((d) => {
      d.builds.splice(index, 1)
    }),

  moveBuild: (index, tile) =>
    get().set((d) => {
      const b = d.builds[index]
      if (b && b.kind !== 'link') b.tile = [tile[0], tile[1]]
    }),

  toggleUpgrade: (id) =>
    get().set((d) => {
      d.upgrades = d.upgrades.includes(id) ? d.upgrades.filter((u) => u !== id) : [...d.upgrades, id]
    }),

  setLoanTake: (amount) => get().set((d) => void (d.loans.take = clean(amount)), 'loan.take'),

  setRepay: (loanId, amount) =>
    get().set((d) => {
      const a = clean(amount)
      if (a > 0) d.loans.repay[loanId] = a
      else delete d.loans.repay[loanId]
    }, `repay.${loanId}`),

  toggleRefinance: (loanId) =>
    get().set((d) => {
      const r = d.loans.refinance
      d.loans.refinance = r.includes(loanId) ? r.filter((x) => x !== loanId) : [...r, loanId]
    }),

  setShares: (mode, count) =>
    get().set(
      (d) => {
        d.shares = { mode, count: mode === 'none' ? 0 : Math.max(0, Math.floor(clean(count))) }
      },
      'shares',
    ),

  toggleForcedSale: (id) =>
    get().set((d) => {
      const f = d.forcedSales
      d.forcedSales = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]
    }),
}))
