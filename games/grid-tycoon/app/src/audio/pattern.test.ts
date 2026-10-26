import { describe, expect, it } from 'vitest'
import {
  accent,
  arpeggiate,
  barLengths,
  chordTones,
  compileSong,
  durationSteps,
  parseArpPattern,
  parseChord,
  parseHits,
  parseLine,
  toneAt,
} from './pattern'
import { noteToMidi } from './notes'
import type { Song, VoiceSpec } from './types'

const SPB = 4 // steps per beat: a sixteenth-note grid
const BAR = 16 // 4/4

describe('durations', () => {
  it('maps note lengths to steps on a sixteenth grid', () => {
    expect(durationSteps('w', SPB)).toBe(16)
    expect(durationSteps('h', SPB)).toBe(8)
    expect(durationSteps('q', SPB)).toBe(4)
    expect(durationSteps('e', SPB)).toBe(2)
    expect(durationSteps('s', SPB)).toBe(1)
  })

  it('makes dotted lengths one and a half times as long', () => {
    expect(durationSteps('h.', SPB)).toBe(12)
    expect(durationSteps('q.', SPB)).toBe(6)
    expect(durationSteps('e.', SPB)).toBe(3)
  })

  it('accepts a plain number of steps', () => {
    expect(durationSteps('3', SPB)).toBe(3)
  })

  it('rejects lengths that do not fit the grid', () => {
    expect(() => durationSteps('s', 2)).toThrow(/whole number of steps/)
    expect(() => durationSteps('s.', SPB)).toThrow()
    expect(() => durationSteps('x', SPB)).toThrow(/Unknown length/)
    expect(() => durationSteps('0', SPB)).toThrow()
  })
})

describe('pattern length per bar', () => {
  it('counts the steps written in every bar', () => {
    expect(barLengths('C4:q D4 E4 F4 | G4:h G4:h', SPB)).toEqual([16, 16])
  })

  it('carries a length over to the next tokens until it changes', () => {
    expect(barLengths('C4:e D4 E4 F4 G4:q A4 | B4', SPB)).toEqual([16, 4])
  })

  it('counts a 3/4 bar as 12 steps', () => {
    expect(barLengths('E5:h A4:q | D5:h.', SPB)).toEqual([12, 12])
  })

  it('places notes on the grid and fails loudly on a short bar', () => {
    const line = parseLine('C4:q. D4:e E4:h | r:q G4:q -:h', BAR, SPB, noteToMidi, 'test')
    expect(line.bars).toBe(2)
    expect(line.totalSteps).toBe(32)
    expect(line.events.map((e) => [e.step, e.length, e.value])).toEqual([
      [0, 6, 60],
      [6, 2, 62],
      [8, 8, 64],
      [20, 12, 67], // the tie holds G4 for the rest of the bar
    ])
    expect(() => parseLine('C4:q D4 E4 | C4:w', BAR, SPB, noteToMidi, 'lead')).toThrow('lead: bar 1 has 12 steps, expected 16')
  })

  it('lets a tie carry a note over the bar line', () => {
    const line = parseLine('C4:h. D4:q | -:q E4:q F4:h', BAR, SPB, noteToMidi)
    expect(line.events[1]).toEqual({ step: 12, length: 8, value: 62 })
  })

  it('names the bar of a bad note', () => {
    expect(() => parseLine('C4:w | X4:w', BAR, SPB, noteToMidi, 'bass')).toThrow(/bass: bar 2/)
  })
})

describe('chords', () => {
  it('parses qualities and slash basses', () => {
    expect(parseChord('Am7').pitchClasses).toEqual([9, 0, 4, 7])
    expect(parseChord('Fmaj7').pitchClasses).toEqual([5, 9, 0, 4])
    expect(parseChord('Bsus4').pitchClasses).toEqual([11, 4, 6])
    const slash = parseChord('A/C#')
    expect(slash.pitchClasses).toEqual([9, 1, 4])
    expect(slash.bass).toBe(1)
    expect(() => parseChord('Cfoo')).toThrow(/Unknown chord/)
  })

  it('voices every chord inside one octave window so changes move by small steps', () => {
    const low = noteToMidi('G3')
    expect(chordTones(parseChord('C'), low)).toEqual([noteToMidi('G3'), noteToMidi('C4'), noteToMidi('E4')])
    expect(chordTones(parseChord('Am'), low)).toEqual([noteToMidi('A3'), noteToMidi('C4'), noteToMidi('E4')])
    for (const sym of ['Cmaj7', 'F#m7', 'Bb', 'E7', 'D/F#']) {
      for (const t of chordTones(parseChord(sym), low)) {
        expect(t).toBeGreaterThanOrEqual(low)
        expect(t).toBeLessThan(low + 12)
      }
    }
  })

  it('continues an octave up past the top chord tone', () => {
    expect(toneAt([60, 64, 67], 3)).toBe(72)
    expect(toneAt([60, 64, 67], 5)).toBe(79)
  })
})

describe('arpeggios', () => {
  it('parses rests, single tones and stacked tones', () => {
    expect(parseArpPattern('0 . 1+3 | 2')).toEqual([[0], null, [1, 3], [2]])
    expect(() => parseArpPattern('0 a')).toThrow()
  })

  it('cycles the pattern on its own slots and follows the chord at each step', () => {
    const c = parseChord('C')
    const g = parseChord('G')
    const chordAt = (step: number) => (step < 16 ? c : g)
    const events = arpeggiate(chordAt, 32, 4, parseArpPattern('0 1 . 2'), noteToMidi('C4'))
    // C voiced from C4: C4 E4 G4. G in the same window: D4 G4 B4.
    expect(events.map((e) => [e.step, e.value])).toEqual([
      [0, [60]], [4, [64]], [12, [67]],
      [16, [62]], [20, [67]], [28, [71]],
    ])
  })
})

describe('percussion lines', () => {
  it('reads one character per step and checks bar length', () => {
    const line = parseHits('x... ..o. .... ..x. | .... .... x... ....', 16, 'hat')
    expect(line.bars).toBe(2)
    expect(line.events.map((e) => [e.step, e.value])).toEqual([[0, 'x'], [6, 'o'], [14, 'x'], [24, 'x']])
    expect(() => parseHits('x... ..o. .... ..x. | ....', 16, 'hat')).toThrow('hat: bar 2 has 4 steps, expected 16')
  })

  it('marks open hits longer than closed ones', () => {
    const line = parseHits('x.o. .... .... ....', 16)
    expect(line.events).toEqual([
      { step: 0, length: 1, value: 'x' },
      { step: 2, length: 4, value: 'o' },
    ])
  })
})

describe('compiling a song', () => {
  const voice: VoiceSpec = { wave: 'pulse', level: 1, attack: 0, decay: 0, sustain: 1, release: 0, gate: 1 }
  const tiny: Song = {
    title: 'tiny',
    season: 0,
    bpm: 120,
    beatsPerBar: 4,
    stepsPerBeat: 4,
    swing: 0.5,
    chords: 'C:w | G:w',
    parts: [
      { kind: 'melody', name: 'lead', voice, notes: 'E4:h G4:h | D4:w' },
      { kind: 'arp', name: 'arp', voice, pattern: '0 1 2 1', rate: 'q', low: 'C4' },
      { kind: 'hits', name: 'hat', voice: { ...voice, wave: 'noise' }, hits: '..x...x...x...x. | ..x...x...x...x.' },
    ],
  }

  it('indexes every event by its start step', () => {
    const c = compileSong(tiny)
    expect(c.bars).toBe(2)
    expect(c.totalSteps).toBe(32)
    expect(c.loopSeconds).toBe(4) // 8 beats at 120 bpm
    expect(c.byStep[0].map((x) => x.track)).toEqual([0, 1])
    expect(c.byStep[16].map((x) => x.event.midis)).toEqual([[62], [62]]) // D4 in the lead, G voiced D4 G4 B4
    expect(c.byStep[2].map((x) => x.track)).toEqual([2])
  })

  it('accents the downbeat of each bar most', () => {
    expect(accent(0, 4, 16)).toBe(1)
    expect(accent(16, 4, 16)).toBe(1)
    expect(accent(4, 4, 16)).toBeLessThan(1)
    expect(accent(2, 4, 16)).toBeLessThan(accent(4, 4, 16))
  })

  it('rejects a part that is shorter than the chord line', () => {
    const broken = { ...tiny, parts: [{ ...tiny.parts[0], notes: 'E4:w' }] }
    expect(() => compileSong(broken)).toThrow('tiny/lead: 1 bars, the chord line has 2')
  })

  it('rejects a bar of the wrong length with the part name', () => {
    const broken = { ...tiny, parts: [{ ...tiny.parts[0], notes: 'E4:h G4:q | D4:w' }] }
    expect(() => compileSong(broken)).toThrow('tiny/lead: bar 1 has 12 steps, expected 16')
  })
})
