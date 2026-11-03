// A budget bar: one building type's MW split into where it goes, read-only. The last parts are the
// problems: unallocated plant MW (red, hatched, with its penalty) or datacenter MW without power.
// Every part has a legend entry with its icon, words and MW, so colour is never the only signal.

import type { CSSProperties, ReactNode } from 'react'
import { Icon, Mw, fmtMw } from '../kit'
import type { IconName } from '../kit'

export interface BudgetPart {
  key: string
  label: string
  value: number
  /** Fill colour; omit for the neutral idle look. */
  color?: string
  icon?: IconName
  /** 'bad' draws red and hatched (unallocated), 'idle' a soft neutral, 'off' hatched grey (no power). */
  tone?: 'bad' | 'idle' | 'off'
  /** Extra words after the MW in the legend (a penalty, "auto"). */
  note?: ReactNode
}

export function BudgetBar({ label, total, parts }: { label: string; total: number; parts: BudgetPart[] }) {
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0)
  const scale = Math.max(total, sum, 0.0001)
  const shown = parts.filter((p) => p.value > 0.005)
  const text = shown.map((p) => `${p.label} ${fmtMw(p.value)}`).join(', ')
  return (
    <div className="bbar">
      <div className="bbar-track" role="img" aria-label={`${label}: ${fmtMw(total)}. ${text || 'nothing assigned'}.`}>
        {shown.map((p) => (
          <span
            key={p.key}
            className={`bbar-seg${p.tone ? ` bbar-${p.tone}` : ''}`}
            style={{ width: `${(p.value / scale) * 100}%`, '--bb': p.color ?? 'transparent' } as CSSProperties}
            title={`${p.label}: ${fmtMw(p.value)}`}
          >
            {p.icon && p.value / scale > 0.08 ? <Icon name={p.icon} size={16} /> : null}
          </span>
        ))}
      </div>
      <ul className="bbar-legend">
        {parts.map((p) => (
          <li key={p.key} className={`bbar-item${p.tone ? ` bbar-item-${p.tone}` : ''}${p.value > 0.005 ? '' : ' is-zero'}`}>
            <span className={`bbar-key${p.tone ? ` bbar-${p.tone}` : ''}`} style={{ '--bb': p.color ?? 'transparent' } as CSSProperties} aria-hidden="true" />
            <span className="bbar-label">{p.label}</span>
            <Mw value={p.value} tween className="bbar-mw" />
            {p.note ? <span className="bbar-note">{p.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
