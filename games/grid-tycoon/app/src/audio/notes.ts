// Note names, MIDI numbers and frequencies. Pure functions, no WebAudio.
// Scientific pitch notation: C4 is middle C (MIDI 60), A4 is 440 Hz (MIDI 69).

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/

/** Pitch class 0..11 of a letter plus optional accidental, e.g. 'Bb' → 10. */
export function pitchClass(name: string): number {
  const m = /^([A-G])([#b]?)$/.exec(name)
  if (!m) throw new Error(`Not a pitch name: "${name}"`)
  return mod12(PITCH_CLASS[m[1]] + accidental(m[2]))
}

/** 'C4' → 60, 'F#5' → 78, 'Bb3' → 58. */
export function noteToMidi(note: string): number {
  const m = NOTE_RE.exec(note)
  if (!m) throw new Error(`Not a note: "${note}" (expected a letter, optional # or b, and an octave, like F#4)`)
  return (Number(m[3]) + 1) * 12 + PITCH_CLASS[m[1]] + accidental(m[2])
}

export function isNote(token: string): boolean {
  return NOTE_RE.test(token)
}

/** Equal temperament, A4 = 440 Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function noteToFreq(note: string): number {
  return midiToFreq(noteToMidi(note))
}

/** 60 → 'C4'. Sharps only, which is enough for debugging and for transpose(). */
export function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  return NAMES_SHARP[mod12(midi)] + octave
}

/** 'F2', 12 → 'F3'. */
export function transpose(note: string, semitones: number): string {
  return midiToNote(noteToMidi(note) + semitones)
}

function accidental(sign: string): number {
  return sign === '#' ? 1 : sign === 'b' ? -1 : 0
}

function mod12(n: number): number {
  return ((n % 12) + 12) % 12
}
