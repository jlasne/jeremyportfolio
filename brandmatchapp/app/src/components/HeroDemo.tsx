import { useEffect, useState } from 'react'

// The product in 12 seconds, on a loop: a website goes in, agents wake up, and
// leads land day after day. Three steps, and the last one ends on the chart.
// Under reduced motion it shows that chart and stays there.

const SITE = 'strongher.co'
const AGENTS = ['Technique coaches', 'Program sellers', 'Paid post watchers']
const LEADS = ['@liftwithmaya', '@jennakstrong', '@sophie.souleve', '@priyalifts', '@tashtrains', '@amaraliftsheavy']
const DAYS = [180, 210, 240, 230, 270, 300, 290, 330, 350, 340, 380, 400]

type Phase = 'site' | 'agents' | 'leads' | 'chart'

export function HeroDemo() {
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState<Phase>(still ? 'chart' : 'site')
  const [typed, setTyped] = useState(still ? SITE : '')
  const [shown, setShown] = useState(still ? LEADS.length : 0)
  const [bars, setBars] = useState(still ? DAYS.length : 0)

  useEffect(() => {
    if (still) return
    let alive = true
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(() => alive && fn(), ms))

    const run = () => {
      setPhase('site'); setTyped(''); setShown(0); setBars(0)
      SITE.split('').forEach((_, i) => at(300 + i * 90, () => setTyped(SITE.slice(0, i + 1))))
      at(1900, () => setPhase('agents'))
      at(3600, () => setPhase('leads'))
      LEADS.forEach((_, i) => at(3900 + i * 420, () => setShown(i + 1)))
      at(7000, () => setPhase('chart'))
      DAYS.forEach((_, i) => at(7200 + i * 160, () => setBars(i + 1)))
      at(12200, run)
    }
    run()
    return () => {
      alive = false
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [still])

  const max = Math.max(...DAYS)

  return (
    <div className="demo" aria-label="How brandmatch works, in four steps">
      <ol className="demo-steps">
        <li className={phase === 'site' ? 'on' : 'done'}>Enter your website</li>
        <li className={phase === 'agents' ? 'on' : phase === 'site' ? '' : 'done'}>Agents wake up</li>
        <li className={phase === 'leads' || phase === 'chart' ? 'on' : ''}>Leads land every day</li>
      </ol>

      <div className="demo-stage">
        {phase === 'site' && (
          <div className="demo-site">
            <span className="demo-label">Your website</span>
            <span className="demo-input">{typed}<i className="caret" /></span>
          </div>
        )}

        {phase === 'agents' && (
          <div className="demo-agents">
            <span className="demo-label">Reading {SITE}. Three agents on it.</span>
            <div className="chips">
              {AGENTS.map((a, i) => (
                <span key={a} className="chip demo-pop" style={{ animationDelay: `${i * 220}ms` }}>
                  <i className="dot on" /> {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {phase === 'leads' && (
          <div className="demo-leads">
            <span className="demo-label">Day 1. {shown} leads so far.</span>
            <ul>
              {LEADS.slice(0, shown).map((h, i) => (
                <li key={h} className="demo-pop" style={{ animationDelay: '0ms' }}>
                  <span className="handle">{h}</span>
                  <span className="stars-mini" aria-hidden="true">{'★'.repeat(3 - (i % 2))}</span>
                  <span className="faint">{i % 3 === 1 ? 'No email found' : 'email attached'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase === 'chart' && (
          <div className="demo-chart">
            <span className="demo-label">12 days in. {DAYS.slice(0, bars).reduce((s, v) => s + v, 0).toLocaleString('en-US')} leads in your list.</span>
            <div className="demo-bars" role="img" aria-label="Leads a day, rising over 12 days">
              {DAYS.map((v, i) => (
                <i key={i} style={{ height: i < bars ? `${(v / max) * 100}%` : '0%' }} />
              ))}
            </div>
            <div className="demo-legend" aria-hidden="true">
              <span><i style={{ background: '#ff5c2b' }} /> Technique coaches</span>
              <span><i style={{ background: '#7c5cff' }} /> Program sellers</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
