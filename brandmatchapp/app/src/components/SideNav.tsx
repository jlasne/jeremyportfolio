import { getDashboard, getSettings } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import type { Route } from '../lib/router'

const Mark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#1A1A17" />
    <path d="M16 5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L16 21.6l-6.7 3.9 1.7-7.6-5.8-5.1 7.7-.7z" fill="#C8860D" />
  </svg>
)

const ITEMS: { href: string; label: string; name: Route['name'] }[] = [
  { href: '#/contacts', label: 'Contacts', name: 'contacts' },
  { href: '#/agents', label: 'Agents', name: 'agents' },
]

export function SideNav({ route }: { route: Route }) {
  useStore()
  const d = getDashboard()
  return (
    <nav className="sidenav" aria-label="Main">
      <a className="brand" href="#/contacts">
        <Mark />
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
              </a>
            </li>
          )
        })}
      </ul>
      <p className="sidenav-foot">Next batch {nextBatchLabel(getSettings().timezone)}</p>
    </nav>
  )
}
