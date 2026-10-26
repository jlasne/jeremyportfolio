// Sound cues: short, soft, and all under 600 ms. Each cue is data (a list of
// tones) so tests can check its shape; playCue turns it into WebAudio nodes.

import { noteToFreq } from './notes'
import { playNote, type Synth } from './synth'
import type { CueName, CueTone, VoiceSpec } from './types'

const soft = { type: 'lowpass', freq: 3200 } as const
const bright = { type: 'lowpass', freq: 7000 } as const

export const CUES: Record<CueName, CueTone[]> = {
  // Two-note confirm: the fifth resolving up to the root, "done".
  lock: [
    { wave: 'pulse', duty: 0.25, note: 'G5', at: 0, dur: 0.06, gain: 0.45, filter: soft },
    { wave: 'pulse', duty: 0.25, note: 'C6', at: 0.075, dur: 0.16, gain: 0.5, release: 0.12, filter: soft },
    { wave: 'triangle', note: 'C5', at: 0.075, dur: 0.18, gain: 0.4, release: 0.12 },
  ],
  // Bright arpeggio blips up an E major chord.
  coins: [
    { wave: 'pulse', duty: 0.125, note: 'B5', at: 0, dur: 0.035, gain: 0.42, filter: bright },
    { wave: 'pulse', duty: 0.125, note: 'E6', at: 0.045, dur: 0.035, gain: 0.44, filter: bright },
    { wave: 'pulse', duty: 0.125, note: 'G#6', at: 0.09, dur: 0.035, gain: 0.44, filter: bright },
    { wave: 'pulse', duty: 0.125, note: 'B6', at: 0.135, dur: 0.1, gain: 0.46, release: 0.12, filter: bright },
    { wave: 'sine', note: 'E7', at: 0.135, dur: 0.08, gain: 0.16, release: 0.12 },
  ],
  // A soft metal clank (filtered noise over a dropping thump), then a rising ding.
  crane: [
    { wave: 'noise', at: 0, dur: 0.035, gain: 0.5, release: 0.03, filter: { type: 'bandpass', freq: 1700, q: 4 } },
    { wave: 'pulse', duty: 0.5, freq: 196, glide: -7, at: 0, dur: 0.06, gain: 0.25, filter: { type: 'lowpass', freq: 900 } },
    { wave: 'noise', at: 0.085, dur: 0.025, gain: 0.32, release: 0.03, filter: { type: 'bandpass', freq: 2400, q: 5 } },
    { wave: 'bell', note: 'E6', at: 0.19, dur: 0.12, gain: 0.42 },
    { wave: 'bell', note: 'B6', at: 0.27, dur: 0.24, gain: 0.46 },
  ],
  // Rising major triad.
  stockUp: [
    { wave: 'pulse', duty: 0.25, note: 'C5', at: 0, dur: 0.065, gain: 0.38, filter: soft },
    { wave: 'pulse', duty: 0.25, note: 'E5', at: 0.07, dur: 0.065, gain: 0.4, filter: soft },
    { wave: 'pulse', duty: 0.25, note: 'G5', at: 0.14, dur: 0.18, gain: 0.42, release: 0.12, filter: soft },
    { wave: 'triangle', note: 'G4', at: 0.14, dur: 0.18, gain: 0.3, release: 0.12 },
  ],
  // Falling minor third, drooping a little at the end.
  stockDown: [
    { wave: 'pulse', duty: 0.5, note: 'E5', at: 0, dur: 0.11, gain: 0.32, filter: { type: 'lowpass', freq: 1800 } },
    { wave: 'pulse', duty: 0.5, note: 'C#5', at: 0.12, dur: 0.22, gain: 0.34, glide: -0.5, release: 0.1, filter: { type: 'lowpass', freq: 1600 } },
    { wave: 'triangle', note: 'C#4', at: 0.12, dur: 0.22, gain: 0.28, glide: -0.5, release: 0.1 },
  ],
  // A tiny tick for buttons.
  click: [
    { wave: 'triangle', note: 'A6', at: 0, dur: 0.012, gain: 0.22, attack: 0.001, release: 0.02 },
    { wave: 'noise', at: 0, dur: 0.006, gain: 0.08, attack: 0.001, release: 0.01, filter: { type: 'highpass', freq: 4000 } },
  ],
  // A low, short double buzz, two notes a semitone apart so they beat.
  error: [
    { wave: 'pulse', duty: 0.5, note: 'A2', at: 0, dur: 0.1, gain: 0.3, filter: { type: 'lowpass', freq: 700 } },
    { wave: 'pulse', duty: 0.5, note: 'A#2', at: 0, dur: 0.1, gain: 0.22, filter: { type: 'lowpass', freq: 700 } },
    { wave: 'pulse', duty: 0.5, note: 'A2', at: 0.14, dur: 0.13, gain: 0.3, filter: { type: 'lowpass', freq: 700 } },
    { wave: 'pulse', duty: 0.5, note: 'A#2', at: 0.14, dur: 0.13, gain: 0.22, filter: { type: 'lowpass', freq: 700 } },
  ],
}

export const CUE_NAMES = Object.keys(CUES) as CueName[]

const DEFAULT_ATTACK = 0.004
const DEFAULT_RELEASE = 0.05

export function toneFreq(t: CueTone): number {
  return t.freq ?? (t.note ? noteToFreq(t.note) : 0)
}

/** When the last tone of a cue has fully faded, in seconds from its start. */
export function cueLength(tones: CueTone[]): number {
  return Math.max(...tones.map((t) => {
    const v = toneVoice(t)
    return t.wave === 'bell' ? t.at + v.attack + v.decay : t.at + t.dur + v.release
  }))
}

function toneVoice(t: CueTone): VoiceSpec {
  const bell = t.wave === 'bell'
  return {
    wave: t.wave,
    duty: t.duty,
    level: 1,
    attack: t.attack ?? (bell ? 0.002 : DEFAULT_ATTACK),
    // A bell rings for its whole written length; other tones hold, then release.
    decay: bell ? t.dur : 0.05,
    sustain: bell ? 0 : 0.85,
    release: t.release ?? DEFAULT_RELEASE,
    gate: 1,
    bell: bell ? { ratio: 3.5, strike: 1.2, ring: 0.1 } : undefined,
  }
}

/**
 * Schedule a cue at `time` into `dest`. `semitones` shifts every pitched tone
 * (used to lift a run of coin cues). Returns when the cue is silent again.
 */
export function playCue(s: Synth, name: CueName, dest: AudioNode, time: number, semitones = 0): number {
  const shift = Math.pow(2, semitones / 12)
  let end = time
  for (const tone of CUES[name]) {
    let out = dest
    if (tone.filter) {
      const f = s.ctx.createBiquadFilter()
      f.type = tone.filter.type
      f.frequency.value = tone.filter.freq
      f.Q.value = tone.filter.q ?? 0.7
      f.connect(dest)
      out = f
    }
    const freq = toneFreq(tone) * shift
    const stop = playNote(s, toneVoice(tone), out, freq, time + tone.at, tone.dur, tone.gain, { glide: tone.glide })
    end = Math.max(end, stop)
  }
  return end
}
