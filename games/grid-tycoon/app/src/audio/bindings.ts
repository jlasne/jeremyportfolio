// Wires the audio engine to the app stores. Imported once from main.tsx (the import starts it).
//
//   - the saved music / sfx settings apply before the first gesture, then stay in sync
//   - the context unlocks on the first pointer or key press
//   - the music follows the season of the round (spring on the title and lobby)
//   - cues: 'lock' on lock in, 'error' when a blocked Lock in is pressed (click or Ctrl+Enter),
//     'click' when a panel opens. The results overlay plays stockUp / stockDown itself, the map
//     plays coins and crane.

import { audio } from '.'
import { seasonOf } from '../engine'
import { computeDerived } from '../store/derived'
import { useDraft } from '../store/draft'
import { useGame } from '../store/game'
import type { GameStore } from '../store/game'
import { selectLosingRound } from '../store/selectors'
import { useUi } from '../store/ui'

function seasonFor(s: GameStore): 0 | 1 | 2 | 3 {
  if ((s.screen === 'game' || s.screen === 'end') && s.state) return seasonOf(Math.min(s.state.round, s.state.rounds))
  return 0
}

/** True when pressing Lock in now would do nothing (the button is disabled for a reason). */
function lockBlocked(): boolean {
  const game = useGame.getState()
  if (game.screen !== 'game' || game.phase !== 'decide' || !game.state || !game.meId) return false
  const me = game.state.companies.find((c) => c.id === game.meId)
  if (!me || me.bankrupt) return false
  if (selectLosingRound(game) && !useUi.getState().forcedSaleConfirmed) return true
  return !computeDerived(game.state, game.meId, useDraft.getState().decision, game.config).validation.ok
}

export function startAudioBindings(): () => void {
  const offs: (() => void)[] = []

  // settings first, so a muted player never hears the first note
  const { music, sfx } = useUi.getState().settings
  audio.setMusic(music)
  audio.setSfx(sfx)
  offs.push(
    useUi.subscribe((s, p) => {
      if (s.settings.music !== p.settings.music) audio.setMusic(s.settings.music)
      if (s.settings.sfx !== p.settings.sfx) audio.setSfx(s.settings.sfx)
      if (s.panel && s.panel !== p.panel) audio.cue('click')
    }),
  )

  offs.push(audio.unlockOnFirstGesture())

  audio.setSeason(seasonFor(useGame.getState()))
  offs.push(
    useGame.subscribe((s, p) => {
      const season = seasonFor(s)
      if (season !== seasonFor(p)) audio.setSeason(season)
      if (s.screen === 'game' && p.phase === 'decide' && (s.phase === 'results' || s.phase === 'waiting') && s.state && p.state && s.mode === p.mode) audio.cue('lock')
    }),
  )

  // A disabled button gets no click, so listen for the press on its wrapper (capture phase).
  const onPress = (e: PointerEvent) => {
    const el = e.target instanceof Element ? e.target : null
    const btn = el?.closest('.lock-wrap')?.querySelector<HTMLButtonElement>('.lock-btn')
    if (btn?.disabled && lockBlocked()) audio.cue('error')
  }
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.repeat && lockBlocked()) audio.cue('error')
  }
  window.addEventListener('pointerdown', onPress, true)
  window.addEventListener('keydown', onKey, true)
  offs.push(() => {
    window.removeEventListener('pointerdown', onPress, true)
    window.removeEventListener('keydown', onKey, true)
  })

  return () => offs.splice(0).forEach((off) => off())
}

if (typeof window !== 'undefined') {
  const stop = startAudioBindings()
  if (import.meta.hot) import.meta.hot.dispose(stop)
}
