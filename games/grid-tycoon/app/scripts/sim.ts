// Plays one bot-only game and prints the share price per round and the final ranking.
// Usage: npm run sim -- --seed 7 [--verbose]

import { BOT_NAMES, createGame, defaultConfig, POOLS, rankCompanies, resolveRound, type BotStyle, type GameState } from '../src/engine'

export const SIM_STYLES: BotStyle[] = ['volta', 'nimbus', 'hashfield', 'volta']

export function botGame(seed: number, styles: BotStyle[] = SIM_STYLES): GameState {
  const seen = new Map<BotStyle, number>()
  const companies = styles.map((style) => {
    const n = (seen.get(style) ?? 0) + 1
    seen.set(style, n)
    const suffix = n > 1 ? ` ${n}` : ''
    return { id: n > 1 ? `${style}${n}` : style, name: `${BOT_NAMES[style]}${suffix}`, isBot: true, bot: style }
  })
  return createGame({ seed, companies }, defaultConfig)
}

export function playGame(seed: number, styles: BotStyle[] = SIM_STYLES, onRound?: (s: GameState) => void): GameState {
  let state = botGame(seed, styles)
  while (!state.finished) {
    state = resolveRound(state, {}, defaultConfig)
    onRound?.(state)
  }
  return state
}

const pad = (s: string | number, n: number): string => String(s).padStart(n)

function main(): void {
  const args = process.argv.slice(2)
  const at = args.indexOf('--seed')
  const seed = at >= 0 ? Number(args[at + 1]) : 7
  const verbose = args.includes('--verbose')
  if (!Number.isFinite(seed)) throw new Error('--seed needs a number')

  const first = botGame(seed)
  const names = first.companies.map((c) => c.id)
  console.log(`Grid Tycoon sim, seed ${seed}, ${first.rounds} rounds, bots: ${first.companies.map((c) => c.name).join(', ')}`)
  console.log(`\nShare price per round\n${pad('round', 5)} ${names.map((n) => pad(n, 11)).join(' ')}`)

  const final = playGame(seed, SIM_STYLES, (s) => {
    const summary = s.history.at(-1)!
    const row = names.map((id) => pad(summary.prices[id].toFixed(2), 11)).join(' ')
    console.log(`${pad(summary.round, 5)} ${row}`)
    if (verbose) {
      const pools = POOLS.map((p) => `${p} ${summary.pools[p].demand.toFixed(1)}/${summary.pools[p].used.toFixed(1)}`).join('  ')
      console.log(`      demand/used: ${pools}`)
      for (const c of s.companies) {
        const r = c.history.at(-1)
        if (!r || r.round !== summary.round) continue
        const used = POOLS.map((p) => `${p[0]}${r.used[p].toFixed(1)}`).join(' ')
        const sold = r.finance.forcedSold.length > 0 ? ` FORCED SALE ${r.finance.forcedSold.length}` : ''
        console.log(
          `      ${pad(c.id, 10)} rev ${pad(r.revenue.toFixed(1), 6)} profit ${pad(r.profit.toFixed(1), 6)} cash ${pad(r.treasury.toFixed(1), 7)}` +
            ` plant ${pad(r.plantMw, 3)} dc ${pad(r.dcMw, 3)} idle ${pad((r.idle * 100).toFixed(0), 3)}% rent ${r.rent.requested.toFixed(1)}` +
            ` debt ${pad(r.stock.debt.toFixed(0), 4)} shares ${r.shares} build ${r.finance.buildSpend.toFixed(0)} | ${used}${sold}`,
        )
      }
    }
  })

  console.log('\nFinal ranking')
  rankCompanies(final).forEach((id, i) => {
    const c = final.companies.find((x) => x.id === id)!
    const last = c.history.at(-1)!
    const status = c.bankrupt ? '  BANKRUPT' : ''
    console.log(
      `${i + 1}. ${c.name.padEnd(20)} price ${pad(c.sharePrice.toFixed(2), 8)}  market cap ${pad(c.marketCap.toFixed(0), 6)}` +
        `  revenue ${pad(last.revenue.toFixed(1), 6)}  profit ${pad(last.profit.toFixed(1), 6)}  treasury ${pad(c.treasury.toFixed(0), 5)}  debt ${pad(last.stock.debt.toFixed(0), 4)}${status}`,
    )
  })
}

const isMain = process.argv[1]?.endsWith('sim.ts')
if (isMain) main()
