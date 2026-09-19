import { useEffect, useState } from 'react'
import { deliveredToday, getQuota } from '../data'
import { useStore } from '../data/hooks'
import { api, isLive } from '../lib/api'
import type { Route } from '../lib/router'
import { Logo } from './Logo'

// Four places to go, and the month's balance underneath. The three campaign
// zones live inside a campaign, so nothing nests here.
//
// The rail collapses to its icons and the choice is remembered in this browser.
// On a narrow screen it starts collapsed and every label is a tooltip.

const ITEMS: { href: string; label: string; name: Route['name'] }[] = [
  { href: '#/app', label: 'Dashboard', name: 'dashboard' },
  { href: '#/leads', label: 'Leads', name: 'leads' },
  { href: '#/campaigns', label: 'Campaigns', name: 'campaigns' },
  { href: '#/outreach', label: 'Outreach', name: 'outreach' },
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
    if (!isLive()) return
    api.me().then((m) => setOwner(m.role === 'owner')).catch(() => setOwner(false))
  }, [])
  return owner
}

export function SideNav({ route }: { route: Route }) {
  useStore()
  const owner = useOwner()
  const [shut, setShut] = useCollapsed()
  const today = deliveredToday()
  const quota = getQuota()
  const items = owner ? [...ITEMS, { href: '#/admin', label: 'Admin', name: 'admin' as const }] : ITEMS

  useEffect(() => {
    document.body.classList.toggle('nav-shut', shut)
    return () => document.body.classList.remove('nav-shut')
  }, [shut])

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
      <ul>
        {items.map((item) => {
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
              </a>
            </li>
          )
        })}
      </ul>
      <p className="sidenav-foot">
        <span className="nav-label">
          <b className="num">{quota.remaining}</b> leads left this month
        </span>
      </p>
    </nav>
  )
}
