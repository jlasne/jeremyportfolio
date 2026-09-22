import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render, rotate } from '../dist/instagram/template.js'
import { parse } from '../dist/core/decide.js'
import { DailyCap } from '../dist/instagram/limiter.js'
import { pick } from '../dist/instagram/pacing.js'
import { findChrome } from '../dist/config/settings.js'
import { exactMatch } from '../dist/instagram/outreach.js'

const t = { leadId: 'l1', handle: 'ana.lifts', name: 'Ana Ruiz', followers: 24300, bio: '', note: '', tags: [], score: 2.5 }

// templates
const ok = render('Hey {{firstName}}, {{followers}} strong. Two briefs fit you.', t)
assert.equal(ok.message, 'Hey Ana, 24.3k strong. Two briefs fit you.')
assert.deepEqual(ok.missing, [])

const bad = render('Hey {{firstName}}, your {{niche}} posts.', t)
assert.deepEqual(bad.missing, ['niche'])

const noName = render('Hi {{firstName}}', { ...t, name: '' })
assert.equal(noName.message, 'Hi Ana')

// A lowercase Instagram name still opens the message properly.
assert.equal(render('Hi {{firstName}}', { ...t, name: 'sylvie | online fitness coach' }).message, 'Hi Sylvie')
// One that already carries a capital is left exactly as written.
assert.equal(render('Hi {{firstName}}', { ...t, name: 'McKenzie Westmore' }).message, 'Hi McKenzie')
assert.equal(render('Hi {{firstName}}', { ...t, name: "d'Arcy Flynn" }).message, "Hi d'Arcy")

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
// Picking the right account out of Instagram's own search results. This is
// the exact list it returned for sylv.putz, on which the model spread itself
// across eight near-identical handles at 28% and took the search box.
const rows = [
  'jeremy_lasne', 'Back', 'Search', 'Clear search',
  'sylvie | online fitness coach sylv.putz i like the gym & helping women build the',
  'Sylvi sylvi.putz', 'Sylvi Putz sylviputz', 'Sylvia Putz sylvia.putz Humorvoll',
  'Sylvie Pütz sylvie.putz', 'Sylvia Pütz sylvia.puetz62', 'Sylvia Pütz sylvia2.3',
  'Sylvia Pütz sylvia.puetz', 'Send message',
]
const results = { candidates: rows.map((name, i) => ({ i, name, editable: i === 2 })) }
assert.equal(exactMatch('sylv.putz')(results), 4, 'the one row carrying the exact handle')

// The single-result case, from the same run.
const onlyOne = {
  candidates: ['jeremy_lasne', 'Back', 'Search', 'Clear search',
    'Alassane MAIGA pheno_la_legende Fitness Atthlete - Fitness model Core & Aestheti',
    'Send message'].map((name, i) => ({ i, name, editable: i === 2 })),
}
assert.equal(exactMatch('pheno_la_legende')(onlyOne), 4)

// A handle that is a prefix of another must not match it.
const prefix = { candidates: [{ i: 0, name: 'Someone sylv.putz2', editable: false }] }
assert.equal(exactMatch('sylv.putz')(prefix), null, 'sylv.putz must not match inside sylv.putz2')

// Nothing there, and two of the same, both go back to the model.
assert.equal(exactMatch('nobody.here')(results), null)
const twice = { candidates: [
  { i: 0, name: 'A sylv.putz', editable: false },
  { i: 1, name: 'B sylv.putz', editable: false },
]}
assert.equal(exactMatch('sylv.putz')(twice), null, 'two rows with one handle is not a case for guessing')
console.log('account matching holds on the real search results')

// Chrome detection: either it found one that is really there, or none.
import { existsSync } from 'node:fs'
const chrome = findChrome()
assert.ok(chrome === undefined || existsSync(chrome), 'a detected Chrome must exist on disk')
console.log('chrome detected:', chrome ?? 'none, Playwright will use its own')

// The shipped examples must render. One unknown placeholder in there skips
// every lead that gets that template, silently, in production.
import { readFileSync } from 'node:fs'
for (const shipped of JSON.parse(readFileSync(new URL('../config/templates.example.json', import.meta.url), 'utf8'))) {
  const out = render(shipped, t)
  assert.deepEqual(out.missing, [], `shipped template needs ${out.missing.join(', ')}: ${shipped}`)
}
console.log('shipped templates all render')

console.log('all assertions passed')
