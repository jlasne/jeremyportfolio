import { agentTally, getAgents, getDashboard } from '../data'
import { useStore } from '../data/hooks'
import { DailyChart } from '../components/DailyChart'

export function Dashboard() {
  useStore()
  const d = getDashboard()
  const agents = getAgents()
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
          <span>contacts today</span>
          <small className="faint">{d.gatheredToday} profiles crawled</small>
        </div>
        <div className="tile">
          <b className="num">{d.high}</b>
          <span>at 2 stars or more</span>
          <small className="faint">{Math.round((d.high / d.total) * 100)}% of every contact</small>
        </div>
        <div className="tile">
          <b className="num">{d.total}</b>
          <span>contacts in total</span>
          <small className="faint">{avgLeads} a day on average</small>
        </div>
      </div>

      <div className="card">
        <h2>Contacts gathered per day</h2>
        <DailyChart data={d.daily} />
      </div>

      <div className="split">
        <div className="card">
          <h2>What earns a star</h2>
          <ul className="criteria">
            {d.byCriterion.map((c) => (
              <li key={c.key}>
                <span className="crit-name">{c.label}</span>
                <span className="crit-bar">
                  <i className="full" style={{ width: `${(c.full / d.total) * 100}%` }} />
                  <i className="half" style={{ width: `${(c.half / d.total) * 100}%` }} />
                </span>
                <span className="num crit-count">{c.full + c.half / 2}</span>
                <span className="crit-means faint">{c.full} full · {c.half} half</span>
              </li>
            ))}
          </ul>
          <div className="star-split">
            {d.buckets.map((b) => (
              <div key={b.label}>
                <b className="num">{b.count}</b>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
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
              {agents.map((a) => {
                const t = agentTally(a.id)
                return (
                  <tr key={a.id}>
                    <td>
                      <a href={`#/contacts/${a.id}`}>{a.name}</a>
                      {a.active ? null : <span className="tag" style={{ marginLeft: 6 }}>paused</span>}
                    </td>
                    <td className="r num">{a.leadsPerDay}</td>
                    <td className="r num">{t.found}</td>
                    <td className="r num">{t.high}</td>
                    <td className="r num">{t.today}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
