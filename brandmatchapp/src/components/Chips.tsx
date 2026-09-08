export function Chips<T extends string>({
  options,
  value,
  onToggle,
  labels,
  small = false,
}: {
  options: T[]
  value: T[]
  onToggle: (v: T) => void
  labels?: Record<string, string>
  small?: boolean
}) {
  return (
    <div className="chips" role="group">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button key={o} type="button" className={`chip${on ? ' on' : ''}${small ? ' small' : ''}`} aria-pressed={on} onClick={() => onToggle(o)}>
            {labels?.[o] ?? o}
          </button>
        )
      })}
    </div>
  )
}
