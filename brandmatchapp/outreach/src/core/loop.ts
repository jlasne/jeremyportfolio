import type { Settings } from '../config/settings.js'
import type { Browser } from './browser.js'
import { decide } from './decide.js'
import { addUsage, ZERO, type Log } from './log.js'
import type { PageState, Step, Usage } from './types.js'
import { fallback } from './vision.js'

// One goal, up to a handful of steps, and a stop in every direction.
//
// The loop ends on done, on stuck, on a broken step, or on the step ceiling.
// Nothing here retries forever, because a run that cannot end is a run that
// keeps typing into the wrong box at three in the morning.

export type Outcome = {
  reached: boolean
  why: string
  steps: number
  decideCalls: number
  visionCalls: number
  usage: Usage
  /** The text box the model last chose, so the caller can type into it. */
  lastBox: number | null
}

export type PursueOptions = {
  /** What to type when the model asks for a text box. Absent means typing ends the goal. */
  text?: string
  maxSteps?: number
  /**
   * A goal the page can answer on its own, checked before the model is asked.
   *
   * A composer on screen means the conversation is open, and no model needs to
   * confirm it. Every goal that has such a test costs one call less per step,
   * and stops on a fact instead of on an opinion.
   */
  until?: (state: PageState) => boolean
  /**
   * A rule tried before the model, returning the option to take or null.
   *
   * Where the page already holds the answer, asking is worse than reading:
   * it costs a call and it can be wrong. Picking a person out of a list of
   * near-identical handles is the case that proved it.
   */
  prefer?: (state: PageState) => number | null
}

export async function pursue(
  browser: Browser,
  goal: string,
  s: Settings,
  log: Log,
  opts: PursueOptions = {},
): Promise<Outcome> {
  const max = opts.maxSteps ?? s.limits.maxStepsPerGoal
  let usage = ZERO
  let decideCalls = 0
  let visionCalls = 0
  let lastBox: number | null = null

  // What the page looked like before the last action, and what that action
  // was. An action that leaves both the address and every name on the page
  // untouched did nothing, and asking a model to pick again gets the same
  // answer at the same price. Eight steps of that is how the first real run
  // burned four calls a profile and moved nowhere.
  let before: { signature: string; did: string; label: string } | null = null
  let settled = false

  /**
   * Things on this page that were clicked and did nothing.
   *
   * They are taken off the list rather than argued about. A model shown the
   * same dead button answers the same way at the same price, which is how the
   * first real run spent four calls a profile pressing Message. Removed, it
   * has to find another way in, and only an empty list ends the goal.
   */
  const dead = new Set<string>()

  for (let step = 0; step < max; step++) {
    let full = await browser.state()

    if (before && signatureOf(full) === before.signature) {
      if (!settled) {
        // One more wait first: a page can be slow rather than unmoved.
        settled = true
        await browser.settle(2500)
        full = await browser.state()
      }
      if (signatureOf(full) === before.signature) dead.add(before.label)
    }
    settled = false

    // With nothing to type, a box is not an option. Offered one anyway, a
    // model asked to pick a person out of eight near-identical handles took
    // the search box instead, and a text box the loop had no text for used to
    // count as arriving.
    const usable = full.candidates.filter((c) => !dead.has(c.name) && (opts.text !== undefined || !c.editable))
    const state: PageState = { ...full, candidates: usable }
    const record: Step = {
      at: new Date().toISOString(),
      goal,
      url: state.url,
      candidates: state.candidates.length,
      decision: null,
      saw: state.candidates.map((c) => `${c.i}) [${c.editable ? 'type' : 'click'}] ${c.name}`),
      ...(full.found > full.candidates.length ? { truncated: true } : {}),
      ...(dead.size ? { dropped: [...dead] } : {}),
    }

    // Asked of the whole page, never of the shortened list of options. What is
    // true of the page does not change because an option was withheld.
    if (opts.until?.(full)) {
      record.reachedWithoutModel = true
      log.step(record)
      return { reached: true, why: 'the page already shows the goal', steps: step, decideCalls, visionCalls, usage, lastBox }
    }

    if (state.candidates.length === 0) {
      const why = dead.size
        ? `nothing left to try: ${[...dead].map((d) => `"${d}"`).join(', ')} changed nothing`
        : 'the page offers nothing to click or type into'
      log.step({ at: new Date().toISOString(), goal, url: state.url, candidates: 0, decision: null, error: why })
      return { reached: false, why, steps: step + 1, decideCalls, visionCalls, usage, lastBox }
    }

    const ruled = opts.prefer?.(state)
    if (ruled !== null && ruled !== undefined && state.candidates.some((c) => c.i === ruled)) {
      const label = state.candidates.find((c) => c.i === ruled)?.name ?? `item ${ruled}`
      record.decision = { kind: 'click', i: ruled, why: 'matched by rule', source: 'text', usage: ZERO }
      log.step(record)
      try {
        await browser.click(ruled)
      } catch (err) {
        return { reached: false, why: `action failed: ${err}`, steps: step + 1, decideCalls, visionCalls, usage, lastBox }
      }
      before = { signature: signatureOf(full), did: `clicking "${label}"`, label }
      await browser.settle(2500)
      continue
    }

    let choice
    try {
      const first = await decide(goal, state, s)
      decideCalls++
      usage = addUsage(usage, first.usage)
      choice = first.decision
      record.replied = first.raw.slice(0, 300)

      if (!choice) {
        const second = await fallback(goal, state, () => browser.screenshot(), s)
        if (second.skipped) record.visionSkipped = true
        else {
          visionCalls++
          usage = addUsage(usage, second.usage)
          record.replied = `${record.replied ?? ''} | vision: ${second.raw.slice(0, 300)}`
        }
        choice = second.decision
      }
    } catch (err) {
      record.error = String(err)
      log.step(record)
      return { reached: false, why: `step failed: ${record.error}`, steps: step + 1, decideCalls, visionCalls, usage, lastBox }
    }

    record.decision = choice
    log.step(record)

    if (!choice) {
      return { reached: false, why: 'the page settled nothing', steps: step + 1, decideCalls, visionCalls, usage, lastBox }
    }
    if (choice.kind === 'done') {
      return { reached: true, why: choice.why || 'goal reached', steps: step + 1, decideCalls, visionCalls, usage, lastBox }
    }
    if (choice.kind === 'stuck') {
      return { reached: false, why: choice.why || 'nothing on the page serves the goal', steps: step + 1, decideCalls, visionCalls, usage, lastBox }
    }

    try {
      if (choice.kind === 'click') {
        const label = state.candidates.find((c) => c.i === choice.i)?.name ?? `item ${choice.i}`
        await browser.click(choice.i)
        before = { signature: signatureOf(full), did: `clicking "${label}"`, label }
      } else {
        lastBox = choice.i
        await browser.type(choice.i, opts.text!)
        return { reached: true, why: 'text written', steps: step + 1, decideCalls, visionCalls, usage, lastBox }
      }
    } catch (err) {
      record.error = String(err)
      log.step({ ...record, error: record.error })
      return { reached: false, why: `action failed: ${err}`, steps: step + 1, decideCalls, visionCalls, usage, lastBox }
    }

    await browser.settle(2500)
  }

  return { reached: false, why: `gave up after ${max} steps`, steps: max, decideCalls, visionCalls, usage, lastBox }
}

/** The address plus every name on the page. Two equal ones mean nothing moved. */
function signatureOf(state: PageState): string {
  return `${state.url}||${state.candidates.map((c) => c.name).join('|')}`
}
