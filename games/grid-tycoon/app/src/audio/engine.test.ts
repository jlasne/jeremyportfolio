import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CROSSFADE, MUSIC_DB, SFX_DB, browserEnv, createAudioEngine, type AudioEnv } from './engine'
import { dbToGain } from './timing'

// A minimal WebAudio stand-in: enough surface for the engine, and it records
// what was scheduled so tests can look at it.

type Call = [string, ...number[]]

class FakeParam {
  calls: Call[] = []
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number) {
    this.calls.push(['set', v, t])
    this.value = v
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(['linear', v, t])
    this.value = v
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push(['exp', v, t])
  }
  setTargetAtTime(v: number, t: number, c: number) {
    this.calls.push(['target', v, t, c])
  }
  cancelScheduledValues(t: number) {
    this.calls.push(['cancel', t])
  }
}

class FakeNode {
  outputs: unknown[] = []
  connect(dest: unknown) {
    this.outputs.push(dest)
    return dest
  }
  disconnect() {
    this.outputs = []
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam(1)
}

class FakeSource extends FakeNode {
  frequency = new FakeParam(440)
  detune = new FakeParam(0)
  playbackRate = new FakeParam(1)
  type = 'sine'
  buffer: unknown = null
  loop = false
  startedAt: number | null = null
  constructor(private ctx: FakeContext, public kind: 'osc' | 'buffer') {
    super()
  }
  setPeriodicWave() {}
  start(t = 0) {
    this.startedAt = t
    this.ctx.started.push({ kind: this.kind, time: t, freq: this.frequency.value })
  }
  stop() {}
}

class FakeContext {
  static instances: FakeContext[] = []
  currentTime = 0
  sampleRate = 48000
  state: AudioContextState = 'suspended'
  destination = new FakeNode()
  started: { kind: string; time: number; freq: number }[] = []
  gains: FakeGain[] = []
  calls: string[] = []
  constructor() {
    FakeContext.instances.push(this)
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createOscillator() {
    return new FakeSource(this, 'osc')
  }
  createBufferSource() {
    return new FakeSource(this, 'buffer')
  }
  createBuffer(_ch: number, length: number) {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() })
  }
  createStereoPanner() {
    return Object.assign(new FakeNode(), { pan: new FakeParam() })
  }
  createDelay() {
    return Object.assign(new FakeNode(), { delayTime: new FakeParam() })
  }
  createDynamicsCompressor() {
    const p = () => new FakeParam()
    return Object.assign(new FakeNode(), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() })
  }
  createPeriodicWave() {
    return {}
  }
  resume() {
    this.calls.push('resume')
    this.state = 'running'
    return Promise.resolve()
  }
  suspend() {
    this.calls.push('suspend')
    this.state = 'suspended'
    return Promise.resolve()
  }
  close() {
    this.state = 'closed'
    return Promise.resolve()
  }
}

class FakeDocument {
  hidden = false
  private fns: (() => void)[] = []
  addEventListener(_: string, fn: () => void) {
    this.fns.push(fn)
  }
  removeEventListener(_: string, fn: () => void) {
    this.fns = this.fns.filter((f) => f !== fn)
  }
  setHidden(h: boolean) {
    this.hidden = h
    for (const f of this.fns) f()
  }
}

let doc: FakeDocument
let env: AudioEnv

function ctx(): FakeContext {
  return FakeContext.instances[FakeContext.instances.length - 1]
}

/** Move the audio clock and the timers forward together. */
function advance(ms: number, step = 25) {
  for (let t = 0; t < ms; t += step) {
    for (const c of FakeContext.instances) if (c.state === 'running') c.currentTime += step / 1000
    vi.advanceTimersByTime(step)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeContext.instances = []
  doc = new FakeDocument()
  env = {
    AudioContext: FakeContext as unknown as AudioEnv['AudioContext'],
    document: doc,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('without WebAudio (SSR, tests, old browsers)', () => {
  it('turns every method into a safe no-op', () => {
    const a = createAudioEngine(() => ({ ...env, AudioContext: null, document: null }))
    expect(() => {
      a.setSeason(2)
      a.setMusic(false)
      a.setSfx(true)
      a.cue('coins')
      a.unlock()
      a.cue('lock')
      a.unlockOnFirstGesture()
      a.close()
    }).not.toThrow()
    expect(a.isUnlocked()).toBe(false)
  })

  it('reads the real environment lazily and finds no AudioContext in node', () => {
    expect(browserEnv().AudioContext).toBeNull()
  })
})

describe('before unlock', () => {
  it('never creates an AudioContext, whatever is called', () => {
    const a = createAudioEngine(() => env)
    a.setSeason(1)
    a.setMusic(true)
    a.cue('lock')
    a.cue('coins')
    advance(500)
    expect(FakeContext.instances).toHaveLength(0)
    expect(a.isUnlocked()).toBe(false)
  })
})

describe('after unlock', () => {
  it('creates exactly one context and resumes it', () => {
    const a = createAudioEngine(() => env)
    a.unlock()
    a.unlock()
    expect(FakeContext.instances).toHaveLength(1)
    expect(ctx().calls).toContain('resume')
    expect(a.isUnlocked()).toBe(true)
  })

  it('sets the music and cue buses to their quiet levels', () => {
    const a = createAudioEngine(() => env)
    a.unlock()
    const levels = ctx().gains.map((g) => g.gain.value)
    expect(levels).toContain(dbToGain(MUSIC_DB))
    expect(levels).toContain(dbToGain(SFX_DB))
  })

  it('plays the season set before unlock, scheduling only a lookahead window ahead', () => {
    const a = createAudioEngine(() => env)
    a.setSeason(3)
    a.unlock()
    advance(2000)
    const c = ctx()
    const notes = c.started.filter((s) => s.kind === 'osc' && s.time > 0)
    expect(notes.length).toBeGreaterThan(0)
    for (const n of notes) expect(n.time).toBeLessThanOrEqual(c.currentTime + 0.1 + 1e-9)
  })

  it('keeps scheduling as time goes on, without bursts', () => {
    const a = createAudioEngine(() => env)
    a.setSeason(0)
    a.unlock()
    advance(1000)
    const first = ctx().started.length
    advance(1000)
    const second = ctx().started.length - first
    expect(second).toBeGreaterThan(0)
    // Two equal seconds of the same song schedule about the same number of sources.
    expect(second).toBeLessThan(first * 2 + 20)
  })

  it('plays cues when sound effects are on, and not when they are off', () => {
    const a = createAudioEngine(() => env)
    a.setMusic(false)
    a.unlock()
    const c = ctx()
    const before = c.started.length
    a.cue('lock')
    expect(c.started.length).toBeGreaterThan(before)
    advance(200)
    a.setSfx(false)
    const muted = c.started.length
    a.cue('stockUp')
    expect(c.started.length).toBe(muted)
  })

  it('drops the same cue fired twice in the same instant', () => {
    const a = createAudioEngine(() => env)
    a.setMusic(false)
    a.unlock()
    const c = ctx()
    a.cue('coins')
    const once = c.started.length
    a.cue('coins')
    expect(c.started.length).toBe(once)
  })

  it('crossfades over 1.5 s on a season change', () => {
    const a = createAudioEngine(() => env)
    a.setSeason(0)
    a.unlock()
    advance(1000)
    const c = ctx()
    const gainsBefore = c.gains.length
    a.setSeason(1)
    const now = c.currentTime
    // The old song's fader ramps to 0 over the crossfade...
    const fadedOut = c.gains.slice(0, gainsBefore).some((g) =>
      g.gain.calls.some(([k, v, t]) => k === 'linear' && v === 0 && Math.abs(t - (now + CROSSFADE)) < 1e-9),
    )
    expect(fadedOut).toBe(true)
    // ...while the new one starts at 0 and ramps to full.
    const fadedIn = c.gains.slice(gainsBefore).some((g) =>
      g.gain.calls.some(([k, v]) => k === 'set' && v === 0) && g.gain.calls.some(([k, v]) => k === 'linear' && v === 1),
    )
    expect(fadedIn).toBe(true)
  })

  it('ignores a season change to the season already playing', () => {
    const a = createAudioEngine(() => env)
    a.setSeason(2)
    a.unlock()
    advance(300)
    const gains = ctx().gains.length
    a.setSeason(2)
    expect(ctx().gains.length).toBe(gains)
  })

  it('stops scheduling music once it is turned off and the fade is over', () => {
    const a = createAudioEngine(() => env)
    a.unlock()
    advance(1000)
    a.setMusic(false)
    advance(1500)
    const c = ctx()
    const quiet = c.started.length
    advance(2000)
    expect(c.started.length).toBe(quiet)
    a.setMusic(true)
    advance(1000)
    expect(c.started.length).toBeGreaterThan(quiet)
  })

  it('pauses when the tab is hidden and resumes after', () => {
    const a = createAudioEngine(() => env)
    a.unlock()
    advance(1000)
    const c = ctx()
    doc.setHidden(true)
    expect(c.calls).toContain('suspend')
    const paused = c.started.length
    advance(2000)
    expect(c.started.length).toBe(paused)
    a.cue('coins') // nobody is there to hear it
    expect(c.started.length).toBe(paused)
    doc.setHidden(false)
    expect(c.calls.filter((x) => x === 'resume').length).toBeGreaterThanOrEqual(2)
    advance(1000)
    expect(c.started.length).toBeGreaterThan(paused)
  })

  it('unlocks on the first gesture and resumes on later ones', () => {
    const fns = new Map<string, () => void>()
    const target = {
      addEventListener: (type: string, fn: () => void) => fns.set(type, fn),
      removeEventListener: (type: string) => fns.delete(type),
    }
    const a = createAudioEngine(() => env)
    const remove = a.unlockOnFirstGesture(target)
    expect(FakeContext.instances).toHaveLength(0)
    fns.get('pointerdown')?.()
    expect(a.isUnlocked()).toBe(true)
    ctx().state = 'suspended' // e.g. an iOS interruption
    fns.get('keydown')?.()
    expect(ctx().state).toBe('running')
    remove()
    expect(fns.size).toBe(0)
  })

  it('closes cleanly', () => {
    const a = createAudioEngine(() => env)
    a.unlock()
    advance(300)
    a.close()
    expect(ctx().state).toBe('closed')
    expect(a.isUnlocked()).toBe(false)
    expect(() => a.cue('click')).not.toThrow()
  })
})
