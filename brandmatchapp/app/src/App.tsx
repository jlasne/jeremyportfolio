import { useStore } from './data/hooks'
import { useRoute } from './lib/router'
import { SideNav } from './components/SideNav'
import { StarClip } from './components/Stars'
import { AgentConnect } from './screens/AgentConnect'
import { LeadEditor, Leads } from './screens/Leads'
import { Contacts } from './screens/Contacts'
import { Landing } from './screens/Landing'
import { FirstRun, OnboardingAgent, OnboardingStart } from './screens/Onboarding'

export function App() {
  useStore()
  const route = useRoute()

  if (route.name === 'home') {
    return (
      <>
        <StarClip />
        <Landing />
      </>
    )
  }

  if (route.name === 'onboarding') {
    return (
      <>
        <StarClip />
        {!route.agentId && <OnboardingStart />}
        {route.agentId && !route.running && <OnboardingAgent agentId={route.agentId} />}
        {route.agentId && route.running && <FirstRun agentId={route.agentId} />}
      </>
    )
  }

  return (
    <div className="shell">
      <StarClip />
      <SideNav route={route} />
      <main className="main">
        {route.name === 'contacts' && <Contacts agentId={route.agentId} />}
        {route.name === 'leads' && (route.agentId ? <LeadEditor agentId={route.agentId} /> : <Leads />)}
        {route.name === 'agent' && <AgentConnect />}
      </main>
    </div>
  )
}
