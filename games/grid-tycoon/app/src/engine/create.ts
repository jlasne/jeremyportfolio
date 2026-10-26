// New games: every company gets the same start kit, pools scale with the number of companies.

import { firstFree } from './assets'
import { buildingSpec, defaultConfig } from './config'
import { POOLS } from './constants'
import { round2 } from './money'
import type { BotStyle, Company, CompanySeed, Config, GameState, PoolId, Pool, Tile } from './types'

export const BOT_NAMES: Record<BotStyle, string> = {
  volta: 'Volta Utility',
  nimbus: 'Nimbus Compute',
  hashfield: 'Hashfield Mining',
}
export const BOT_ORDER: BotStyle[] = ['volta', 'nimbus', 'hashfield']

export function createGame(opts: { seed: number; companies: CompanySeed[] }, config: Config = defaultConfig): GameState {
  let nextId = 1
  const id = (prefix: string): string => `${prefix}${nextId++}`
  const n = opts.companies.length

  const companies: Company[] = opts.companies.map((seed, i) => {
    const taken = new Set<string>()
    const buildings = config.start.buildings.map((s) => {
      const kind = s.kind as 'plant' | 'dc'
      const size = s.size as 'small' | 'big'
      const spec = buildingSpec(config, kind, size)
      const tile: Tile = firstFree(taken, config)
      taken.add(`${tile[0]},${tile[1]}`)
      return { id: id('b'), kind, size, mw: spec.mw, status: 'online' as const, roundsLeft: 0, pricePaid: spec.cost, tile, builtRound: 0 }
    })
    const links = config.start.links.map((l) => ({ id: id('l'), use: l.use as 'internal' | 'town' | 'import', mw: l.mw, roundsLeft: 0 }))
    return {
      id: seed.id,
      name: seed.name,
      isBot: seed.isBot,
      bot: seed.isBot ? (seed.bot ?? 'volta') : null,
      bankrupt: false,
      color: i,
      treasury: config.start.treasury,
      shares: config.start.shares,
      businessValue: config.start.businessValue,
      marketCap: config.start.businessValue,
      sharePrice: round2(config.start.businessValue / config.start.shares),
      buildings,
      links,
      loans: [],
      history: [],
      lastDecision: null,
    }
  })

  const pools = {} as Record<PoolId, Pool>
  for (const p of POOLS) {
    pools[p] = {
      demand: config.pool.startPerCompany[p] * n,
      growth: config.pool.meanGrowth[p],
      expectedGrowth: config.pool.meanGrowth[p],
      lastUsed: {},
    }
  }

  return {
    version: 1,
    seed: opts.seed,
    round: 1,
    rounds: config.rounds,
    finished: false,
    rngState: opts.seed >>> 0,
    nextId,
    pools,
    companies,
    history: [],
  }
}

/** Solo: the player ('you') plus Volta Utility, Nimbus Compute and Hashfield Mining. */
export function createSoloGame(opts: { seed: number; playerName: string }, config: Config = defaultConfig): GameState {
  const bots: CompanySeed[] = []
  for (let i = 0; i < config.solo.bots; i++) {
    const style = BOT_ORDER[i % BOT_ORDER.length]
    const lap = Math.floor(i / BOT_ORDER.length)
    bots.push({ id: lap === 0 ? style : `${style}${lap + 1}`, name: lap === 0 ? BOT_NAMES[style] : `${BOT_NAMES[style]} ${lap + 1}`, isBot: true, bot: style })
  }
  return createGame({ seed: opts.seed, companies: [{ id: 'you', name: opts.playerName || 'You', isBot: false, bot: null }, ...bots] }, config)
}
