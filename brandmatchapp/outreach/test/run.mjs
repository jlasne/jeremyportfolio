import http from 'node:http'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run } from '../dist/instagram/outreach.js'
import { Log } from '../dist/core/log.js'
import { DailyCap } from '../dist/instagram/limiter.js'

// Instagram's new-message screen, near enough to test the route that uses it:
// a search box, results that appear as you type, a person to pick, and a
// button that opens the thread at its own address.
const NEW = `<!doctype html><html><body>
<h1>New message</h1>
<nav><a href="#" role="link">Home</a><a href="#" role="link">Explore</a></nav>
<input aria-label="Search for a message recipient" placeholder="Search..." id="q">
<div id="results"></div>
<button aria-label="Chat" id="chat" style="display:none">Chat</button>
<script>
const q = document.getElementById('q')
q.addEventListener('input', () => {
  const v = q.value.trim()
  document.getElementById('results').innerHTML = v
    ? '<div role="button" id="hit">' + v + '</div>'
    : ''
  const hit = document.getElementById('hit')
  if (hit) hit.onclick = () => { document.getElementById('chat').style.display = 'block' }
})
document.getElementById('chat').onclick = () => { window.location.href = '/direct/t/1' }
</script></body></html>`

// The thread. Its address is what proves the conversation is open.
const THREAD = `<!doctype html><html><body>
<h1>Conversation</h1>
<div contenteditable="true" aria-label="Message..." id="box" style="width:400px;height:60px;border:1px solid #000"></div>
<script>
document.getElementById('box').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.innerText = '' }
})
</script></body></html>`

const PAGE = `<!doctype html><html><body>
<h1>profile</h1><button aria-label="Message">Message</button>
</body></html>`

const site = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  if (req.url.startsWith('/direct/new')) return res.end(NEW)
  if (req.url.startsWith('/direct/t/')) return res.end(THREAD)
  res.end(PAGE)
}).listen(8121)

// Decides the way the real one is asked to: pick one key out of the options
// it was handed. Deliberately stubborn on the account step, so the loop has
// to notice that its click does nothing and move on to Chat.
function pickKey(goal, options) {
  const entry = (re) => Object.entries(options).find(([, text]) => re.test(text))
  if (/search for a person|box where a new message is typed/.test(goal)) return entry(/^type into/)?.[0]
  if (/Pick the account/.test(goal)) {
    const handle = (goal.match(/@([\w.]+)/) ?? [])[1] ?? ''
    return (entry(new RegExp('click "' + handle.replace(/\./g, '\\.') + '"')) ?? entry(/click "Chat"/))?.[0]
  }
  return entry(/click "Message"/)?.[0]
}

let unsureOnce = true
let decisionCalls = 0
let chatCalls = 0
const model = http.createServer((req, res) => {
  let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
    const payload = JSON.parse(b)
    res.setHeader('content-type','application/json')

    // The decisions door: a state, one typed question, one named answer back.
    if (req.url.includes('/alpha/decisions')) {
      decisionCalls++
      // One model that is simply down, to prove the fallback is reached.
      if (payload.model === 'broken/model') {
        res.statusCode = 502
        return res.end(JSON.stringify({ error: { message: 'model is down', code: 502 } }))
      }
      assert.equal(payload.questions.next.type, 'choice')
      const key = pickKey(payload.state.goal, payload.questions.next.criteria) ?? 'stuck'

      // On the message box, answer the way Jev did on a real lead: "nothing
      // here", barely chosen, with the right option scored underneath.
      if (unsureOnce && /box where a new message is typed/.test(payload.state.goal)) {
        unsureOnce = false
        return res.end(JSON.stringify({
          answers: { next: { choice: 'stuck', confidence: 0.19, probabilities: { stuck: 0.19, [key]: 0.31 } } },
          usage: { prompt_tokens: 300, completion_tokens: 0 },
        }))
      }

      return res.end(JSON.stringify({
        answers: { next: { choice: key, confidence: 0.91, probabilities: { [key]: 0.91 } } },
        usage: { prompt_tokens: 300, completion_tokens: 0 },
      }))
    }

    // The chat door, where the fallback answers.
    chatCalls++
    const prompt = payload.messages.map(m=>m.content).join('\n')
    const goal = (prompt.match(/Goal: (.*)/) ?? [])[1] ?? ''
    const options = {}
    for (const l of prompt.split('\n')) {
      const m = l.match(/^(\d+)\) \[(type|click)\] (.*)$/)
      if (m) options[m[1]] = m[2] === 'type' ? 'type into the box named "' + m[3] + '"' : 'click "' + m[3] + '"'
    }
    const key = pickKey(goal, options)
    const answer = key
      ? { action: /^type into/.test(options[key]) ? 'type' : 'click', i: Number(key), why: 'x' }
      : { action: 'stuck', why: 'nothing on this page' }
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
  openrouter: { apiKey:'k', baseUrl:'http://127.0.0.1:8122', minConfidence:0.35,
    decide:{model:'typesafe/jev-1.13',endpoint:'decisions',priceIn:0.042,priceOut:0,fallbacks:[{model:'deepseek/deepseek-v4-flash-0731',endpoint:'chat',priceIn:0.04,priceOut:0.64}]}, vision:{enabled:false,model:'deepseek/deepseek-v4-flash-vision-exp',priceIn:0.22,priceOut:0.66} },
  brandmatch: { apiBase:'http://127.0.0.1:8123', apiKey:'bm-key', status:'new', savedOnly:false, markAs:'contacted' },
  instagram: { account:'test.hq', baseUrl:'http://127.0.0.1:8121', openWith:'direct', entry:'paste', dailyCap:50, betweenDms:[1,1], afterProfile:[0,0], typing:[1,2] },
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
  // A draft only counts from inside a conversation. If the agent had written
  // into the search box, whose name mentions messaging, this is where it shows.
  assert.equal(dry.drafted, 2, `both usable leads must be drafted, got ${JSON.stringify(dry)}`)

  // Drafted is not enough: it has to have been drafted in a conversation.
  // The search box on the new-message screen is named for messaging, so a
  // loose test for "somewhere you can type" writes the message into it and
  // still reports a draft. The address is what cannot be faked by a label.
  const steps = readFileSync(join(logDir, `steps-${new Date().toLocaleDateString('en-CA')}.jsonl`), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const writing = steps.filter((x) => /box where a new message is typed/.test(x.goal))
  assert.ok(writing.length > 0, 'the run must have looked for a message box')
  for (const step of writing) {
    assert.match(step.url, /\/direct\/t\//, `the message box was looked for at ${step.url}, not in a conversation`)
  }
  assert.equal(unsureOnce, false, 'the low-confidence shrug must have been served')
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

  // 5. a profile nobody logged in stops before the browser opens
  const noProfile = { ...s, instagram: { ...s.instagram, account: 'never.logged.in' } }
  const stopped = await run(noProfile, log, templates, { send: false, approve: false })
  assert.equal(stopped.attempted, 0, 'a fresh profile must send the user to the login command')

  // The message must be the only thing in the box. The handle typed into the
  // search on the way here must not have ridden along into the conversation.
  const firstDm = JSON.parse(readFileSync(join(logDir, `dms-${new Date().toLocaleDateString('en-CA')}.jsonl`), 'utf8').split('\n')[0])
  assert.equal(firstDm.message, 'Hey Ana, 24.3k strong. Two briefs fit you.')
  assert.ok(!firstDm.message.includes('ana.lifts'), 'the searched handle must not end up in the message')

  // 6. a primary that is down falls through to the model behind it, at the
  //    other door. The two sit at different endpoints, so this cannot be left
  //    to OpenRouter's own routing.
  const before = { d: decisionCalls, c: chatCalls }
  const broken = {
    ...s,
    openrouter: {
      ...s.openrouter,
      decide: {
        model: 'broken/model',
        endpoint: 'decisions',
        priceIn: 0,
        priceOut: 0,
        fallbacks: [{ model: 'deepseek/deepseek-v4-flash-0731', endpoint: 'chat', priceIn: 0.04, priceOut: 0.64 }],
      },
    },
    instagram: { ...s.instagram, account: 'fallback.hq' },
  }
  mkdirSync(join(sessionRoot, 'fallback.hq'), { recursive: true })
  const fell = await run(broken, log, templates, { send: false, approve: false, limit: 1 })
  assert.equal(fell.drafted, 1, `the fallback must carry the lead, got ${JSON.stringify(fell)}`)
  assert.ok(decisionCalls > before.d, 'the broken primary must still be tried')
  assert.ok(chatCalls > before.c, 'the fallback must answer at the chat door')
  console.log(`fallback: ${decisionCalls - before.d} decisions attempts, ${chatCalls - before.c} chat answers`)

  assert.ok(decisionCalls > 0, 'the decisions door must be the one used')
  assert.equal(before.c, 0, 'the chat fallback must stay unused while decisions answers')
  console.log(`decisions calls ${decisionCalls}, chat calls ${chatCalls}`)

  console.log('day totals:', JSON.stringify(log.day()))
  console.log('full run passed')
  rmSync(sessionRoot, { recursive: true, force: true })
} finally {
  site.close(); model.close(); api.close()
}
