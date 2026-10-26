// Plays one compiled song in a loop. The owner calls pump() every few ms with
// the audio clock; pump schedules every step that starts before `until`.

import { Fader } from './fader'
import { midiToFreq } from './notes'
import type { CompiledSong } from './pattern'
import { createChain, disconnectAll, playNote, type Chain, type Synth } from './synth'
import { beatSeconds, originFor, resyncStep, stepOffset, stepSpan, stepsDueUntil } from './timing'

const OPEN_HIT_RING = 5

export class SongPlayer {
  /** The player's fader: the engine crossfades songs on this gain. */
  readonly output: GainNode
  private readonly fader: Fader
  private readonly bus: GainNode
  private readonly chains: Chain[]
  private readonly nodes: AudioNode[] = []
  private readonly origin: number
  private nextStep: number

  /**
   * Starts silent and fades up over `fadeIn` seconds from `startTime` (0 = full
   * level at once). `startStep` picks where in the loop to begin.
   */
  constructor(
    private readonly synth: Synth,
    readonly song: CompiledSong,
    dest: AudioNode,
    startTime: number,
    startStep = 0,
    fadeIn = 0,
  ) {
    const { ctx } = synth
    this.output = ctx.createGain()
    this.fader = new Fader(this.output.gain, fadeIn > 0 ? 0 : 1)
    if (fadeIn > 0) this.fader.rampTo(1, startTime, fadeIn)
    this.output.connect(dest)
    this.bus = ctx.createGain()
    this.bus.connect(this.output)
    this.nodes.push(this.output, this.bus)
    this.addEcho()
    this.chains = song.tracks.map((t) => createChain(ctx, t.part.voice, this.bus))
    this.origin = originFor(startStep, startTime, song.timing)
    this.nextStep = startStep
  }

  /** The next step to be scheduled, counted from the start of the loop's first play. */
  get position(): number {
    return this.nextStep
  }

  /** Schedule every step that starts before `until`. */
  pump(now: number, until: number): void {
    const { song } = this
    const t = song.timing
    this.nextStep = resyncStep(this.nextStep, this.origin, now, t)
    const end = stepsDueUntil(this.nextStep, this.origin, until, t)
    for (let step = this.nextStep; step < end; step++) {
      const time = this.origin + stepOffset(step, t)
      for (const { track, event } of song.byStep[step % song.totalSteps]) {
        const voice = song.tracks[track].part.voice
        const length = stepSpan(step, event.length, t)
        const dest = this.chains[track].input
        if (event.midis.length === 0) {
          // An open hit is written longer than a closed one and rings on accordingly.
          const hit = event.length > 1 ? { ...voice, decay: voice.decay * OPEN_HIT_RING } : voice
          playNote(this.synth, hit, dest, 0, time, length, event.velocity)
        } else {
          // Chord tones share the level of one note.
          const v = event.velocity / Math.sqrt(event.midis.length)
          for (const m of event.midis) playNote(this.synth, voice, dest, midiToFreq(m), time, length, v)
        }
      }
    }
    this.nextStep = end
  }

  /** Fade to silence from wherever the fader is at `at`. Returns when the fade ends. */
  fadeOut(at: number, seconds: number): number {
    return this.fader.rampTo(0, at, seconds)
  }

  dispose(): void {
    disconnectAll(this.chains.flatMap((c) => c.nodes))
    disconnectAll(this.nodes)
  }

  private addEcho(): void {
    const echo = this.song.song.echo
    if (!echo) return
    const { ctx } = this.synth
    const delay = ctx.createDelay(2)
    delay.delayTime.value = Math.min(1.9, echo.beats * beatSeconds(this.song.song.bpm))
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = echo.tone
    const feedback = ctx.createGain()
    feedback.gain.value = echo.feedback
    const wet = ctx.createGain()
    wet.gain.value = echo.wet
    this.bus.connect(delay)
    delay.connect(tone)
    tone.connect(feedback)
    feedback.connect(delay)
    tone.connect(wet)
    wet.connect(this.output)
    this.nodes.push(delay, tone, feedback, wet)
  }
}
