import type { ModelSettings, Settings } from '../config/settings.js'
import { round } from './log.js'
import type { Choice, Decision, PageState, Usage } from './types.js'

// The decision model. It sees the goal and a numbered list, and answers with
// one of the options it was given.
//
// The question is deliberately a multiple choice, not an open instruction. A
// model that can only return one of the options it was handed cannot invent a
// selector, cannot navigate somewhere nobody asked for, and cannot write the
// message. Those are three whole classes of failure removed by the shape of
// the question rather than by a check afterwards.
//
// Two doors lead to a model, and the shape of the question is the same at
// both. A decisions model answers with the option's own name and nothing
// else. A chat model answers with a line of JSON that has to be read, and
// checked against the list it was given.

const ASK = 'Pick the one action that best serves the goal.'
const DONE = 'done'
const STUCK = 'stuck'

const SYSTEM = [
  'You drive a web browser one step at a time.',
  'You get a goal and a numbered list of things on the page.',
  `Answer with JSON only: {"action":"click"|"type"|"${DONE}"|"${STUCK}","i":<number>,"why":"<8 words>"}.`,
  'Use "i" only for click and type. Use "done" when the goal is already reached.',
  'Use "stuck" when nothing in the list can serve the goal.',
  'Never explain outside the JSON.',
].join(' ')

export type CallResult = { decision: Decision | null; usage: Usage; raw: string }

export async function decide(goal: string, state: PageState, s: Settings): Promise<CallResult> {
  const tries = [s.openrouter.decide, ...(s.openrouter.decide.fallbacks ?? [])]
  const failures: string[] = []

  for (const model of tries) {
    try {
      const { choice, usage, raw } = await ask(goal, state, s, model)
      return { decision: choice ? { ...choice, source: 'text', usage } : null, usage, raw }
    } catch (err) {
      // A model that errors is stepped over, not retried. The next one on the
      // list is a different model at a possibly different door, which is the
      // only reason a second attempt is worth anything.
      failures.push(`${model.model}: ${String(err).slice(0, 200)}`)
    }
  }
  throw new Error(failures.join(' | '))
}

async function ask(
  goal: string,
  state: PageState,
  s: Settings,
  model: ModelSettings,
): Promise<{ choice: Choice | null; usage: Usage; raw: string }> {
  return model.endpoint === 'decisions'
    ? await askDecisions(goal, state, s, model)
    : await askChat(goal, state, s, model)
}

// ---------------------------------------------------------------------------
// The decisions door
// ---------------------------------------------------------------------------

/**
 * One question, one typed answer.
 *
 * The options carry their own names, so the pick comes back as a name from
 * the list and there is nothing to parse and nothing to validate: an answer
 * that was not on the list cannot be returned in the first place.
 */
async function askDecisions(goal: string, state: PageState, s: Settings, model: ModelSettings) {
  const criteria: Record<string, string> = {}
  for (const c of state.candidates) {
    criteria[String(c.i)] = c.editable ? `type into the box named "${c.name}"` : `click "${c.name}"`
  }
  criteria[DONE] = 'the goal is already reached on this page'
  criteria[STUCK] = 'nothing on this page can serve the goal'

  const body = await post(s, `${s.openrouter.baseUrl.replace(/\/v1$/, '')}/alpha/decisions`, {
    model: model.model,
    state: { goal, url: state.url, page: state.title },
    questions: { next: { type: 'choice', instructions: `${ASK} Goal: ${goal}`, criteria } },
  })

  const answer = (body as DecisionsBody).answers?.next
  return {
    choice: readAnswer(answer, state, s.openrouter.minConfidence),
    usage: price(usageOf(body), model),
    raw: JSON.stringify(answer ?? body).slice(0, 400),
  }
}

type Answer = {
  choice?: unknown
  value?: unknown
  selected?: unknown
  answer?: unknown
  confidence?: number
  probabilities?: Record<string, number>
}
type DecisionsBody = { answers?: Record<string, Answer> }

/**
 * The chosen option, under whichever name this endpoint gives it.
 *
 * The probabilities are the fallback and the safest reading of the two: the
 * highest one is the pick whatever the field beside it happens to be called.
 */
function pickedFrom(answer: Answer | undefined): string | null {
  if (!answer) return null
  for (const direct of [answer.choice, answer.value, answer.selected, answer.answer]) {
    if (typeof direct === 'string' && direct) return direct
  }
  const p = answer.probabilities
  if (!p) return null
  let best: string | null = null
  for (const [key, weight] of Object.entries(p)) {
    if (best === null || weight > (p[best] ?? -1)) best = key
  }
  return best
}

/**
 * The answer, and what to do when the model is not sure of it.
 *
 * "Nothing here serves the goal" ends a lead, so it is worth believing only
 * when the model means it. Under the threshold the spread underneath decides
 * instead: the best real option it scored beats a word it barely chose.
 */
function readAnswer(answer: Answer | undefined, state: PageState, min: number): Choice | null {
  const picked = pickedFrom(answer)
  const confidence = answer?.confidence

  if ((picked === STUCK || picked === DONE) && confidence !== undefined && confidence < min) {
    const best = bestReal(answer?.probabilities, state)
    if (best) return best
  }
  return asChoice(picked, state, confidence)
}

/** The highest scored option that is an actual thing on the page. */
function bestReal(probabilities: Record<string, number> | undefined, state: PageState): Choice | null {
  if (!probabilities) return null
  let best: { key: string; weight: number } | null = null
  for (const [key, weight] of Object.entries(probabilities)) {
    if (key === STUCK || key === DONE) continue
    if (!state.candidates.some((c) => String(c.i) === key)) continue
    if (!best || weight > best.weight) best = { key, weight }
  }
  if (!best) return null
  const found = state.candidates.find((c) => String(c.i) === best!.key)
  if (!found) return null
  return {
    kind: found.editable ? 'type' : 'click',
    i: found.i,
    why: `unsure, best of the rest at ${Math.round(best.weight * 100)}%`,
  }
}

function asChoice(picked: string | null, state: PageState, confidence?: number): Choice | null {
  if (!picked) return null
  const why = confidence === undefined ? 'chosen' : `confidence ${Math.round(confidence * 100)}%`
  if (picked === DONE) return { kind: 'done', why }
  if (picked === STUCK) return { kind: 'stuck', why }
  const found = state.candidates.find((c) => String(c.i) === picked)
  if (!found) return null
  return { kind: found.editable ? 'type' : 'click', i: found.i, why }
}

// ---------------------------------------------------------------------------
// The chat door
// ---------------------------------------------------------------------------

async function askChat(goal: string, state: PageState, s: Settings, model: ModelSettings) {
  const lines = state.candidates.map((c) => `${c.i}) [${c.editable ? 'type' : 'click'}] ${c.name}`).join('\n')
  const user = [
    `Goal: ${goal}`,
    `Page: ${state.title}`,
    `URL: ${state.url}`,
    '',
    lines || '(nothing on this page can be clicked or typed into)',
  ].join('\n')

  const body = (await post(s, `${s.openrouter.baseUrl}/chat/completions`, {
    model: model.model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
    max_tokens: 120,
    temperature: 0,
  })) as ChatBody

  const text = textOf(body)
  const choice = parse(text, state)
  return {
    choice,
    usage: price(usageOf(body), model),
    // A refused answer takes the whole envelope into the log, so a model that
    // puts its reply somewhere unexpected says so on the first run.
    raw: choice ? text : `${text} || shape: ${JSON.stringify(body.choices?.[0] ?? body).slice(0, 300)}`,
  }
}

type ChatBody = {
  choices?: { message?: { content?: unknown; reasoning?: unknown }; text?: unknown }[]
}

/** The answer, wherever the model put it. */
function textOf(body: ChatBody): string {
  const choice = body.choices?.[0]
  const content = choice?.message?.content ?? choice?.text
  if (typeof content === 'string') return content
  if (content !== undefined && content !== null) return JSON.stringify(content)
  const reasoning = choice?.message?.reasoning
  return typeof reasoning === 'string' ? reasoning : ''
}

/** Reads the answer, and refuses anything that is not an option we offered. */
export function parse(text: string, state: PageState): Choice | null {
  const body = text.replace(/```(?:json)?/g, '').trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null

  let raw: { action?: unknown; i?: unknown; why?: unknown }
  try {
    raw = JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }

  const why = typeof raw.why === 'string' ? raw.why.slice(0, 120) : ''
  const action = String(raw.action ?? '')
  if (action === DONE) return { kind: 'done', why }
  if (action === STUCK) return { kind: 'stuck', why }
  if (action !== 'click' && action !== 'type') return null

  const i = Number(raw.i)
  const found = state.candidates.find((c) => c.i === i)
  if (!found) return null
  // A click on a text box and a type into a link are both the model losing the
  // thread. The list already said which is which.
  if (action === 'type' && !found.editable) return null
  return { kind: action, i, why }
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type Message = {
  role: 'system' | 'user'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export async function post(s: Settings, url: string, payload: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${s.openrouter.apiKey}`,
      'content-type': 'application/json',
      'x-title': 'brandmatch outreach',
    },
    body: JSON.stringify(payload),
  })
  const body: unknown = await res.json().catch(() => null)
  const message = (body as { error?: { message?: string } } | null)?.error?.message
  if (!res.ok || message) throw new Error(`OpenRouter ${res.status}: ${message ?? JSON.stringify(body).slice(0, 300)}`)
  return body
}

type Counted = { usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number } }

export function usageOf(body: unknown): { tokensIn: number; tokensOut: number } {
  const u = (body as Counted).usage
  return {
    tokensIn: u?.prompt_tokens ?? u?.input_tokens ?? 0,
    tokensOut: u?.completion_tokens ?? u?.output_tokens ?? 0,
  }
}

export function price(t: { tokensIn: number; tokensOut: number }, model: { priceIn: number; priceOut: number }): Usage {
  return {
    tokensIn: t.tokensIn,
    tokensOut: t.tokensOut,
    usd: round((t.tokensIn / 1e6) * model.priceIn + (t.tokensOut / 1e6) * model.priceOut),
  }
}

/** The chat door, for the vision fallback, which only ever sends a picture. */
export async function chat(s: Settings, model: ModelSettings, messages: Message[]): Promise<{ text: string; usage: Usage }> {
  const body = (await post(s, `${s.openrouter.baseUrl}/chat/completions`, {
    model: model.model,
    messages,
    max_tokens: 120,
    temperature: 0,
  })) as ChatBody
  return { text: textOf(body), usage: price(usageOf(body), model) }
}
