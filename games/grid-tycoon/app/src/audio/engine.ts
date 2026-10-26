// The audio engine: owns the AudioContext, the mix buses, the lookahead
// scheduler and the season crossfades. No AudioContext exists until unlock(),
// which the UI calls on the first user gesture; before that, and wherever
// WebAudio is missing (SSR, tests), every method is a silent no-op.

import { playCue } from './cues'
import { compileSong, type CompiledSong } from './pattern'
import { Fader } from './fader'
import { SongPlayer } from './player'
import { SONGS } from './songs'
import { createSynth, type Synth } from './synth'
import { LOOKAHEAD, TICK_MS, coinStreakSemitones, dbToGain, phraseStart } from './timing'
import type { CueName, Season } from './types'

/** Music and cue bus levels. Quiet on purpose: the game is played for 25 minutes. */
export const MUSIC_DB = -24
export const SFX_DB = -14
/** Season change crossfade. */
export const CROSSFADE = 1.5
const MUSIC_ON_FADE = 1.2
const MUSIC_OFF_FADE = 0.4
/** Notes start a little after "now" so the first one is never late. */
const START_DELAY = 0.06
/** Same cue again within this many seconds is dropped (a burst of coins stays one sound). */
const CUE_GAP = 0.05
const MAX_CUES = 8
/** Coins within this window climb in pitch. */
const COIN_STREAK_WINDOW = 0.7
/** How much the music dips under a cue, and for how long. */
const DUCK_TO = 0.6
const DUCK_HOLD = 0.08
const DUCK_RECOVER = 0.4

export interface AudioApi {
  /** Create and start the AudioContext. Call from a user gesture; safe to call again (it resumes). */
  unlock(): void
  isUnlocked(): boolean
  /** 0 spring, 1 summer, 2 autumn, 3 winter. Crossfades when the loop changes. */
  setSeason(season: Season): void
  cue(name: CueName): void
  setMusic(on: boolean): void
  setSfx(on: boolean): void
  /** Unlock on the first pointer or key press (and resume after iOS interruptions). Returns a remover. */
  unlockOnFirstGesture(target?: GestureTarget): () => void
  /** Stop everything and close the context (hot reload, tests). */
  close(): void
}

type AudioCtor = new (options?: AudioContextOptions) => AudioContext

interface DocLike {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', fn: () => void): void
  removeEventListener(type: 'visibilitychange', fn: () => void): void
}

export interface GestureTarget {
  addEventListener(type: string, fn: () => void, opts?: AddEventListenerOptions): void
  removeEventListener(type: string, fn: () => void, opts?: EventListenerOptions): void
}

/** What the engine needs from its surroundings; read lazily so importing is always safe. */
export interface AudioEnv {
  AudioContext: AudioCtor | null
  document: DocLike | null
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
}

export function browserEnv(): AudioEnv {
  const g = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor; document?: DocLike }
  return {
    AudioContext: g.AudioContext ?? g.webkitAudioContext ?? null,
    document: g.document ?? null,
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  }
}

interface Live {
  ctx: AudioContext
  synth: Synth
  music: GainNode
  duck: Fader
  sfx: GainNode
}

interface Playing {
  season: Season
  player: SongPlayer
}

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const

/** Swallow a rejected resume/suspend/close; old WebKit does not even return a promise. */
function quietly(p: Promise<unknown> | undefined): void {
  if (p && typeof p.catch === 'function') p.catch(() => undefined)
}

export function createAudioEngine(getEnv: () => AudioEnv = browserEnv): AudioApi {
  let env: AudioEnv | null = null
  let live: Live | null = null
  let musicOn = true
  let sfxOn = true
  let season: Season = 0
  let current: Playing | null = null
  let fading: { player: SongPlayer; until: number }[] = []
  let timer: unknown = null
  let hidden = false
  const compiled = new Map<Season, CompiledSong>()
  // Where each season's loop stopped, so the next year picks up further on.
  const resumeAt: Record<Season, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  const lastCue = new Map<CueName, number>()
  let cueEnds: number[] = []
  let coinStreak = { count: 0, at: -Infinity }

  const guard = (fn: () => void) => {
    try {
      fn()
    } catch {
      // Audio must never break the game; a failed node just means no sound.
    }
  }

  const songFor = (s: Season): CompiledSong => {
    let c = compiled.get(s)
    if (!c) {
      c = compileSong(SONGS[s])
      compiled.set(s, c)
    }
    return c
  }

  const onVisibility = () =>
    guard(() => {
      if (!live || !env?.document) return
      hidden = env.document.hidden
      if (hidden) {
        stopTimer()
        quietly(live.ctx.suspend())
      } else {
        quietly(live.ctx.resume())
        ensureTimer()
      }
    })

  function build(ctor: AudioCtor): Live {
    const ctx = new ctor({ latencyHint: 'interactive' })
    const synth = createSynth(ctx)
    const limiter = ctx.createDynamicsCompressor()
    // A safety net for stacked cues only: it should never touch normal levels.
    limiter.threshold.value = -6
    limiter.knee.value = 6
    limiter.ratio.value = 8
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    const master = ctx.createGain()
    const duckGain = ctx.createGain()
    const duck = new Fader(duckGain.gain, 1)
    const music = ctx.createGain()
    const sfx = ctx.createGain()
    music.gain.value = dbToGain(MUSIC_DB)
    sfx.gain.value = dbToGain(SFX_DB)
    music.connect(duckGain)
    duckGain.connect(master)
    sfx.connect(master)
    master.connect(limiter)
    limiter.connect(ctx.destination)
    return { ctx, synth, music, duck, sfx }
  }

  /** iOS only unmutes WebAudio after something plays inside the gesture. */
  function primeOutput(l: Live) {
    const src = l.ctx.createBufferSource()
    src.buffer = l.ctx.createBuffer(1, 1, l.ctx.sampleRate)
    src.connect(l.ctx.destination)
    src.start(0)
  }

  function startMusic(fade: number) {
    if (!live) return
    const song = songFor(season)
    const at = live.ctx.currentTime + START_DELAY
    const step = phraseStart(resumeAt[season], song.totalSteps, song.stepsPerBar)
    const player = new SongPlayer(live.synth, song, live.music, at, step, fade)
    current = { season, player }
    ensureTimer()
  }

  function fadeOutCurrent(seconds: number) {
    if (!live || !current) return
    resumeAt[current.season] = current.player.position
    const until = current.player.fadeOut(live.ctx.currentTime, seconds)
    fading.push({ player: current.player, until })
    current = null
  }

  function tick() {
    timer = null
    if (!live || hidden) return
    const now = live.ctx.currentTime
    const until = now + LOOKAHEAD
    try {
      current?.player.pump(now, until)
      fading = fading.filter((f) => {
        // Keep a fading song playing to the end of its fade, then let its notes ring out.
        if (now < f.until) f.player.pump(now, Math.min(until, f.until))
        if (now > f.until + 0.5) {
          f.player.dispose()
          return false
        }
        return true
      })
    } finally {
      // Re-arm even if a node failed, so one bad note never stops the music for good.
      if (current || fading.length) timer = env?.setTimeout(() => guard(tick), TICK_MS) ?? null
    }
  }

  function ensureTimer() {
    if (timer !== null || !live || hidden) return
    if (!current && !fading.length) return
    tick()
  }

  function stopTimer() {
    if (timer !== null) env?.clearTimeout(timer)
    timer = null
  }

  function duckMusic(now: number) {
    if (!live || !current) return
    live.duck.rampTo(DUCK_TO, now, 0.02)
    live.duck.thenRampTo(1, now + 0.02 + DUCK_HOLD, DUCK_RECOVER)
    live.duck.prune(now - 1)
  }

  const api: AudioApi = {
    unlock: () =>
      guard(() => {
        if (live) {
          if (!hidden && live.ctx.state !== 'running' && live.ctx.state !== 'closed') {
            quietly(live.ctx.resume())
          }
          return
        }
        env = getEnv()
        if (!env.AudioContext) return
        live = build(env.AudioContext)
        quietly(live.ctx.resume())
        const l = live
        guard(() => primeOutput(l))
        env.document?.addEventListener('visibilitychange', onVisibility)
        hidden = env.document?.hidden ?? false
        if (musicOn) startMusic(MUSIC_ON_FADE)
      }),

    isUnlocked: () => live !== null,

    setSeason: (s) =>
      guard(() => {
        if (s !== 0 && s !== 1 && s !== 2 && s !== 3) return
        const changed = s !== season
        season = s
        if (!live || !musicOn) return
        if (current && !changed) return
        fadeOutCurrent(CROSSFADE)
        startMusic(CROSSFADE)
      }),

    cue: (name) =>
      guard(() => {
        if (!live || !sfxOn || hidden) return
        const now = live.ctx.currentTime
        if (now - (lastCue.get(name) ?? -Infinity) < CUE_GAP) return
        cueEnds = cueEnds.filter((t) => t > now)
        if (cueEnds.length >= MAX_CUES) return
        let semitones = 0
        if (name === 'coins') {
          coinStreak = now - coinStreak.at < COIN_STREAK_WINDOW ? { count: coinStreak.count + 1, at: now } : { count: 0, at: now }
          semitones = coinStreakSemitones(coinStreak.count)
        }
        lastCue.set(name, now)
        cueEnds.push(playCue(live.synth, name, live.sfx, now + 0.005, semitones))
        if (name !== 'click') duckMusic(now)
      }),

    setMusic: (on) =>
      guard(() => {
        musicOn = on
        if (!live) return
        if (on && !current) startMusic(MUSIC_ON_FADE)
        if (!on && current) fadeOutCurrent(MUSIC_OFF_FADE)
      }),

    setSfx: (on) => {
      sfxOn = on
    },

    unlockOnFirstGesture(target) {
      const t: GestureTarget | undefined = target ?? (globalThis as unknown as { window?: GestureTarget }).window
      if (!t) return () => undefined
      // Stays subscribed: later gestures resume a context that iOS suspended (calls, Siri).
      const handler = () => api.unlock()
      for (const type of GESTURES) t.addEventListener(type, handler, { passive: true, capture: true })
      return () => {
        for (const type of GESTURES) t.removeEventListener(type, handler, { capture: true })
      }
    },

    close: () =>
      guard(() => {
        stopTimer()
        current?.player.dispose()
        for (const f of fading) f.player.dispose()
        current = null
        fading = []
        env?.document?.removeEventListener('visibilitychange', onVisibility)
        if (live) quietly(live.ctx.close())
        live = null
      }),
  }
  return api
}
