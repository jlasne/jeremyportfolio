// The card of the selected building (or pending order): what it is, its MW, used / idle this round
// (the draft) and last round, status and countdown, maintenance, sell value, and the one action it
// offers (Upgrade, or Cancel order). Desktop: an overlay next to the building that follows the
// camera. Phones: a card docked at the bottom of the map (top when a sheet is open).

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { computeDerived } from '../store/derived'
import { useDraft } from '../store/draft'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { Button, Icon, IconButton, Mw, fmtMoney, usePhone } from '../ui/kit'
import type { IconName } from '../ui/kit'
import { buildingStats, pendingStats } from './stats'
import type { BuildingStats, PendingStats } from './stats'
import type { MapView } from './view'

const CARD_W = 300
const GAP = 12

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export default function BuildingCard({ view }: { view: MapView }) {
  const selected = useUi((s) => s.selected)
  const select = useUi((s) => s.select)
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const phase = useGame((s) => s.phase)
  const decision = useDraft((s) => s.decision)
  const toggleUpgrade = useDraft((s) => s.toggleUpgrade)
  const removeBuild = useDraft((s) => s.removeBuild)
  const phone = usePhone()
  const ref = useRef<HTMLElement>(null)

  const derived = state && meId ? computeDerived(state, meId, decision, config) : null
  const bstats = state && meId && derived && selected && !selected.startsWith('pending:') ? buildingStats(state, meId, decision, derived.preview, config, selected) : null
  const pstats = state && selected?.startsWith('pending:') ? pendingStats(state, decision, config, selected) : null
  const open = !!(bstats || pstats)
  const tile = bstats?.building.tile ?? pstats?.tile ?? null

  // a selection that no longer exists (sold, cancelled, new round) closes the card
  useEffect(() => {
    if (selected && state && !open) select(null)
  }, [selected, state, open, select])

  // Esc closes the card when no panel is open (the panel's Esc comes first)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || useUi.getState().panel) return
      e.preventDefault()
      select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, select])

  // follow the camera without re-rendering: write the position straight to the element
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !tile) return
    const place = () => {
      if (phone) {
        const safe = view.mapSafe
        const sheetOpen = safe.y1 < view.host.clientHeight - 4
        el.style.left = `${8}px`
        el.style.right = `${8}px`
        el.style.width = 'auto'
        if (sheetOpen) {
          el.style.top = `${8}px`
          el.style.bottom = 'auto'
          view.setOccluder({ top: 8 + el.offsetHeight + 8 })
        } else {
          el.style.top = 'auto'
          el.style.bottom = `${8}px`
          view.setOccluder({ bottom: view.host.clientHeight - 8 - el.offsetHeight - 8 })
        }
        return
      }
      const safe = view.safeRect
      const r = view.lotScreenRect(tile)
      const h = el.offsetHeight || 260
      // open toward the nearer edge of the plot (left for the two west columns, right for the two
      // east ones), so the card covers the roads, town or grid rather than neighbouring lots
      const right = r.x + r.w + GAP
      const left = r.x - GAP - CARD_W
      const fitsRight = right + CARD_W <= safe.x1 - 8
      const fitsLeft = left >= safe.x0 + 8
      let x = tile[0] >= 2 ? (fitsRight ? right : fitsLeft ? left : NaN) : fitsLeft ? left : fitsRight ? right : NaN
      if (Number.isNaN(x)) x = Math.min(safe.x1 - CARD_W - 8, Math.max(safe.x0 + 8, r.x + r.w / 2 - CARD_W / 2))
      let y = r.y - 8
      y = Math.min(safe.y1 - h - 8, Math.max(safe.y0 + 8, y))
      el.style.left = `${Math.round(x)}px`
      el.style.top = `${Math.round(y)}px`
      el.style.right = 'auto'
      el.style.bottom = 'auto'
      el.style.width = `${CARD_W}px`
    }
    place()
    const off = view.onCamera(place)
    const off2 = view.onLayout(place)
    return () => {
      off()
      off2()
      view.setOccluder(null)
    }
  }, [view, tile, phone, open, bstats?.upgrade?.ordered, pstats?.index])

  if (!open || !state) return null
  const deciding = phase === 'decide'
  return (
    <aside ref={ref} className={`mcard${phone ? ' is-phone' : ''}`} aria-label={`${bstats?.name ?? pstats?.name} card`}>
      {bstats ? (
        <BuildingBody s={bstats} deciding={deciding} phone={phone} round={state.round} onUpgrade={() => toggleUpgrade(bstats.building.id)} onClose={() => select(null)} />
      ) : pstats ? (
        <PendingBody
          s={pstats}
          deciding={deciding}
          phone={phone}
          onCancel={() => {
            removeBuild(pstats.index)
            select(null)
          }}
          onClose={() => select(null)}
        />
      ) : null}
    </aside>
  )
}

function Head({ icon, hue, title, sub, onClose }: { icon: IconName; hue: string; title: string; sub: string; onClose: () => void }) {
  return (
    <header className="mcard-head">
      <span className="mcard-badge" style={{ ['--hue' as string]: hue }}>
        <Icon name={icon} size={20} />
      </span>
      <div className="mcard-title">
        <h3>{title}</h3>
        <p className="mcard-sub">{sub}</p>
      </div>
      <IconButton icon="close" label="Close building card" size="sm" onClick={onClose} />
    </header>
  )
}

function Status({ icon, level, children }: { icon: IconName; level: 'ok' | 'busy' | 'warn'; children: ReactNode }) {
  return (
    <p className={`mcard-status is-${level}`}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </p>
  )
}

function BuildingBody({ s, deciding, round, phone, onUpgrade, onClose }: { s: BuildingStats; deciding: boolean; round: number; phone: boolean; onUpgrade: () => void; onClose: () => void }) {
  const b = s.building
  const plant = b.kind === 'plant'
  const hue = plant ? 'var(--plant-mid)' : 'var(--dc-mid)'
  const building = b.status === 'building'
  return (
    <>
      <Head icon={plant ? 'plant' : 'dc'} hue={hue} title={s.name} sub={b.status === 'building' ? `Under construction` : `${plant ? 'Makes' : 'Runs'} ${b.mw} MW`} onClose={onClose} />
      {s.selling ? (
        <Status icon="warn" level="warn">
          Selling in this losing round for <span className="num">{fmtMoney(s.sell)}</span>
        </Status>
      ) : b.status === 'building' ? (
        <Status icon="crane" level="busy">
          Building · online in round <span className="num">{round + b.roundsLeft}</span> ({plural(b.roundsLeft, 'round')} left)
        </Status>
      ) : b.status === 'upgrading' ? (
        <Status icon="crane" level="busy">
          Upgrading · big ({s.bigMw} MW) in round <span className="num">{round + b.roundsLeft}</span> ({plural(b.roundsLeft, 'round')} left), runs at 2 MW until then
        </Status>
      ) : s.upgrade?.ordered ? (
        <Status icon="arrowUp" level="busy">
          Upgrade ordered this round · big in <span className="num">{s.upgrade.rounds}</span> rounds
        </Status>
      ) : (
        <Status icon="ok" level="ok">
          Online
        </Status>
      )}
      <dl className={`facts mcard-facts${phone && !building ? ' is-3' : ''}`}>
        <div>
          <dt>{plant ? 'Output' : 'Capacity'}</dt>
          {building ? (
            <>
              <dd>
                <Mw value={s.mwOnline} />
              </dd>
              <dd className="mcard-small">once online</dd>
            </>
          ) : (
            <dd>
              <Mw value={s.mwNow} />
            </dd>
          )}
        </div>
        {building ? null : (
          <div>
            <dt>This round</dt>
            <dd>
              <Mw value={s.used} /> <span className="mcard-dim">used</span>
            </dd>
            <dd className="mcard-small">
              <Mw value={s.idle} /> idle
            </dd>
          </div>
        )}
        {building ? null : (
          <div>
            <dt>Last round</dt>
            {s.last ? (
              <>
                <dd>
                  <Mw value={s.last.used} /> <span className="mcard-dim">used</span>
                </dd>
                <dd className="mcard-small">
                  <Mw value={Math.max(0, s.last.delivered - s.last.used)} /> idle
                </dd>
                {s.last.revenue >= 0.005 ? (
                  <dd className="mcard-small">
                    <span className="num mcard-money">+{fmtMoney(s.last.revenue)}</span> earned
                  </dd>
                ) : null}
              </>
            ) : (
              <dd className="mcard-small">Not played yet</dd>
            )}
          </div>
        )}
        {phone && !building ? null : (
          <div>
            <dt>Maintenance</dt>
            <dd>
              <span className="num">{fmtMoney(s.maintenance)}</span> <span className="mcard-dim">/ round</span>
            </dd>
            {!s.maintenanceActive ? <dd className="mcard-small">From when it is online</dd> : null}
          </div>
        )}
      </dl>
      <p className="mcard-foot">
        {phone && !building ? (
          <>
            Maintenance <span className="num">{fmtMoney(s.maintenance)}</span> / round ·{' '}
          </>
        ) : null}
        Sells for <span className="num">{fmtMoney(s.sell)}</span> (30%), only in a losing round
      </p>
      {s.upgrade ? (
        <div className="mcard-action">
          <Button
            variant={s.upgrade.ordered ? 'secondary' : 'primary'}
            icon={s.upgrade.ordered ? 'undo' : 'arrowUp'}
            block
            disabled={!deciding || (!s.upgrade.ordered && !s.upgrade.canAfford)}
            aria-describedby="mcard-upgrade-note"
            onClick={onUpgrade}
          >
            {s.upgrade.ordered ? 'Cancel upgrade' : (
              <span className="num">{`Upgrade to big · ${fmtMoney(s.upgrade.cost)}`}</span>
            )}
          </Button>
          <p id="mcard-upgrade-note" className="mcard-note">
            {!deciding
              ? 'Orders open in the next decision phase.'
              : s.upgrade.ordered
                ? `Big (${s.bigMw} MW) in ${s.upgrade.rounds} rounds; keeps running at 2 MW meanwhile.`
                : s.upgrade.canAfford
                  ? `${s.bigMw} MW after ${s.upgrade.rounds} rounds; keeps running at 2 MW meanwhile.`
                  : `Needs ${fmtMoney(s.upgrade.short)} more in the treasury.`}
          </p>
        </div>
      ) : null}
    </>
  )
}

function PendingBody({ s, deciding, phone, onCancel, onClose }: { s: PendingStats; deciding: boolean; phone: boolean; onCancel: () => void; onClose: () => void }) {
  const plant = s.order.kind === 'plant'
  return (
    <>
      <Head icon={plant ? 'plant' : 'dc'} hue={plant ? 'var(--plant-mid)' : 'var(--dc-mid)'} title={s.name} sub="Ordered this round" onClose={onClose} />
      <Status icon="crane" level="busy">
        Starts at lock in · online in round <span className="num">{s.onlineRound}</span> ({plural(s.rounds, 'round')})
      </Status>
      <dl className={`facts mcard-facts${phone ? ' is-3' : ''}`}>
        <div>
          <dt>{plant ? 'Output' : 'Capacity'}</dt>
          <dd>
            <Mw value={s.mw} />
          </dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>
            <span className="num">{fmtMoney(s.cost)}</span>
          </dd>
        </div>
        <div>
          <dt>Maintenance</dt>
          <dd>
            <span className="num">{fmtMoney(s.maintenance)}</span> <span className="mcard-dim">/ round</span>
          </dd>
          <dd className="mcard-small">From when it is online</dd>
        </div>
        <div>
          <dt>Lot</dt>
          <dd className="num">
            {s.tile[0] + 1}, row {s.tile[1] + 1}
          </dd>
          <dd className="mcard-small">Drag it to move</dd>
        </div>
      </dl>
      <div className="mcard-action">
        <Button variant="danger" icon="close" block disabled={!deciding} onClick={onCancel}>
          <span className="num">{`Cancel order · refund ${fmtMoney(s.cost)}`}</span>
        </Button>
      </div>
    </>
  )
}
