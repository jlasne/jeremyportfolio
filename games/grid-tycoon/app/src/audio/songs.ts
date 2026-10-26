// The four season loops, written in the note format from pattern.ts. Each line
// is one bar; sections are listed in play order. Chord lines are the source of
// truth for the harmony: arpeggios are derived from them, and the hand-written
// bass and melody follow them.

import { transpose } from './notes'
import type { Season, Song, VoiceSpec } from './types'

const bars = (...lines: string[]) => lines.join(' | ')
const repeat = (bar: string, n: number) => Array.from({ length: n }, () => bar)

// ---------------------------------------------------------------------------
// Instruments

const leadPulse = (duty: number, cutoff: number, level: number, extra: Partial<VoiceSpec> = {}): VoiceSpec => ({
  wave: 'pulse',
  duty,
  filter: { type: 'lowpass', freq: cutoff, q: 0.6 },
  level,
  attack: 0.008,
  decay: 0.18,
  sustain: 0.55,
  release: 0.12,
  gate: 0.9,
  vibrato: { rate: 5.2, depth: 0.12, delay: 0.22 },
  ...extra,
})

const pluck = (duty: number, cutoff: number, level: number, pan: number): VoiceSpec => ({
  wave: 'pulse',
  duty,
  filter: { type: 'lowpass', freq: cutoff, q: 0.5 },
  level,
  attack: 0.004,
  decay: 0.09,
  sustain: 0.25,
  release: 0.07,
  gate: 0.55,
  pan,
})

const triBass = (level: number, extra: Partial<VoiceSpec> = {}): VoiceSpec => ({
  wave: 'triangle',
  filter: { type: 'lowpass', freq: 1500, q: 0.5 },
  level,
  attack: 0.005,
  decay: 0.12,
  sustain: 0.8,
  release: 0.06,
  gate: 0.82,
  ...extra,
})

const hat = (level: number, pan: number): VoiceSpec => ({
  wave: 'noise',
  filter: { type: 'highpass', freq: 7500, q: 0.6 },
  level,
  attack: 0.001,
  decay: 0.035,
  sustain: 0,
  release: 0.02,
  gate: 1,
  pan,
})

const bell = (level: number, ring: number, pan: number): VoiceSpec => ({
  wave: 'bell',
  filter: { type: 'lowpass', freq: 5000, q: 0.5 },
  level,
  attack: 0.003,
  decay: ring,
  sustain: 0,
  release: 0,
  gate: 1,
  pan,
  bell: { ratio: 3.5, strike: 1.3, ring: 0.12 },
})

// ---------------------------------------------------------------------------
// Spring: D major, bright and light. A B A' over 24 bars.

const spring: Song = {
  title: 'spring',
  season: 0,
  bpm: 104,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  swing: 0.5,
  echo: { beats: 0.75, feedback: 0.22, wet: 0.14, tone: 2400 },
  chords: bars(
    // A
    'D:w', 'A/C#:w', 'Bm7:w', 'Gmaj7:w', 'D:w', 'Em7:w', 'G:w', 'A7:w',
    // B
    'G:w', 'A:w', 'F#m7:w', 'Bm7:w', 'Em7:w', 'A:w', 'D:w', 'Asus4:h A7:h',
    // A'
    'D:w', 'A/C#:w', 'Bm7:w', 'Gmaj7:w', 'Em7:w', 'A7:w', 'D:w', 'A7:w',
  ),
  parts: [
    {
      kind: 'melody',
      name: 'lead',
      voice: leadPulse(0.25, 2800, 0.5),
      notes: bars(
        // A
        'F#5:q A5:e F#5:e E5:q D5:q',
        'E5:q. C#5:e A4:h',
        'D5:e E5:e F#5:q A5:q F#5:q',
        'G5:q. F#5:e D5:h',
        'F#5:q A5:e B5:e A5:q F#5:q',
        'G5:q. F#5:e E5:q D5:q',
        'B4:e D5:e G5:q F#5:q E5:q',
        'E5:h C#5:q r:q',
        // B
        'D5:e G5:e B5:q A5:e G5:e F#5:q',
        'E5:q. C#5:e E5:h',
        'C#5:e E5:e A5:q F#5:q E5:q',
        'D5:q. C#5:e B4:h',
        'G5:e F#5:e E5:e D5:e E5:q B4:q',
        'C#5:q E5:q A5:h',
        'F#5:q. E5:e D5:q A4:q',
        'D5:h C#5:q r:q',
        // A'
        'F#5:q A5:e F#5:e E5:q D5:q',
        'E5:q. C#5:e A4:h',
        'D5:e E5:e F#5:q B5:q A5:q',
        'G5:q. F#5:e D5:h',
        'E5:e F#5:e G5:q B5:q G5:q',
        'A5:q. G5:e E5:q C#5:q',
        'D5:q F#5:e A5:e D6:q r:q',
        'r:h C#5:q E5:q',
      ),
    },
    {
      kind: 'arp',
      name: 'sparkle',
      voice: pluck(0.125, 2400, 0.2, 0.3),
      pattern: '0 2 1 3 0 2 1 3',
      rate: 'e',
      low: 'D4',
    },
    {
      kind: 'melody',
      name: 'bass',
      voice: triBass(0.55),
      notes: bars(
        // A
        'D3:q. D3:e A2:q F#2:q',
        'C#3:q. C#3:e A2:q E2:q',
        'B2:q. B2:e F#2:q A2:q',
        'G2:q. G2:e D3:q B2:q',
        'D3:q. D3:e A2:q F#2:q',
        'E2:q. E2:e B2:q D3:q',
        'G2:q. G2:e D3:q B2:q',
        'A2:q. A2:e E3:q C#3:q',
        // B
        'G2:q. G2:e B2:q D3:q',
        'A2:q. A2:e C#3:q E3:q',
        'F#2:q. F#2:e A2:q C#3:q',
        'B2:q. B2:e D3:q F#2:q',
        'E2:q. E2:e G2:q B2:q',
        'A2:q. A2:e C#3:q E3:q',
        'D3:q. D3:e A2:q F#2:q',
        'A2:q. A2:e E3:q C#3:q',
        // A'
        'D3:q. D3:e A2:q F#2:q',
        'C#3:q. C#3:e A2:q E2:q',
        'B2:q. B2:e F#2:q A2:q',
        'G2:q. G2:e D3:q B2:q',
        'E2:q. E2:e B2:q D3:q',
        'A2:q. A2:e E3:q C#3:q',
        'D3:q. D3:e A2:q F#2:q',
        'A2:q. A2:e E2:q C#3:q',
      ),
    },
    {
      kind: 'hits',
      name: 'hat',
      voice: hat(0.12, -0.25),
      hits: bars(
        ...repeat('.... ..x. .... ..x.', 8),
        ...repeat('..x. ..x. ..x. ..x.', 8),
        ...repeat('.... ..x. .... ..x.', 8),
      ),
    },
  ],
}

// ---------------------------------------------------------------------------
// Summer: F major, warm and bouncy, a light shuffle. A B A' over 24 bars.

/** Octave-jumping bass with a gap on the off-beats: the bounce. */
const bounce = (root: string, fifth: string) => {
  const up = transpose(root, 12)
  return `${root}:e ${up}:e r:e ${root}:e ${fifth}:e ${up}:e r:e ${fifth}:e`
}
const halfBounce = (root: string, fifth: string) => `${root}:e ${transpose(root, 12)}:e r:e ${fifth}:e`

const summer: Song = {
  title: 'summer',
  season: 1,
  bpm: 108,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  swing: 0.58,
  echo: { beats: 0.5, feedback: 0.18, wet: 0.1, tone: 2200 },
  chords: bars(
    // A
    'Fmaj7:w', 'Am7:w', 'Bbmaj7:w', 'C7:w', 'Fmaj7:w', 'Am7:w', 'Gm7:w', 'C7:w',
    // B
    'Bbmaj7:w', 'C/Bb:w', 'Am7:w', 'Dm7:w', 'Gm7:w', 'C7:w', 'F:w', 'Gm7:h C7:h',
    // A'
    'Fmaj7:w', 'Am7:w', 'Bbmaj7:w', 'C7:w', 'Fmaj7:w', 'Am7:w', 'Gm7:h C7:h', 'F:w',
  ),
  parts: [
    {
      kind: 'melody',
      name: 'lead',
      voice: leadPulse(0.5, 2000, 0.52, { detune: 8, decay: 0.14, sustain: 0.6 }),
      notes: bars(
        // A
        'r:e A4:e C5:e E5:e r:e E5:q.',
        'D5:e C5:e A4:q r:e G4:e A4:q',
        'r:e Bb4:e D5:e F5:e r:e F5:e D5:e A4:e',
        'G4:q E4:e G4:e Bb4:q r:q',
        'r:e A4:e C5:e E5:e r:e E5:q.',
        'E5:e D5:e C5:q r:e A4:e C5:q',
        'r:e Bb4:e D5:e F5:e r:e F5:e E5:e D5:e',
        'E5:q. D5:e C5:q r:q',
        // B
        'F5:q. D5:e Bb4:q A4:q',
        'G4:q. A4:e Bb4:q C5:q',
        'E5:q. C5:e A4:q G4:q',
        'F4:e A4:e D5:e F5:e r:e E5:e D5:e C5:e',
        'D5:q. Bb4:e G4:q A4:q',
        'Bb4:q. G4:e E4:q G4:q',
        'A4:e C5:e F5:e A5:e r:e G5:e F5:q',
        'D5:h C5:q r:q',
        // A'
        'r:e A4:e C5:e E5:e r:e E5:q.',
        'D5:e C5:e A4:q r:e G4:e A4:q',
        'r:e Bb4:e D5:e F5:e r:e F5:e D5:e A4:e',
        'G4:q E4:e G4:e Bb4:q r:q',
        'r:e A4:e C5:e E5:e r:e E5:q.',
        'E5:e D5:e C5:q r:e A4:e C5:q',
        'Bb4:e D5:e F5:q E5:e C5:e G4:q',
        'F5:q. r:e A4:e C5:e F5:q',
      ),
    },
    {
      // Off-beat two-note stabs, the "skank" that makes it bounce.
      kind: 'arp',
      name: 'comp',
      voice: pluck(0.25, 1700, 0.2, -0.3),
      pattern: '. 0+2 . 1+3 . 0+2 . 1+3',
      rate: 'e',
      low: 'A3',
    },
    {
      kind: 'melody',
      name: 'bass',
      voice: triBass(0.6, { gate: 0.7 }),
      notes: bars(
        // A
        bounce('F2', 'C3'), bounce('A2', 'E3'), bounce('Bb2', 'F3'), bounce('C3', 'G2'),
        bounce('F2', 'C3'), bounce('A2', 'E2'), bounce('G2', 'D3'), bounce('C3', 'G2'),
        // B
        bounce('Bb2', 'F2'), bounce('Bb2', 'C3'), bounce('A2', 'E2'), bounce('D3', 'A2'),
        bounce('G2', 'D3'), bounce('C3', 'G2'), bounce('F2', 'C3'), halfBounce('G2', 'D3') + ' ' + halfBounce('C3', 'G2'),
        // A'
        bounce('F2', 'C3'), bounce('A2', 'E3'), bounce('Bb2', 'F3'), bounce('C3', 'G2'),
        bounce('F2', 'C3'), bounce('A2', 'E2'), halfBounce('G2', 'D3') + ' ' + halfBounce('C3', 'G2'), bounce('F2', 'C3'),
      ),
    },
    {
      kind: 'hits',
      name: 'hat',
      voice: hat(0.1, 0.25),
      hits: bars(
        ...repeat('.... .... .... ....', 4),
        ...repeat('..x. ..x. ..x. ..x.', 4),
        ...repeat('..x. ..x. ..x. ..x.', 7),
        '..x. ..x. ..x. o...',
        ...repeat('..x. ..x. ..x. ..x.', 7),
        '..x. ..x. ..x. o...',
      ),
    },
  ],
}

// ---------------------------------------------------------------------------
// Autumn: A minor waltz, mellow and a little wistful. A B A' over 24 bars of 3/4.

const autumn: Song = {
  title: 'autumn',
  season: 2,
  bpm: 92,
  beatsPerBar: 3,
  stepsPerBeat: 4,
  swing: 0.5,
  echo: { beats: 1, feedback: 0.26, wet: 0.16, tone: 1800 },
  chords: bars(
    // A
    'Am:h.', 'Fmaj7:h.', 'C:h.', 'G:h.', 'Am:h.', 'Dm7:h.', 'Esus4:h.', 'E7:h.',
    // B
    'F:h.', 'G:h.', 'Em7:h.', 'Am:h.', 'Dm7:h.', 'G:h.', 'Cmaj7:h.', 'E7:h.',
    // A'
    'Am:h.', 'Fmaj7:h.', 'C:h.', 'G:h.', 'Am:h.', 'Dm7:h.', 'E7:h.', 'Am:h.',
  ),
  parts: [
    {
      kind: 'melody',
      name: 'lead',
      voice: leadPulse(0.5, 1300, 0.36, {
        attack: 0.03,
        decay: 0.3,
        sustain: 0.7,
        release: 0.25,
        vibrato: { rate: 4.8, depth: 0.18, delay: 0.25 },
      }),
      notes: bars(
        // A
        'E5:h A4:q',
        'C5:q. D5:e E5:q',
        'G5:h E5:q',
        'D5:h.',
        'E5:q. D5:e C5:q',
        'F5:q. E5:e D5:q',
        'A4:q B4:q C5:q',
        'B4:h G#4:q',
        // B
        'A4:q C5:q F5:q',
        'G5:q. F5:e D5:q',
        'E5:h B4:q',
        'C5:h.',
        'D5:q F5:q A5:q',
        'G5:q. F5:e D5:q',
        'E5:q. D5:e B4:q',
        'G#4:h B4:q',
        // A'
        'E5:h A4:q',
        'C5:q. D5:e E5:q',
        'G5:h E5:q',
        'D5:h.',
        'C5:q. B4:e A4:q',
        'F4:q. A4:e D5:q',
        'B4:q. D5:e G#4:q',
        'A4:h.',
      ),
    },
    {
      // A harp-like broken chord in flowing eighths, up and back down.
      kind: 'arp',
      name: 'harp',
      voice: pluck(0.125, 1300, 0.15, 0.25),
      pattern: '0 1 2 3 2 1',
      rate: 'e',
      low: 'G3',
    },
    {
      kind: 'melody',
      name: 'bass',
      voice: triBass(0.36, { attack: 0.01, gate: 0.9, release: 0.12 }),
      notes: bars(
        // A
        'A2:h E3:q', 'F2:h C3:q', 'C3:h G2:q', 'G2:h B2:q',
        'A2:h E3:q', 'D3:h A2:q', 'E2:h B2:q', 'E2:h G#2:q',
        // B
        'F2:h C3:q', 'G2:h D3:q', 'E2:h B2:q', 'A2:h E2:q',
        'D3:h A2:q', 'G2:h B2:q', 'C3:h G2:q', 'E2:h B2:q',
        // A'
        'A2:h E3:q', 'F2:h C3:q', 'C3:h G2:q', 'G2:h B2:q',
        'A2:h E3:q', 'D3:h A2:q', 'E2:h G#2:q', 'A2:h.',
      ),
    },
  ],
}

// ---------------------------------------------------------------------------
// Winter: E minor, sparse, bells in the snow. 16 bars.

const winter: Song = {
  title: 'winter',
  season: 3,
  bpm: 84,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  swing: 0.5,
  echo: { beats: 0.75, feedback: 0.34, wet: 0.24, tone: 2600 },
  chords: bars(
    // A
    'Em:w', 'Cmaj7:w', 'G:w', 'D:w', 'Em:w', 'Am7:w', 'Cmaj7:w', 'Bsus4:w',
    // B
    'Cmaj7:w', 'G/B:w', 'Am7:w', 'Em:w', 'Cmaj7:w', 'D:w', 'Bsus4:w', 'B7:w',
  ),
  parts: [
    {
      kind: 'melody',
      name: 'bells',
      voice: bell(0.4, 1.8, 0.1),
      notes: bars(
        // A
        'B5:q. r:e G5:h',
        'E5:h. r:q',
        'D5:q G5:q B5:h',
        'A5:h. r:q',
        'G5:q. F#5:e E5:h',
        'C6:h B5:q A5:q',
        'G5:h E5:h',
        'F#5:w',
        // B
        'r:q E5:q G5:q B5:q',
        'D6:h. r:q',
        'C6:q. B5:e A5:h',
        'G5:h. r:q',
        'r:q G5:q B5:q E6:q',
        'D6:h. A5:q',
        'B5:h E5:h',
        'D#5:h. r:q',
      ),
    },
    {
      // A few soft chord tones under the bells, two bars per pattern.
      kind: 'arp',
      name: 'glints',
      voice: bell(0.16, 1.2, -0.35),
      pattern: '0 . 2 . . 1 . . | . . 3 . . 2 . .',
      rate: 'e',
      low: 'E4',
    },
    {
      kind: 'melody',
      name: 'bass',
      voice: triBass(0.52, { attack: 0.12, decay: 0.6, sustain: 0.7, release: 0.5, gate: 0.95 }),
      notes: bars(
        // A
        'E2:w', 'C3:w', 'G2:w', 'D3:w', 'E2:w', 'A2:w', 'C3:w', 'B2:w',
        // B
        'C3:w', 'B2:w', 'A2:w', 'E2:w', 'C3:w', 'D3:w', 'B2:w', 'B2:w',
      ),
    },
  ],
}

/** Indexed by season: 0 spring, 1 summer, 2 autumn, 3 winter. */
export const SONGS: Record<Season, Song> = { 0: spring, 1: summer, 2: autumn, 3: winter }
