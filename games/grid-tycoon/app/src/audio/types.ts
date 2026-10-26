// Data types shared by the audio modules. Everything here is plain data so the
// songs and cues can be checked by tests without a WebAudio context.

/** Round 1 to 4 maps to spring, summer, autumn, winter (same as engine seasonOf). */
export type Season = 0 | 1 | 2 | 3

export type CueName = 'lock' | 'coins' | 'crane' | 'stockUp' | 'stockDown' | 'click' | 'error'

export type Wave = 'pulse' | 'triangle' | 'sine' | 'bell' | 'noise'

/** How one instrument sounds. Times are seconds, levels are linear gain. */
export interface VoiceSpec {
  wave: Wave
  /** Pulse width for 'pulse': 0.5 is a square, 0.25 and 0.125 are thinner and brighter. */
  duty?: number
  /** A second oscillator detuned by this many cents, for warmth. */
  detune?: number
  filter?: { type: BiquadFilterType; freq: number; q?: number }
  level: number
  attack: number
  decay: number
  /** Fraction of the peak held after the decay. */
  sustain: number
  release: number
  /** Fraction of the written note length held before the release starts. */
  gate: number
  vibrato?: { rate: number; depth: number; delay: number }
  /** Stereo position, -1 left to 1 right. */
  pan?: number
  /** Bell only: modulator ratio and the modulation index at the strike and once it rings. */
  bell?: { ratio: number; strike: number; ring: number }
}

/** A hand-written line of notes, see pattern.ts for the format. */
export interface MelodyPart {
  kind: 'melody'
  name: string
  voice: VoiceSpec
  notes: string
}

/** Chord tones from the song's chord line, picked by a repeating index pattern. */
export interface ArpPart {
  kind: 'arp'
  name: string
  voice: VoiceSpec
  /** Indexes into the chord tones (0 = lowest), '.' for a rest, '0+2' for two at once, '|' is ignored. */
  pattern: string
  /** One slot per this duration, e.g. 'e'. */
  rate: string
  /** Lowest note of the voicing window: every chord tone is placed in [low, low + 12). */
  low: string
}

/** A percussion line: one character per step, 'x' hit, 'o' open hit, '.' nothing. */
export interface HitsPart {
  kind: 'hits'
  name: string
  voice: VoiceSpec
  hits: string
}

export type Part = MelodyPart | ArpPart | HitsPart

export interface Song {
  title: string
  season: Season
  bpm: number
  beatsPerBar: number
  /** 4 means the grid is sixteenth notes. */
  stepsPerBeat: number
  /** Where the off-beat eighth lands, as a fraction of the beat: 0.5 straight, 0.67 triplet shuffle. */
  swing: number
  /** Feedback echo on the whole song, delay in beats. */
  echo?: { beats: number; feedback: number; wet: number; tone: number }
  /** The progression, one chord symbol per token, same format as a melody. */
  chords: string
  parts: Part[]
}

/** One note (or chord, or hit) on the song grid. */
export interface NoteEvent {
  /** Step from the start of the loop. */
  step: number
  /** Length in steps. */
  length: number
  /** MIDI note numbers, empty for a noise hit. */
  midis: number[]
  /** 0..1, from the beat accent and the hit type. */
  velocity: number
}

/** One tone of a sound cue. Times in seconds from the cue start. */
export interface CueTone {
  wave: Wave
  duty?: number
  note?: string
  freq?: number
  at: number
  dur: number
  gain: number
  /** Semitones the pitch slides by over the tone. */
  glide?: number
  attack?: number
  release?: number
  filter?: { type: BiquadFilterType; freq: number; q?: number }
}
