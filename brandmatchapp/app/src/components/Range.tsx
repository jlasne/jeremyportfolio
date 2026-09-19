// A range with two ends, on one track.
//
// Two native sliders laid over each other. Each one only answers to its own
// thumb, so the track reads as one control and the client drags either end.
// Followers span three orders of magnitude, so that one runs on a log scale:
// 5k to 50k takes as much track as 50k to 500k, which is how people think.

const STEPS = 1000

interface Props {
  label: string
  min: number
  max: number
  value: [number, number]
  scale?: 'log' | 'linear'
  format: (n: number) => string
  onChange: (next: [number, number]) => void
}

function toPos(v: number, min: number, max: number, log: boolean): number {
  const c = Math.min(max, Math.max(min, v))
  if (!log || min <= 0) return Math.round(((c - min) / (max - min)) * STEPS)
  return Math.round((Math.log(c / min) / Math.log(max / min)) * STEPS)
}

function fromPos(p: number, min: number, max: number, log: boolean): number {
  const t = Math.min(1, Math.max(0, p / STEPS))
  const raw = !log || min <= 0 ? min + t * (max - min) : min * Math.pow(max / min, t)
  // Two significant figures, so a slider never lands on 23,417.
  if (raw < 100) return Math.round(raw)
  const digits = Math.floor(Math.log10(raw)) - 1
  const unit = Math.pow(10, digits)
  return Math.round(raw / unit) * unit
}

export function Range({ label, min, max, value, scale = 'linear', format, onChange }: Props) {
  const log = scale === 'log'
  const lo = toPos(value[0], min, max, log)
  const hi = toPos(value[1], min, max, log)
  const whole = value[0] <= min && value[1] >= max
  return (
    <div className="range">
      <div className="range-head">
        <span>{label}</span>
        <b className="num">{whole ? 'Any' : `${format(value[0])} to ${format(value[1])}`}</b>
      </div>
      <div className="range-track">
        <i style={{ left: `${(lo / STEPS) * 100}%`, right: `${100 - (hi / STEPS) * 100}%` }} />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={lo}
          aria-label={`${label}, from`}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), hi)
            onChange([fromPos(next, min, max, log), value[1]])
          }}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={hi}
          aria-label={`${label}, up to`}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), lo)
            onChange([value[0], fromPos(next, min, max, log)])
          }}
        />
      </div>
    </div>
  )
}
