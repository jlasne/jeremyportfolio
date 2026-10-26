// The readable note format the songs are written in, and the compiler that
// turns a Song into note events on a step grid. Pure functions, no WebAudio.
//
// A line is tokens separated by spaces, with '|' between bars:
//
//   'F#5:q A5:e F#5:e E5:q D5:q | E5:q. C#5:e A4:h'
//
// - A token is `<head>:<length>` or just `<head>`, which reuses the previous length.
// - head: a note (C4, F#5, Bb3), a chord symbol on the chord line (Am7, F/A, Bsus4),
//   'r' for a rest, '-' to hold the previous note (or rest) a little longer.
// - length: w h q e s (whole, half, quarter, eighth, sixteenth), a trailing '.' makes it
//   one and a half times as long (q. = dotted quarter), or a plain number of steps.
// - Every bar must add up to exactly one bar, so a typo fails a test instead of drifting.
//
// Percussion lines are one character per step: 'x' hit, 'o' open hit, '.' nothing,
// with '|' and spaces free for readability: '..x. ..x. | ..x. ..o.'.

import { isNote, noteToMidi, pitchClass } from './notes'
import type { ArpPart, MelodyPart, NoteEvent, Part, Song } from './types'
import type { Timing } from './timing'
import { stepOffset } from './timing'

const BEATS: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 }

/** Steps in one written length: 'q' at 4 steps per beat → 4, 'h.' → 12, '3' → 3. */
export function durationSteps(length: string, stepsPerBeat: number): number {
  let steps: number
  if (/^\d+$/.test(length)) {
    steps = Number(length)
  } else {
    const m = /^([whqes])(\.?)$/.exec(length)
    if (!m) throw new Error(`Unknown length "${length}" (use w h q e s, an optional '.', or a number of steps)`)
    steps = BEATS[m[1]] * stepsPerBeat * (m[2] ? 1.5 : 1)
  }
  if (!Number.isInteger(steps) || steps <= 0) {
    throw new Error(`Length "${length}" is not a whole number of steps at ${stepsPerBeat} steps per beat`)
  }
  return steps
}

export interface Placed<T> {
  step: number
  length: number
  value: T
}

export interface ParsedLine<T> {
  events: Placed<T>[]
  bars: number
  totalSteps: number
}

/**
 * Parse one line into placed values. `read` turns a head token into a value.
 * Throws with the line label and bar number when a bar does not add up.
 */
export function parseLine<T>(
  text: string,
  stepsPerBar: number,
  stepsPerBeat: number,
  read: (head: string) => T,
  label = 'line',
): ParsedLine<T> {
  const events: Placed<T>[] = []
  const bars = splitBars(text)
  let step = 0
  let length = durationSteps('q', stepsPerBeat)
  // The last thing written, so '-' can extend it: an event, or a rest (null).
  let last: Placed<T> | null = null
  bars.forEach((bar, barIndex) => {
    let barSteps = 0
    for (const token of bar.split(/\s+/).filter(Boolean)) {
      const [head, len, extra] = token.split(':')
      if (extra !== undefined || head === '') throw new Error(`${label}: bad token "${token}" in bar ${barIndex + 1}`)
      if (len !== undefined) length = durationSteps(len, stepsPerBeat)
      if (head === '-') {
        if (last) last.length += length
      } else if (head === 'r') {
        last = null
      } else {
        let value: T
        try {
          value = read(head)
        } catch (e) {
          throw new Error(`${label}: bar ${barIndex + 1}: ${(e as Error).message}`)
        }
        last = { step, length, value }
        events.push(last)
      }
      step += length
      barSteps += length
    }
    if (barSteps !== stepsPerBar) {
      throw new Error(`${label}: bar ${barIndex + 1} has ${barSteps} steps, expected ${stepsPerBar}`)
    }
  })
  return { events, bars: bars.length, totalSteps: step }
}

/** Steps written in each bar of a line, without checking them. Used by tests and tooling. */
export function barLengths(text: string, stepsPerBeat: number): number[] {
  let length = durationSteps('q', stepsPerBeat)
  return splitBars(text).map((bar) => {
    let steps = 0
    for (const token of bar.split(/\s+/).filter(Boolean)) {
      const len = token.split(':')[1]
      if (len !== undefined) length = durationSteps(len, stepsPerBeat)
      steps += length
    }
    return steps
  })
}

function splitBars(text: string): string[] {
  return text
    .split('|')
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
}

// ---------------------------------------------------------------------------
// Chords

const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
  '9': [0, 2, 4, 7, 10],
  maj9: [0, 2, 4, 7, 11],
  m9: [0, 2, 3, 7, 10],
}

export interface Chord {
  symbol: string
  root: number
  /** Pitch classes of the chord tones, root first. */
  pitchClasses: number[]
  /** Pitch class of the slash bass, or the root. */
  bass: number
}

/** 'Am7' → root A, tones A C E G. 'A/C#' → A major over C#. */
export function parseChord(symbol: string): Chord {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol)
  const intervals = m ? QUALITIES[m[2]] : undefined
  if (!m || !intervals) throw new Error(`Unknown chord "${symbol}"`)
  const root = pitchClass(m[1])
  return {
    symbol,
    root,
    pitchClasses: intervals.map((i) => (root + i) % 12),
    bass: m[3] ? pitchClass(m[3]) : root,
  }
}

/** Chord tones placed in the window [low, low + 12), lowest first, so changes move by small steps. */
export function chordTones(chord: Chord, low: number): number[] {
  const tones = chord.pitchClasses.map((pc) => low + ((((pc - low) % 12) + 12) % 12))
  return [...new Set(tones)].sort((a, b) => a - b)
}

/** Tone `index` of a voiced chord; indexes past the top continue an octave up. */
export function toneAt(tones: number[], index: number): number {
  const n = tones.length
  return tones[index % n] + 12 * Math.floor(index / n)
}

/** Parse an arpeggio pattern into slots: null for a rest, else the tone indexes to play. */
export function parseArpPattern(pattern: string): (number[] | null)[] {
  return pattern
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((slot) => {
      if (slot === '.') return null
      const idx = slot.split('+').map(Number)
      if (idx.some((i) => !Number.isInteger(i) || i < 0)) throw new Error(`Bad arpeggio slot "${slot}"`)
      return idx
    })
}

/**
 * Arpeggio events: slot k (counted from the loop start, one per `rate` steps) plays
 * pattern[k mod length] over the chord sounding at that step.
 */
export function arpeggiate(
  chordAt: (step: number) => Chord | null,
  totalSteps: number,
  rate: number,
  pattern: (number[] | null)[],
  low: number,
): Placed<number[]>[] {
  const out: Placed<number[]>[] = []
  if (pattern.length === 0) return out
  for (let step = 0, slot = 0; step < totalSteps; step += rate, slot++) {
    const idx = pattern[slot % pattern.length]
    const chord = chordAt(step)
    if (!idx || !chord) continue
    const tones = chordTones(chord, low)
    out.push({ step, length: Math.min(rate, totalSteps - step), value: idx.map((i) => toneAt(tones, i)) })
  }
  return out
}

// ---------------------------------------------------------------------------
// Percussion

/** Hits per step: 'x' 0.8, 'o' (open, longer) 1.0. Throws when a bar is the wrong length. */
export function parseHits(text: string, stepsPerBar: number, label = 'hits'): ParsedLine<'x' | 'o'> {
  const events: Placed<'x' | 'o'>[] = []
  const bars = splitBars(text.replace(/\s+/g, ' '))
  let step = 0
  bars.forEach((bar, barIndex) => {
    const cells = bar.replace(/\s+/g, '')
    if (cells.length !== stepsPerBar) {
      throw new Error(`${label}: bar ${barIndex + 1} has ${cells.length} steps, expected ${stepsPerBar}`)
    }
    for (const c of cells) {
      if (c === 'x' || c === 'o') events.push({ step, length: c === 'o' ? 4 : 1, value: c })
      else if (c !== '.') throw new Error(`${label}: bar ${barIndex + 1}: unknown hit "${c}"`)
      step++
    }
  })
  return { events, bars: bars.length, totalSteps: step }
}

// ---------------------------------------------------------------------------
// Songs

/** Downbeat of the bar strongest, other beats a bit softer, off-beats softest. */
export function accent(step: number, stepsPerBeat: number, stepsPerBar: number): number {
  if (step % stepsPerBar === 0) return 1
  if (step % stepsPerBeat === 0) return 0.88
  return 0.76
}

export interface CompiledTrack {
  part: Part
  events: NoteEvent[]
}

export interface CompiledSong {
  song: Song
  timing: Timing
  stepsPerBar: number
  bars: number
  totalSteps: number
  loopSeconds: number
  tracks: CompiledTrack[]
  /** For each step of the loop, the events starting there and their track index. */
  byStep: { track: number; event: NoteEvent }[][]
}

/** Check and compile a song. Every part must be exactly as long as the chord line. */
export function compileSong(song: Song): CompiledSong {
  const stepsPerBar = song.beatsPerBar * song.stepsPerBeat
  const label = (name: string) => `${song.title}/${name}`
  const chordLine = parseLine(song.chords, stepsPerBar, song.stepsPerBeat, parseChord, label('chords'))
  const { totalSteps, bars } = chordLine
  const chordByStep: (Chord | null)[] = new Array(totalSteps).fill(null)
  for (const c of chordLine.events) {
    for (let s = c.step; s < c.step + c.length && s < totalSteps; s++) chordByStep[s] = c.value
  }

  const tracks = song.parts.map((part): CompiledTrack => {
    const { events, steps } = compilePart(part, song, stepsPerBar, chordByStep, label(part.name))
    if (steps !== totalSteps) {
      throw new Error(`${label(part.name)}: ${steps / stepsPerBar} bars, the chord line has ${bars}`)
    }
    if (events.length === 0) throw new Error(`${label(part.name)}: no notes`)
    return { part, events }
  })

  const byStep: CompiledSong['byStep'] = Array.from({ length: totalSteps }, () => [])
  tracks.forEach((t, track) => t.events.forEach((event) => byStep[event.step].push({ track, event })))
  const timing: Timing = { bpm: song.bpm, stepsPerBeat: song.stepsPerBeat, swing: song.swing }
  return { song, timing, stepsPerBar, bars, totalSteps, loopSeconds: stepOffset(totalSteps, timing), tracks, byStep }
}

function compilePart(
  part: Part,
  song: Song,
  stepsPerBar: number,
  chordByStep: (Chord | null)[],
  label: string,
): { events: NoteEvent[]; steps: number } {
  const spb = song.stepsPerBeat
  const velocity = (step: number) => accent(step, spb, stepsPerBar)
  switch (part.kind) {
    case 'melody': {
      const line = parseMelody(part, spb, stepsPerBar, label)
      const events = line.events.map((e) => ({ step: e.step, length: e.length, midis: [e.value], velocity: velocity(e.step) }))
      return { events, steps: line.totalSteps }
    }
    case 'arp': {
      // An arpeggio follows the chord line, so it is always as long as the song.
      const events = arpPart(part, spb, chordByStep, label).map((e) => ({
        step: e.step,
        length: e.length,
        midis: e.value,
        velocity: velocity(e.step),
      }))
      return { events, steps: chordByStep.length }
    }
    case 'hits': {
      const line = parseHits(part.hits, stepsPerBar, label)
      const events = line.events.map((e) => ({
        step: e.step,
        length: e.length,
        midis: [],
        velocity: (e.value === 'o' ? 1 : 0.8) * velocity(e.step),
      }))
      return { events, steps: line.totalSteps }
    }
  }
}

function parseMelody(part: MelodyPart, spb: number, stepsPerBar: number, label: string): ParsedLine<number> {
  const read = (head: string) => {
    if (!isNote(head)) throw new Error(`"${head}" is not a note`)
    return noteToMidi(head)
  }
  return parseLine(part.notes, stepsPerBar, spb, read, label)
}

function arpPart(part: ArpPart, spb: number, chordByStep: (Chord | null)[], label: string): Placed<number[]>[] {
  try {
    const rate = durationSteps(part.rate, spb)
    return arpeggiate((s) => chordByStep[s] ?? null, chordByStep.length, rate, parseArpPattern(part.pattern), noteToMidi(part.low))
  } catch (e) {
    throw new Error(`${label}: ${(e as Error).message}`)
  }
}
