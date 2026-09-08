import { useEffect } from 'react'
import { getSettings } from './data'
import { useStore } from './data/hooks'
import { navigate, useRoute } from './lib/router'
import { SideNav } from './components/SideNav'
import { Agents } from './screens/Agents'
import { Contacts } from './screens/Contacts'
import { Dashboard } from './screens/Dashboard'
import { Feed } from './screens/Feed'
import { Groups } from './screens/Groups'
import { Lists } from './screens/Lists'
import { FirstRun, OnboardingDetails, OnboardingFilters, OnboardingWho } from './screens/Onboarding'
import { Settings } from './screens/Settings'

export function App() {
  useStore()
  const route = useRoute()
  const onboarded = getSettings().onboarded

  useEffect(() => {
    if (route.name === 'home') navigate(onboarded ? 'dashboard' : 'onboarding/who')
  }, [route.name, onboarded])

  if (route.name === 'onboarding') {
    switch (route.step) {
      case 'who': return <OnboardingWho />
      case 'details': return <OnboardingDetails />
      case 'filters': return <OnboardingFilters />
      case 'running': return <FirstRun />
    }
  }

  return (
    <div className="shell">
      <main className="main">
        {route.name === 'dashboard' && <Dashboard />}
        {route.name === 'feed' && <Feed creatorId={route.creatorId} />}
        {route.name === 'groups' && <Groups agentId={route.agentId} />}
        {route.name === 'contacts' && <Contacts />}
        {route.name === 'agents' && <Agents agentId={route.agentId} />}
        {route.name === 'lists' && <Lists listId={route.listId} />}
        {route.name === 'settings' && <Settings />}
      </main>
      <SideNav route={route} />
    </div>
  )
}
