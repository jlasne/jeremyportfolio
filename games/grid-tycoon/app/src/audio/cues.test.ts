import { describe, expect, it } from 'vitest'
import { CUES, CUE_NAMES, cueLength, toneFreq } from './cues'
import { noteToMidi } from './notes'
import type { CueTone } from './types'

/** The pitched notes of a cue's main voice, in time order (doublings at the same time dropped). */
function melody(tones: CueTone[]): number[] {
  const byTime = new Map<number, number>()
  for (const t of tones) if (t.note && t.wave !== 'triangle' && !byTime.has(t.at)) byTime.set(t.at, noteToMidi(t.note))
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m)
}

describe('sound cues', () => {
  it('has every cue the game uses', () => {
    expect(CUE_NAMES.sort()).toEqual(['click', 'coins', 'crane', 'error', 'lock', 'stockDown', 'stockUp'])
  })

  for (const name of CUE_NAMES) {
    it(`${name} is short (under 600 ms) and soft`, () => {
      const tones = CUES[name]
      expect(tones.length).toBeGreaterThan(0)
      expect(cueLength(tones)).toBeLessThan(0.6)
      for (const t of tones) {
        expect(t.gain).toBeGreaterThan(0)
        expect(t.gain).toBeLessThanOrEqual(0.6)
        if (t.wave !== 'noise') expect(toneFreq(t)).toBeGreaterThan(20)
      }
    })
  }

  it('lock is a two-note rising confirm', () => {
    const m = melody(CUES.lock)
    expect(m).toHaveLength(2)
    expect(m[1]).toBeGreaterThan(m[0])
  })

  it('coins are quick blips climbing an arpeggio', () => {
    const m = melody(CUES.coins)
    expect(m.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThan(m[i - 1])
    for (const t of CUES.coins) expect(t.dur).toBeLessThanOrEqual(0.1)
  })

  it('crane is a noisy clank followed by a rising ding', () => {
    const clank = CUES.crane.filter((t) => t.wave === 'noise')
    const ding = CUES.crane.filter((t) => t.wave === 'bell')
    expect(clank.length).toBeGreaterThan(0)
    expect(ding.length).toBeGreaterThanOrEqual(2)
    expect(Math.min(...ding.map((t) => t.at))).toBeGreaterThan(Math.max(...clank.map((t) => t.at)))
    expect(toneFreq(ding[1])).toBeGreaterThan(toneFreq(ding[0]))
  })

  it('stockUp is a rising major triad', () => {
    const m = melody(CUES.stockUp)
    expect(m.map((x) => x - m[0])).toEqual([0, 4, 7])
  })

  it('stockDown is a falling minor third', () => {
    const m = melody(CUES.stockDown)
    expect(m).toHaveLength(2)
    expect(m[1] - m[0]).toBe(-3)
  })

  it('click is a tiny tick', () => {
    expect(cueLength(CUES.click)).toBeLessThan(0.05)
  })

  it('error is a low buzz', () => {
    for (const t of CUES.error) expect(toneFreq(t)).toBeLessThan(200)
  })
})
