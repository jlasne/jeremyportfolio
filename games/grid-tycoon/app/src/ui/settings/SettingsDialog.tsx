// Settings: theme, music, sound effects, reduced motion, replay the tutorial. Everything is saved
// to gt.settings.v1 as it changes; there is no Save button.

import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Button, Dialog, Segmented, Toggle } from '../kit'

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen)
  const setOpen = useUi((s) => s.setSettingsOpen)
  const settings = useUi((s) => s.settings)
  const setSetting = useUi((s) => s.setSetting)
  const replayTutorial = useUi((s) => s.replayTutorial)
  const inGame = useGame((s) => s.screen === 'game')

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Settings" icon="gear" footer={<Button variant="primary" onClick={() => setOpen(false)}>Done</Button>}>
      <div className="settings-grid">
        <Segmented
          label="Theme"
          value={settings.theme}
          onChange={(v) => setSetting('theme', v)}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light', icon: 'summer' },
            { value: 'dark', label: 'Dark', icon: 'winter' },
          ]}
        />
        <Toggle label="Music" description="A soft chiptune loop, one per season." checked={settings.music} onChange={(v) => setSetting('music', v)} />
        <Toggle label="Sound effects" description="Lock in, coins, cranes and stock moves." checked={settings.sfx} onChange={(v) => setSetting('sfx', v)} />
        <Segmented
          label="Reduced motion"
          value={settings.reducedMotion}
          onChange={(v) => setSetting('reducedMotion', v)}
          options={[
            { value: 'system', label: 'System' },
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
        />
        <p className="field-desc">Reduced motion stops flow dots, smoke and number easing.</p>
        <div className="settings-row">
          <div className="toggle-text">
            <span className="field-label">Tutorial</span>
            <span className="field-desc">Five short steps over rounds 1 to 3.</span>
          </div>
          <Button
            icon="play"
            onClick={() => {
              replayTutorial()
              if (inGame) setOpen(false)
            }}
          >
            Replay tutorial
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
