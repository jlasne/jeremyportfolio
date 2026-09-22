import type { Settings } from '../config/settings.js'
import { call, parse, price } from './decide.js'
import { ZERO } from './log.js'
import type { Decision, PageState, Usage } from './types.js'

// The fallback, and the reason it is switched off.
//
// A screenshot costs more than the whole text step it replaces, so it is worth
// paying for only where text keeps failing. Off, this still reports that it
// would have fired. After a week the log says how many steps a month the
// fallback would buy, and that number decides whether to switch it on.
//
// Once per step, never twice. A model that cannot read the page twice in a row
// will not read it on the third try either.

export type Fallback = { decision: Decision | null; usage: Usage; skipped: boolean }

export async function fallback(
  goal: string,
  state: PageState,
  shot: () => Promise<string>,
  s: Settings,
): Promise<Fallback> {
  if (!s.openrouter.vision.enabled) return { decision: null, usage: ZERO, skipped: true }

  const lines = state.candidates.map((c) => `${c.i}) [${c.editable ? 'type' : 'click'}] ${c.name}`).join('\n')
  const image = await shot()

  const res = await call(s, s.openrouter.vision.model, [
    {
      role: 'system',
      content:
        'You look at a screenshot of a browser and pick one action from a numbered list. ' +
        'Answer with JSON only: {"action":"click"|"type"|"done"|"stuck","i":<number>,"why":"<8 words>"}.',
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Goal: ${goal}\nURL: ${state.url}\n\n${lines || '(the list is empty)'}` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
      ],
    },
  ])

  const usage = price(res, s.openrouter.vision.priceIn, s.openrouter.vision.priceOut)
  const choice = parse(res.text, state)
  return { decision: choice ? { ...choice, source: 'vision', usage } : null, usage, skipped: false }
}
