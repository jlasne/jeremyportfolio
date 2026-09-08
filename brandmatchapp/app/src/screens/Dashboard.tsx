import type { Stars } from '../types'
import { getDashboard, getGroups } from '../data'
import { useStore } from '../data/hooks'
import { DailyChart } from '../components/DailyChart'
import { LADDER } from '../components/Stars'

export function Dashboard() {
  useStore()
  const d = getDashboard()
  const groups = getGroups()
  const maxRung = Math.max(...Object.values(d.byStars), 1)
  const avgLeads = Math.round(d.daily.reduce((sum, x) => sum + x.leads, 0) / d.daily.length)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="count">Last 14 days</span>
      </div>

      <div className="tiles">
        <div className="tile">
          <b className="num">{d.today}</b>
          <span>leads today</span>
          <small className="faint">{d.gatheredToday} profiles crawled</small>
        </div>
        <div className="tile">
          <b className="num">{d.high}</b>
          <span>high leads, 2 or 3 stars</span>
          <small className="faint">{Math.round((d.high / d.total) * 100)}% of every lead</small>
        </div>
        <div className="tile">
          <b className="num">{d.total}</b>
          <span>leads in total</span>
          <small className="faint">{avgLeads} a day on average</small>
        </div>
      </div>

      <div className="card">
        <h2>Leads gathered per day</h2>
        <DailyChart data={d.daily} />
      </div>

      <div className="split">
        <div className="card">
          <h2>Where the leads sit</h2>
          <ul className="rungs">
            {LADDER.map((r) => {
              const n = d.byStars[r.stars as Stars]
              return (
                <li key={r.stars}>
                  <span className="rung-name">
                    <span className="num">{r.stars}</span> {r.rung}
                  </span>
                  <span className="rung-bar">
                    <i style={{ width: `${(n / maxRung) * 100}%` }} />
                  </span>
                  <span className="num rung-count">{n}</span>
                  <span className="rung-means faint">{r.means}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="card">
          <h2>Agents</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>Agent</th>
                <th className="r">Target a day</th>
                <th className="r">Leads</th>
                <th className="r">High</th>
                <th className="r">Today</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.agent.id}>
                  <td>
                    <a href={`#/groups/${g.agent.id}`}>{g.agent.name}</a>
                    {g.agent.active ? null : <span className="tag" style={{ marginLeft: 6 }}>paused</span>}
                  </td>
                  <td className="r num">{g.agent.leadsPerDay}</td>
                  <td className="r num">{g.leads.length}</td>
                  <td className="r num">{g.high}</td>
                  <td className="r num">{g.today}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
