import { describe, expect, it } from 'vitest'
import { midiToFreq, midiToNote, noteToFreq, noteToMidi, pitchClass, transpose } from './notes'

describe('note to frequency', () => {
  it('tunes A4 to 440 Hz and middle C to 261.63 Hz', () => {
    expect(noteToFreq('A4')).toBe(440)
    expect(noteToFreq('C4')).toBeCloseTo(261.63, 2)
  })

  it('doubles every octave', () => {
    expect(noteToFreq('A5')).toBeCloseTo(880, 6)
    expect(noteToFreq('A3')).toBeCloseTo(220, 6)
    expect(noteToFreq('A0')).toBeCloseTo(27.5, 6)
  })

  it('handles sharps and flats as the same pitch', () => {
    expect(noteToMidi('F#5')).toBe(78)
    expect(noteToMidi('Gb5')).toBe(78)
    expect(noteToMidi('Bb3')).toBe(58)
    expect(noteToMidi('A#3')).toBe(58)
  })

  it('crosses octave boundaries with B# and Cb', () => {
    expect(noteToMidi('B#3')).toBe(noteToMidi('C4'))
    expect(noteToMidi('Cb4')).toBe(noteToMidi('B3'))
  })

  it('maps MIDI 0 to C-1 and back', () => {
    expect(noteToMidi('C-1')).toBe(0)
    expect(midiToNote(0)).toBe('C-1')
    expect(midiToNote(61)).toBe('C#4')
  })

  it('steps one semitone at a time by 2^(1/12)', () => {
    expect(midiToFreq(70) / midiToFreq(69)).toBeCloseTo(Math.pow(2, 1 / 12), 12)
  })

  it('rejects anything that is not a note', () => {
    for (const bad of ['H4', 'C', '4', 'c4', 'C##4', 'r', '']) expect(() => noteToMidi(bad)).toThrow()
  })

  it('transposes by semitones', () => {
    expect(transpose('F2', 12)).toBe('F3')
    expect(transpose('Bb2', 12)).toBe('A#3')
    expect(transpose('C4', -1)).toBe('B3')
  })

  it('gives pitch classes for chord roots', () => {
    expect(pitchClass('C')).toBe(0)
    expect(pitchClass('Bb')).toBe(10)
    expect(pitchClass('Cb')).toBe(11)
    expect(() => pitchClass('X')).toThrow()
  })
})
