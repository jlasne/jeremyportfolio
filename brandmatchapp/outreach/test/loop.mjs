import http from 'node:http'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Browser } from '../dist/core/browser.js'
import { pursue } from '../dist/core/loop.js'
import { Log } from '../dist/core/log.js'

// A page that behaves like a profile: a Message button that opens a composer.
const PAGE = `<!doctype html><html><body>
<h1>ana.lifts</h1>
<a href="#" role="link">Follow</a>
<button id="msg" aria-label="Message">Message</button>
<div id="thread" style="display:none">
  <div contenteditable="true" aria-label="Message..." id="box" style="width:400px;height:60px;border:1px solid #000"></div>
  <button aria-label="Send">Send</button>
</div>
<script>
document.getElementById('msg').onclick = () => { document.getElementById('thread').style.display = 'block' }
document.getElementById('box').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('box').innerText = '' }
})
</script></body></html>`

// A page whose button does nothing, which is what Instagram looked like when
// a stale number sent the click to the wrong element.
const DEAD = `<!doctype html><html><body>
<h1>ana.lifts</h1>
<button aria-label="Message">Message</button>
</body></html>`

const site = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  res.end(req.url.startsWith('/dead') ? DEAD : PAGE)
}).listen(8111)

// A stub for OpenRouter. It reads the numbered list out of the prompt and
// answers the way the real model is asked to: one option, as JSON.
let calls = 0
const model = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    calls++
    const prompt = JSON.parse(body).messages.map((m) => m.content).join('\n')
    const lines = prompt.split('\n').filter((l) => /^\d+\) \[/.test(l))
    const goal = (prompt.match(/Goal: (.*)/) ?? [])[1] ?? ''
    let answer = { action: 'stuck', why: 'nothing' }
    if (/conversation/.test(goal)) {
      const hit = lines.find((l) => /\[click\].*Message$/.test(l))
      if (hit) answer = { action: 'click', i: Number(hit.split(')')[0]), why: 'open the dm' }
    } else if (/box/.test(goal)) {
      const hit = lines.find((l) => /\[type\]/.test(l))
      if (hit) answer = { action: 'type', i: Number(hit.split(')')[0]), why: 'the composer' }
    }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(answer) } }],
      usage: { prompt_tokens: 320, completion_tokens: 18 },
    }))
  })
}).listen(8112)

const settings = {
  openrouter: {
    apiKey: 'test', baseUrl: 'http://127.0.0.1:8112',
    decide: { model: 'stub', priceIn: 0.1, priceOut: 0.3 },
    vision: { enabled: false, model: 'stub-vision', priceIn: 0.3, priceOut: 0.9 },
  },
  brandmatch: { apiBase: '', apiKey: '', status: 'new', savedOnly: false, markAs: 'contacted' },
  instagram: { account: 'test', dailyCap: 50, betweenDms: [1, 1], afterProfile: [0, 0], typing: [1, 3] },
  browser: { headless: true, viewport: { width: 1000, height: 800 }, sessionRoot: '', executablePath: process.env.CHROME_PATH },
  costs: { browserUsdPerHour: 0 },
  limits: { maxStepsPerGoal: 6 },
  paths: { logs: join(mkdtempSync(join(tmpdir(), 'bm-')), 'logs') },
}

const log = new Log(settings.paths.logs, 0)
const browser = await Browser.open(settings, mkdtempSync(join(tmpdir(), 'profile-')))

try {
  await browser.goto('http://127.0.0.1:8111/')
  await browser.settle(300)

  const state = await browser.state()
  console.log('candidates read from the page:', state.candidates.map((c) => `${c.i}:${c.role}:${c.name}`).join(' | '))
  assert.ok(state.candidates.some((c) => c.name === 'Message'), 'the Message button must be in the list')

  const open = await pursue(browser, 'Open the direct message conversation with the person whose profile this is.', settings, log, { until: (p) => p.candidates.some((c) => c.editable) })
  assert.equal(open.reached, true, `open failed: ${open.why}`)
  await browser.settle(300)

  const text = 'Hey Ana, two briefs fit you this week. Want the details?'
  const write = await pursue(browser, 'Find the box where a new message is typed.', settings, log, { text })
  assert.equal(write.reached, true, `write failed: ${write.why}`)
  assert.notEqual(write.lastBox, null)

  const typed = (await browser.textOf(write.lastBox)).trim()
  assert.equal(typed, text, 'the message must be in the box, character for character')
  console.log('typed into the box:', JSON.stringify(typed))

  await browser.pressEnter()
  await browser.settle(300)
  const after = (await browser.textOf(write.lastBox)).trim()
  assert.equal(after, '', 'after Enter the box must be empty, which is how a send is confirmed')

  // A click that moves nothing stops the goal, instead of paying for the same
  // answer until the step ceiling.
  await browser.goto('http://127.0.0.1:8111/dead')
  await browser.settle(300)
  const callsBefore = calls
  const stuck = await pursue(browser, 'Open the direct message conversation with the person whose profile this is.', settings, log, { until: (p) => p.url.includes('/direct/') })
  assert.equal(stuck.reached, false)
  // Message is the only way in. Clicking it does nothing, so it is dropped,
  // the list empties, and the goal ends naming what was tried.
  assert.match(stuck.why, /nothing left to try/, `expected a dead-end stop, got: ${stuck.why}`)
  assert.match(stuck.why, /Message/, 'the stop must name what it tried')
  assert.ok(stuck.steps <= 3, `a dead click must stop early, took ${stuck.steps} steps`)
  console.log(`dead page stopped after ${stuck.steps} steps and ${calls - callsBefore} calls: ${stuck.why}`)

  const usd = open.usage.usd + write.usage.usd
  console.log(`steps ${open.steps + write.steps}, model calls ${calls}, cost $${usd.toFixed(6)}`)
  assert.ok(usd > 0, 'the cost log must add up to something')
  console.log('end to end passed')
} finally {
  await browser.close()
  site.close()
  model.close()
}
