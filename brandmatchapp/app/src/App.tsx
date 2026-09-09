import { useStore } from './data/hooks'
import { useRoute } from './lib/router'
import { SideNav } from './components/SideNav'
import { StarClip } from './components/Stars'
import { AgentEditor, Agents } from './screens/Agent'
import { Connect } from './screens/Connect'
import { Settings } from './screens/Settings'
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
        {route.name === 'agent' && (route.agentId ? <AgentEditor agentId={route.agentId} /> : <Agents />)}
        {route.name === 'connect' && <Connect />}
        {route.name === 'settings' && <Settings />}
      </main>
    </div>
  )
}
