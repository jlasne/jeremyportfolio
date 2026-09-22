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

  const res = await call(s, s.openrouter.decide, [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ])

  const usage = price(res, s.openrouter.decide.priceIn, s.openrouter.decide.priceOut)
  const choice = parse(res.text, state)
  return {
    decision: choice ? { ...choice, source: 'text', usage } : null,
    usage,
    // On a refused answer the log gets the whole reply envelope, so a model
    // that puts its choice somewhere unexpected says so on the first run.
    raw: choice ? res.text : `${res.text} || shape: ${res.shape ?? ''}`,
  }
}

export type Message = {
  role: 'system' | 'user'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export type Raw = { text: string; tokensIn: number; tokensOut: number; shape?: string }

type Body = {
  choices?: { message?: { content?: unknown; reasoning?: unknown }; text?: unknown }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  error?: { message?: string }
}

export async function call(s: Settings, cfg: { model: string; fallbacks?: string[] }, messages: Message[]): Promise<Raw> {
  // Jev declares no supported parameters, so the tuning knobs go out on the
  // first try and are dropped if the provider objects to them. One retry,
  // never a loop: a model that rejects a bare request is not going to answer.
  let body = await post(s, cfg, messages, true)
  if (typeof body === 'string') {
    if (!/parameter|unsupported|unrecognized/i.test(body)) throw new Error(`OpenRouter: ${body.slice(0, 300)}`)
    const bare = await post(s, cfg, messages, false)
    if (typeof bare === 'string') throw new Error(`OpenRouter: ${bare.slice(0, 300)}`)
    body = bare
  }

  if (body.error?.message) throw new Error(`OpenRouter: ${body.error.message.slice(0, 300)}`)

  return {
    text: textOf(body),
    tokensIn: body.usage?.prompt_tokens ?? 0,
    tokensOut: body.usage?.completion_tokens ?? 0,
    // Kept for the log so a model whose reply sits somewhere else says where,
    // rather than looking like a model that answered nothing.
    shape: JSON.stringify(body.choices?.[0] ?? body).slice(0, 400),
  }
}

async function post(
  s: Settings,
  cfg: { model: string; fallbacks?: string[] },
  messages: Message[],
  tuned: boolean,
): Promise<Body | string> {
  const res = await fetch(`${s.openrouter.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${s.openrouter.apiKey}`,
      'content-type': 'application/json',
      'x-title': 'brandmatch outreach',
    },
    body: JSON.stringify({
      model: cfg.model,
      // OpenRouter walks this list itself when one errors, so a fallback costs
      // no second request and no waiting.
      ...(cfg.fallbacks?.length ? { models: [cfg.model, ...cfg.fallbacks] } : {}),
      messages,
      ...(tuned ? { max_tokens: 120, temperature: 0 } : {}),
    }),
  })
  if (!res.ok) return `${res.status} ${(await res.text()).slice(0, 300)}`
  return (await res.json()) as Body
}

/**
 * The answer, wherever the model put it.
 *
 * A decision model returns a typed choice rather than prose, so its reply can
 * arrive as an object instead of a string. Both are read the same way here,
 * and anything else is handed on as JSON for the parser to try.
 */
function textOf(body: Body): string {
  const choice = body.choices?.[0]
  const content = choice?.message?.content ?? choice?.text
  if (typeof content === 'string') return content
  if (content !== undefined && content !== null) return JSON.stringify(content)
  const reasoning = choice?.message?.reasoning
  if (typeof reasoning === 'string') return reasoning
  return ''
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
