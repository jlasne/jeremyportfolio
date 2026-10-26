// Mirrors the theme and reduced-motion settings onto <html> (data-theme, data-reduced-motion) and
// the browser chrome colour. Renders nothing.

import { useEffect } from 'react'
import { useReducedMotion, useResolvedTheme } from '../kit/hooks'

const CHROME = { light: '#f6f1e3', dark: '#1b1a24' }

export function ThemeSync() {
  const theme = useResolvedTheme()
  const reduced = useReducedMotion()

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', CHROME[theme])
      m.removeAttribute('media')
    })
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reduced ? 'true' : 'false'
  }, [reduced])

  return null
}
