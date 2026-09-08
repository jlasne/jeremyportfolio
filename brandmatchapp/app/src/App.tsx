import { useEffect } from 'react'
import { getSettings } from './data'
import { useStore } from './data/hooks'
import { navigate, useRoute } from './lib/router'
import { TopBar } from './components/TopBar'
import { Feed } from './screens/Feed'
import { Lists } from './screens/Lists'
import { FirstRun, OnboardingDetails, OnboardingFilters, OnboardingWho } from './screens/Onboarding'
import { Settings } from './screens/Settings'

export function App() {
  useStore()
  const route = useRoute()
  const onboarded = getSettings().onboarded

  useEffect(() => {
    if (route.name === 'home') navigate(onboarded ? 'feed' : 'onboarding/who')
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
    <>
      <TopBar route={route} />
      {route.name === 'feed' && <Feed creatorId={route.creatorId} />}
      {route.name === 'lists' && <Lists listId={route.listId} />}
      {route.name === 'settings' && <Settings />}
    </>
  )
}
