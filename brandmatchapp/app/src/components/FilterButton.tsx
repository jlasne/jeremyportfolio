import { useEffect, useRef, useState } from 'react'
import type { Filters } from '../types'
import { getDefaultFilters, getFilters, resetFilters, setFilters } from '../data'
import { useStore } from '../data/hooks'
import { FilterForm } from './FilterForm'

function activeCount(f: Filters): number {
  const d = getDefaultFilters()
  let n = 0
  if (f.followersMin !== d.followersMin || f.followersMax !== d.followersMax) n++
  if (f.engagementMin !== d.engagementMin) n++
  if (f.reelViewsMin !== d.reelViewsMin) n++
  if (f.emailInBio !== d.emailInBio) n++
  if (f.lastPostWithin !== d.lastPostWithin) n++
  if (f.postsPerMonthMin !== d.postsPerMonthMin) n++
  if (f.countries.length) n++
  if (f.languages.length) n++
  return n
}

export function FilterButton() {
  useStore()
  const filters = getFilters()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const changed = activeCount(filters)
  return (
    <div className="popover-wrap" ref={wrap}>
      <button type="button" className={`btn${changed ? ' on' : ''}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        Filters{changed ? ` (${changed} changed)` : ''}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Filters">
          <h2>
            Filters
            <button type="button" className="btn quiet small" onClick={() => resetFilters()}>Reset to defaults</button>
          </h2>
          <FilterForm value={filters} onChange={setFilters} />
          <p className="hint" style={{ marginTop: 12 }}>Filters cut the volume. Stars set the order. The list updates as you type.</p>
        </div>
      )}
    </div>
  )
}
