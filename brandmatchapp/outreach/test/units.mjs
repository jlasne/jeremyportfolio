import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render, rotate } from '../dist/instagram/template.js'
import { parse } from '../dist/core/decide.js'
import { DailyCap } from '../dist/instagram/limiter.js'
import { pick } from '../dist/instagram/pacing.js'

const t = { leadId: 'l1', handle: 'ana.lifts', name: 'Ana Ruiz', followers: 24300, bio: '', note: '', tags: [], score: 2.5 }

// templates
const ok = render('Hey {{firstName}}, {{followers}} strong. Two briefs fit you.', t)
assert.equal(ok.message, 'Hey Ana, 24.3k strong. Two briefs fit you.')
assert.deepEqual(ok.missing, [])

const bad = render('Hey {{firstName}}, your {{niche}} posts.', t)
assert.deepEqual(bad.missing, ['niche'])

const noName = render('Hi {{firstName}}', { ...t, name: '' })
assert.equal(noName.message, 'Hi ana')

assert.equal(rotate(['a', 'b'], 0), 'a')
assert.equal(rotate(['a', 'b'], 3), 'b')

// parse
const state = { url: 'u', title: 't', candidates: [
  { i: 0, role: 'button', name: 'Message', editable: false },
  { i: 1, role: 'textbox', name: 'Message...', editable: true },
]}
assert.deepEqual(parse('{"action":"click","i":0,"why":"open dm"}', state), { kind: 'click', i: 0, why: 'open dm' })
assert.deepEqual(parse('```json\n{"action":"type","i":1,"why":"box"}\n```', state), { kind: 'type', i: 1, why: 'box' })
assert.equal(parse('{"action":"type","i":0,"why":"x"}', state), null, 'typing into a button must be refused')
assert.equal(parse('{"action":"click","i":9,"why":"x"}', state), null, 'an index we never offered must be refused')
assert.equal(parse('I think you should click Message', state), null)
assert.equal(parse('{"action":"done","why":"already open"}', state).kind, 'done')
assert.equal(parse('{"action":"stuck","why":"nothing here"}', state).kind, 'stuck')

// cap
const dir = mkdtempSync(join(tmpdir(), 'caps-'))
const cap = new DailyCap(dir, 3)
assert.equal(cap.remaining('a'), 3)
cap.record('a'); cap.record('a')
assert.equal(cap.remaining('a'), 1)
const reloaded = new DailyCap(dir, 3)
assert.equal(reloaded.sentToday('a'), 2, 'the count must survive a restart')
reloaded.record('a')
assert.equal(reloaded.remaining('a'), 0)
reloaded.record('a')
assert.equal(reloaded.remaining('a'), 0, 'remaining never goes below zero')

// pacing
for (let n = 0; n < 200; n++) {
  const v = pick([20, 90])
  assert.ok(v >= 20 && v <= 90)
}
console.log('all assertions passed')
