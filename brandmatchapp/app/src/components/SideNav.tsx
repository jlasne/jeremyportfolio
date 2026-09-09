import { getDashboard, getSettings } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import type { Route } from '../lib/router'
import { Logo } from './Logo'

const ITEMS: { href: string; label: string; name: Route['name'] }[] = [
  { href: '#/contacts', label: 'Contacts', name: 'contacts' },
  { href: '#/agent', label: 'Agents', name: 'agent' },
  { href: '#/connect', label: 'Connect AI', name: 'connect' },
  { href: '#/settings', label: 'Settings', name: 'settings' },
]

export function SideNav({ route }: { route: Route }) {
  useStore()
  const d = getDashboard()
  return (
    <nav className="sidenav" aria-label="Main">
      <a className="brand" href="#/contacts">
        <Logo size={22} />
        brandmatch
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
