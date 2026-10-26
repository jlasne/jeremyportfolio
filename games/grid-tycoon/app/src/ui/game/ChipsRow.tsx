// Warnings as chips under the top bar (never pop-ups). The first chip, when present, is the reason
// Lock in is disabled. Each chip opens the panel that fixes it.

import { useDerived } from '../../store/derived'
import { useGame } from '../../store/game'
import { selectLosingRound } from '../../store/selectors'
import { useUi } from '../../store/ui'
import { Chip } from '../kit'
import { panelForIssue, panelForWarning } from './panelFor'
import { LOCK_REASON_ID, useLockBlock } from './TopBar'

const ORDER = { critical: 0, warn: 1, info: 2 } as const

export function ChipsRow() {
  const { warnings, validation } = useDerived()
  const block = useLockBlock()
  const phase = useGame((s) => s.phase)
  const losing = useGame(selectLosingRound)
  const open = useUi((s) => s.open)
  if (phase !== 'decide' && phase !== 'waiting') return <div className="chips" aria-hidden="true" />

  const sorted = [...warnings].sort((a, b) => ORDER[a.level] - ORDER[b.level])
  const blockPanel = panelForIssue(validation.errors[0])

  return (
    <div className="chips" role="region" aria-label="Warnings">
      {block ? (
        <Chip
          id={LOCK_REASON_ID}
          level={phase === 'waiting' ? 'info' : 'critical'}
          icon="lock"
          label={block}
          onClick={blockPanel && blockPanel !== 'forced' && !losing ? () => open(blockPanel) : undefined}
        />
      ) : null}
      {sorted.map((w) => (
        <Chip key={w.code} level={w.level} label={w.label} detail={w.detail} onClick={losing ? undefined : () => open(panelForWarning(w.code))} />
      ))}
      {!block && sorted.length === 0 ? <Chip level="ok" label="Ready" value="no warnings" /> : null}
    </div>
  )
}
