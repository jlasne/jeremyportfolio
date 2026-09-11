import { getDashboard, getSettings } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import type { Route } from '../lib/router'
import { Logo } from './Logo'

// The mark, four places to go, and when the next batch lands. Campaigns and
// their agents live on their own page, so nothing nests here.

const ITEMS: { href: string; label: string; name: Route['name'] }[] = [
  { href: '#/contacts', label: 'Contacts', name: 'contacts' },
  { href: '#/campaign', label: 'Campaigns', name: 'campaign' },
  { href: '#/connect', label: 'API', name: 'connect' },
  { href: '#/settings', label: 'Settings', name: 'settings' },
]

export function SideNav({ route }: { route: Route }) {
  useStore()
  const d = getDashboard()
  return (
    <nav className="sidenav" aria-label="Main">
      <a className="brand" href="#/contacts" aria-label="brandmatch, back to contacts">
        <Logo size={26} />
      </a>
      <ul>
        {ITEMS.map((item) => {
          const on = route.name === item.name
          return (
            <li key={item.href}>
              <a href={item.href} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined}>
                <span>{item.label}</span>
                {item.name === 'contacts' && d.today ? <span className="pill num">{d.today}</span> : null}
                {item.name === 'connect' ? <span className="soon">Soon</span> : null}
              </a>
            </li>
          )
        })}
      </ul>
      <p className="sidenav-foot">Next batch {nextBatchLabel(getSettings().timezone)}</p>
    </nav>
  )
}
