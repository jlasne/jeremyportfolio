import { createInterface } from 'node:readline/promises'
import type { Settings } from '../config/settings.js'
import { Browser } from '../core/browser.js'
import { pursue, type Outcome } from '../core/loop.js'
import { addUsage, ZERO, round, type DmRecord, type Log } from '../core/log.js'
import { DailyCap } from './limiter.js'
import { Leads, type Target } from './leads.js'
import { pause } from './pacing.js'
import { sessionFor } from './session.js'
import { render, rotate, type Template } from './template.js'

// One account, one pass down the list.
//
// Three things end a run early: the daily cap, an empty list, or a step that
// fails twice in a row. The last one matters most. Instagram answers a run it
// dislikes by changing the page, so two dead leads in a row mean the page is
// not what we think it is, and carrying on just burns the account.

const GOAL_OPEN = 'Open the direct message conversation with the person whose profile this is.'
const GOAL_SEARCH = 'Find the box where you search for a person to send a new message to.'
const GOAL_BOX = 'Find the box where a new message is typed.'
const goalStart = (handle: string) => `Pick the account @${handle} from the results and open the chat with them.`

/**
 * The result that is this exact account, by reading rather than by asking.
 *
 * A search for sylv.putz returns sylvi.putz, sylviputz, sylvia.putz,
 * sylvie.putz and four more. Asked to choose, the model spread itself over
 * the lot at 28% and took the search box. The handle is right there in the
 * row and it is exact, so this is a thing to read, not a judgement to make.
 *
 * Only a single match counts. Two rows carrying the same handle is not a
 * case for guessing, and the model gets it instead.
 */
export function exactMatch(handle: string) {
  const needle = handle.toLowerCase()
  return (state: { candidates: { i: number; name: string; editable: boolean }[] }): number | null => {
    const hits = state.candidates.filter((c) => !c.editable && holds(c.name.toLowerCase(), needle))
    return hits.length === 1 ? hits[0]!.i : null
  }
}

/** The handle as a whole word, so sylv.putz never matches inside sylv.putz2. */
function holds(haystack: string, needle: string): boolean {
  const edge = (ch: string | undefined) => ch === undefined || !/[a-z0-9._]/.test(ch)
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    if (edge(haystack[at - 1]) && edge(haystack[at + needle.length])) return true
    at = haystack.indexOf(needle, at + 1)
  }
  return false
}

/**
 * The conversation is open when the thread has its own address. Nothing else
 * counts.
 *
 * Accepting "a box whose name mentions messaging" as proof cost a whole run:
 * the new-message search box qualifies, so the agent decided it had arrived
 * the moment it got there, skipped opening the chat, and wrote the message
 * into the search bar. It reported that as a draft. A false success is worse
 * than a failure, so the test is now the one thing that cannot be faked by a
 * label.
 */
const inThread = (page: { url: string }) => page.url.includes('/direct/t/')

export type RunOptions = {
  /** False writes the message and stops. True presses the key. */
  send: boolean
  /** Ask in the terminal before each send. Only read when send is true. */
  approve: boolean
  /** Cap for this run, on top of the daily one. */
  limit?: number
}

export type RunSummary = {
  account: string
  attempted: number
  drafted: number
  sent: number
  skipped: number
  failed: number
  usd: number
  remainingToday: number
}

export async function run(s: Settings, log: Log, templates: Template[], opts: RunOptions): Promise<RunSummary> {
  const account = s.instagram.account
  const cap = new DailyCap(s.paths.logs, s.instagram.dailyCap)
  const room = cap.remaining(account)

  const summary: RunSummary = { account, attempted: 0, drafted: 0, sent: 0, skipped: 0, failed: 0, usd: 0, remainingToday: room }
  if (room === 0) {
    console.log(`${account}: ${s.instagram.dailyCap} messages already today. Nothing to do until tomorrow.`)
    return summary
  }

  const want = Math.min(room, opts.limit ?? room)
  const targets = await new Leads(s).next(want)
  if (targets.length === 0) {
    console.log(`${account}: no lead matches ${s.brandmatch.status}${s.brandmatch.savedOnly ? ' and saved' : ''}.`)
    return summary
  }

  // A profile nobody has logged in yet cannot send anything, and opening a
  // browser to say so only costs a launch. The login command exists for this.
  const session = sessionFor(s.browser.sessionRoot, account)
  if (session.fresh) {
    console.log(`${account}: no browser profile yet. Run: node dist/cli.js login --account ${account}`)
    return summary
  }

  const browser = await Browser.open(s, session.dir)
  const ask = opts.approve && opts.send ? createInterface({ input: process.stdin, output: process.stdout }) : null
  let consecutiveFailures = 0

  try {
    for (const [index, target] of targets.entries()) {
      if (cap.remaining(account) === 0) {
        console.log(`${account}: daily cap reached mid run. Stopping.`)
        break
      }

      summary.attempted++
      const record = await one(browser, s, log, target, rotate(templates, index), { ...opts, ask })
      log.dm(record)
      summary.usd = round(summary.usd + record.usd)

      if (record.outcome === 'sent') { summary.sent++; cap.record(account) }
      if (record.outcome === 'drafted') summary.drafted++
      if (record.outcome === 'skipped') summary.skipped++
      if (record.outcome === 'failed') summary.failed++

      console.log(line(record))

      consecutiveFailures = record.outcome === 'failed' ? consecutiveFailures + 1 : 0
      if (consecutiveFailures >= 2) {
        console.log('Two failures in a row. The page is not what the agent expects. Stopping.')
        break
      }

      const last = index === targets.length - 1
      if (!last) {
        const waited = await pause(s.instagram.betweenDms)
        console.log(`  waited ${waited}s`)
      }
    }
  } finally {
    ask?.close()
    await browser.close()
  }

  summary.remainingToday = cap.remaining(account)
  return summary
}

type OneOptions = RunOptions & { ask: ReturnType<typeof createInterface> | null }

async function one(
  browser: Browser,
  s: Settings,
  log: Log,
  target: Target,
  template: Template,
  opts: OneOptions,
): Promise<DmRecord> {
  const started = Date.now()
  const base = {
    at: new Date().toISOString(),
    account: s.instagram.account,
    handle: target.handle,
    leadId: target.leadId,
    steps: 0,
    decideCalls: 0,
    visionCalls: 0,
  }
  const close = (extra: Partial<DmRecord> & { outcome: DmRecord['outcome'] }, usage = ZERO, steps = 0, calls = { d: 0, v: 0 }): DmRecord => {
    const browserSeconds = Math.round((Date.now() - started) / 1000)
    return {
      ...base,
      ...extra,
      steps,
      decideCalls: calls.d,
      visionCalls: calls.v,
      browserSeconds,
      usd: round(usage.usd + log.browserCost(browserSeconds)),
    }
  }

  const { message, missing } = render(template, target)
  if (missing.length > 0) {
    return close({ outcome: 'skipped', reason: `template needs ${missing.join(', ')}` })
  }

  try {
    const open =
      s.instagram.openWith === 'profile'
        ? await viaProfile(browser, s, log, target.handle)
        : await viaInbox(browser, s, log, target.handle)

    let usage = open.usage
    let steps = open.steps
    let calls = { d: open.decideCalls, v: open.visionCalls }
    if (!open.reached) {
      return close({ outcome: 'failed', reason: `could not open the conversation: ${open.why}`, message }, usage, steps, calls)
    }

    await browser.settle(1500)

    // Never write into a page that is not a conversation. The one time this
    // was assumed rather than checked, the message went into a search box.
    const landed = await browser.state()
    if (!inThread(landed)) {
      return close({ outcome: 'failed', reason: `not in a conversation, at ${landed.url}`, message }, usage, steps, calls)
    }

    const write = await pursue(browser, GOAL_BOX, s, log, { text: message })
    usage = addUsage(usage, write.usage)
    steps += write.steps
    calls = { d: calls.d + write.decideCalls, v: calls.v + write.visionCalls }
    if (!write.reached || write.lastBox === null) {
      return close({ outcome: 'failed', reason: `could not write the message: ${write.why}`, message }, usage, steps, calls)
    }

    // And read it back. A draft this run never checked is a draft that may be
    // sitting in the wrong box, which is exactly how this went wrong before.
    const inBox = (await browser.textOf(write.lastBox)).trim()
    if (!inBox.includes(message.slice(0, 30))) {
      return close(
        { outcome: 'failed', reason: `the message is not in the box: it holds "${inBox.slice(0, 60)}"`, message },
        usage,
        steps,
        calls,
      )
    }

    // The default stops here. The message sits in the box, unsent, for a human
    // to read and send. Sending needs a flag, every time.
    if (!opts.send) {
      return close({ outcome: 'drafted', message }, usage, steps, calls)
    }

    if (opts.ask) {
      const answer = await opts.ask.question(`\nSend to @${target.handle}?\n  "${message}"\n[y/N] `)
      if (answer.trim().toLowerCase() !== 'y') {
        return close({ outcome: 'skipped', reason: 'not approved', message }, usage, steps, calls)
      }
    }

    await browser.pressEnter()
    await browser.settle(2000)

    // An empty box is the only proof the run has that the message left.
    const left = (await browser.textOf(write.lastBox)).trim()
    if (left.length > 0) {
      return close({ outcome: 'failed', reason: 'the box still holds the message', message }, usage, steps, calls)
    }

    await new Leads(s).markContacted(target.leadId, message)
    return close({ outcome: 'sent', message }, usage, steps, calls)
  } catch (err) {
    return close({ outcome: 'failed', reason: String(err), message })
  }
}

/**
 * Start at the new-message screen and search for the handle.
 *
 * The profile route pressed a Message button that, on a real account, changed
 * neither the address nor a single thing on the page. The inbox asks for a
 * name and hands back a conversation, which is a far shorter path with one
 * fewer thing to go wrong.
 */
async function viaInbox(browser: Browser, s: Settings, log: Log, handle: string): Promise<Outcome> {
  await browser.goto(`${s.instagram.baseUrl}/direct/new/`)
  await browser.settle(2500)
  await pause(s.instagram.afterProfile)

  const search = await pursue(browser, GOAL_SEARCH, s, log, { text: handle })
  if (!search.reached) return { ...search, why: `no search box: ${search.why}` }

  // The results need a moment, and they arrive without a page change.
  await browser.settle(2500)

  const start = await pursue(browser, goalStart(handle), s, log, {
    until: inThread,
    prefer: exactMatch(handle),
  })
  return {
    ...start,
    steps: search.steps + start.steps,
    decideCalls: search.decideCalls + start.decideCalls,
    visionCalls: search.visionCalls + start.visionCalls,
    usage: addUsage(search.usage, start.usage),
  }
}

/** The original route: open the profile, press its Message button. */
async function viaProfile(browser: Browser, s: Settings, log: Log, handle: string): Promise<Outcome> {
  await browser.goto(`${s.instagram.baseUrl}/${handle}/`)
  await browser.settle(1500)
  await pause(s.instagram.afterProfile)
  return await pursue(browser, GOAL_OPEN, s, log, { until: inThread })
}

function line(r: DmRecord): string {
  const head = { sent: 'sent   ', drafted: 'drafted', skipped: 'skipped', failed: 'failed ' }[r.outcome]
  const cost = `$${r.usd.toFixed(4)}`
  const why = r.reason ? ` (${r.reason})` : ''
  return `${head} @${r.handle}  ${r.steps} steps  ${r.decideCalls} calls  ${r.browserSeconds}s  ${cost}${why}`
}
