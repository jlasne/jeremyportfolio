// Re-records the three bento videos on the landing.
//
//   NODE_PATH=$(npm root -g) node media/apps/record.mjs [dana] [kivenro] [kaught]
//
// Needs playwright (with its chromium) and ffmpeg with libx264 on the path.
//
// dana, kivenro: opens the live page at the tile's shape, scrolls it top to
//   bottom the way a hand would (eased in and out, one steady pace between),
//   records what the screen shows, and cuts it into a loop: the end fades into
//   the start, so the video never jumps.
// kaught: takes the 15 second reel from kaught.app, cropped to the tile.
//
// Why a recording and not the page in a frame: a page on another site can't
// be scrolled from here, and a recording starts by itself on every screen,
// phones included, without loading three third-party pages.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = createRequire(import.meta.url)('playwright')
const here = dirname(fileURLToPath(import.meta.url))

const FPS = 30
const FADE = 0.9 // seconds the end of the scroll melts into the start

// view: the page's own width and height, as it lays out inside the tile.
// scale: device pixels per css pixel, so the video is sharp at the popped size.
const PAGES = {
  dana: { url: 'https://www.maximehouel.com/dana/', view: [420, 568], scale: 1.5, run: 24, hold: 1.4, crf: 29 },
  kivenro: { url: 'https://www.maximehouel.com/kivenro/', view: [900, 472], scale: 1, run: 20, hold: 1.2, crf: 28 },
}
const REEL = 'https://www.kaught.app/assets/reel/reel.mp4'

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] })
const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`

// where a hand-scroll of `dist` px lasting T seconds is at time t: ease in, one steady speed, ease out
function pace(dist, T) {
  const r = Math.min(1.6, T / 4), vmax = dist / (T - r)
  return (t) => t <= 0 ? 0 : t >= T ? dist
    : t < r ? 0.5 * vmax / r * t * t
    : t <= T - r ? 0.5 * vmax * r + vmax * (t - r)
    : dist - 0.5 * vmax / r * (T - t) * (T - t)
}

async function recordPage(name, cfg) {
  const [w, h] = cfg.view
  const work = mkdtempSync(join(tmpdir(), `rec-${name}-`))
  const proxy = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY] : []
  const browser = await chromium.launch({ args: proxy })
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: cfg.scale })
  const page = await ctx.newPage()
  await page.goto(cfg.url, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(5000) // the page's own intro plays out first
  const dist = await page.evaluate((h) => document.documentElement.scrollHeight - h, h)

  const frames = []
  if (cfg.scale > 1) {
    // Full resolution: Chromium's screencast only hands back css pixels, so the page is parked
    // at where the scroll would be, frame by frame, and photographed. Steady 30 frames a second
    // whatever the machine's speed. The page's own timers run a little slower than the video.
    const at = pace(dist, cfg.run)
    const hold = Math.round(cfg.hold * FPS), run = Math.round(cfg.run * FPS)
    for (let i = 0; i < hold + run + hold; i++) {
      const y = at(Math.min(Math.max(i - hold, 0), run) / FPS)
      await page.evaluate((y) => new Promise((done) => {
        scrollTo({ top: y, behavior: 'instant' })
        requestAnimationFrame(() => requestAnimationFrame(done))
      }), y)
      const buf = await page.screenshot({ type: 'jpeg', quality: 90, scale: 'device' })
      frames.push({ t: i / FPS, data: buf.toString('base64') })
    }
  } else {
    // The screencast is smooth (50+ frames a second): scroll in real time and let it watch
    const cdp = await ctx.newCDPSession(page)
    cdp.on('Page.screencastFrame', (f) => {
      frames.push({ t: f.metadata.timestamp, data: f.data })
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
    })
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
    await page.waitForTimeout(cfg.hold * 1000)
    await page.evaluate(({ dist, T, src }) => new Promise((done) => {
      const at = new Function('return ' + src)()(dist, T), t0 = performance.now()
      const step = (now) => {
        const t = (now - t0) / 1000
        scrollTo({ top: at(t), behavior: 'instant' })
        t < T ? requestAnimationFrame(step) : done()
      }
      requestAnimationFrame(step)
    }), { dist, T: cfg.run, src: pace.toString() })
    await page.waitForTimeout(cfg.hold * 1000)
    await cdp.send('Page.stopScreencast')
  }
  await browser.close()

  // frames arrive when the screen changes: write each with how long it stayed up
  const list = []
  frames.forEach((f, i) => {
    const file = join(work, `f${String(i).padStart(5, '0')}.jpg`)
    writeFileSync(file, Buffer.from(f.data, 'base64'))
    const next = frames[i + 1] ? frames[i + 1].t : f.t + 1 / FPS
    list.push(`file '${file}'`, `duration ${Math.max(next - f.t, 1 / 120).toFixed(5)}`)
  })
  list.push(`file '${join(work, `f${String(frames.length - 1).padStart(5, '0')}.jpg`)}'`)
  writeFileSync(join(work, 'list.txt'), list.join('\n'))
  const span = frames.at(-1).t - frames[0].t
  console.log(`${name}: ${frames.length} frames over ${span.toFixed(1)}s (${(frames.length / span).toFixed(0)} per second), page ${dist}px`)

  // constant frame rate, then loop it: the last FADE seconds dissolve into the first
  const cfr = join(work, 'cfr.mp4')
  sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-vf', `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', cfr])
  const T = span + 1 / FPS
  const out = join(here, `${name}.mp4`)
  sh('ffmpeg', ['-y', '-i', cfr, '-filter_complex',
    `[0:v]trim=start=${FADE},setpts=PTS-STARTPTS[body];[0:v]trim=end=${FADE},setpts=PTS-STARTPTS[head];` +
    `[body][head]xfade=transition=fade:duration=${FADE}:offset=${(T - 2 * FADE).toFixed(3)},format=yuv420p[v]`,
    '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', String(cfg.crf), '-preset', 'slow', '-movflags', '+faststart', out])
  rmSync(work, { recursive: true, force: true })
  console.log(`${name}.mp4 ${kb(out)}`)
}

function recordReel() {
  const work = mkdtempSync(join(tmpdir(), 'rec-kaught-'))
  const src = join(work, 'reel.mp4')
  sh('curl', ['-sSL', '--fail', '-o', src, REEL])
  const out = join(here, 'kaught.mp4')
  // 16:9 reel into the tile's 1200:630 shape: scale to the width, trim the height evenly
  sh('ffmpeg', ['-y', '-i', src, '-vf', 'scale=900:-2,crop=900:472,fps=30,format=yuv420p', '-an',
    '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', out])
  rmSync(work, { recursive: true, force: true })
  console.log(`kaught.mp4 ${kb(out)}`)
}

const want = process.argv.slice(2)
const all = want.length ? want : ['dana', 'kivenro', 'kaught']
for (const name of all) {
  if (name === 'kaught') recordReel()
  else if (PAGES[name]) await recordPage(name, PAGES[name])
  else console.log('unknown tile', name)
}
