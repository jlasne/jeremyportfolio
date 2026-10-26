// Public API of the audio module: one shared engine for the whole app.
//
//   audio.unlockOnFirstGesture()   // once at startup (or call audio.unlock() from a click handler)
//   audio.setSeason(seasonOf(state.round))
//   audio.cue('lock')
//   audio.setMusic(settings.music); audio.setSfx(settings.sfx)
//
// Nothing touches WebAudio until unlock(), so importing this is safe anywhere.

import { createAudioEngine, type AudioApi } from './engine'

export const audio: AudioApi = createAudioEngine()

export type { AudioApi, AudioEnv, GestureTarget } from './engine'
export { createAudioEngine, MUSIC_DB, SFX_DB, CROSSFADE } from './engine'
export type { CueName, Season } from './types'
export { CUE_NAMES } from './cues'

// Vite hot reload would otherwise leave the old engine's music playing under the new one.
if (import.meta.hot) import.meta.hot.dispose(() => audio.close())
