import { resolve } from 'node:path'
import { readJson, writeJson, today } from '../core/log.js'

// Fifty a day, per Instagram account, counted on disk.
//
// On disk because the cap has to survive a crash. A counter held in memory
// resets every time the run dies, which turns a cap into a suggestion.

type Counters = Record<string, { date: string; sent: number }>

export class DailyCap {
  private readonly file: string
  private counters: Counters

  constructor(logDir: string, private readonly cap: number) {
    this.file = resolve(logDir, 'counters.json')
    this.counters = readJson<Counters>(this.file, {})
  }

  private row(account: string): { date: string; sent: number } {
    const row = this.counters[account]
    // A new day is a new count. Midnight is read off this machine's clock.
    if (!row || row.date !== today()) {
      const fresh = { date: today(), sent: 0 }
      this.counters[account] = fresh
      return fresh
    }
    return row
  }

  sentToday(account: string): number {
    return this.row(account).sent
  }

  remaining(account: string): number {
    return Math.max(0, this.cap - this.sentToday(account))
  }

  /** Counted when a message actually goes out. A draft costs nothing. */
  record(account: string): void {
    this.row(account).sent++
    writeJson(this.file, this.counters)
  }
}
