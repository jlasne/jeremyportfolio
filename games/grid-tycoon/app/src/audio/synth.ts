// WebAudio voices: pulse, triangle, sine, an FM bell and a noise hit, each with
// a soft envelope. Works on any BaseAudioContext, so the same code plays live
// and renders offline (see app/.sim/audio for the offline renderer).

import { pulseCoefficients } from './waves'
import type { VoiceSpec } from './types'

export interface Synth {
  ctx: BaseAudioContext
  /** One second of white noise, shared by every hit. */
  noise: AudioBuffer
  pulse(duty: number): PeriodicWave
}

export function createSynth(ctx: BaseAudioContext): Synth {
  const waves = new Map<number, PeriodicWave>()
  return {
    ctx,
    noise: noiseBuffer(ctx),
    pulse(duty) {
      const key = Math.round(duty * 1000)
      let w = waves.get(key)
      if (!w) {
        const { real, imag } = pulseCoefficients(duty)
        w = ctx.createPeriodicWave(real, imag)
        waves.set(key, w)
      }
      return w
    },
  }
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buf.getChannelData(0)
  // A small LCG: noise only needs to sound random, and this keeps renders repeatable.
  let x = 0x2545f491
  for (let i = 0; i < data.length; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    data[i] = x / 0x80000000 - 1
  }
  return buf
}

/** A filter, a stereo position and a level for one part of a song; notes connect to `input`. */
export interface Chain {
  input: AudioNode
  nodes: AudioNode[]
}

export function createChain(ctx: BaseAudioContext, voice: VoiceSpec, dest: AudioNode): Chain {
  const nodes: AudioNode[] = []
  const level = ctx.createGain()
  level.gain.value = voice.level
  nodes.push(level)
  let head: AudioNode = level
  if (voice.pan && typeof ctx.createStereoPanner === 'function') {
    const pan = ctx.createStereoPanner()
    pan.pan.value = voice.pan
    pan.connect(level)
    nodes.push(pan)
    head = pan
  }
  if (voice.filter) {
    const f = ctx.createBiquadFilter()
    f.type = voice.filter.type
    f.frequency.value = voice.filter.freq
    f.Q.value = voice.filter.q ?? 0.7
    f.connect(head)
    nodes.push(f)
    head = f
  }
  level.connect(dest)
  return { input: head, nodes }
}

export function disconnectAll(nodes: AudioNode[]): void {
  for (const n of nodes) {
    try {
      n.disconnect()
    } catch {
      // already disconnected
    }
  }
}

interface Source {
  output: AudioNode
  frequencies: AudioParam[]
  start(at: number): void
  stop(at: number): void
}

function source(s: Synth, voice: Pick<VoiceSpec, 'wave' | 'duty' | 'detune' | 'bell'>, freq: number): Source {
  const { ctx } = s
  if (voice.wave === 'noise') {
    const src = ctx.createBufferSource()
    src.buffer = s.noise
    src.loop = true
    return {
      output: src,
      frequencies: [],
      // A different slice of the buffer each time, so hits do not sound identical.
      start: (at) => src.start(at, (at * 7.31) % 1),
      stop: (at) => src.stop(at),
    }
  }
  if (voice.wave === 'bell') {
    // Two-operator FM: an inharmonic modulator gives the strike, and its index
    // falls quickly so the note rings out as an almost pure tone.
    const { ratio, strike, ring } = voice.bell ?? { ratio: 3.5, strike: 1.4, ring: 0.12 }
    const carrier = ctx.createOscillator()
    const mod = ctx.createOscillator()
    const depth = ctx.createGain()
    carrier.frequency.value = freq
    mod.frequency.value = freq * ratio
    mod.connect(depth)
    depth.connect(carrier.frequency)
    return {
      output: carrier,
      frequencies: [carrier.frequency],
      start(at) {
        depth.gain.setValueAtTime(freq * strike, at)
        depth.gain.setTargetAtTime(freq * ring, at, 0.08)
        mod.start(at)
        carrier.start(at)
      },
      stop(at) {
        mod.stop(at)
        carrier.stop(at)
      },
    }
  }
  const wave = voice.wave
  const make = (detune: number) => {
    const o = ctx.createOscillator()
    if (wave === 'pulse') o.setPeriodicWave(s.pulse(voice.duty ?? 0.5))
    else o.type = wave
    o.frequency.value = freq
    if (detune) o.detune.value = detune
    return o
  }
  const oscs = voice.detune ? [make(-voice.detune / 2), make(voice.detune / 2)] : [make(0)]
  const mix = ctx.createGain()
  mix.gain.value = 1 / oscs.length
  for (const o of oscs) o.connect(mix)
  return {
    output: mix,
    frequencies: oscs.map((o) => o.frequency),
    start: (at) => oscs.forEach((o) => o.start(at)),
    stop: (at) => oscs.forEach((o) => o.stop(at)),
  }
}

export interface NoteOptions {
  /** Semitones to slide by over the note. */
  glide?: number
}

/**
 * Play one note through `dest`. `length` is the written length in seconds; the
 * voice's gate and release decide how long it actually sounds.
 */
export function playNote(
  s: Synth,
  voice: VoiceSpec,
  dest: AudioNode,
  freq: number,
  time: number,
  length: number,
  velocity: number,
  opts: NoteOptions = {},
): number {
  const { ctx } = s
  const peak = Math.max(0, velocity)
  const src = source(s, voice, freq)
  const env = ctx.createGain()
  src.output.connect(env)
  env.connect(dest)

  const g = env.gain
  const attack = Math.max(0.001, voice.attack)
  g.setValueAtTime(0, time)
  g.linearRampToValueAtTime(peak, time + attack)
  let end: number
  if (voice.wave === 'bell' || voice.sustain <= 0) {
    // Percussive: decay from the strike, ignore the written length past the attack.
    const ring = Math.max(voice.decay, 0.01)
    g.setTargetAtTime(0, time + attack, ring / 4)
    end = time + attack + ring
  } else {
    const off = time + Math.max(attack, length * voice.gate)
    g.setTargetAtTime(peak * voice.sustain, time + attack, Math.max(0.005, voice.decay / 3))
    g.setTargetAtTime(0, off, Math.max(0.005, voice.release / 4))
    end = off + voice.release
  }

  if (opts.glide) {
    const ratio = Math.pow(2, opts.glide / 12)
    for (const f of src.frequencies) {
      f.setValueAtTime(freq, time)
      f.exponentialRampToValueAtTime(freq * ratio, time + Math.max(length, 0.01))
    }
  }

  const vib = voice.vibrato
  const lfoStops: OscillatorNode[] = []
  if (vib && length > vib.delay + 0.05 && src.frequencies.length > 0) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = vib.rate
    const hz = freq * (Math.pow(2, vib.depth / 12) - 1)
    depth.gain.setValueAtTime(0, time)
    depth.gain.setValueAtTime(0, time + vib.delay)
    depth.gain.linearRampToValueAtTime(hz, time + vib.delay + 0.2)
    lfo.connect(depth)
    for (const f of src.frequencies) depth.connect(f)
    lfo.start(time)
    lfoStops.push(lfo)
  }

  const stopAt = end + 0.05
  src.start(time)
  src.stop(stopAt)
  for (const l of lfoStops) l.stop(stopAt)
  return stopAt
}
