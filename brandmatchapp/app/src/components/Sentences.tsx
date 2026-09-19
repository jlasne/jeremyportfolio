import type { Criterion } from '../types'

// The client's own description of who they want, one sentence a line.
//
// Each line is something the model can answer about a profile: true, partly,
// or false. Between one and twelve, because under one nothing is scored and
// over twelve nothing is read. The draft they start from came from their
// brief; every word of it is theirs to change.

export const SENTENCES_MAX = 12

function newId(): string {
  return `c_${Math.random().toString(36).slice(2, 8)}`
}

export function Sentences({ list, onChange }: { list: Criterion[]; onChange: (next: Criterion[]) => void }) {
  return (
    <div className="sentences">
      <ol className="sentence-list">
        {list.map((c, i) => (
          <li key={c.id}>
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
              className="btn small quiet drop"
              aria-label={`Remove sentence ${i + 1}`}
              title="Remove"
              disabled={list.length <= 1}
              onClick={() => onChange(list.filter((x) => x.id !== c.id))}
            >
              ✕
            </button>
          </li>
        ))}
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
      </div>
    </div>
  )
}
