// The first-game tutorial: 5 short steps over rounds 1 to 3, one action each (allocate, build,
// read results, borrow, lock in). A small pointer bubble sits next to the control it is about,
// follows it on resize, scroll and panel animations, flips to stay on screen, and moves on by
// itself when the player does the action (it watches the stores). "Got it" moves on by hand,
// "Skip tutorial" ends it for good.
//
// Contract: default export, no props, always mounted inside the game screen above the map, panels
// and results overlay. Stores: useUi (tutorialStep 0..4 or null, advanceTutorial, skipTutorial,
// panel / open), useGame (round, phase), useDraft (the draft, to see the actions happen).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { selectLosingRound, selectMe } from '../../store/selectors'
import { TUTORIAL_STEPS, useUi } from '../../store/ui'
import type { PanelId } from '../../store/ui'
import { Button, usePhone, useReducedMotion } from '../kit'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface View {
  /** data-tut value of the element to point at. */
  anchor: string
  text: string
  /** The first part of a step opens its panel; the button does it too. */
  openPanel?: PanelId
  /** "Got it" moves to the next step; without it the step only ends by doing the action. */
  gotIt?: boolean
  sides: { desk: Side[]; phone: Side[] }
  /** On the left side, stay clear of this element too (the results card around the anchor). */
  avoid?: string
}

const TAB_SIDES = { desk: ['left'] as Side[], phone: ['top'] as Side[] }
const SHEET_SIDES = { desk: ['left', 'bottom'] as Side[], phone: ['top', 'bottom'] as Side[] }

function viewFor(step: number, panel: PanelId | null, phase: string, round: number): View | null {
  switch (step) {
    case 0:
      if (phase !== 'decide') return null
      return panel !== 'allocate'
        ? { anchor: 'tab-allocate', text: 'Open Allocate: it decides where your power and compute go each round.', openPanel: 'allocate', sides: TAB_SIDES }
        : {
            anchor: 'allocate-compute',
            text: 'Put your datacenter MW on AI: it pays 3.2 per MW, the best rate. Drag a segment or use the arrow keys to change the split.',
            gotIt: true,
            sides: SHEET_SIDES,
          }
    case 1:
      if (phase !== 'decide') return null
      return panel !== 'build'
        ? { anchor: 'tab-build', text: 'Open Build: more plants and datacenters mean more MW to sell.', openPanel: 'build', sides: TAB_SIDES }
        : {
            anchor: 'build-card-plant-small',
            text: 'Order a small plant: 10 from the treasury, 2 more MW from next round. Tap it, or drag it onto a free lot.',
            gotIt: true,
            sides: SHEET_SIDES,
          }
    case 2:
      if (phase === 'results')
        return {
          anchor: 'results-next',
          text: 'This is how the round went: demand, your revenue, why your share price moved, the new ranking. Press Next round when you are done.',
          gotIt: true,
          sides: { desk: ['left', 'top'], phone: ['top'] },
          avoid: '.rs-card',
        }
      if (phase === 'decide') return { anchor: 'lock-in', text: 'Ready? Lock in to play the round. Every company resolves at the same time.', sides: { desk: ['bottom', 'left'], phone: ['bottom'] } }
      return null
    case 3:
      if (phase !== 'decide' || round < 2) return null
      return panel !== 'finance'
        ? { anchor: 'tab-finance', text: 'Open Finance: a loan lets you build faster than profit alone.', openPanel: 'finance', sides: TAB_SIDES }
        : {
            anchor: 'finance-loan',
            text: 'Borrow with this stepper. Interest is due each round and the principal after 8 rounds; the risk view shows the drag on your price.',
            gotIt: true,
            sides: SHEET_SIDES,
          }
    case 4:
      if (phase !== 'decide') return null
      return {
        anchor: 'lock-in',
        text: 'Happy with the plan? Lock in. That is the whole loop: decide, lock in, read the results.',
        gotIt: true,
        sides: { desk: ['bottom', 'left'], phone: ['bottom'] },
      }
    default:
      return null
  }
}

/** Moves the tutorial on when the player does the step's action. */
function useTutorialWatch(): void {
  useEffect(() => {
    const advanceTo = (target: number) => {
      for (let i = 0; i < TUTORIAL_STEPS; i++) {
        const now = useUi.getState().tutorialStep
        if (now == null || now >= target) return
        useUi.getState().advanceTutorial()
      }
    }
    const offDraft = useDraft.subscribe((s, p) => {
      const step = useUi.getState().tutorialStep
      if (step == null || useGame.getState().phase !== 'decide') return
      const d = s.decision
      const q = p.decision
      const userEdit = s.past.length > 0 && s.decision !== p.decision
      if (!userEdit) return
      if (step === 0 && (d.compute.ai !== q.compute.ai || d.compute.cloud !== q.compute.cloud || d.compute.btc !== q.compute.btc)) advanceTo(1)
      else if (step === 1 && d.builds.filter((b) => b.kind === 'plant').length > q.builds.filter((b) => b.kind === 'plant').length) advanceTo(2)
      else if (step === 3 && d.loans.take > 0 && q.loans.take === 0) advanceTo(4)
    })
    const offGame = useGame.subscribe((s, p) => {
      const step = useUi.getState().tutorialStep
      if (step == null || s.phase === p.phase) return
      if (p.phase === 'decide' && (s.phase === 'results' || s.phase === 'waiting')) {
        // locked in
        if (step < 2) advanceTo(2)
        else if (step >= 3) advanceTo(step + 1)
      } else if (p.phase === 'results' && s.phase === 'decide' && step === 2) advanceTo(3)
    })
    return () => {
      offDraft()
      offGame()
    }
  }, [])
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}
const sameRect = (a: Rect | null, b: Rect | null) =>
  !!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5

/** The anchor's viewport rect, kept current on resize, scroll (any scroller), DOM changes and animations. */
function useAnchorRect(anchor: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)
  const last = useRef<Rect | null>(null)
  useEffect(() => {
    if (!anchor) {
      last.current = null
      setRect(null)
      return
    }
    let raf = 0
    let until = 0
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tut="${anchor}"]`)
      let r: Rect | null = null
      if (el) {
        const b = el.getBoundingClientRect()
        if (b.width > 0 && b.height > 0 && b.bottom > 0 && b.right > 0 && b.top < window.innerHeight && b.left < window.innerWidth) r = { top: b.top, left: b.left, width: b.width, height: b.height }
      }
      if (!(r === null && last.current === null) && !sameRect(r, last.current)) {
        last.current = r
        setRect(r)
      }
    }
    // Follow for a moment after anything moves (sheets slide in, panels re-layout).
    const follow = () => {
      until = performance.now() + 700
      if (raf) return
      const loop = () => {
        measure()
        raf = performance.now() < until ? requestAnimationFrame(loop) : 0
      }
      raf = requestAnimationFrame(loop)
    }
    measure()
    follow()
    window.addEventListener('resize', follow)
    window.addEventListener('scroll', follow, true)
    const mo = new MutationObserver(follow)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-selected'] })
    const ro = new ResizeObserver(follow)
    ro.observe(document.documentElement)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', follow)
      window.removeEventListener('scroll', follow, true)
      mo.disconnect()
      ro.disconnect()
    }
  }, [anchor])
  return rect
}

const GAP = 14
const MARGIN = 8

interface Placement {
  x: number
  y: number
  side: Side
  arrow: number
}

function place(r: Rect, bw: number, bh: number, prefs: Side[], vw: number, vh: number, avoidLeft = Infinity): Placement {
  const order = [...prefs, ...(['bottom', 'top', 'left', 'right'] as Side[]).filter((s) => !prefs.includes(s))]
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const clampX = (x: number) => Math.max(MARGIN, Math.min(vw - MARGIN - bw, x))
  const clampY = (y: number) => Math.max(MARGIN, Math.min(vh - MARGIN - bh, y))
  for (const side of order) {
    let x = 0
    let y = 0
    let fits = false
    if (side === 'left') {
      x = Math.min(r.left, avoidLeft) - GAP - bw
      y = clampY(cy - bh / 2)
      fits = x >= MARGIN
    } else if (side === 'right') {
      x = r.left + r.width + GAP
      y = clampY(cy - bh / 2)
      fits = x + bw <= vw - MARGIN
    } else if (side === 'top') {
      y = r.top - GAP - bh
      x = clampX(cx - bw / 2)
      fits = y >= MARGIN
    } else {
      y = r.top + r.height + GAP
      x = clampX(cx - bw / 2)
      fits = y + bh <= vh - MARGIN
    }
    if (fits) {
      const arrow = side === 'left' || side === 'right' ? Math.max(16, Math.min(bh - 16, cy - y)) : Math.max(16, Math.min(bw - 16, cx - x))
      return { x, y, side, arrow }
    }
  }
  // nothing fits: sit at the bottom centre, no arrow pointing anywhere useful
  return { x: clampX(vw / 2 - bw / 2), y: clampY(vh - bh - 96), side: 'bottom', arrow: -1 }
}

export default function Tutorial() {
  const step = useUi((s) => s.tutorialStep)
  const panel = useUi((s) => s.panel)
  const open = useUi((s) => s.open)
  const advance = useUi((s) => s.advanceTutorial)
  const skip = useUi((s) => s.skipTutorial)
  const settingsOpen = useUi((s) => s.settingsOpen)
  const dragging = useUi((s) => s.drag != null)
  const forcedConfirmed = useUi((s) => s.forcedSaleConfirmed)
  const phase = useGame((s) => s.phase)
  const round = useGame((s) => s.state?.round ?? 1)
  const losing = useGame(selectLosingRound)
  const bankrupt = useGame((s) => !!selectMe(s)?.bankrupt)
  const screen = useGame((s) => s.screen)
  const phone = usePhone()
  const reduced = useReducedMotion()
  useTutorialWatch()

  const hidden = step == null || screen !== 'game' || settingsOpen || dragging || bankrupt || (losing && !forcedConfirmed && phase === 'decide')
  const view = hidden || step == null ? null : viewFor(step, panel, phase, round)
  const rect = useAnchorRect(view?.anchor ?? null)

  const bubbleRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 300, h: 140 })
  const [vp, setVp] = useState({ w: typeof window === 'undefined' ? 1280 : window.innerWidth, h: typeof window === 'undefined' ? 800 : window.innerHeight })

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    if (w !== size.w || h !== size.h) setSize({ w, h })
  })

  // Bring an anchor inside a scrolling sheet into view once per anchor (after the sheet slides in).
  const anchorKey = view?.anchor ?? null
  const scrolledFor = useRef<string | null>(null)
  useEffect(() => {
    if (!anchorKey || scrolledFor.current === anchorKey) return
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-tut="${anchorKey}"]`)
      if (!el || !el.closest('.sheet-body')) return
      scrolledFor.current = anchorKey
      el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
    }, 280)
    return () => window.clearTimeout(t)
  }, [anchorKey, reduced])

  if (!view || step == null) return null
  const avoid = view.avoid ? document.querySelector(view.avoid)?.getBoundingClientRect().left : undefined
  const p = rect ? place(rect, size.w, size.h, phone ? view.sides.phone : view.sides.desk, vp.w, vp.h, avoid ?? Infinity) : null
  const style: CSSProperties = p ? { left: Math.round(p.x), top: Math.round(p.y), ['--arrow' as string]: `${Math.round(p.arrow)}px` } : { visibility: 'hidden', left: 0, top: 0 }

  return (
    <>
      {rect ? <div className="tut-ring" aria-hidden="true" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} /> : null}
      <div
        ref={bubbleRef}
        className={`tut-bubble${p ? ` tut-${p.side}` : ''}${p && p.arrow < 0 ? ' no-arrow' : ''}`}
        style={style}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tut-step"
        aria-describedby="tut-text"
      >
        <span className="tut-arrow" aria-hidden="true" />
        <p id="tut-step" className="tut-step caps">
          Tutorial <span className="num">{step + 1}</span> of <span className="num">{TUTORIAL_STEPS}</span>
        </p>
        <p id="tut-text" className="tut-text" aria-live="polite">
          {view.text}
        </p>
        <div className="tut-actions">
          {view.openPanel ? (
            <Button size="sm" variant="primary" onClick={() => open(view.openPanel!)}>
              Open {view.openPanel === 'allocate' ? 'Allocate' : view.openPanel === 'build' ? 'Build' : 'Finance'}
            </Button>
          ) : view.gotIt ? (
            <Button size="sm" variant="primary" onClick={advance}>
              Got it
            </Button>
          ) : null}
          <button type="button" className="link-btn tut-skip" onClick={skip}>
            Skip tutorial
          </button>
        </div>
      </div>
    </>
  )
}
