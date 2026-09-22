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

  for (let step = 0; step < max; step++) {
    const state = await browser.state()
    const record: Step = {
      at: new Date().toISOString(),
      goal,
      url: state.url,
      candidates: state.candidates.length,
      decision: null,
      saw: state.candidates.map((c) => `${c.i}) [${c.editable ? 'type' : 'click'}] ${c.name}`),
      ...(state.found > state.candidates.length ? { truncated: true } : {}),
    }

    if (opts.until?.(state)) {
      record.reachedWithoutModel = true
      log.step(record)
      return { reached: true, why: 'the page already shows the goal', steps: step, decideCalls, visionCalls, usage, lastBox }
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
        await browser.click(choice.i)
      } else {
        lastBox = choice.i
        if (opts.text === undefined) {
          return { reached: true, why: 'text box found', steps: step + 1, decideCalls, visionCalls, usage, lastBox }
        }
        await browser.type(choice.i, opts.text)
        return { reached: true, why: 'text written', steps: step + 1, decideCalls, visionCalls, usage, lastBox }
      }
    } catch (err) {
      record.error = String(err)
      log.step({ ...record, error: record.error })
      return { reached: false, why: `action failed: ${err}`, steps: step + 1, decideCalls, visionCalls, usage, lastBox }
    }

    await browser.settle()
  }

  return { reached: false, why: `gave up after ${max} steps`, steps: max, decideCalls, visionCalls, usage, lastBox }
}
