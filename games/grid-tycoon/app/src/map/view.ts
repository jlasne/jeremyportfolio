// The PixiJS company map (DESIGN.md section 6). One MapView per mounted CompanyMap. It reads the
// stores with zustand subscribe (never through React renders), rebuilds the static scene only when
// what it shows changes (buildings, orders, season, theme, plot size), and animates the living
// parts in the ticker: blades, smoke, solar shimmer, rack LEDs, flow dots, coins and sparkles.
//
// Pixels stay sharp: the canvas is sized in device pixels, the world is scaled by an integer number
// of device pixels per art pixel, the camera snaps to whole device pixels, and sprites sit on whole
// art pixels. Moving things (dots, smoke, coins) move on a sub-art-pixel path that still lands on
// device pixels (roundPixels).

import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture, TextureStyle } from 'pixi.js'
import type { Spritesheet } from 'pixi.js'
import { capacity, companyById, plotRows, revenueByBuilding, seasonOf } from '../engine'
import type { Building, Decision, GameState, Tile } from '../engine'
import { audio } from '../audio'
import { useDraft } from '../store/draft'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { startMoveDrag, placeAt } from './drag'
import {
  BRANCH_ROW,
  EAST_ROAD_COL,
  LANE_ROW0,
  PLOT_COL0,
  SUBSTATION_FOOT,
  T,
  WEST_ROAD_COL,
  WORLD_W,
  PLOT_X0,
  PLOT_X1,
  clampCam,
  craneFoot,
  dotGap,
  ensureVisible,
  flowSpeed,
  footOnLot,
  frameX,
  hash,
  houseCount,
  houseSpots,
  laneCount,
  laneShift,
  lotRect,
  pairUp,
  pickScale,
  polyline,
  roadRow,
  routeFromSubstation,
  routeLots,
  routeToSubstation,
  routeToTown,
  tileAt,
  tileKey,
  worldRows,
} from './layout'
import type { Polyline, Pt, Rect, Safe } from './layout'
import { amountTexture, badgeTexture, dotTexture, sellTagTexture } from './pixelText'
import { freeTiles, registerMap, usePlacement } from './placement'
import type { MapHandle } from './placement'

TextureStyle.defaultOptions.scaleMode = 'nearest'

const ATLAS_URL = `${import.meta.env.BASE_URL}sprites/atlas.json`
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
/** The scene preview's dusk: r × 0.5, g × 0.52, b × 0.72. */
const DUSK = 0x8085b8
const WHITE = 0xffffff
const INK_WIRE = 0x2d2f40
const SMOKE_GREY = 0xe0e0e6
const TARP_PLANT = 0xff9e66
const TARP_DC = 0xb49cf5
const POWER = 0xffd23f
const CREAM = 0xfffdf6
/** Average colour of each season's plain grass tile, for the canvas behind the world. */
const GROUND = [0x98c15b, 0x6f9e3d, 0x8f9343, 0xedf3fa]
/** Grass tiles drawn around the world, so a viewport wider than the world never shows an edge. */
const MARGIN = 8
/** Art px the camera may show above the world's first row (trees and poles on the top verge reach above it). */
const TOP_PAD = 24
/** Lamp glow at dusk: a warm sodium tint, added onto the scene. */
const GLOW_WARM = 0xffa63d
/** The three pylons of the high-voltage line: down from the substation, then off the map to the south-east. */
const PYLONS: Pt[] = [[700, 290], [640, 372], [720, 470]]
const PHONE_QUERY = '(max-width: 640px)'
/** Desktop sheet width + its gap, in CSS px: kept clear when choosing the scale. */
const DESKTOP_SHEET = 404

type LinkState = 'on' | 'pending' | 'off'
type FlowKind = 'internal' | 'town' | 'import' | 'otherDc'

export interface LotInfo {
  tile: Tile
  /** 'pending:c,r' for an order, the building id, or null for a free lot. */
  id: string | null
  kind: 'building' | 'pending' | 'free'
}

interface Model {
  season: 0 | 1 | 2 | 3
  dusk: boolean
  reduced: boolean
  plotRows: number
  rows: number
  houses: number
  buildings: { id: string; kind: Building['kind']; size: Building['size']; status: Building['status']; left: number; tile: Tile; sold: boolean; upg: boolean }[]
  pending: { index: number; kind: 'plant' | 'dc'; size: 'small' | 'big'; tile: Tile; rounds: number }[]
  links: Record<'internal' | 'town' | 'import', LinkState>
  upgradeRounds: number
}

interface Live {
  plantUtil: number
  dcUtil: number
  flows: Record<FlowKind, number>
  townSmoke: boolean
}

interface Smoke {
  s: Sprite
  x: number
  y: number
  t: number
  life: number
  drift: number
  rise: number
}
interface SmokeSource {
  x: number
  y: number
  kind: 'chimney' | 'tower' | 'house'
  acc: number
}
interface Led {
  s: Sprite
  on: boolean
}
interface DcLeds {
  leds: Led[]
  next: number
}
interface Route {
  kind: FlowKind
  pl: Polyline
  dots: Sprite[]
}
interface Fx {
  s: Container
  /** The sprite whose texture plays `frames` (s itself when it is a sprite). */
  anim?: Sprite
  frames: Texture[] | null
  x: number
  y: number
  delay: number
  t: number
  life: number
  rise: number
  fps: number
}

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0)

function mulTint(a: number, b: number): number {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255
  const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255
  const bl = ((a & 255) * (b & 255)) / 255
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)
}

function readDusk(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

function readReduced(): boolean {
  const v = document.documentElement.dataset.reducedMotion
  if (v === 'true') return true
  if (v === 'false') return false
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export class MapView {
  readonly host: HTMLDivElement
  private app: Application
  private sheet: Spritesheet
  private points: Record<string, Record<string, number[] | number[][]>>
  // Static layers are render groups: Pixi keeps their draw instructions and moves them as a whole,
  // so panning and the small animated layers never re-walk thousands of ground sprites.
  private world = new Container({ isRenderGroup: true })
  private ground = new Container({ isRenderGroup: true })
  private lotFx = new Container()
  private marks = new Container()
  private bakedGround: Texture | null = null
  private groundKey = ''
  private flow = new Container({ isRenderGroup: true })
  private objects = new Container({ isRenderGroup: true })
  private wires = new Graphics()
  private top = new Container()
  private fxLayer = new Container({ isRenderGroup: true })
  private lotHighlight = new Graphics()
  private ghost = new Container()

  private model: Model | null = null
  private sceneKey = ''
  private live: Live = { plantUtil: 0, dcUtil: 0, flows: { internal: 0, town: 0, import: 0, otherDc: 0 }, townSmoke: false }
  private routes: Route[] = []
  private routeKey = ''
  private flowPhase: Record<FlowKind, number> = { internal: 0, town: 0, import: 0, otherDc: 0 }
  /** Lane stretches each route covers, keyed by lane ('h<y>' or 'v<x>'): one link per stretch shows its dots. */
  private claims = new Map<string, { kind: FlowKind; lo: number; hi: number }[]>()
  private hud = new Container()

  private blades: { s: Sprite; phase: number; still: boolean }[] = []
  private shimmers: Sprite[] = []
  private smokeSources: SmokeSource[] = []
  private smoke: Smoke[] = []
  private dcs: DcLeds[] = []
  private fx: Fx[] = []
  private lotMarks = new Map<string, Sprite>()
  private buildingRects = new Map<string, Rect>()
  private time = 0
  private shimmerT = 0

  // camera: art px at the viewport's top-left; k device px per art px
  private k = 2
  private dpr = 1
  private viewW = 1
  private viewH = 1
  private cam = { x: 0, y: 0, tx: 0, ty: 0 }
  private safe: Safe = { x0: 0, y0: 0, x1: 1, y1: 1 }
  private worldH = 12 * T
  private camReady = false
  /** Integer magnification of pixel labels (badges, coin amounts) so they stay >= 14 CSS px on phones. */
  private labelScale = 1
  private idleFrames = 0
  private fps = -1
  private camListeners = new Set<() => void>()
  private layoutListeners = new Set<() => void>()

  private hover: Tile | null = null
  private extHighlight: Tile[] | null = null
  private pulse: { key: string; until: number } | null = null
  private knownIds = new Set<string>()
  private playedFor: GameState | null = null
  private pendingResolution: { before: GameState; after: GameState } | null = null

  private press: { id: number; x: number; y: number; camX: number; camY: number; moved: boolean; tile: Tile | null; pendingIndex: number | null; ev: PointerEvent } | null = null
  private unsubs: (() => void)[] = []
  private updateQueued = false
  private destroyed = false
  private dirtyOverlay = true

  private constructor(host: HTMLDivElement, app: Application, sheet: Spritesheet) {
    this.host = host
    this.app = app
    this.sheet = sheet
    this.points = ((sheet.data as unknown as { points?: MapView['points'] }).points ?? {}) as MapView['points']
  }

  /** Creates the map in `host`. Resolves to null if the component unmounted meanwhile (`alive()` false). */
  static async create(host: HTMLDivElement, alive: () => boolean): Promise<MapView | null> {
    const sheet = (await Assets.load(ATLAS_URL)) as Spritesheet
    const app = new Application()
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    await app.init({
      preference: 'webgl',
      antialias: false,
      width: Math.round(w * dpr),
      height: Math.round(h * dpr),
      resolution: 1,
      autoDensity: false,
      roundPixels: true,
      background: GROUND[1],
      powerPreference: 'high-performance',
    })
    if (!alive()) {
      app.destroy({ removeView: true }, { children: true })
      return null
    }
    const view = new MapView(host, app, sheet)
    view.mount()
    return view
  }

  // ---------- setup ----------

  private mount(): void {
    const { app, host } = this
    const cv = app.canvas
    cv.className = 'map-canvas'
    cv.setAttribute('aria-hidden', 'true')
    host.prepend(cv)

    this.objects.sortableChildren = true
    this.fxLayer.sortableChildren = false
    this.lotFx.addChild(this.lotHighlight)
    this.world.addChild(this.ground, this.marks, this.lotFx, this.flow, this.objects, this.wires, this.top, this.ghost, this.fxLayer)
    app.stage.addChild(this.world, this.hud)
    app.ticker.add((t) => this.tick(Math.min(100, t.deltaMS) / 1000))

    // stores
    this.unsubs.push(useGame.subscribe((s, p) => {
      if (s.state !== p.state || s.meId !== p.meId || s.phase !== p.phase) this.queueUpdate()
      if (s.last !== p.last && s.last) this.onLast(s.last)
      if (s.phase !== p.phase && s.phase !== 'results' && this.pendingResolution) {
        const r = this.pendingResolution
        this.pendingResolution = null
        window.setTimeout(() => !this.destroyed && this.playResolution(r.before, r.after), 120)
      }
    }))
    this.unsubs.push(useDraft.subscribe((s, p) => s.decision !== p.decision && this.queueUpdate()))
    this.unsubs.push(useUi.subscribe((s, p) => {
      if (s.selected !== p.selected) {
        this.markDirty()
        if (s.selected) this.revealId(s.selected)
      }
      if (s.panel !== p.panel) this.measureSoon()
    }))
    this.unsubs.push(usePlacement.subscribe(() => this.markDirty()))
    this.playedFor = useGame.getState().last?.after ?? null

    // theme / reduced motion on <html>
    const mo = new MutationObserver((recs) => {
      if (recs.some((r) => r.attributeName === 'class')) this.measureSoon()
      else this.queueUpdate()
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-reduced-motion', 'class'] })
    this.unsubs.push(() => mo.disconnect())
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onMq = () => this.queueUpdate()
    mq?.addEventListener?.('change', onMq)
    this.unsubs.push(() => mq?.removeEventListener?.('change', onMq))

    // size + the sheet that covers part of the map
    const ro = new ResizeObserver(() => this.resize())
    ro.observe(host)
    this.unsubs.push(() => ro.disconnect())
    const main = host.closest('.game-main')
    if (main) {
      const so = new MutationObserver(() => this.measureSoon())
      so.observe(main, { childList: true, subtree: true })
      this.unsubs.push(() => so.disconnect())
    }

    // pause when the tab is hidden
    const onVis = () => (document.hidden ? app.ticker.stop() : this.wake())
    document.addEventListener('visibilitychange', onVis)
    this.unsubs.push(() => document.removeEventListener('visibilitychange', onVis))

    this.bindInput()
    this.update()
    this.resize()
    registerMap(this.handle())
  }

  /** Overlay (highlights, hover, ghost) needs a redraw. */
  private markDirty(): void {
    this.dirtyOverlay = true
    this.wake()
  }

  /** Restarts the ticker after it parked itself because nothing on the map moved. */
  private wake(): void {
    this.idleFrames = 0
    if (!this.destroyed && !document.hidden && !this.app.ticker.started) this.app.ticker.start()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    registerMap(null)
    for (const u of this.unsubs) u()
    this.unsubs = []
    this.app.destroy({ removeView: true }, { children: true })
    this.bakedGround?.destroy(true)
    this.bakedGround = null
  }

  private handle(): MapHandle {
    return {
      lotAt: (x, y) => this.lotAt(x, y),
      highlightLots: (tiles) => {
        this.extHighlight = tiles
        this.markDirty()
      },
      focusBuilding: (id) => this.focusId(id),
      playResolution: (b, a) => this.playResolution(b, a),
      cssScale: () => Math.max(1, Math.round(this.k / this.dpr)),
      lotClientRect: (tile) => {
        const hr = this.host.getBoundingClientRect()
        const r = this.lotScreenRect(tile)
        return { left: hr.left + r.x, top: hr.top + r.y, width: r.w, height: r.h }
      },
      frame: (name) => {
        const t = this.sheet.textures[name]
        if (!t) return null
        const f = t.frame
        const src = this.sheet.textureSource
        return { x: f.x, y: f.y, w: f.width, h: f.height, atlasW: src.width, atlasH: src.height, url: `${import.meta.env.BASE_URL}sprites/atlas.png` }
      },
    }
  }

  onCamera(cb: () => void): () => void {
    this.camListeners.add(cb)
    return () => this.camListeners.delete(cb)
  }
  onLayout(cb: () => void): () => void {
    this.layoutListeners.add(cb)
    return () => this.layoutListeners.delete(cb)
  }

  /** CSS px per art px. */
  get cssScale(): number {
    return this.k / this.dpr
  }
  /** World offset in CSS px (what the DOM layer translates by). */
  get offset(): Pt {
    return [Math.round(-this.cam.x * this.k) / this.dpr, Math.round(-this.cam.y * this.k) / this.dpr]
  }
  get plotRowsNow(): number {
    return this.model?.plotRows ?? 2
  }
  /** Lot rectangle in CSS px relative to the map area. */
  lotScreenRect(tile: Tile): Rect {
    const r = lotRect(tile)
    const s = this.cssScale
    const [ox, oy] = this.offset
    return { x: ox + r.x * s, y: oy + r.y * s, w: r.w * s, h: r.h * s }
  }
  get safeRect(): Safe {
    return this.safe
  }

  // ---------- model ----------

  private queueUpdate(): void {
    if (this.updateQueued || this.destroyed) return
    this.updateQueued = true
    queueMicrotask(() => {
      this.updateQueued = false
      if (!this.destroyed) {
        this.update()
        this.wake()
      }
    })
  }

  private computeModel(): { model: Model; live: Live } | null {
    const { state, meId, config, phase, last: lastRes } = useGame.getState()
    if (!state || !meId) return null
    const me = companyById(state, meId)
    const d: Decision = useDraft.getState().decision
    // behind the results overlay the header still shows the round just played: so does the season
    const seasonRound = phase === 'results' && lastRes ? lastRes.before.round : state.round
    const pending = d.builds.flatMap((b, index) =>
      b.kind !== 'link' && b.tile ? [{ index, kind: b.kind, size: b.size ?? 'small', tile: b.tile, rounds: config.buildings[b.kind][b.size ?? 'small'].rounds }] : [],
    )
    const rows = plotRows(me, pending.map((p) => p.tile), config)
    const last = me.history.at(-1)
    const houses = houseCount(last?.used.citizens ?? 0)
    const cap = capacity(me)
    const linkState = (use: 'internal' | 'town' | 'import'): LinkState =>
      cap.links[use] > 0 ? 'on' : d.builds.some((b) => b.kind === 'link' && b.use === use && (b.mw ?? 0) > 0) || me.links.some((l) => l.use === use && l.mw > 0) ? 'pending' : 'off'
    const model: Model = {
      season: seasonOf(Math.max(1, Math.min(seasonRound, state.rounds))),
      dusk: readDusk(),
      reduced: readReduced(),
      plotRows: rows,
      rows: worldRows(rows, houses),
      houses,
      buildings: me.buildings.map((b) => ({ id: b.id, kind: b.kind, size: b.size, status: b.status, left: b.roundsLeft, tile: b.tile, sold: d.forcedSales.includes(b.id), upg: d.upgrades.includes(b.id) })),
      pending,
      links: { internal: linkState('internal'), town: linkState('town'), import: linkState('import') },
      upgradeRounds: config.buildings.plant.upgrade.rounds,
    }
    const plantAssigned = d.power.internal + d.power.town + d.power.otherDc
    const computeAssigned = d.compute.cloud + d.compute.btc + d.compute.ai
    const live: Live = {
      plantUtil: cap.plantMw > 0 ? clamp01(plantAssigned / cap.plantMw) : 0,
      dcUtil: cap.dcMw > 0 ? clamp01(computeAssigned / cap.dcMw) : 0,
      flows: {
        internal: cap.links.internal > 0 ? Math.min(d.power.internal, cap.links.internal) : 0,
        town: cap.links.town > 0 ? Math.min(d.power.town, cap.links.town) : 0,
        import: cap.links.import > 0 ? Math.min(d.rentMw, cap.links.import) : 0,
        otherDc: Math.max(0, d.power.otherDc),
      },
      townSmoke: cap.links.town > 0 && d.power.town > 0,
    }
    return { model, live }
  }

  private update(): void {
    const next = this.computeModel()
    if (!next) return
    const key = JSON.stringify(next.model)
    const firstModel = !this.model
    this.live = next.live
    if (key !== this.sceneKey) {
      const prevRows = this.model?.plotRows
      this.sceneKey = key
      this.model = next.model
      this.rebuild()
      if (prevRows !== next.model.plotRows) for (const cb of this.layoutListeners) cb()
      this.followNewest(firstModel)
    }
    this.syncRoutes()
    this.markDirty()
  }

  /** Keeps the newest building or order in view (not on the first build, which frames the plot). */
  private followNewest(first: boolean): void {
    const m = this.model
    if (!m) return
    const ids = [...m.buildings.map((b) => b.id), ...m.pending.map((p) => `pending:${tileKey(p.tile)}`)]
    const fresh = first ? [] : ids.filter((id) => !this.knownIds.has(id))
    this.knownIds = new Set(ids)
    const id = fresh[fresh.length - 1]
    if (id && usePlacement.getState().mode !== 'drag') this.revealId(id)
  }

  // ---------- scene ----------

  private tex(name: string): Texture {
    return this.sheet.textures[name] ?? Texture.EMPTY
  }
  private pt(frame: string, key: string): number[] | null {
    const p = this.points[frame]?.[key]
    return Array.isArray(p) && typeof p[0] === 'number' ? (p as number[]) : null
  }

  private clearLayer(c: Container): void {
    for (const ch of c.removeChildren()) ch.destroy({ children: true })
  }

  /** A sprite at a top-left position; tinted for dusk unless emissive. */
  private put(layer: Container, name: string, x: number, y: number, z: number, o: { tint?: number; emissive?: boolean; flip?: boolean; alpha?: number } = {}): Sprite {
    const s = new Sprite(this.tex(name))
    s.position.set(o.flip ? x + s.texture.width : x, y)
    if (o.flip) s.scale.x = -1
    const base = o.tint ?? WHITE
    s.tint = o.emissive || !this.model?.dusk ? base : mulTint(base, DUSK)
    if (o.alpha != null) s.alpha = o.alpha
    s.zIndex = z
    layer.addChild(s)
    return s
  }

  /** A sprite placed by its foot point (points.foot, else bottom centre). Returns it and its top-left. */
  private putFoot(name: string, fx: number, fy: number, o: { tint?: number; alpha?: number; z?: number; layer?: Container } = {}): Sprite {
    const t = this.tex(name)
    const foot = this.pt(name, 'foot') ?? [t.width >> 1, t.height - 1]
    const x = Math.round(fx - foot[0])
    const y = Math.round(fy - foot[1])
    const s = this.put(o.layer ?? this.objects, name, x, y, o.z ?? fy, { tint: o.tint, alpha: o.alpha })
    const m = this.model
    if (m && m.season === 3 && this.sheet.textures[`snow_${name}`] && o.alpha == null) this.put(this.objects, `snow_${name}`, x, y, s.zIndex + 0.01)
    if (m && m.dusk && this.sheet.textures[`lights_${name}`] && o.alpha == null) this.put(this.objects, `lights_${name}`, x, y, s.zIndex + 0.02, { emissive: true })
    return s
  }

  private prop(name: string, fx: number, fy: number): void {
    const m = this.model
    if (!m) return
    if (m.season === 3 && name.startsWith('flowers_')) return
    if (m.season === 3 && name.startsWith('bush_')) name = name.replace('bush_', 'bush_winter_')
    if (name === 'flowers_0' || name === 'flowers_1' || name === 'flowers_2') {
      // flat ground decoration: under everything that stands
      this.put(this.objects, name, Math.round(fx - 16), Math.round(fy - 16), -1000)
      return
    }
    this.putFoot(name, fx, fy)
  }

  private rebuild(): void {
    const m = this.model
    if (!m) return
    for (const l of [this.marks, this.objects, this.top, this.flow]) this.clearLayer(l)
    this.wires.clear()
    this.blades = []
    this.shimmers = []
    this.smokeSources = []
    for (const p of this.smoke) p.s.destroy()
    this.smoke = []
    this.dcs = []
    this.lotMarks.clear()
    this.buildingRects.clear()
    this.routes = []
    this.routeKey = ''

    const season = SEASONS[m.season]
    const rows = m.rows
    this.worldH = rows * T
    const lanes = laneCount(m.houses)
    const lastLaneRow = LANE_ROW0 + 3 * (lanes - 1)
    // The ground only changes with the season, the theme, the plot size and the town's lanes:
    // otherwise the baked texture from the last rebuild is kept as is.
    const groundKey = `${m.season}|${m.dusk}|${rows}|${m.plotRows}|${lanes}`
    const rebake = groundKey !== this.groundKey || !this.ground.children.length
    const ground = new Container()
    const g = (name: string, c: number, r: number, flip = false) => {
      if (rebake) this.put(ground, name, c * T, r * T, 0, { flip })
    }

    // 1. grass everywhere (weighted toward the plain variants 2-3, random flips), with a margin
    for (let r = -MARGIN; r < rows + MARGIN; r++) {
      for (let c = -MARGIN; c < WORLD_W / T + MARGIN; c++) {
        const h = hash(c + 64, r + 64)
        const v = h % 10 < 6 ? 2 + ((h >> 4) & 1) : (h >> 4) & 1
        g(`grass_${season}_${v}`, c, r, ((h >> 9) & 1) === 1)
      }
    }
    // 2. town lanes and the spine (dirt paths have transparent edges: grass is already under them)
    for (let lane = 0; lane < lanes; lane++) {
      const r = LANE_ROW0 + 3 * lane
      for (let c = -MARGIN; c < WEST_ROAD_COL; c++) if (c !== 2) g(`path_h_${(c + r + 64) % 2}`, c, r)
    }
    for (let r = LANE_ROW0; r <= lastLaneRow; r++) g((r - LANE_ROW0) % 3 === 0 ? 'path_x' : `path_v_${r % 2}`, 2, r)
    g('path_end_s', 2, lastLaneRow + 1)

    // 3. roads: two verticals framing the plot, a road row above and below every lot row, the branch east
    for (let r = -MARGIN; r < rows + MARGIN; r++) {
      const isRoadRow = r >= 1 && (r - 1) % 4 === 0 && r <= roadRow(m.plotRows)
      g(isRoadRow ? 'road_t_e' : 'road_v', WEST_ROAD_COL, r)
      g(r === BRANCH_ROW ? 'road_x' : isRoadRow ? 'road_t_w' : 'road_v', EAST_ROAD_COL, r)
      if (isRoadRow) for (let c = PLOT_COL0; c < EAST_ROAD_COL; c++) g('road_h', c, r)
    }
    for (let c = EAST_ROAD_COL + 1; c < WORLD_W / T + MARGIN; c++) g('road_h', c, BRANCH_ROW)

    // 4. lot pads; corner marks on free lots only
    const occupied = new Set([...m.buildings.map((b) => tileKey(b.tile)), ...m.pending.map((p) => tileKey(p.tile))])
    for (let r = 0; r < m.plotRows; r++) {
      for (let c = 0; c < 4; c++) {
        const lr = lotRect([c, r])
        if (rebake) this.put(ground, 'lot', lr.x, lr.y, 0)
        if (!occupied.has(`${c},${r}`)) this.lotMarks.set(`${c},${r}`, this.put(this.marks, 'lot_marks', lr.x, lr.y, 0))
      }
    }
    if (rebake) {
      this.clearLayer(this.ground)
      this.bakeGround(ground, rows)
      this.groundKey = groundKey
    } else ground.destroy()

    // 5. buildings, scaffolds, cranes, ghosts
    for (const b of m.buildings) this.drawBuilding(b)
    for (const p of m.pending) this.drawGhost(p.tile, p.kind, p.size, p.rounds, 0.5)

    // 6. town: hall, houses, lamp, props
    this.putFoot('townhall', 80, 112)
    houseSpots(m.houses).forEach((h, i) => {
      const v = hash(h.x, h.y, 7) % 6
      this.putFoot(`house_${v}`, h.x, h.y)
      const ch = this.pt(`house_${v}`, 'chimney')
      const foot = this.pt(`house_${v}`, 'foot') ?? [16, 28]
      if (ch && i % 2 === 0) this.smokeSources.push({ x: h.x - foot[0] + ch[0], y: h.y - foot[1] + ch[1], kind: 'house', acc: (i * 0.37) % 1 })
    })
    this.townProps(lanes, rows)
    this.putFoot('lamp', 5 * T - 6, 4 * T + 2)
    this.lampExtras(5 * T - 6, 4 * T + 2)

    // 7. grid: substation, pylons and the high-voltage line leaving the map
    const sub = this.putFoot('substation', SUBSTATION_FOOT[0], SUBSTATION_FOOT[1])
    const pylons = PYLONS.map(([x, y]) => this.putFoot('pylon', x, y))
    this.eastProps(rows)

    // 8. the plot's verges: poles (internal link) along the top, trees above and below
    const poleFeet: Pt[] = [208, 320, 432, 544].map((x) => [x, T + 3])
    const showPoles = m.links.internal !== 'off' || m.links.town !== 'off'
    const poles = showPoles ? poleFeet.map(([x, y], i) => (i === 0 || m.links.internal !== 'off' ? this.putFoot('pole', x, y, { alpha: m.links.internal === 'pending' && i > 0 ? 0.55 : undefined }) : null)) : []
    const townPole = m.links.town !== 'off' ? this.putFoot('pole', 150, T + 3, { alpha: m.links.town === 'pending' ? 0.55 : undefined }) : null
    const importPole = m.links.import !== 'off' ? this.putFoot('pole', 624, BRANCH_ROW * T + 3, { alpha: m.links.import === 'pending' ? 0.55 : undefined }) : null
    for (const x of [264, 376, 488]) this.prop(`tree_${season}`, x, 24)
    const bottom = (roadRow(m.plotRows) + 1) * T
    for (const x of [210, 330, 460, 560]) this.prop(`tree_${season}`, x, bottom + 52)
    this.prop('bush_1', 270, bottom + 42)
    this.prop('rock_0', 400, bottom + 46)
    this.prop('flowers_1', 480, bottom + 24)
    for (let y = bottom + 64 + 40; y < rows * T + 24; y += 56)
      for (const x of [228, 300, 380, 452, 530]) {
        const h = hash(x, y, 3)
        if (h % 3 === 0) this.prop(`tree_${season}`, x + (h % 17) - 8, y)
        else if (h % 5 === 1) this.prop(h % 2 ? 'bush_0' : 'rock_0', x, y - 10)
      }

    // 9. street lamps: north sidewalk of every inner road row, two on the last one
    for (let j = 1; j < m.plotRows; j++) for (let c = 0; c < 4; c++) this.lamp((PLOT_COL0 + 3 * c) * T + 4, roadRow(j) * T + 3)
    for (const x of [7 * T + 20, 13 * T + 20]) this.lamp(x, (roadRow(m.plotRows) + 1) * T - 1)

    // 10. wires: continuous 1 px ink lines with a 3 px sag
    const wp = (s: Sprite | null, frame: string, i: number): Pt | null => {
      const w = this.points[frame]?.wires as number[][] | undefined
      return s && w?.[i] ? [s.x + w[i][0], s.y + w[i][1]] : null
    }
    const pw = (this.points.pole?.wires as number[][] | undefined)?.length ?? 2
    if (m.links.internal !== 'off')
      for (let i = 0; i + 1 < poles.length; i++) for (let w = 0; w < pw; w++) this.wire(wp(poles[i], 'pole', w), wp(poles[i + 1], 'pole', w), m.links.internal === 'pending')
    if (townPole) {
      for (let w = 0; w < pw; w++) this.wire(wp(townPole, 'pole', w), wp(poles[0] ?? null, 'pole', w), m.links.town === 'pending')
    }
    if (importPole) {
      this.wire(wp(sub, 'substation', 0), wp(importPole, 'pole', 1), m.links.import === 'pending')
      this.wire(wp(sub, 'substation', 1), wp(importPole, 'pole', 1), m.links.import === 'pending')
    }
    for (let i = 0; i + 1 < pylons.length; i++) for (const w of [0, 1]) this.wire(wp(pylons[i], 'pylon', w), wp(pylons[i + 1], 'pylon', w), false)
    for (const w of [0, 1]) this.wire(wp(pylons[0], 'pylon', w), [sub.x + 51, sub.y + 14], false)
    // the line leaves the map on the bearing of its last span, far enough to clear any viewport
    const [p1, p2] = PYLONS.slice(-2)
    const lastPylon = pylons[pylons.length - 1]
    for (const w of [0, 1]) {
      const a = wp(lastPylon, 'pylon', w)
      if (a) this.wire(a, [a[0] + (p2[0] - p1[0]) * 6, a[1] + (p2[1] - p1[1]) * 6], false)
    }
    this.wires.tint = m.dusk ? DUSK : WHITE
    // the canvas behind the world: the season's grass, dusk-tinted at night
    this.app.renderer.background.color = m.dusk ? mulTint(GROUND[m.season], DUSK) : GROUND[m.season]

    this.objects.sortChildren()
    this.markDirty()
  }

  /**
   * Flattens the ground (a few thousand static tiles) into one texture at art resolution. It is
   * drawn scaled by the same integer as everything else with nearest filtering, so it is pixel for
   * pixel the same picture at a fraction of the GPU cost. Falls back to live tiles if too tall.
   */
  private bakeGround(tiles: Container, rows: number): void {
    const x0 = -MARGIN * T
    const y0 = -MARGIN * T
    const w = WORLD_W + 2 * MARGIN * T
    const h = (rows + 2 * MARGIN) * T
    const max = (this.app.renderer as unknown as { gl?: WebGLRenderingContext }).gl?.getParameter?.(0x0d33 /* MAX_TEXTURE_SIZE */) ?? 4096
    if (h > max || w > max) {
      this.ground.addChild(tiles)
      return
    }
    const tex = this.app.renderer.generateTexture({
      target: tiles,
      frame: new Rectangle(x0, y0, w, h),
      resolution: 1,
      antialias: false,
      textureSourceOptions: { scaleMode: 'nearest' },
    })
    tiles.destroy({ children: true })
    const old = this.bakedGround
    this.bakedGround = tex
    const s = new Sprite(tex)
    s.position.set(x0, y0)
    this.ground.addChild(s)
    old?.destroy(true)
  }

  private lamp(fx: number, fy: number): void {
    this.putFoot('lamp', fx, fy)
    this.lampExtras(fx, fy)
  }

  private lampExtras(fx: number, fy: number): void {
    if (!this.model?.dusk) return
    const foot = this.pt('lamp', 'foot') ?? [8, 27]
    const light = this.pt('lamp', 'light') ?? [8, 4]
    const x = fx - foot[0]
    const y = fy - foot[1]
    // additive, so the light warms what is under it instead of greying it; doubled at the lamp head
    for (const [gy, alpha] of [[y + light[1] - 12, 1], [y + light[1] - 12, 1], [y + foot[1] - 10, 0.8]] as const)
      this.put(this.top, 'glow_0', x + light[0] - 12, gy, 0, { emissive: true, tint: GLOW_WARM, alpha }).blendMode = 'add'
  }

  private townProps(lanes: number, rows: number): void {
    const m = this.model
    if (!m) return
    const season = SEASONS[m.season]
    this.prop(`tree_${season}`, 14, 44)
    this.prop(`tree_${season}`, 124, 40)
    for (let lane = 0; lane < lanes; lane++) {
      const ly = (LANE_ROW0 + 3 * lane) * T
      const h = hash(lane, 11)
      if (lane === 0) {
        this.prop('bush_0', 36, ly + 58)
        this.prop('bush_1', 128, ly + 58)
        this.prop('flowers_1', 96, ly + 40)
        continue
      }
      this.prop(`tree_${season}`, h % 2 ? 88 : 70, ly + 58 + (h % 5))
      if (h % 3 === 0) {
        this.put(this.objects, 'fence_h', 0, ly + 36, ly + 58)
        this.put(this.objects, 'fence_h', 128, ly + 36, ly + 58)
      } else this.prop(h % 2 ? 'bush_0' : 'bush_1', h % 2 ? 128 : 36, ly + 54)
      this.prop(`flowers_${h % 3}`, h % 2 ? 30 : 126, ly + 30)
    }
    // past the last lane: a loose wood with clearings
    const start = (LANE_ROW0 + 3 * lanes) * T + 20
    for (let y = start; y < rows * T + 30; y += 40)
      for (const x of [20, 62, 104, 142]) {
        const h = hash(x, y, 5)
        const jx = (h % 17) - 8
        const jy = ((h >> 5) % 15) - 7
        if (h % 5 < 3) this.prop(`tree_${season}`, x + jx, y + jy)
        else if (h % 5 === 3) this.prop(h % 2 ? 'bush_1' : 'bush_0', x + jx, y + jy - 8)
        else if ((h >> 3) % 3 === 0) this.prop(`flowers_${(h >> 7) % 3}`, x + jx, y + jy - 12)
      }
  }

  private eastProps(rows: number): void {
    const m = this.model
    if (!m) return
    const season = SEASONS[m.season]
    this.prop(`tree_${season}`, 740, 44)
    this.prop(`tree_${season}`, 628, 254)
    this.prop('bush_0', 752, 220)
    this.prop('rock_0', 730, 330)
    this.prop('flowers_1', 670, 226)
    // past the line: a loose wood, like the town's, so a tall plot has company on both sides
    for (let y = 440; y < rows * T + 24; y += 44)
      for (const x of [628, 670, 712, 752]) {
        const h = hash(x, y, 9)
        const jx = (h % 13) - 6
        const jy = ((h >> 5) % 11) - 5
        if (PYLONS.some(([px, py]) => Math.abs(px - (x + jx)) < 30 && y + jy > py - 66 && y + jy < py + 26)) continue
        if (h % 9 < 4) this.prop(`tree_${season}`, x + jx, y + jy)
        else if (h % 9 === 4) this.prop(h % 2 ? 'bush_0' : 'bush_1', x + jx, y + jy - 8)
        else if (h % 9 === 5) this.prop('rock_0', x + jx, y + jy)
        else if (h % 9 === 6) this.prop('flowers_2', x + jx, y + jy - 8)
      }
  }

  /** Continuous 1 px wire between two points with a 3 px sag, drawn pixel by pixel (dashed when pending). */
  private wire(a: Pt | null, b: Pt | null, dashed: boolean): void {
    if (!a || !b) return
    const g = this.wires
    const n = 12
    let px = Math.round(a[0])
    let py = Math.round(a[1])
    let count = 0
    const plot = (x: number, y: number) => {
      count++
      if (dashed && count % 4 >= 2) return
      g.rect(x, y, 1, 1)
    }
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const qx = Math.round(a[0] + (b[0] - a[0]) * t)
      const qy = Math.round(a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * 3)
      // Bresenham from (px,py) to (qx,qy), skipping the first point (already drawn)
      let x = px
      let y = py
      const dx = Math.abs(qx - x)
      const dy = -Math.abs(qy - y)
      const sx = x < qx ? 1 : -1
      const sy = y < qy ? 1 : -1
      let err = dx + dy
      if (i === 1) plot(x, y)
      while (x !== qx || y !== qy) {
        const e2 = 2 * err
        if (e2 >= dy) {
          err += dy
          x += sx
        }
        if (e2 <= dx) {
          err += dx
          y += sy
        }
        plot(x, y)
      }
      px = qx
      py = qy
    }
    g.fill({ color: INK_WIRE, alpha: dashed ? 0.7 : 1 })
  }

  private drawBuilding(b: Model['buildings'][number]): void {
    const name = `${b.kind === 'plant' ? 'plant' : 'dc'}_${b.size}`
    const lr = lotRect(b.tile)
    this.buildingRects.set(b.id, lr)
    const alpha = b.sold ? 0.35 : undefined
    if (b.status === 'building') {
      const [fx, fy] = footOnLot(b.tile, b.size)
      const sc = this.putFoot(`scaffold_${b.size}`, fx, fy, { alpha })
      this.put(this.objects, `tarp_${b.size}`, sc.x, sc.y, sc.zIndex + 0.01, { tint: b.kind === 'plant' ? TARP_PLANT : TARP_DC, alpha })
      this.crane(b.tile, b.size, b.left, alpha ?? 1, b.kind)
      if (b.sold) this.sellTag(lr)
      return
    }
    const [fx, fy] = footOnLot(b.tile, b.size)
    const s = this.putFoot(name, fx, fy, { alpha })
    if (b.kind === 'plant' && b.size === 'small') {
      const hub = this.pt('plant_small', 'hub') ?? [51, 12]
      const center = this.pt('blades_0', 'center') ?? [12, 12]
      // a plant marked for sale is a still ghost: no glint, no turning blades
      if (!b.sold) this.shimmers.push(this.put(this.objects, 'shimmer_0', s.x, s.y, s.zIndex + 0.03, { alpha: 0 }))
      const phase = hash(b.tile[0], b.tile[1]) % 4
      const bl = this.put(this.objects, 'blades_0', s.x + hub[0] - center[0], s.y + hub[1] - center[1], s.zIndex + 0.04, { alpha })
      this.blades.push({ s: bl, phase, still: b.sold })
    }
    if (b.kind === 'plant' && b.size === 'big' && !b.sold) {
      const ch = this.pt('plant_big', 'chimney') ?? [17, 5]
      const tw = this.pt('plant_big', 'tower') ?? [75, 27]
      this.smokeSources.push({ x: s.x + ch[0], y: s.y + ch[1], kind: 'chimney', acc: 0.3 })
      this.smokeSources.push({ x: s.x + tw[0], y: s.y + tw[1], kind: 'tower', acc: 0.7 })
    }
    if (b.kind === 'dc' && !b.sold) {
      const leds = (this.points[name]?.leds as number[][] | undefined) ?? []
      const set: DcLeds = { leds: [], next: 0 }
      leds.forEach(([x, y], i) => set.leds.push({ s: this.put(this.objects, 'rack_led_dim', s.x + x, s.y + y, s.zIndex + 0.03 + i * 1e-4, { emissive: true }), on: false }))
      this.dcs.push(set)
    }
    if (b.status === 'upgrading') this.crane(b.tile, 'small', b.left, 1, b.kind)
    else if (b.upg && !b.sold) this.crane(b.tile, 'small', this.model?.upgradeRounds ?? 4, 0.55, b.kind)
    if (b.sold) this.sellTag(lr)
  }

  /** The "SELL" tag in the top-left corner of a lot marked for a forced sale (drawn at full opacity). */
  private sellTag(lr: Rect): void {
    const tag = new Sprite(sellTagTexture())
    tag.scale.set(this.labelScale)
    tag.position.set(lr.x + 5, lr.y + 5)
    this.top.addChild(tag)
  }

  /** The countdown badge over a crane at (c.x, c.y): centred on its spot, magnified on phones. */
  private badge(layer: Container, c: { x: number; y: number }, rounds: number, kind: 'plant' | 'dc'): Sprite {
    const t = badgeTexture(rounds, kind)
    const badge = new Sprite(t)
    badge.anchor.set(0.5)
    badge.scale.set(this.labelScale)
    // centre where the 1x badge sat (left at the jib's tip), nudged so a magnified badge stays on its lot
    badge.position.set(Math.round(c.x + 34 + t.width / 2 - (this.labelScale - 1) * 8), Math.round(c.y - 4 + t.height / 2 - (this.labelScale - 1) * 4))
    layer.addChild(badge)
    return badge
  }

  /** A crane with its floating countdown badge (alpha < 1 for a ghost crane). */
  private crane(tile: Tile, size: 'small' | 'big', rounds: number, alpha: number, kind: 'plant' | 'dc'): void {
    const [cx, cy] = craneFoot(tile, size)
    const c = this.putFoot('crane', cx, cy, { alpha: alpha < 1 ? alpha : undefined })
    const badge = this.badge(this.top, c, rounds, kind)
    if (alpha < 1) badge.alpha = 0.92
  }

  private drawGhost(tile: Tile, kind: 'plant' | 'dc', size: 'small' | 'big', rounds: number, alpha: number, layer?: Container): void {
    const [fx, fy] = footOnLot(tile, size)
    const name = `${kind === 'plant' ? 'plant' : 'dc'}_${size}`
    if (layer) {
      const t = this.tex(name)
      const foot = this.pt(name, 'foot') ?? [t.width >> 1, t.height - 1]
      this.put(layer, name, fx - foot[0], fy - foot[1], 0, { alpha })
      const [cx, cy] = craneFoot(tile, size)
      const cf = this.pt('crane', 'foot') ?? [20, 93]
      const c = this.put(layer, 'crane', cx - cf[0], cy - cf[1], 0, { alpha: Math.min(1, alpha + 0.1) })
      this.badge(layer, c, rounds, kind)
      return
    }
    this.putFoot(name, fx, fy, { alpha })
    this.crane(tile, size, rounds, 0.55, kind)
  }

  // ---------- flows ----------

  private syncRoutes(): void {
    const m = this.model
    if (!m) return
    const f = this.live.flows
    const active = (Object.keys(f) as FlowKind[]).filter((k) => f[k] > 0)
    const key = m.reduced ? 'reduced' : `${this.sceneKey.length}:${this.sceneKey}|${active.join(',')}`
    if (key === this.routeKey) return
    this.routeKey = key
    this.clearLayer(this.flow)
    this.routes = []
    this.claims.clear()
    if (m.reduced) return
    const plants = m.buildings.filter((b) => b.kind === 'plant' && b.status !== 'building' && !b.sold).map((b) => b.tile)
    const dcs = m.buildings.filter((b) => b.kind === 'dc' && b.status !== 'building' && !b.sold).map((b) => b.tile)
    // every route keeps to the right-hand lane of its direction, so opposite flows never share one
    const add = (kind: FlowKind, centre: Pt[]) => {
      const pts = laneShift(centre, 5)
      const pl = polyline(pts)
      if (pl.length < 4) return
      this.routes.push({ kind, pl, dots: [] })
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]]
        const horiz = a[1] === b[1]
        const key = horiz ? `h${a[1]}` : `v${a[0]}`
        const lo = Math.min(horiz ? a[0] : a[1], horiz ? b[0] : b[1])
        const hi = Math.max(horiz ? a[0] : a[1], horiz ? b[0] : b[1])
        const list = this.claims.get(key) ?? []
        list.push({ kind, lo, hi })
        this.claims.set(key, list)
      }
    }
    if (f.internal > 0) for (const [p, d] of pairUp(plants, dcs)) add('internal', routeLots(p, d, 0))
    if (f.town > 0) for (const p of plants) add('town', routeToTown(p, 0))
    if (f.import > 0) for (const d of dcs) add('import', routeFromSubstation(d, 0))
    if (f.otherDc > 0) for (const p of plants) add('otherDc', routeToSubstation(p, 0))
  }

  /** True when a bigger link already shows its dots on this stretch of lane (one link per stretch). */
  private yields(kind: FlowKind, key: string, u: number): boolean {
    const list = this.claims.get(key)
    if (!list || list.length < 2) return false
    const f = this.live.flows
    const mine = f[kind]
    for (const c of list) {
      if (c.kind === kind || u < c.lo - 0.5 || u > c.hi + 0.5) continue
      const theirs = f[c.kind]
      if (theirs > mine || (theirs === mine && c.kind < kind)) return true
    }
    return false
  }

  /**
   * Dots sit on a world-space grid along the direction of travel: a dot is drawn where
   * (direction × coordinate − phase) is a multiple of the spacing. Routes of one link that share a
   * stretch of road therefore share the same dots, so many plants never turn a road into noise.
   */
  private placeDots(): void {
    const seen = new Map<string, Sprite>()
    for (const r of this.routes) {
      const ph = this.flowPhase[r.kind]
      const gap = dotGap(this.live.flows[r.kind])
      const { pts, cum, length: L } = r.pl
      let used = 0
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const horiz = a[1] === b[1]
        const ua = horiz ? a[0] : a[1]
        const ub = horiz ? b[0] : b[1]
        const sg = ub >= ua ? 1 : -1
        const w0 = sg * ua
        const w1 = sg * ub
        const lane = horiz ? `h${a[1]}` : `v${a[0]}`
        for (let w = Math.ceil((w0 - ph) / gap) * gap + ph; w <= w1 + 1e-6; w += gap) {
          const u = sg * w
          const x = horiz ? u : a[0]
          const y = horiz ? a[1] : u
          if (this.yields(r.kind, lane, u)) continue
          const d = cum[i - 1] + Math.abs(u - ua)
          const alpha = Math.min(1, d / 6, (L - d) / 6)
          if (alpha <= 0.05) continue
          const key = `${r.kind}:${Math.round(x * 4)},${Math.round(y * 4)}`
          const twin = seen.get(key)
          if (twin) {
            twin.alpha = Math.max(twin.alpha, alpha)
            continue
          }
          let s = r.dots[used]
          if (!s) {
            s = new Sprite(dotTexture())
            s.anchor.set(0.5)
            this.flow.addChild(s)
            r.dots.push(s)
          }
          used++
          s.visible = true
          s.position.set(x, y)
          s.alpha = alpha
          seen.set(key, s)
        }
      }
      for (let j = used; j < r.dots.length; j++) r.dots[j].visible = false
    }
  }

  // ---------- overlay: highlights, hover, selection, placement ghost ----------

  private drawOverlay(): void {
    this.dirtyOverlay = false
    const m = this.model
    const g = this.lotHighlight
    g.clear()
    this.clearLayer(this.ghost)
    if (!m) return
    const pl = usePlacement.getState()
    const placing = pl.mode != null && (pl.mode === 'tap' || pl.active)
    const { state, meId, config } = useGame.getState()
    const free = placing && state && meId ? new Set(freeTiles(state, meId, useDraft.getState().decision, config, pl.moveIndex).map(tileKey)) : null
    const ext = new Set((this.extHighlight ?? []).map(tileKey))

    for (const [key, s] of this.lotMarks) {
      const lit = (free && free.has(key)) || ext.has(key)
      s.tint = lit ? POWER : m.dusk ? DUSK : WHITE
    }
    const fill = (r: Rect, color: number, alpha: number) => g.rect(r.x + 3, r.y + 3, r.w - 6, r.h - 6).fill({ color, alpha })
    if (free) for (const key of free) {
      const [c, r] = key.split(',').map(Number)
      fill(lotRect([c, r]), POWER, 0.1)
    }
    for (const key of ext) {
      const [c, r] = key.split(',').map(Number)
      fill(lotRect([c, r]), POWER, 0.2)
    }
    if (placing && pl.hover && pl.order && pl.order.kind !== 'link') {
      const r = lotRect(pl.hover)
      fill(r, POWER, 0.22)
      this.frame(r, POWER, 2, 1)
      const rounds = config.buildings[pl.order.kind][pl.order.size ?? 'small'].rounds
      this.drawGhost(pl.hover, pl.order.kind, pl.order.size ?? 'small', rounds, 0.62, this.ghost)
    }
    const sel = useUi.getState().selected
    const selRect = sel ? this.rectOfId(sel) : null
    if (selRect) this.frame(selRect, POWER, 2, 1)
    if (this.hover && !placing) {
      const key = tileKey(this.hover)
      const r = lotRect(this.hover)
      if (!selRect || selRect.x !== r.x || selRect.y !== r.y)
        if (this.lotInfo(this.hover).kind !== 'free' || ext.has(key)) {
          // 2 px cream with a dark halo on both sides: reads on concrete, grass and snow alike
          this.frame({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, INK_WIRE, 4, 0.55)
          this.frame(r, CREAM, 2, 1)
        }
    }
    if (this.pulse && this.pulse.until > this.time) {
      const r = this.rectOfId(this.pulse.key)
      if (r) this.frame(r, POWER, 2, 0.5 + 0.5 * Math.abs(Math.sin(this.time * 6)))
    }
  }

  /** A rounded lot outline, `w` art px thick. */
  private frame(r: Rect, color: number, w: number, alpha: number): void {
    const g = this.lotHighlight
    const x = r.x + 1
    const y = r.y + 1
    const W = r.w - 2
    const H = r.h - 2
    g.rect(x + 2, y, W - 4, w).rect(x + 2, y + H - w, W - 4, w).rect(x, y + 2, w, H - 4).rect(x + W - w, y + 2, w, H - 4)
    g.rect(x + 1, y + 1, w, w).rect(x + W - 1 - w, y + 1, w, w).rect(x + 1, y + H - 1 - w, w, w).rect(x + W - 1 - w, y + H - 1 - w, w, w)
    g.fill({ color, alpha })
  }

  private rectOfId(id: string): Rect | null {
    if (id.startsWith('pending:')) {
      const [c, r] = id.slice(8).split(',').map(Number)
      return Number.isFinite(c) && Number.isFinite(r) ? lotRect([c, r]) : null
    }
    return this.buildingRects.get(id) ?? null
  }

  /** What sits on a lot (building, pending order or nothing). */
  lotInfo(tile: Tile): LotInfo {
    const m = this.model
    const key = tileKey(tile)
    const b = m?.buildings.find((x) => tileKey(x.tile) === key)
    if (b) return { tile, id: b.id, kind: 'building' }
    if (m?.pending.some((p) => tileKey(p.tile) === key)) return { tile, id: `pending:${key}`, kind: 'pending' }
    return { tile, id: null, kind: 'free' }
  }

  // ---------- camera ----------

  private occluder: { top?: number; bottom?: number } | null = null
  /**
   * A DOM card docked over the map on phones: `top` = the map is hidden above this y (card at the
   * top), `bottom` = hidden below this y (card at the bottom). The selection is kept in view.
   */
  setOccluder(o: { top?: number; bottom?: number } | null): void {
    const same = JSON.stringify(o) === JSON.stringify(this.occluder)
    if (same) return
    this.occluder = o
    this.measureSafe()
    const sel = useUi.getState().selected
    if (o && sel) this.revealId(sel)
  }

  /** The safe rect without the docked card (where the card itself may go). */
  get mapSafe(): Safe {
    const s = { ...this.safe }
    if (this.occluder?.top != null) s.y0 = 0
    if (this.occluder?.bottom != null) s.y1 = this.sheetBottom
    return s
  }
  private sheetBottom = 0

  private measureTimer = 0
  private measureSoon(): void {
    this.measureSafe()
    window.clearTimeout(this.measureTimer)
    this.measureTimer = window.setTimeout(() => !this.destroyed && this.measureSafe(), 260)
  }

  private measureSafe(): void {
    const hr = this.host.getBoundingClientRect()
    const safe: Safe = { x0: 0, y0: 0, x1: this.viewW, y1: this.viewH }
    const sheet = this.host.closest('.game-main')?.querySelector('.sheet')
    const phone = window.matchMedia?.(PHONE_QUERY).matches
    const stepAside = phone && /\bgt-(dragging|placing)\b/.test(document.documentElement.className)
    this.sheetBottom = this.viewH
    if (sheet && !stepAside) {
      const sr = sheet.getBoundingClientRect()
      if (phone) safe.y1 = this.sheetBottom = Math.max(80, Math.min(this.viewH, sr.top - hr.top))
      else safe.x1 = Math.max(160, Math.min(this.viewW, sr.left - hr.left - 8))
    }
    const occ = this.occluder
    if (occ?.top != null) safe.y0 = Math.max(safe.y0, Math.min(safe.y1 - 80, occ.top))
    if (occ?.bottom != null) safe.y1 = Math.min(safe.y1, Math.max(safe.y0 + 80, occ.bottom))
    const changed = safe.x0 !== this.safe.x0 || safe.y0 !== this.safe.y0 || safe.x1 !== this.safe.x1 || safe.y1 !== this.safe.y1
    const widthChanged = safe.x1 - safe.x0 !== this.safe.x1 - this.safe.x0
    this.safe = safe
    if (changed) {
      // the side sheet opened or closed: move only as far as needed to keep the selection (or else
      // the lots) in what is still visible, so the world does not slide under the pointer
      let tx = this.cam.tx
      if (widthChanged && this.camReady) {
        const sel = useUi.getState().selected
        const r = (sel ? this.rectOfId(sel) : null) ?? { x: PLOT_X0, y: 0, w: PLOT_X1 - PLOT_X0, h: 1 }
        tx = ensureVisible(this.cam.tx, this.cam.ty, this.cssScale, safe, { x: r.x, y: this.cam.ty + safe.y0 / this.cssScale + 1, w: r.w, h: 1 }, 12)[0]
      }
      this.setTarget(tx, this.cam.ty)
      for (const cb of this.camListeners) cb()
    }
  }

  private resize(): void {
    if (this.destroyed) return
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    const dpr = window.devicePixelRatio || 1
    const s0 = this.cssScale
    // keep the art point at the centre of the safe rect where it is
    const cx = this.cam.x + (this.safe.x0 + this.safe.x1) / 2 / s0
    const cy = this.cam.y + (this.safe.y0 + this.safe.y1) / 2 / s0
    this.viewW = w
    this.viewH = h
    this.dpr = dpr
    const phone = window.matchMedia?.(PHONE_QUERY).matches ?? false
    const k = pickScale({ viewW: w, viewH: h, dpr, sheetW: phone ? 0 : DESKTOP_SHEET, phone })
    const scaleChanged = k !== this.k
    this.k = k
    const dw = Math.round(w * dpr)
    const dh = Math.round(h * dpr)
    this.app.renderer.resize(dw, dh)
    const cv = this.app.canvas
    cv.style.width = `${dw / dpr}px`
    cv.style.height = `${dh / dpr}px`
    this.safe = { x0: 0, y0: 0, x1: w, y1: h }
    this.measureSafe()
    const s = this.cssScale
    const ls = s < 2 ? Math.ceil(2 / s - 1e-6) : 1
    if (ls !== this.labelScale) {
      this.labelScale = ls
      if (this.model) this.rebuild()
    }
    if (!this.camReady) {
      this.camReady = true
      // default framing: the town and the plot (the grid side gives way first), a little sky on top
      const span = (this.safe.x1 - this.safe.x0) / s
      const [x, y] = this.clampTo(frameX(span) - this.safe.x0 / s, -TOP_PAD - this.safe.y0 / s, s, this.safe, WORLD_W, this.worldH)
      this.cam = { x, y, tx: x, ty: y }
    } else {
      const [x, y] = this.clampTo(cx - (this.safe.x0 + this.safe.x1) / 2 / s, cy - (this.safe.y0 + this.safe.y1) / 2 / s, s, this.safe, WORLD_W, this.worldH)
      this.cam = { x, y, tx: x, ty: y }
    }
    this.applyCam()
    if (scaleChanged) for (const cb of this.layoutListeners) cb()
  }

  /** The camera clamp: a little sky above the top verge, short worlds centred. */
  private clampTo(cx: number, cy: number, sc: number, safe: Safe, worldW: number, worldH: number): Pt {
    return clampCam(cx, cy, sc, safe, worldW, worldH, { top: TOP_PAD, centreY: true })
  }

  private setTarget(tx: number, ty: number, immediate = false): void {
    const [x, y] = this.clampTo(tx, ty, this.cssScale, this.safe, WORLD_W, this.worldH)
    this.cam.tx = x
    this.cam.ty = y
    if (immediate || this.model?.reduced) {
      this.cam.x = x
      this.cam.y = y
      this.applyCam()
    }
  }

  private applyCam(): void {
    this.wake()
    this.world.scale.set(this.k)
    this.world.position.set(Math.round(-this.cam.x * this.k), Math.round(-this.cam.y * this.k))
    for (const cb of this.camListeners) cb()
  }

  /** Pans (eased) so a rect is in view. */
  reveal(r: Rect, margin = 16): void {
    const [x, y] = ensureVisible(this.cam.tx, this.cam.ty, this.cssScale, this.safe, { x: r.x, y: r.y - 24, w: r.w, h: r.h + 24 }, margin)
    this.setTarget(x, y)
  }

  revealTile(tile: Tile): void {
    this.reveal(lotRect(tile))
  }

  private revealId(id: string): void {
    const r = this.rectOfId(id)
    if (r) this.reveal(r)
  }

  private focusId(id: string): void {
    this.revealId(id)
    this.pulse = { key: id, until: this.time + 1.4 }
    this.markDirty()
  }

  /** Client point to art point. */
  private toArt(clientX: number, clientY: number): Pt {
    const hr = this.host.getBoundingClientRect()
    const s = this.cssScale
    const [ox, oy] = this.offset
    return [(clientX - hr.left - ox) / s, (clientY - hr.top - oy) / s]
  }

  lotAt(clientX: number, clientY: number): Tile | null {
    const hr = this.host.getBoundingClientRect()
    if (clientX < hr.left || clientX >= hr.right || clientY < hr.top || clientY >= hr.bottom) return null
    const [ax, ay] = this.toArt(clientX, clientY)
    return tileAt(ax, ay, this.plotRowsNow)
  }

  // ---------- input ----------

  private bindInput(): void {
    const el = this.host
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      if (e.target !== this.app.canvas) return
      const pm = usePlacement.getState().mode
      if (pm === 'drag' || pm === 'move') return
      const tile = this.lotAt(e.clientX, e.clientY)
      const info = tile ? this.lotInfo(tile) : null
      const pendingIndex =
        info?.kind === 'pending' && useGame.getState().phase === 'decide' && usePlacement.getState().mode == null
          ? (this.model?.pending.find((p) => tileKey(p.tile) === tileKey(info.tile))?.index ?? null)
          : null
      this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, camX: this.cam.tx, camY: this.cam.ty, moved: false, tile, pendingIndex, ev: e }
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onMove = (e: PointerEvent) => {
      const p = this.press
      if (p && p.id === e.pointerId) {
        const dx = e.clientX - p.x
        const dy = e.clientY - p.y
        if (!p.moved && Math.hypot(dx, dy) > 6) {
          p.moved = true
          if (p.pendingIndex != null) {
            // dragging a pending order moves it to another lot
            this.press = null
            try {
              el.releasePointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
            startMoveDrag(p.pendingIndex, p.ev)
            return
          }
          el.classList.add('is-panning')
        }
        if (p.moved) {
          const s = this.cssScale
          this.setTarget(p.camX - dx / s, p.camY - dy / s, true)
        }
        return
      }
      if (e.pointerType === 'mouse') this.setHover(this.lotAt(e.clientX, e.clientY))
    }
    const onUp = (e: PointerEvent) => {
      const p = this.press
      if (!p || p.id !== e.pointerId) return
      this.press = null
      el.classList.remove('is-panning')
      if (p.moved) return
      this.tap(p.tile)
    }
    const onCancel = (e: PointerEvent) => {
      if (this.press?.id === e.pointerId) this.press = null
      el.classList.remove('is-panning')
    }
    const onLeave = () => this.setHover(null)
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.viewH : 1
      let dx = e.deltaX * unit
      let dy = e.deltaY * unit
      if (e.shiftKey && dx === 0) {
        dx = dy
        dy = 0
      }
      const s = this.cssScale
      this.setTarget(this.cam.tx + dx / s, this.cam.ty + dy / s, true)
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    this.unsubs.push(() => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('wheel', onWheel)
    })
  }

  private setHover(t: Tile | null): void {
    const same = (a: Tile | null, b: Tile | null) => (a && b ? a[0] === b[0] && a[1] === b[1] : a === b)
    if (same(t, this.hover)) return
    this.hover = t
    this.markDirty()
    const info = t ? this.lotInfo(t) : null
    const placing = usePlacement.getState().mode === 'tap'
    this.host.classList.toggle('is-over-building', !!info && (info.kind !== 'free' || placing))
    if (placing && t && info?.kind === 'free') usePlacement.setState({ hover: t })
  }

  /** A tap or click on the canvas (no drag): select, place, or deselect. */
  tap(tile: Tile | null): void {
    const ui = useUi.getState()
    const pl = usePlacement.getState()
    if (pl.mode === 'tap') {
      if (tile && this.lotInfo(tile).kind === 'free') placeAt(tile)
      return
    }
    if (!tile) {
      if (ui.selected) ui.select(null)
      return
    }
    const info = this.lotInfo(tile)
    if (info.kind === 'free' || !info.id) {
      if (ui.selected) ui.select(null)
      return
    }
    ui.select(ui.selected === info.id ? null : info.id)
    audio.cue('click')
  }

  // ---------- resolution effects ----------

  private onLast(last: { before: GameState; after: GameState }): void {
    if (last.after === this.playedFor) return
    if (useGame.getState().phase === 'results') this.pendingResolution = last
    else this.playResolution(last.before, last.after)
  }

  playResolution(_before: GameState, after: GameState): void {
    if (this.destroyed || after === this.playedFor) return
    this.playedFor = after
    const meId = useGame.getState().meId
    if (!meId || !after.companies.some((c) => c.id === meId)) return
    const me = companyById(after, meId)
    const amounts = revenueByBuilding(after, meId)
    // what is on screen pops first (in reading order), then the rest
    const sc = this.cssScale
    const v = { x0: this.cam.tx + this.safe.x0 / sc, y0: this.cam.ty + this.safe.y0 / sc, x1: this.cam.tx + this.safe.x1 / sc, y1: this.cam.ty + this.safe.y1 / sc }
    const onScreen = (t: Tile): boolean => {
      const r = lotRect(t)
      return r.x + r.w > v.x0 && r.x < v.x1 && r.y + r.h > v.y0 && r.y < v.y1
    }
    const list = me.buildings
      .filter((b) => (amounts[b.id] ?? 0) >= 0.01)
      .sort((a, b) => Number(onScreen(b.tile)) - Number(onScreen(a.tile)) || a.tile[1] - b.tile[1] || a.tile[0] - b.tile[0])
    const reduced = this.model?.reduced ?? readReduced()
    const coinFrames = (this.sheet.animations.coin ?? []) as Texture[]
    const total = list.reduce((sum, b) => sum + amounts[b.id], 0)
    if (total >= 0.01) this.spawnTotal(total, coinFrames, reduced)
    list.forEach((b, i) => {
      const r = lotRect(b.tile)
      // top of the building sprite: big ones fill the lot, small ones stand 24 px lower
      const top = b.status === 'building' ? r.y + 20 : b.size === 'big' ? r.y + 2 : r.y + 24
      const amount = amounts[b.id]
      const delay = i * 0.09
      const n = 1 + Math.min(2, Math.floor(amount / 6))
      for (let j = 0; j < n; j++) {
        const x = r.x + 48 + (j - (n - 1) / 2) * 12 - 8
        const y = top - 10 - (j % 2) * 3
        this.spawn(coinFrames, coinFrames[0], x, y, delay + j * 0.06, 2, reduced ? 0 : 18, 10)
      }
      const lt = amountTexture(amount)
      const ls = this.labelScale
      this.spawn(null, lt, r.x + 48 - Math.floor((lt.width * ls) / 2), top - 14 - 8 * ls, delay + 0.12, 2.2, reduced ? 0 : 16, 0, ls)
    })
    if (list.length) audio.cue('coins')
    const done = new Set(me.history.at(-1)?.completed ?? [])
    const finished = me.buildings.filter((b) => done.has(b.id))
    const sparkFrames = (this.sheet.animations.spark ?? []) as Texture[]
    finished.forEach((b, i) => {
      const r = lotRect(b.tile)
      for (let j = 0; j < 7; j++) {
        const h = hash(j, i, 13)
        const x = r.x + 12 + (h % 72)
        const y = r.y + 6 + ((h >> 8) % 60)
        this.spawn(sparkFrames, sparkFrames[0], x, y, 0.35 + i * 0.12 + j * 0.08, reduced ? 1.2 : 0.7, 0, 8)
      }
    })
    if (finished.length) window.setTimeout(() => audio.cue('crane'), list.length ? 450 : 0)
  }

  private spawn(frames: Texture[] | null, first: Texture | undefined, x: number, y: number, delay: number, life: number, rise: number, fps: number, scale = 1): void {
    if (!first) return
    const s = new Sprite(first)
    s.scale.set(scale)
    s.position.set(x, y)
    s.visible = false
    this.fxLayer.addChild(s)
    this.fx.push({ s, anim: s, frames, x, y, delay, t: 0, life, rise, fps })
    this.wake()
  }

  /**
   * The round's total over the middle of the visible map: a coin and "+12.3" in pixel type, drawn
   * in screen space at a whole multiple of the device pixel so it stays crisp (>= 21 CSS px tall).
   */
  private spawnTotal(total: number, coinFrames: Texture[], reduced: boolean): void {
    const lt = amountTexture(total)
    const box = new Container()
    const coin = coinFrames[0] ? new Sprite(coinFrames[0]) : null
    const gap = 3
    const cw = coin ? coin.texture.width + gap : 0
    if (coin) {
      coin.position.set(0, Math.round((lt.height - coin.texture.height) / 2))
      box.addChild(coin)
    }
    const label = new Sprite(lt)
    label.position.set(cw, 0)
    box.addChild(label)
    const css = Math.max(3, Math.round(this.cssScale * 1.5))
    const k = Math.max(1, Math.round(css * this.dpr))
    box.scale.set(k)
    const w = (cw + lt.width) * k
    const cx = ((this.safe.x0 + this.safe.x1) / 2) * this.dpr
    const cy = ((this.safe.y0 + this.safe.y1) / 2) * this.dpr
    const x = Math.round(cx - w / 2)
    const y = Math.round(cy - (lt.height * k) / 2)
    box.position.set(x, y)
    box.visible = false
    this.hud.addChild(box)
    // the coin stays face on (a spinning coin this size reads as a bar at its edge-on frames)
    this.fx.push({ s: box, frames: null, x, y, delay: 0.05, t: 0, life: 2.4, rise: reduced ? 0 : 6 * k, fps: 0 })
    this.wake()
  }

  // ---------- ticker ----------

  private tick(dt: number): void {
    if (this.destroyed) return
    this.time += dt
    const m = this.model
    const reduced = m?.reduced ?? false

    // camera ease
    const ease = reduced ? 1 : Math.min(1, dt * 12)
    const dx = this.cam.tx - this.cam.x
    const dy = this.cam.ty - this.cam.y
    const camMoving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01
    this.pace(m, camMoving)
    if (camMoving) {
      this.cam.x = Math.abs(dx) < 0.05 ? this.cam.tx : this.cam.x + dx * ease
      this.cam.y = Math.abs(dy) < 0.05 ? this.cam.ty : this.cam.y + dy * ease
      this.applyCam()
    }
    this.edgeScroll(dt)
    if (this.dirtyOverlay || (this.pulse && this.pulse.until > this.time - 0.1)) {
      if (this.pulse && this.pulse.until <= this.time) this.pulse = null
      this.drawOverlay()
    }
    if (!m) return
    const live = this.live

    // turbine blades: turn with the plant output in use, still when idle
    for (const b of this.blades) {
      if (!reduced && live.plantUtil > 0 && !b.still) b.phase += dt * (5 + 9 * live.plantUtil)
      const frames = this.sheet.animations.blades
      if (frames?.length) b.s.texture = frames[Math.floor(b.phase) % frames.length]
    }
    // solar shimmer: a glint sweeps the panels every few seconds while the plant runs
    if (this.shimmers.length) {
      const frames = this.sheet.animations.shimmer ?? []
      if (live.plantUtil <= 0) for (const s of this.shimmers) s.alpha = 0
      else if (reduced) for (const s of this.shimmers) {
        s.texture = frames[2] ?? s.texture
        s.alpha = 0.9
      }
      else {
        this.shimmerT += dt * (0.4 + 0.6 * live.plantUtil)
        this.shimmers.forEach((s, i) => {
          const t = (this.shimmerT + i * 0.37) % 1.6
          const f = Math.floor(t * 10)
          s.alpha = f < frames.length ? 1 : 0
          if (f < frames.length) s.texture = frames[f]
        })
      }
    }
    // rack LEDs: lit in proportion to compute assigned, blinking; dim when idle; static under reduced motion
    const on = this.tex('rack_led_on')
    const dim = this.tex('rack_led_dim')
    for (const d of this.dcs) {
      if (reduced || live.dcUtil <= 0) {
        const lit = Math.round(live.dcUtil * d.leds.length)
        d.leds.forEach((l, i) => {
          const want = i < lit
          if (want !== l.on) {
            l.on = want
            l.s.texture = want ? on : dim
          }
        })
        continue
      }
      if (this.time < d.next) continue
      d.next = this.time + 0.12 + Math.random() * 0.25
      for (const l of d.leds) {
        const want = Math.random() < live.dcUtil * 0.92 + 0.04
        if (want !== l.on) {
          l.on = want
          l.s.texture = want ? on : dim
        }
      }
    }
    // smoke and steam
    this.tickSmoke(dt, reduced)
    // flow dots
    for (const k of Object.keys(this.flowPhase) as FlowKind[]) this.flowPhase[k] = (this.flowPhase[k] + dt * flowSpeed(live.flows[k])) % dotGap(live.flows[k])
    this.placeDots()
    // coins, labels, sparkles
    if (this.fx.length) {
      const keep: Fx[] = []
      for (const f of this.fx) {
        f.t += dt
        const t = f.t - f.delay
        if (t < 0) {
          keep.push(f)
          continue
        }
        if (t >= f.life) {
          f.s.destroy({ children: true })
          continue
        }
        f.s.visible = true
        const p = t / f.life
        const rise = f.rise * (1 - (1 - Math.min(1, p * 1.6)) ** 3)
        f.s.position.set(f.x, f.y - rise)
        f.s.alpha = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1
        if (f.anim && f.frames && f.frames.length && f.fps > 0 && !reduced) f.anim.texture = f.frames[Math.floor(t * f.fps) % f.frames.length]
        keep.push(f)
      }
      this.fx = keep
    }
  }

  /**
   * Frame pacing. The sprite animations run at 8-14 fps, so the map renders at 30 fps unless the
   * camera or a drag is moving (then at the display rate); when nothing moves at all (reduced
   * motion, an idle company) the ticker parks itself until a store, camera or effect wakes it.
   */
  private pace(m: Model | null, camMoving: boolean): void {
    const pl = usePlacement.getState()
    const interacting = camMoving || !!this.press || (pl.active && (pl.mode === 'drag' || pl.mode === 'move'))
    const fps = interacting ? 0 : 30
    if (fps !== this.fps) {
      this.fps = fps
      this.app.ticker.maxFPS = fps
    }
    const live = this.live
    const reduced = m?.reduced ?? false
    const animating =
      interacting ||
      this.dirtyOverlay ||
      !!this.pulse ||
      this.fx.length > 0 ||
      this.smoke.length > 0 ||
      this.routes.length > 0 ||
      (!reduced &&
        ((live.plantUtil > 0 && (this.blades.some((b) => !b.still) || this.shimmers.length > 0 || this.smokeSources.some((x) => x.kind !== 'house'))) ||
          (live.townSmoke && this.smokeSources.length > 0) ||
          (live.dcUtil > 0 && this.dcs.length > 0)))
    if (animating) this.idleFrames = 0
    // park after a few still frames, so the last state has been rendered
    else if (++this.idleFrames > 3) this.app.ticker.stop()
  }

  private tickSmoke(dt: number, reduced: boolean): void {
    const live = this.live
    if (reduced) {
      if (this.smoke.length) {
        for (const p of this.smoke) p.s.destroy()
        this.smoke = []
      }
      return
    }
    const frames = (this.sheet.animations.smoke ?? []) as Texture[]
    if (!frames.length) return
    for (const src of this.smokeSources) {
      const util = src.kind === 'house' ? (live.townSmoke ? 0.6 : 0) : live.plantUtil
      if (util <= 0) continue
      const rate = src.kind === 'chimney' ? 1.1 : src.kind === 'tower' ? 0.8 : 0.35
      src.acc += dt * rate * (0.35 + 0.65 * util)
      while (src.acc >= 1) {
        src.acc -= 1
        const s = new Sprite(frames[0])
        const base = this.pt('smoke_0', 'base') ?? [8, 13]
        s.anchor.set(base[0] / 16, base[1] / 16)
        const dusk = this.model?.dusk
        const t = src.kind === 'tower' ? WHITE : SMOKE_GREY
        s.tint = dusk ? mulTint(t, DUSK) : t
        this.fxLayer.addChild(s)
        this.smoke.push({ s, x: src.x, y: src.y, t: 0, life: src.kind === 'house' ? 2.2 : 2.8, drift: 3 + Math.random() * 5, rise: src.kind === 'house' ? 14 : 30 })
      }
    }
    const keep: Smoke[] = []
    for (const p of this.smoke) {
      p.t += dt
      const q = p.t / p.life
      if (q >= 1) {
        p.s.destroy()
        continue
      }
      p.s.texture = frames[Math.min(frames.length - 1, Math.floor(q * frames.length))]
      p.s.position.set(p.x + p.drift * q, p.y - p.rise * q)
      p.s.alpha = q < 0.1 ? q / 0.1 : 1 - Math.max(0, q - 0.55) / 0.45
      keep.push(p)
    }
    this.smoke = keep
  }

  /** While dragging a build card near the top or bottom of the visible map, scroll it. */
  private edgeScroll(dt: number): void {
    const pl = usePlacement.getState()
    if (!pl.active || !pl.pointer || (pl.mode !== 'drag' && pl.mode !== 'move')) return
    const hr = this.host.getBoundingClientRect()
    const y = pl.pointer.y - hr.top
    const x = pl.pointer.x - hr.left
    if (x < this.safe.x0 || x > this.safe.x1) return
    const zone = 48
    let v = 0
    if (y < this.safe.y0 + zone && y >= this.safe.y0 - 20) v = -(1 - (y - this.safe.y0) / zone)
    else if (y > this.safe.y1 - zone && y <= this.safe.y1 + 20) v = 1 - (this.safe.y1 - y) / zone
    if (!v) return
    const before = this.cam.ty
    this.setTarget(this.cam.tx, this.cam.ty + v * 260 * dt, true)
    if (this.cam.ty !== before) {
      const t = this.lotAt(pl.pointer.x, pl.pointer.y)
      const info = t ? this.lotInfo(t) : null
      const hover = t && info?.kind === 'free' ? t : null
      const prev = pl.hover
      if (!(prev && hover && prev[0] === hover[0] && prev[1] === hover[1]) && (prev || hover)) usePlacement.setState({ hover })
    }
  }

}
