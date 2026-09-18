import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { hydrate } from './data/store'
import './fonts.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Paint the sample account first, swap in the real one when it lands. A visitor
// with no key never calls out and stays on the sample.
void hydrate()
