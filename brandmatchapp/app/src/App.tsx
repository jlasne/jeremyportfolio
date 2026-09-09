import { useEffect } from 'react'
import { getSettings } from './data'
import { useStore } from './data/hooks'
import { navigate, useRoute } from './lib/router'
import { SideNav } from './components/SideNav'
import { StarClip } from './components/Stars'
import { AgentEditor, Agents } from './screens/Agents'
import { Contacts } from './screens/Contacts'
import { FirstRun, OnboardingDetails, OnboardingFilters, OnboardingWho } from './screens/Onboarding'

export function App() {
  useStore()
  const route = useRoute()
  const onboarded = getSettings().onboarded

  useEffect(() => {
    if (route.name === 'home') navigate(onboarded ? 'contacts' : 'onboarding/who')
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
      <StarClip />
      <SideNav route={route} />
      <main className="main">
        {route.name === 'contacts' && <Contacts agentId={route.agentId} />}
        {route.name === 'agents' && (route.agentId ? <AgentEditor agentId={route.agentId} /> : <Agents />)}
      </main>
    </div>
  )
}
