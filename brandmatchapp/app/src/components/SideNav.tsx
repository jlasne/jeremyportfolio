import { useEffect, useState } from 'react'
import { getDashboard, getSettings } from '../data'
import { useStore } from '../data/hooks'
import { api, isLive } from '../lib/api'
import { nextBatchLabel } from '../lib/format'
import type { Route } from '../lib/router'
import { Logo } from './Logo'

// The mark, four places to go, and when the next batch lands. Campaigns and
// their agents live on their own page, so nothing nests here.
//
// The rail collapses to its icons, and the choice is remembered in this
// browser. On a narrow screen it starts collapsed and every label is a tooltip.

const ITEMS: { href: string; label: string; name: Route['name'] }[] = [
  { href: '#/contacts', label: 'Contacts', name: 'contacts' },
  { href: '#/campaign', label: 'Campaigns', name: 'campaign' },
  { href: '#/connect', label: 'API', name: 'connect' },
  { href: '#/settings', label: 'Settings', name: 'settings' },
]

const SHUT = 'brandmatch.nav'

/** One mark per place, drawn so the rail still reads when it is down to them. */
function Glyph({ name }: { name: string }) {
  const common = {
    width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, 'aria-hidden': true,
  }
  if (name === 'contacts') {
    return (
      <svg {...common}>
        <path d="M2 4h12M2 8h12M2 12h7" />
      </svg>
    )
  }
  if (name === 'campaign') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.5" />
      </svg>
    )
  }
  if (name === 'connect') {
    return (
      <svg {...common}>
        <path d="M6 3 2.5 8 6 13M10 3l3.5 5-3.5 5" />
      </svg>
    )
  }
  if (name === 'settings') {
    return (
      <svg {...common}>
        <path d="M2.5 5h11M2.5 11h11" /><circle cx="6" cy="5" r="1.6" /><circle cx="10.5" cy="11" r="1.6" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M2.5 12a5.5 5.5 0 1 1 11 0" /><path d="M8 12 11 7" />
    </svg>
  )
}

/** Collapsed or open, remembered here. Narrow screens start collapsed. */
function useCollapsed(): [boolean, (v: boolean) => void] {
  const [shut, setShut] = useState(() => {
    try {
      const kept = window.localStorage.getItem(SHUT)
      if (kept !== null) return kept === '1'
      return window.matchMedia('(max-width: 1100px)').matches
    } catch {
      return false
    }
  })
  const set = (v: boolean) => {
    setShut(v)
    try { window.localStorage.setItem(SHUT, v ? '1' : '0') } catch { /* storage off */ }
  }
  return [shut, set]
}

/** Admin shows to the owner and to nobody else. Read once per load. */
function useOwner(): boolean {
  const [owner, setOwner] = useState(false)
  useEffect(() => {
    if (!isLive()) return
    api.me().then((m) => setOwner(m.role === 'owner')).catch(() => setOwner(false))
  }, [])
  return owner
}

export function SideNav({ route }: { route: Route }) {
  useStore()
  const d = getDashboard()
  const owner = useOwner()
  const [shut, setShut] = useCollapsed()
  const items = owner ? [...ITEMS, { href: '#/admin', label: 'Admin', name: 'admin' as const }] : ITEMS

  useEffect(() => {
    document.body.classList.toggle('nav-shut', shut)
    return () => document.body.classList.remove('nav-shut')
  }, [shut])

  return (
    <nav className={`sidenav${shut ? ' shut' : ''}`} aria-label="Main">
      <div className="sidenav-top">
        <a className="brand" href="#/contacts" aria-label="brandmatch, back to contacts">
          <Logo size={26} />
        </a>
        <button
          type="button"
          className="nav-toggle"
          onClick={() => setShut(!shut)}
          aria-expanded={!shut}
          aria-label={shut ? 'Open the menu' : 'Close the menu'}
          title={shut ? 'Open the menu' : 'Close the menu'}
        >
          <i aria-hidden="true" />
        </button>
      </div>
      <ul>
        {items.map((item) => {
          const on = route.name === item.name
          const count = item.name === 'contacts' && d.today ? d.today : null
          return (
            <li key={item.href}>
              <a
                href={item.href}
                className={on ? 'on' : undefined}
                aria-current={on ? 'page' : undefined}
                title={shut ? item.label : undefined}
              >
                <i className="nav-glyph"><Glyph name={item.name} /></i>
                <span className="nav-label">{item.label}</span>
                {count ? <span className="pill num">{count}</span> : null}
              </a>
            </li>
          )
        })}
      </ul>
      <p className="sidenav-foot">
        <span className="nav-label">Next batch {nextBatchLabel(getSettings().timezone)}</span>
      </p>
    </nav>
  )
}
