import { useEffect, useState } from 'react'

// The product in nine seconds, on a loop: two questions go in, the filters
// come out, and the leads land. Three steps, and the last one holds on the
// list. Under reduced motion it shows that list and stays there.
//
// It teaches the same three steps as the section below it. A hero that
// demonstrates one flow above a page that describes another one is a page
// nobody believes.

const BRIEF = 'Women lifting coaches'
const NICHES = ['Strength', 'Postnatal', 'Rehab']
const LEADS: [string, number, boolean][] = [
  ['@liftwithmaya', 94, true],
  ['@jennakstrong', 88, true],
  ['@sophie.souleve', 76, false],
  ['@priyalifts', 71, true],
  ['@tashtrains', 66, true],
  ['@amaraliftsheavy', 61, false],
]

type Phase = 'site' | 'agents' | 'leads'

export function HeroDemo() {
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState<Phase>(still ? 'leads' : 'site')
  const [typed, setTyped] = useState(still ? BRIEF : '')
  const [shown, setShown] = useState(still ? LEADS.length : 0)

  useEffect(() => {
    if (still) return
    let alive = true
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(() => alive && fn(), ms))

    const run = () => {
      setPhase('site'); setTyped(''); setShown(0)
      BRIEF.split('').forEach((_, i) => at(300 + i * 70, () => setTyped(BRIEF.slice(0, i + 1))))
      at(1900, () => setPhase('agents'))
      at(3600, () => setPhase('leads'))
      LEADS.forEach((_, i) => at(3900 + i * 420, () => setShown(i + 1)))
      at(9200, run)
    }
    run()
    return () => {
      alive = false
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [still])

  return (
    <div className="demo" aria-label="How brandmatch works, in three steps">
      <ol className="demo-steps">
        <li className={phase === 'site' ? 'on' : 'done'}>Answer two questions</li>
        <li className={phase === 'agents' ? 'on' : phase === 'site' ? '' : 'done'}>We write your filters</li>
        <li className={phase === 'leads' ? 'on' : ''}>Leads land every morning</li>
      </ol>

      <div className="demo-stage">
        {phase === 'site' && (
          <div className="demo-site">
            <span className="demo-label">Who do you want to reach?</span>
            <span className="demo-input">{typed}<i className="caret" /></span>
          </div>
        )}

        {phase === 'agents' && (
          <div className="demo-agents">
            <span className="demo-label">15k to 400k followers, English, posted this week. Three niches to search.</span>
            <div className="chips">
              {NICHES.map((a, i) => (
                <span key={a} className="chip demo-pop" style={{ animationDelay: `${i * 220}ms` }}>
                  <i className="dot on" /> {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {phase === 'leads' && (
          <div className="demo-leads">
            <span className="demo-label">This morning. {shown} of 250 landed so far.</span>
            <ul>
              {LEADS.slice(0, shown).map(([h, fit, mail]) => (
                <li key={h} className="demo-pop" style={{ animationDelay: '0ms' }}>
                  <span className="handle">{h}</span>
                  <span className="stars-mini">{fit}% fit</span>
                  <span className="faint">{mail ? 'email attached' : 'handle only'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
