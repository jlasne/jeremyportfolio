import type { Settings } from '../config/settings.js'
import { round } from './log.js'
import type { Choice, Decision, PageState, Usage } from './types.js'

// The decision model. It sees the goal and a numbered list, and answers with
// one line of JSON.
//
// The question is deliberately a multiple choice, not an open instruction. A
// model that can only return a number from a list it was given cannot invent a
// selector, cannot navigate somewhere nobody asked for, and cannot write the
// message. Those are three whole classes of failure removed by the shape of
// the prompt rather than by a check afterwards.

const SYSTEM = [
  'You drive a web browser one step at a time.',
  'You get a goal and a numbered list of things on the page.',
  'Answer with JSON only: {"action":"click"|"type"|"done"|"stuck","i":<number>,"why":"<8 words>"}.',
  'Use "i" only for click and type. Use "done" when the goal is already reached.',
  'Use "stuck" when nothing in the list can serve the goal.',
  'Never explain outside the JSON.',
].join(' ')

export type CallResult = { decision: Decision | null; usage: Usage; raw: string }

export async function decide(goal: string, state: PageState, s: Settings): Promise<CallResult> {
  const lines = state.candidates.map((c) => `${c.i}) [${c.editable ? 'type' : 'click'}] ${c.name}`).join('\n')
  const user = [
    `Goal: ${goal}`,
    `Page: ${state.title}`,
    `URL: ${state.url}`,
    '',
    lines || '(nothing on this page can be clicked or typed into)',
  ].join('\n')

  const res = await call(s, s.openrouter.decide.model, [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ])

  const usage = price(res, s.openrouter.decide.priceIn, s.openrouter.decide.priceOut)
  const choice = parse(res.text, state)
  return {
    decision: choice ? { ...choice, source: 'text', usage } : null,
    usage,
    raw: res.text,
  }
}

export type Message = {
  role: 'system' | 'user'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export type Raw = { text: string; tokensIn: number; tokensOut: number }

export async function call(s: Settings, model: string, messages: Message[]): Promise<Raw> {
  const res = await fetch(`${s.openrouter.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${s.openrouter.apiKey}`,
      'content-type': 'application/json',
      'x-title': 'brandmatch outreach',
    },
    body: JSON.stringify({ model, messages, max_tokens: 120, temperature: 0 }),
  })

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`)

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return {
    text: body.choices?.[0]?.message?.content ?? '',
    tokensIn: body.usage?.prompt_tokens ?? 0,
    tokensOut: body.usage?.completion_tokens ?? 0,
  }
}

export function price(r: Raw, priceIn: number, priceOut: number): Usage {
  return {
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    usd: round((r.tokensIn / 1e6) * priceIn + (r.tokensOut / 1e6) * priceOut),
  }
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
  if (action === 'done') return { kind: 'done', why }
  if (action === 'stuck') return { kind: 'stuck', why }
  if (action !== 'click' && action !== 'type') return null

  const i = Number(raw.i)
  const found = state.candidates.find((c) => c.i === i)
  if (!found) return null
  // A click on a text box and a type into a link are both the model losing the
  // thread. The list already said which is which.
  if (action === 'type' && !found.editable) return null
  return { kind: action, i, why }
}
