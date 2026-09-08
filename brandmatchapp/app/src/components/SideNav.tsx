import { getAgents, getDashboard, getGroups, getLists, getSettings } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import type { Route } from '../lib/router'

const Mark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#1A1A17" />
    <path d="M16 5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L16 21.6l-6.7 3.9 1.7-7.6-5.8-5.1 7.7-.7z" fill="#C8860D" />
  </svg>
)

interface Child {
  href: string
  label: string
  count: string | number
  id: string
}

/**
 * The nav holds every route, and the section you are in opens to show what it
 * contains. Nothing else navigates, so the screens run full width.
 */
export function SideNav({ route }: { route: Route }) {
  useStore()
  const d = getDashboard()

  const children = (name: Route['name']): Child[] => {
    if (name !== route.name) return []
    switch (name) {
      case 'groups':
        return getGroups().map((g) => ({ href: `#/groups/${g.agent.id}`, label: g.agent.name, count: g.leads.length, id: g.agent.id }))
      case 'agents':
        return getAgents().map((a) => ({ href: `#/agents/${a.id}`, label: a.name, count: a.active ? a.leadsPerDay : 'off', id: a.id }))
      case 'lists':
        return getLists().map((l) => ({ href: `#/lists/${l.id}`, label: l.name, count: l.creatorIds.length, id: l.id }))
      default:
        return []
    }
  }

  const currentChild = (name: Route['name'], list: Child[]): string | null => {
    if (list.length === 0) return null
    if (route.name === 'groups' && name === 'groups') return route.agentId ?? list[0].id
    if (route.name === 'agents' && name === 'agents') return route.agentId ?? list[0].id
    if (route.name === 'lists' && name === 'lists') return route.listId ?? list[0].id
    return null
  }

  const items: { href: string; label: string; name: Route['name'] }[] = [
    { href: '#/dashboard', label: 'Dashboard', name: 'dashboard' },
    { href: '#/feed', label: 'Feed', name: 'feed' },
    { href: '#/groups', label: 'Groups', name: 'groups' },
    { href: '#/contacts', label: 'Contacts', name: 'contacts' },
    { href: '#/agents', label: 'Agents', name: 'agents' },
    { href: '#/lists', label: 'Saved lists', name: 'lists' },
    { href: '#/settings', label: 'Settings', name: 'settings' },
  ]

  return (
    <nav className="sidenav" aria-label="Main">
      <a className="brand" href="#/dashboard">
        <Mark />
        brandmatch
      </a>
      <ul>
        {items.map((item) => {
          const kids = children(item.name)
          const on = route.name === item.name
          const openId = currentChild(item.name, kids)
          return (
            <li key={item.href}>
              <a href={item.href} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined}>
                <span>{item.label}</span>
                {item.name === 'feed' && d.today ? <span className="pill num">{d.today}</span> : null}
              </a>
              {kids.length > 0 && (
                <ul className="sub">
                  {kids.map((k) => (
                    <li key={k.id}>
                      <a href={k.href} className={openId === k.id ? 'on' : undefined}>
                        <span>{k.label}</span>
                        <span className="count num">{k.count}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      <p className="sidenav-foot">Next batch {nextBatchLabel(getSettings().timezone)}</p>
    </nav>
  )
}
