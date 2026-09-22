import http from 'node:http'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run } from '../dist/instagram/outreach.js'
import { Log } from '../dist/core/log.js'
import { DailyCap } from '../dist/instagram/limiter.js'

const PAGE = `<!doctype html><html><body>
<h1>profile</h1><button aria-label="Message">Message</button>
<div id="t" style="display:none"><div contenteditable="true" aria-label="Message..." id="box" style="width:400px;height:60px;border:1px solid #000"></div></div>
<script>
document.querySelector('button').onclick = () => { document.getElementById('t').style.display='block' }
document.getElementById('box').addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); e.target.innerText='' } })
</script></body></html>`

const site = http.createServer((_, res) => { res.setHeader('content-type','text/html'); res.end(PAGE) }).listen(8121)

const model = http.createServer((req, res) => {
  let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
    const prompt = JSON.parse(b).messages.map(m=>m.content).join('\n')
    const lines = prompt.split('\n').filter(l=>/^\d+\) \[/.test(l))
    const hit = lines.find(l=>/\[type\]/.test(l)) ?? lines.find(l=>/\[click\].*Message$/.test(l))
    const answer = hit
      ? { action: /\[type\]/.test(hit) ? 'type' : 'click', i: Number(hit.split(')')[0]), why: 'x' }
      : { action: 'stuck', why: 'nothing' }
    res.setHeader('content-type','application/json')
    res.end(JSON.stringify({ choices:[{message:{content:JSON.stringify(answer)}}], usage:{prompt_tokens:300,completion_tokens:16} }))
  })
}).listen(8122)

// The brandmatch client API, stubbed. Records what the agent writes back.
const marked = []
const api = http.createServer((req, res) => {
  let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
    res.setHeader('content-type','application/json')
    if (req.url.startsWith('/api/leads?')) {
      assert.equal(req.headers.authorization, 'Bearer bm-key', 'the key must travel on every call')
      return res.end(JSON.stringify({ leads: [
        { id:'l1', score:2.5, status:'new', saved:true, creator:{ handle:'ana.lifts', name:'Ana Ruiz', followers:24300, bio:'coach' } },
        { id:'l2', score:2.0, status:'new', saved:false, creator:{ handle:'mia.trains', name:'Mia Diaz', followers:88000, bio:'coach' } },
        { id:'l3', score:1.5, status:'new', saved:true, creator:{ handle:'', name:'no handle', followers:1 } },
      ]}))
    }
    const hit = req.url.match(/^\/api\/leads\/(\w+)\/status$/)
    if (hit) { marked.push({ id: hit[1], body: JSON.parse(b) }); return res.end(JSON.stringify({ ok:true })) }
    res.statusCode = 404; res.end('{}')
  })
}).listen(8123)

const logDir = join(mkdtempSync(join(tmpdir(),'bm-run-')),'logs')
const base = {
  openrouter: { apiKey:'k', baseUrl:'http://127.0.0.1:8122',
    decide:{model:'stub',priceIn:0.1,priceOut:0.3}, vision:{enabled:false,model:'v',priceIn:0.3,priceOut:0.9} },
  brandmatch: { apiBase:'http://127.0.0.1:8123', apiKey:'bm-key', status:'new', savedOnly:false, markAs:'contacted' },
  instagram: { account:'test.hq', baseUrl:'http://127.0.0.1:8121', dailyCap:50, betweenDms:[1,1], afterProfile:[0,0], typing:[1,2] },
  browser: { headless:true, viewport:{width:1000,height:800}, sessionRoot:'', executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  costs: { browserUsdPerHour: 0 },
  limits: { maxStepsPerGoal: 6 },
  paths: { logs: logDir },
}
const templates = ['Hey {{firstName}}, {{followers}} strong. Two briefs fit you.']

try {
  // A profile folder that already exists, so the run does not stop to log in.
  const sessionRoot = mkdtempSync(join(tmpdir(),'sessions-'))
  const s = { ...base, browser: { ...base.browser, sessionRoot } }
  const { mkdirSync } = await import('node:fs')
  mkdirSync(join(sessionRoot, 'test.hq'), { recursive: true })

  const log = new Log(logDir, 0)

  // 1. dry run
  const dry = await run(s, log, templates, { send:false, approve:false })
  console.log('dry:', JSON.stringify(dry))
  assert.equal(dry.drafted, 2, 'both usable leads must be drafted')
  assert.equal(dry.sent, 0, 'a dry run must never send')
  assert.equal(marked.length, 0, 'a dry run must not move a lead')
  assert.equal(new DailyCap(logDir, 50).sentToday('test.hq'), 0, 'a draft must not spend the daily cap')
  assert.equal(dry.remainingToday, 50)

  // 2. real send
  const sent = await run(s, log, templates, { send:true, approve:false })
  console.log('send:', JSON.stringify(sent))
  assert.equal(sent.sent, 2)
  assert.equal(marked.length, 2, 'both leads must be moved to contacted')
  assert.equal(marked[0].body.status, 'contacted')
  assert.equal(marked[0].body.by, 'outreach-agent')
  assert.equal(marked[0].body.note, 'Hey Ana, 24.3k strong. Two briefs fit you.')
  assert.equal(marked[1].body.note, 'Hey Mia, 88k strong. Two briefs fit you.')
  assert.equal(new DailyCap(logDir, 50).sentToday('test.hq'), 2)
  assert.equal(sent.remainingToday, 48)

  // 3. the cap holds
  const capped = { ...s, instagram: { ...s.instagram, dailyCap: 2 } }
  const blocked = await run(capped, log, templates, { send:true, approve:false })
  assert.equal(blocked.attempted, 0, 'at the cap the run must not open the browser at all')
  assert.equal(marked.length, 2, 'nothing more may be written after the cap')

  // 4. saved only
  const savedOnly = { ...s, brandmatch: { ...s.brandmatch, savedOnly: true } }
  const one = await run(savedOnly, log, templates, { send:false, approve:false, limit: 5 })
  assert.equal(one.drafted, 1, 'savedOnly must keep only the saved lead')

  console.log('day totals:', JSON.stringify(log.day()))
  console.log('full run passed')
  rmSync(sessionRoot, { recursive: true, force: true })
} finally {
  site.close(); model.close(); api.close()
}
