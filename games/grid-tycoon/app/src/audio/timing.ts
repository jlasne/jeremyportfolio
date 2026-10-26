// Scheduler and level math. Pure functions so the lookahead scheduler can be
// tested without a clock or an AudioContext.
//
// Steps are counted globally from when a player started (they never wrap); the
// song position is `step % totalSteps`. Times are always computed from the
// player's origin, never accumulated, so a long session does not drift.

export interface Timing {
  bpm: number
  stepsPerBeat: number
  /** Where the off-beat eighth lands, as a fraction of the beat (0.5 = straight). */
  swing: number
}

/** How often the scheduler wakes up, in ms. */
export const TICK_MS = 25
/** How far ahead of the audio clock notes are scheduled, in seconds. */
export const LOOKAHEAD = 0.1
/** A scheduler that falls further behind than this skips ahead instead of playing a burst of late notes. */
export const LATE_TOLERANCE = 0.05

export function beatSeconds(bpm: number): number {
  return 60 / bpm
}

export function stepSeconds(t: Timing): number {
  return 60 / t.bpm / t.stepsPerBeat
}

/**
 * Swing as a time warp inside one beat: phase 0..0.5 maps to 0..swing and
 * 0.5..1 maps to swing..1, so off-beat eighths land late and the beat stays put.
 */
export function swingPhase(phase: number, swing: number): number {
  if (swing === 0.5) return phase
  return phase < 0.5 ? phase * (swing / 0.5) : swing + (phase - 0.5) * ((1 - swing) / 0.5)
}

/** Seconds from the origin to the start of a global step, swing included. */
export function stepOffset(step: number, t: Timing): number {
  const beat = Math.floor(step / t.stepsPerBeat)
  const phase = (step - beat * t.stepsPerBeat) / t.stepsPerBeat
  return (beat + swingPhase(phase, t.swing)) * beatSeconds(t.bpm)
}

/** Seconds between the start of `step` and `step + length` (swing makes this uneven). */
export function stepSpan(step: number, length: number, t: Timing): number {
  return stepOffset(step + length, t) - stepOffset(step, t)
}

/**
 * The scheduler's core: given the next unscheduled step, return the first step
 * that starts at or after `until`. Every step in between is due now.
 */
export function stepsDueUntil(nextStep: number, origin: number, until: number, t: Timing): number {
  let s = nextStep
  while (origin + stepOffset(s, t) < until) s++
  return s
}

/** The first step that starts at or after `time`. */
export function firstStepAtOrAfter(time: number, origin: number, t: Timing): number {
  let s = Math.max(0, Math.floor((time - origin) / stepSeconds(t)))
  while (s > 0 && origin + stepOffset(s - 1, t) >= time) s--
  while (origin + stepOffset(s, t) < time) s++
  return s
}

/**
 * If the next step is already more than LATE_TOLERANCE in the past (a throttled
 * timer, a stalled tab), jump to the first step that can still play on time.
 */
export function resyncStep(nextStep: number, origin: number, now: number, t: Timing, tolerance = LATE_TOLERANCE): number {
  if (origin + stepOffset(nextStep, t) >= now - tolerance) return nextStep
  return firstStepAtOrAfter(now, origin, t)
}

/** The origin that makes `step` start exactly at `time`. */
export function originFor(step: number, time: number, t: Timing): number {
  return time - stepOffset(step, t)
}

/**
 * Where a song picks up next time its season comes round: the start of the
 * phrase (group of bars) it was in, so each year plays a further part of it.
 */
export function phraseStart(step: number, totalSteps: number, stepsPerBar: number, barsPerPhrase = 4): number {
  const inLoop = ((step % totalSteps) + totalSteps) % totalSteps
  const phraseSteps = stepsPerBar * barsPerPhrase
  return Math.floor(inLoop / phraseSteps) * phraseSteps
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain)
}

/** Pitch lift for a run of coin cues in quick succession: up the major scale, capped. */
export function coinStreakSemitones(streak: number): number {
  const steps = [0, 2, 4, 5, 7]
  return steps[Math.min(Math.max(0, Math.floor(streak)), steps.length - 1)]
}
