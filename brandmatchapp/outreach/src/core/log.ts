import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Step, Usage } from './types.js'

// One line per step on disk, one line per message on screen, one total a day.
//
// The cost log is the reason this file exists. A browser agent is only worth
// running if it stays under what the same work costs elsewhere, and that is a
// number, not a feeling.

export function today(): string {
  return new Date().toLocaleDateString('en-CA')
}

export type DmRecord = {
  at: string
  account: string
  handle: string
  leadId: string
  /** 'drafted' stops before sending. 'sent' pressed the key. */
  outcome: 'drafted' | 'sent' | 'skipped' | 'failed'
  reason?: string
  message?: string
  steps: number
  decideCalls: number
  visionCalls: number
  browserSeconds: number
  usd: number
}

export class Log {
  private readonly dir: string
  private readonly browserUsdPerHour: number

  constructor(dir: string, browserUsdPerHour: number) {
    this.dir = dir
    this.browserUsdPerHour = browserUsdPerHour
    mkdirSync(dir, { recursive: true })
  }

  private file(kind: 'steps' | 'dms'): string {
    return resolve(this.dir, `${kind}-${today()}.jsonl`)
  }

  step(s: Step): void {
    appendFileSync(this.file('steps'), JSON.stringify(s) + '\n')
  }

  dm(r: DmRecord): void {
    appendFileSync(this.file('dms'), JSON.stringify(r) + '\n')
  }

  /** Browser time costs nothing locally. The column stays so the totals read alike. */
  browserCost(seconds: number): number {
    return (seconds / 3600) * this.browserUsdPerHour
  }

  /** The day so far, read back from the file rather than held in memory. */
  day(): { dms: number; sent: number; usd: number } {
    const f = this.file('dms')
    if (!existsSync(f)) return { dms: 0, sent: 0, usd: 0 }
    const rows = readFileSync(f, 'utf8').split('\n').filter(Boolean)
    let sent = 0
    let usd = 0
    for (const line of rows) {
      try {
        const r = JSON.parse(line) as DmRecord
        if (r.outcome === 'sent') sent++
        usd += r.usd
      } catch {
        /* a half written line at the end of a killed run */
      }
    }
    return { dms: rows.length, sent, usd: round(usd) }
  }
}

export function round(usd: number): number {
  return Math.round(usd * 1e6) / 1e6
}

export function addUsage(a: Usage, b: Usage): Usage {
  return { tokensIn: a.tokensIn + b.tokensIn, tokensOut: a.tokensOut + b.tokensOut, usd: round(a.usd + b.usd) }
}

export const ZERO: Usage = { tokensIn: 0, tokensOut: 0, usd: 0 }

/** A small JSON file, read and written whole. Used for the daily counters. */
export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function writeJson(file: string, value: unknown): void {
  mkdirSync(resolve(file, '..'), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}
