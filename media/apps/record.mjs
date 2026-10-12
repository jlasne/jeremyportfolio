// Re-records the three bento videos on the landing.
//
//   NODE_PATH=$(npm root -g) node media/apps/record.mjs [dana] [kivenro] [kaught]
//
// Needs playwright (with its chromium) and ffmpeg with libx264 on the path.
//
// dana, kivenro: opens the live page at the tile's shape, scrolls it top to
//   bottom the way a hand would (eased in and out, one steady pace between),
//   photographs it frame by frame, then cuts out every stretch where the page
//   stands still while the scroll goes on (a pinned scene, a stall), so the
//   video never stops by itself. The end fades into the start, so it loops
//   without a jump.
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

  // Frame by frame: park the page where the scroll would be, then photograph it. A steady
  // 30 frames a second whatever the machine's speed, and no hiccup is ever recorded.
  const at = pace(dist, cfg.run)
  const hold = Math.round(cfg.hold * FPS), run = Math.round(cfg.run * FPS), n = hold + run + hold
  for (let i = 0; i < n; i++) {
    const y = at(Math.min(Math.max(i - hold, 0), run) / FPS)
    await page.evaluate((y) => new Promise((done) => {
      scrollTo({ top: y, behavior: 'instant' })
      requestAnimationFrame(() => requestAnimationFrame(done))
    }), y)
    const buf = await page.screenshot({ type: 'jpeg', quality: 90, scale: 'device' })
    writeFileSync(join(work, `f${String(i).padStart(5, '0')}.jpg`), buf)
  }
  await browser.close()
  console.log(`${name}: ${n} frames, page ${dist}px`)
  if (process.env.FRAMES_ONLY) { console.log(`${name}: frames in ${work}`); return }

  // Cut the stills. The two holds stay whole (a beat to read the first and last screen);
  // inside the scroll every frame that equals the one before it is dropped, then the
  // rest is re-timed to a steady 30 a second.
  const seq = join(work, 'seq.mp4')
  sh('ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(work, 'f%05d.jpg'), '-filter_complex',
    `[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p,split=3[a][b][c];` +
    `[a]trim=end_frame=${hold},setpts=PTS-STARTPTS[head];` +
    `[b]trim=start_frame=${hold}:end_frame=${hold + run},setpts=PTS-STARTPTS,mpdecimate,setpts=N/${FPS}/TB[mid];` +
    `[c]trim=start_frame=${hold + run},setpts=PTS-STARTPTS[tail];` +
    `[head][mid][tail]concat=n=3:v=1:a=0[v]`,
    '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', seq])
  const T = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', seq]).toString())

  // loop it: the last FADE seconds dissolve into the first
  const out = join(here, `${name}.mp4`)
  sh('ffmpeg', ['-y', '-i', seq, '-filter_complex',
    `[0:v]trim=start=${FADE},setpts=PTS-STARTPTS[body];[0:v]trim=end=${FADE},setpts=PTS-STARTPTS[head];` +
    `[body][head]xfade=transition=fade:duration=${FADE}:offset=${(T - 2 * FADE).toFixed(3)},format=yuv420p[v]`,
    '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', String(cfg.crf), '-preset', 'slow', '-movflags', '+faststart', out])
  if (process.env.KEEP_FRAMES) console.log(`${name}: frames kept in ${work}`)
  else rmSync(work, { recursive: true, force: true })
  console.log(`${name}.mp4 ${T.toFixed(1)}s before the loop fade, ${kb(out)}`)
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
