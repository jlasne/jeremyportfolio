import { describe, expect, it } from 'vitest'
import {
  LOOKAHEAD,
  coinStreakSemitones,
  dbToGain,
  firstStepAtOrAfter,
  gainToDb,
  originFor,
  phraseStart,
  resyncStep,
  stepOffset,
  stepSeconds,
  stepSpan,
  stepsDueUntil,
  swingPhase,
  type Timing,
} from './timing'

const straight: Timing = { bpm: 120, stepsPerBeat: 4, swing: 0.5 }
const shuffle: Timing = { bpm: 120, stepsPerBeat: 4, swing: 2 / 3 }

describe('scheduler step math', () => {
  it('makes a sixteenth at 120 bpm last 125 ms', () => {
    expect(stepSeconds(straight)).toBe(0.125)
    expect(stepOffset(4, straight)).toBe(0.5)
    expect(stepOffset(16, straight)).toBe(2)
  })

  it('swings only the inside of a beat: beats stay put, off-beat eighths land late', () => {
    expect(stepOffset(4, shuffle)).toBe(stepOffset(4, straight))
    expect(stepOffset(2, shuffle)).toBeCloseTo((2 / 3) * 0.5, 12) // triplet feel
    expect(stepOffset(2, shuffle)).toBeGreaterThan(stepOffset(2, straight))
    expect(swingPhase(0, 0.6)).toBe(0)
    expect(swingPhase(0.5, 0.6)).toBe(0.6)
    expect(swingPhase(1, 0.6)).toBeCloseTo(1, 12)
  })

  it('keeps step times increasing under swing', () => {
    for (let s = 0; s < 64; s++) expect(stepOffset(s + 1, shuffle)).toBeGreaterThan(stepOffset(s, shuffle))
  })

  it('measures note lengths between swung step times', () => {
    // A swung eighth pair: the long one then the short one, still one beat in total.
    expect(stepSpan(0, 2, shuffle) + stepSpan(2, 2, shuffle)).toBeCloseTo(0.5, 12)
    expect(stepSpan(0, 2, shuffle)).toBeGreaterThan(stepSpan(2, 2, shuffle))
  })

  it('schedules exactly the steps that start inside the lookahead window', () => {
    const origin = 10
    // now = 10.3 → window ends at 10.4: steps at 10.0, .125, .25, .375 are due.
    const end = stepsDueUntil(0, origin, 10.3 + LOOKAHEAD, straight)
    expect(end).toBe(4)
    // The next tick 25 ms later only adds what entered the window.
    expect(stepsDueUntil(end, origin, 10.325 + LOOKAHEAD, straight)).toBe(4)
    // A step that starts exactly at the window edge waits for the next tick.
    expect(stepsDueUntil(end, origin, 10.4 + LOOKAHEAD, straight)).toBe(4)
    expect(stepsDueUntil(end, origin, 10.41 + LOOKAHEAD, straight)).toBe(5)
  })

  it('never schedules anything before the origin is near', () => {
    expect(stepsDueUntil(0, 5, 4.8, straight)).toBe(0)
  })

  it('finds the first step at or after a time, with and without swing', () => {
    expect(firstStepAtOrAfter(0, 0, straight)).toBe(0)
    expect(firstStepAtOrAfter(0.125, 0, straight)).toBe(1)
    expect(firstStepAtOrAfter(0.126, 0, straight)).toBe(2)
    for (const t of [0, 0.1, 0.33, 0.5, 1.77, 9.01]) {
      const s = firstStepAtOrAfter(t, 0, shuffle)
      expect(stepOffset(s, shuffle)).toBeGreaterThanOrEqual(t)
      if (s > 0) expect(stepOffset(s - 1, shuffle)).toBeLessThan(t)
    }
  })

  it('skips ahead after a stall instead of playing a burst of late notes', () => {
    expect(resyncStep(3, 0, 0.4, straight)).toBe(3) // step 3 at 0.375 is only 25 ms late
    expect(resyncStep(3, 0, 2.01, straight)).toBe(17) // a 1.6 s stall: resume at the next step on time
  })

  it('puts a chosen step exactly at the start time', () => {
    const origin = originFor(64, 3, straight)
    expect(origin + stepOffset(64, straight)).toBe(3)
  })

  it('wraps the loop position and resumes at the start of a phrase', () => {
    // 24 bars of 16 steps, phrases of 4 bars (64 steps).
    expect(phraseStart(0, 384, 16)).toBe(0)
    expect(phraseStart(63, 384, 16)).toBe(0)
    expect(phraseStart(200, 384, 16)).toBe(192)
    expect(phraseStart(384 + 70, 384, 16)).toBe(64)
  })
})

describe('levels', () => {
  it('converts decibels to gain', () => {
    expect(dbToGain(0)).toBe(1)
    expect(dbToGain(-20)).toBeCloseTo(0.1, 12)
    expect(dbToGain(-24)).toBeCloseTo(0.0631, 4)
    expect(dbToGain(-14)).toBeCloseTo(0.1995, 4)
    expect(gainToDb(dbToGain(-14))).toBeCloseTo(-14, 10)
  })

  it('lifts a run of coins up the scale, then holds', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(coinStreakSemitones)).toEqual([0, 2, 4, 5, 7, 7, 7])
  })
})
