import { describe, expect, it } from 'vitest'
import { noteToMidi } from './notes'
import { compileSong, parseChord, parseLine } from './pattern'
import { SONGS } from './songs'
import type { Season } from './types'

const SEASONS: Season[] = [0, 1, 2, 3]
const NAMES = ['spring', 'summer', 'autumn', 'winter']

describe('season loops', () => {
  it('has one loop per season, in season order', () => {
    expect(SEASONS.map((s) => SONGS[s].title)).toEqual(NAMES)
    for (const s of SEASONS) expect(SONGS[s].season).toBe(s)
  })

  for (const s of SEASONS) {
    const song = SONGS[s]
    describe(song.title, () => {
      const c = compileSong(song) // throws on any bar that does not add up

      it('is 16 to 32 bars at 84 to 112 bpm', () => {
        expect(c.bars).toBeGreaterThanOrEqual(16)
        expect(c.bars).toBeLessThanOrEqual(32)
        expect(song.bpm).toBeGreaterThanOrEqual(84)
        expect(song.bpm).toBeLessThanOrEqual(112)
      })

      it('has 2 to 4 voices and every one plays', () => {
        expect(song.parts.length).toBeGreaterThanOrEqual(2)
        expect(song.parts.length).toBeLessThanOrEqual(4)
        for (const t of c.tracks) expect(t.events.length).toBeGreaterThan(0)
      })

      it('changes chord at least every two bars, so it is a progression and not a drone', () => {
        const stepsPerBar = song.beatsPerBar * song.stepsPerBeat
        const chords = parseLine(song.chords, stepsPerBar, song.stepsPerBeat, parseChord).events
        expect(new Set(chords.map((e) => e.value.symbol)).size).toBeGreaterThanOrEqual(4)
        for (const e of chords) expect(e.length).toBeLessThanOrEqual(2 * stepsPerBar)
      })

      it('keeps the bass low and the melody above it', () => {
        const range = (name: string) => {
          const t = c.tracks.find((x) => x.part.name === name)
          const midis = t ? t.events.flatMap((e) => e.midis) : []
          return { lo: Math.min(...midis), hi: Math.max(...midis) }
        }
        const bass = range('bass')
        expect(bass.lo).toBeGreaterThanOrEqual(noteToMidi('B1'))
        expect(bass.hi).toBeLessThanOrEqual(noteToMidi('D4')) // summer's bass pops up an octave
        const lead = range(c.tracks[0].part.name)
        expect(lead.lo).toBeGreaterThan(bass.hi)
        expect(lead.hi).toBeLessThanOrEqual(noteToMidi('F#6'))
      })

      it('uses the hi-hat sparingly, if at all', () => {
        const hits = c.tracks.filter((t) => t.part.kind === 'hits').flatMap((t) => t.events)
        expect(hits.length / c.totalSteps).toBeLessThanOrEqual(0.25)
      })

      it('keeps every voice soft: filtered, and no level above 0.6', () => {
        for (const p of song.parts) {
          expect(p.voice.level).toBeLessThanOrEqual(0.6)
          if (p.voice.wave === 'pulse') expect(p.voice.filter?.type).toBe('lowpass')
        }
      })

      it('loops in 40 to 60 seconds, about one round', () => {
        expect(c.loopSeconds).toBeGreaterThanOrEqual(40)
        expect(c.loopSeconds).toBeLessThanOrEqual(60)
      })
    })
  }

  it('gives each season its own character', () => {
    const [spring, summer, autumn, winter] = SEASONS.map((s) => SONGS[s])
    expect(summer.swing).toBeGreaterThan(0.5) // bouncy shuffle
    expect(autumn.beatsPerBar).toBe(3) // a waltz
    expect(winter.bpm).toBeLessThan(spring.bpm)
    expect(winter.parts.some((p) => p.voice.wave === 'bell')).toBe(true)
    expect(winter.parts.some((p) => p.kind === 'hits')).toBe(false)
    // Winter is sparse: far fewer notes per bar than spring.
    const density = (s: Season) => {
      const c = compileSong(SONGS[s])
      return c.tracks.reduce((n, t) => n + t.events.length, 0) / c.bars
    }
    expect(density(3)).toBeLessThan(density(0) / 3)
  })
})
