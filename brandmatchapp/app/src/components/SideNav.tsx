import { useEffect, useState } from 'react'
import { deliveredToday } from '../data'
import { useStore } from '../data/hooks'
import { api, hasKey, isDemo } from '../lib/api'
import type { Route } from '../lib/router'
import { Help } from './Help'
import { Logo } from './Logo'

// Two groups, and the gap between them is the point.
//
// The top five are the work, in the order it is done: see the morning, run the
// campaigns, work the list, wire your own AI to it, and one day let us do the
// writing. The bottom two are about the tool rather than the work, so they sit
// at the foot where nobody looks for them by accident.
//
// The month's balance used to sit down there. It was a number with nothing to
// do: it appears on the account page, where it is acted on.
//
// The rail collapses to its icons and the choice is remembered in this browser.
// On a narrow screen it starts collapsed and every label is a tooltip.

interface Item { href: string; label: string; name: Route['name']; soon?: boolean }

// The three numbered ones are a sequence: you write a campaign, it brings
// leads, and your own AI works them. Numbering them says the order out loud
// to somebody opening the product for the first time.
const ITEMS: Item[] = [
  { href: '#/app', label: 'Dashboard', name: 'dashboard' },
  { href: '#/campaigns', label: '1. Campaigns', name: 'campaigns' },
  { href: '#/leads', label: '2. Leads', name: 'leads' },
  { href: '#/ai', label: '3. AI Connect', name: 'ai' },
  { href: '#/outreach', label: 'Outreach', name: 'outreach', soon: true },
]

const FOOT: Item[] = [
  { href: '#/account', label: 'Account', name: 'account' },
]

const SHUT = 'brandmatch.nav'

function Glyph({ name }: { name: string }) {
  const common = {
    width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, 'aria-hidden': true,
  }
  if (name === 'dashboard') {
    return <svg {...common}><path d="M2.5 10.5 6 6.5l3 2.5 4.5-5.5" /><path d="M2.5 13.5h11" /></svg>
  }
  if (name === 'help') {
    return <svg {...common}><circle cx="8" cy="8" r="5.5" /><path d="M6.6 6.4a1.4 1.4 0 1 1 1.9 1.3v1" /><path d="M8.5 11h-.01" /></svg>
  }
  if (name === 'ai') {
    return <svg {...common}><path d="M5.5 5.5 2.5 8l3 2.5" /><path d="M10.5 5.5 13.5 8l-3 2.5" /><path d="M9 3.5 7 12.5" /></svg>
  }
  if (name === 'leads') {
    return <svg {...common}><path d="M2 4h12M2 8h12M2 12h7" /></svg>
  }
  if (name === 'campaigns') {
    return <svg {...common}><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.5" /></svg>
  }
  if (name === 'outreach') {
    return <svg {...common}><path d="M2.5 8h9" /><path d="M8.5 4.5 12 8l-3.5 3.5" /></svg>
  }
  if (name === 'account') {
    return <svg {...common}><path d="M2.5 5h11M2.5 11h11" /><circle cx="6" cy="5" r="1.6" /><circle cx="10.5" cy="11" r="1.6" /></svg>
  }
  return <svg {...common}><path d="M2.5 12a5.5 5.5 0 1 1 11 0" /><path d="M8 12 11 7" /></svg>
}

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
    // The demo is a client's view, and a client has no admin entry.
    if (!hasKey() || isDemo()) return
    api.me().then((m) => setOwner(m.role === 'owner')).catch(() => setOwner(false))
  }, [])
  return owner
}

export function SideNav({ route }: { route: Route }) {
  useStore()
  const owner = useOwner()
  const [shut, setShut] = useCollapsed()
  const [helping, setHelping] = useState(false)
  const today = deliveredToday()
  const foot = owner ? [{ href: '#/admin', label: 'Admin', name: 'admin' as const }, ...FOOT] : FOOT

  useEffect(() => {
    document.body.classList.toggle('nav-shut', shut)
    return () => document.body.classList.remove('nav-shut')
  }, [shut])

  const link = (item: Item) => {
    const on =
      route.name === item.name ||
      (item.name === 'campaigns' && (route.name === 'campaign' || route.name === 'newCampaign'))
    const count = item.name === 'leads' && today ? today : null
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
          {item.soon && !count ? <span className="soon">soon</span> : null}
        </a>
      </li>
    )
  }

  return (
    <nav className={`sidenav${shut ? ' shut' : ''}`} aria-label="Main">
      <div className="sidenav-top">
        <a className="brand" href="#/app" aria-label="brandmatch, back to the dashboard">
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

      <ul>{ITEMS.map(link)}</ul>

      <ul className="nav-foot">
        <li>
          <button
            type="button"
            className="nav-button"
            title={shut ? 'Help Center' : undefined}
            onClick={() => setHelping(true)}
          >
            <i className="nav-glyph"><Glyph name="help" /></i>
            <span className="nav-label">Help Center</span>
          </button>
        </li>
        {foot.map(link)}
      </ul>

      {helping && <Help onClose={() => setHelping(false)} />}
    </nav>
  )
}
