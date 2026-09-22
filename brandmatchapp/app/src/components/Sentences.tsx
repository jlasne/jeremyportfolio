import type { Criterion } from '../types'

// The client's own description of who they want, one sentence a line.
//
// Each line is something the model can answer about a profile: true, partly,
// or false. Between one and twelve, because under one nothing is scored and
// over twelve nothing is read. The draft they start from came from their
// brief; every word of it is theirs to change.
//
// An empty line stays on screen until the client fills it or removes it. It
// used to be filtered out by the screen above on every change, which meant
// Add a sentence added a line and the same keystroke threw it away.
//
// Any line can be made non negotiable, three at most. A marked line leaves
// the score, because a rule you refuse to compromise on is not a matter of
// degree, and it stops removing anybody: the lead is delivered carrying the
// count of what it missed. There used to be a separate list of deal breaker
// questions, written from a library, where a locked one could refuse a whole
// campaign's target without the client ever being able to switch it off.

export const SENTENCES_MAX = 12

/** How many sentences a client may make non negotiable. */
export const BREAKERS_MAX = 3

function newId(): string {
  return `c_${Math.random().toString(36).slice(2, 8)}`
}

export function Sentences({ list, onChange }: { list: Criterion[]; onChange: (next: Criterion[]) => void }) {
  const marked = list.filter((c) => c.breaker).length
  const full = marked >= BREAKERS_MAX
  return (
    <div className="sentences">
      <ol className="sentence-list">
        {list.map((c, i) => {
          const on = Boolean(c.breaker)
          return (
            <li key={c.id} className={on ? 'breaker' : undefined}>
              <span className="sentence-n num">{i + 1}</span>
              <textarea
                className="textarea sentence"
                rows={1}
                value={c.text}
                placeholder="Something true about the people you want"
                aria-label={`Sentence ${i + 1}`}
                onChange={(e) => onChange(list.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
              />
              <button
                type="button"
                className={`btn small breaker-toggle${on ? ' on' : ''}`}
                aria-pressed={on}
                disabled={!on && (full || !c.text.trim())}
                title={
                  on
                    ? 'Non negotiable. Out of the score, and leads that miss it arrive marked.'
                    : full
                      ? `You already have ${BREAKERS_MAX}. Unmark one to mark this.`
                      : 'Make this non negotiable'
                }
                onClick={() => onChange(list.map((x) => (x.id === c.id ? { ...x, breaker: !on } : x)))}
              >
                {on ? 'Non negotiable' : 'Make it a must'}
              </button>
              <button
                type="button"
                className="btn small quiet drop"
                aria-label={`Remove sentence ${i + 1}`}
                title="Remove"
                disabled={list.length <= 1}
                onClick={() => onChange(list.filter((x) => x.id !== c.id))}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ol>
      <div className="sentence-foot">
        <button
          type="button"
          className="btn small"
          disabled={list.length >= SENTENCES_MAX}
          onClick={() => onChange([...list, { id: newId(), text: '' }])}
        >
          Add a sentence
        </button>
        <span className="faint num">{list.length} of {SENTENCES_MAX}</span>
        <span className="spacer" />
        <span className="faint num">{marked} of {BREAKERS_MAX} non negotiable</span>
      </div>
    </div>
  )
}
