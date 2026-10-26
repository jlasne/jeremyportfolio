// npm run sprites: draw every frame, pack them into one atlas and write
// public/sprites/atlas.png + atlas.json (TexturePacker JSON-hash, read by
// PixiJS 8 Spritesheet) plus a "points" object of anchors per frame.
// Previews for review go to .sim/ (git-ignored).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Canvas, paletteSet } from './raster.mjs'
import { groundFrames } from './ground.mjs'
import { plantFrames } from './plants.mjs'
import { dcFrames } from './datacenters.mjs'
import { townFrames } from './town.mjs'
import { constructionFrames } from './construction.mjs'
import { effectFrames } from './effects.mjs'
import { lightsFrame, snowFrame } from './overlays.mjs'
import { contactSheet, greyscale, hueReport, scene, silhouettes, SEASONS } from './preview.mjs'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = resolve(app, 'public/sprites')
const simDir = resolve(app, '.sim')

/** DESIGN.md section 6: every frame name the map relies on, with its size. */
function expected() {
  const e = {}
  const add = (name, w, h = w) => (e[name] = [w, h])
  for (const s of SEASONS) for (let v = 0; v < 4; v++) add(`grass_${s}_${v}`, 32)
  add('dirt_0', 32)
  add('dirt_1', 32)
  for (const n of ['road_h', 'road_v', 'road_x', 'road_t_n', 'road_t_s', 'road_t_e', 'road_t_w']) add(n, 32)
  add('lot', 96)
  add('fence_h', 32)
  add('fence_v', 32)
  for (let i = 0; i < 3; i++) add(`flowers_${i}`, 32)
  for (const s of SEASONS) add(`tree_${s}`, 32, 48)
  add('bush_0', 32)
  add('bush_1', 32)
  add('rock_0', 32)
  add('plant_small', 64)
  for (let i = 0; i < 4; i++) add(`blades_${i}`, 24)
  add('plant_big', 96)
  for (let i = 0; i < 5; i++) add(`smoke_${i}`, 16)
  for (let i = 0; i < 6; i++) add(`shimmer_${i}`, 64)
  add('dc_small', 64)
  add('dc_big', 96)
  add('rack_led_on', 2)
  add('rack_led_dim', 2)
  add('crane', 64, 96)
  add('scaffold_small', 64)
  add('scaffold_big', 96)
  for (let i = 0; i < 6; i++) add(`house_${i}`, 32)
  add('townhall', 64)
  add('substation', 64)
  add('pylon', 32, 64)
  add('pole', 16, 32)
  for (let i = 0; i < 6; i++) add(`coin_${i}`, 16)
  for (let i = 0; i < 4; i++) add(`spark_${i}`, 8)

  // Contract additions (art revision 2; to be added to DESIGN.md section 6).
  // Path pieces: dirt with transparent ragged edges, drawn over the season's grass.
  for (let v = 0; v < 2; v++) add(`path_v_${v}`, 32), add(`path_h_${v}`, 32)
  for (const d of ['n', 's', 'e', 'w']) add(`path_end_${d}`, 32)
  add('path_x', 32)
  // Free-lot corner marks (drawn only on lots nobody has built on).
  add('lot_marks', 96)
  // Winter props drawn instead of bush_0..1.
  add('bush_winter_0', 32)
  add('bush_winter_1', 32)
  // Street lamp and its dusk glow.
  add('lamp', 16, 32)
  add('glow_0', 24)
  // Construction tarp overlays, tinted by the map with the future asset's hue.
  add('tarp_small', 64)
  add('tarp_big', 96)
  // Dusk light overlays (drawn above the dusk tint, untinted) and winter
  // snow overlays (drawn above the building), same size as their building.
  const SIZED = { plant_small: 64, plant_big: 96, dc_small: 64, dc_big: 96, townhall: 64, substation: 64 }
  for (let i = 0; i < 6; i++) SIZED[`house_${i}`] = 32
  for (const [n, w] of Object.entries(SIZED)) add(`lights_${n}`, w), add(`snow_${n}`, w)
  add('lights_lamp', 16, 32)
  add('snow_rock_0', 32)
  return e
}

const ANIMATIONS = {
  blades: [0, 1, 2, 3].map((i) => `blades_${i}`),
  smoke: [0, 1, 2, 3, 4].map((i) => `smoke_${i}`),
  shimmer: [0, 1, 2, 3, 4, 5].map((i) => `shimmer_${i}`),
  coin: [0, 1, 2, 3, 4, 5].map((i) => `coin_${i}`),
  spark: [0, 1, 2, 3].map((i) => `spark_${i}`),
}

const PAD = 2 // px of edge extrusion around every frame; neighbours never touch

/** Shelf packing: tallest first, left to right, a new shelf when a row is full. */
function pack(frames, width) {
  const order = [...frames].sort((a, b) => b.canvas.h - a.canvas.h || b.canvas.w - a.canvas.w || a.name.localeCompare(b.name))
  let x = 0
  let y = 0
  let shelf = 0
  for (const f of order) {
    const w = f.canvas.w + PAD * 2
    const h = f.canvas.h + PAD * 2
    if (x + w > width) {
      x = 0
      y += shelf
      shelf = 0
    }
    f.x = x + PAD
    f.y = y + PAD
    x += w
    shelf = Math.max(shelf, h)
  }
  return y + shelf
}

/** Copy a frame in, then repeat its border pixels into the padding (extrusion). */
function place(atlas, f) {
  const { canvas: c, x: fx, y: fy } = f
  for (let y = -PAD; y < c.h + PAD; y++) {
    for (let x = -PAD; x < c.w + PAD; x++) {
      const sx = Math.min(c.w - 1, Math.max(0, x))
      const sy = Math.min(c.h - 1, Math.max(0, y))
      atlas.set(fx + x, fy + y, c.get(sx, sy))
    }
  }
}

const pow2 = (n) => 2 ** Math.ceil(Math.log2(n))

function auditPalette(frames) {
  const allowed = paletteSet()
  const bad = new Map()
  for (const f of frames) {
    const c = f.canvas
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const p = c.get(x, y)
        if (!p[3]) continue
        const key = `${p[0]},${p[1]},${p[2]}`
        if (!allowed.has(key)) bad.set(f.name, (bad.get(f.name) ?? 0) + 1)
      }
    }
  }
  return bad
}

/** Every variant of a season must share its 1 px edge ring, so any two butt together seamlessly. */
function auditSeams(byName) {
  const issues = []
  const ring = (c) => {
    const out = []
    for (let i = 0; i < 32; i++) out.push(c.get(i, 0), c.get(i, 31), c.get(0, i), c.get(31, i))
    return out.map((p) => p.join(',')).join(';')
  }
  for (const s of SEASONS) {
    const r0 = ring(byName[`grass_${s}_0`])
    for (let v = 1; v < 4; v++) if (ring(byName[`grass_${s}_${v}`]) !== r0) issues.push(`grass_${s}_${v} edge ring differs from variant 0`)
  }
  if (ring(byName.dirt_0) !== ring(byName.dirt_1)) issues.push('dirt_1 edge ring differs from dirt_0')
  // road pieces must agree on their kerbs where they meet (asphalt is a speckle texture, free to differ)
  const kerb = (c, edge) => {
    const at = (i) => (edge === 'w' ? c.get(0, i) : edge === 'e' ? c.get(31, i) : edge === 'n' ? c.get(i, 0) : c.get(i, 31))
    return [0, 1, 2, 3, 28, 29, 30, 31].map((i) => at(i).join(',')).join(';')
  }
  const h = byName.road_h
  const v = byName.road_v
  for (const n of ['road_h', 'road_x', 'road_t_n', 'road_t_s']) {
    if (kerb(byName[n], 'w') !== kerb(h, 'e')) issues.push(`${n} west kerb does not meet road_h`)
    if (kerb(byName[n], 'e') !== kerb(h, 'w')) issues.push(`${n} east kerb does not meet road_h`)
  }
  for (const n of ['road_v', 'road_x', 'road_t_e', 'road_t_w']) {
    if (kerb(byName[n], 'n') !== kerb(v, 's')) issues.push(`${n} north kerb does not meet road_v`)
    if (kerb(byName[n], 's') !== kerb(v, 'n')) issues.push(`${n} south kerb does not meet road_v`)
  }
  // path pieces: every piece that leaves through an edge shares that edge's
  // profile, and the profile is periodic, so any two pieces line up
  const edgeA = (c, side) => {
    const out = []
    for (let i = 0; i < 32; i++) {
      const [x, y] = side === 'n' ? [i, 0] : side === 's' ? [i, 31] : side === 'w' ? [0, i] : [31, i]
      out.push(c.alpha(x, y) ? 1 : 0)
    }
    return out.join('')
  }
  const pv = byName.path_v_0
  const ph = byName.path_h_0
  for (const n of ['path_v_1', 'path_end_s', 'path_x']) if (edgeA(byName[n], 'n') !== edgeA(pv, 'n')) issues.push(`${n} north edge differs from path_v_0`)
  for (const n of ['path_v_1', 'path_end_n', 'path_x']) if (edgeA(byName[n], 's') !== edgeA(pv, 's')) issues.push(`${n} south edge differs from path_v_0`)
  for (const n of ['path_h_1', 'path_end_e', 'path_x']) if (edgeA(byName[n], 'w') !== edgeA(ph, 'w')) issues.push(`${n} west edge differs from path_h_0`)
  for (const n of ['path_h_1', 'path_end_w', 'path_x']) if (edgeA(byName[n], 'e') !== edgeA(ph, 'e')) issues.push(`${n} east edge differs from path_h_0`)
  return issues
}

/** Overlays derived from flagged frames: lights_<name> for dusk, snow_<name> for winter. */
function deriveOverlays(frames) {
  const out = []
  for (const f of frames) {
    if (f.lights) out.push({ name: `lights_${f.name}`, canvas: lightsFrame(f.canvas) })
    if (f.snow) out.push({ name: `snow_${f.name}`, canvas: snowFrame(f.canvas) })
  }
  return out
}

function main() {
  const base = [...groundFrames(), ...plantFrames(), ...dcFrames(), ...townFrames(), ...constructionFrames(), ...effectFrames()]
  const frames = [...base, ...deriveOverlays(base)]
  const byName = Object.fromEntries(frames.map((f) => [f.name, f.canvas]))
  if (Object.keys(byName).length !== frames.length) throw new Error('duplicate frame names')

  const exp = expected()
  const problems = []
  for (const [name, [w, h]] of Object.entries(exp)) {
    const c = byName[name]
    if (!c) problems.push(`missing ${name}`)
    else if (c.w !== w || c.h !== h) problems.push(`${name} is ${c.w}x${c.h}, expected ${w}x${h}`)
  }
  for (const name of Object.keys(byName)) if (!exp[name]) problems.push(`unexpected frame ${name}`)
  if (problems.length) throw new Error(problems.join('\n'))

  // narrowest power-of-two width that keeps the atlas no taller than wide
  let width = 256
  let height = pack(frames, width)
  while (height > width) {
    width *= 2
    height = pack(frames, width)
  }
  height = pow2(height)
  const atlas = new Canvas(width, height)
  for (const f of frames) place(atlas, f)

  const json = {
    frames: {},
    animations: ANIMATIONS,
    points: {},
    meta: {
      app: 'grid-tycoon scripts/sprites/build.mjs',
      version: '1',
      image: 'atlas.png',
      format: 'RGBA8888',
      size: { w: width, h: height },
      scale: '1',
    },
  }
  for (const f of [...frames].sort((a, b) => a.name.localeCompare(b.name))) {
    const { w, h } = f.canvas
    json.frames[f.name] = {
      frame: { x: f.x, y: f.y, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
    }
    if (f.points) json.points[f.name] = f.points
  }

  mkdirSync(outDir, { recursive: true })
  atlas.save(resolve(outDir, 'atlas.png'))
  writeFileSync(resolve(outDir, 'atlas.json'), JSON.stringify(json, null, 1) + '\n')

  const bad = auditPalette(frames)
  const seams = auditSeams(byName)

  mkdirSync(simDir, { recursive: true })
  contactSheet(frames, 3).save(resolve(simDir, 'sprites-preview.png'))
  for (const s of SEASONS) scene(byName, json.points, s).scale(2).save(resolve(simDir, `scene-${s}.png`))
  scene(byName, json.points, 'summer', { dusk: true }).scale(2).save(resolve(simDir, 'scene-dusk.png'))
  scene(byName, json.points, 'winter', { dusk: true }).scale(2).save(resolve(simDir, 'scene-winter-dusk.png'))
  greyscale(scene(byName, json.points, 'summer')).scale(2).save(resolve(simDir, 'scene-summer-grey.png'))
  silhouettes(byName, ['plant_small', 'dc_small', 'scaffold_small', 'plant_big', 'dc_big', 'scaffold_big', 'house_0', 'house_1', 'house_2', 'house_3', 'house_4', 'house_5', 'townhall', 'substation']).save(resolve(simDir, 'silhouettes.png'))
  writeFileSync(resolve(simDir, 'hue-report.txt'), hueReport(byName))

  console.log(`sprites: ${frames.length} frames -> public/sprites/atlas.png ${width}x${height}`)
  console.log(bad.size ? `palette: off-palette pixels in ${[...bad].map(([n, k]) => `${n}(${k})`).join(', ')}` : 'palette: every opaque pixel is a palette colour')
  console.log(seams.length ? `seams:\n  ${seams.join('\n  ')}` : 'seams: grass variants share edges, road pieces meet')
  const opaque = new Set()
  for (const f of frames) for (let y = 0; y < f.canvas.h; y++) for (let x = 0; x < f.canvas.w; x++) {
    const p = f.canvas.get(x, y)
    if (p[3] === 255) opaque.add(`${p[0]},${p[1]},${p[2]}`)
  }
  console.log(`colours: ${opaque.size} distinct opaque colours`)
  console.log('previews: .sim/sprites-preview.png, .sim/scene-{spring,summer,autumn,winter,dusk,winter-dusk}.png, .sim/scene-summer-grey.png, .sim/silhouettes.png, .sim/hue-report.txt')
  if (bad.size || seams.length) process.exitCode = 1
}

main()
