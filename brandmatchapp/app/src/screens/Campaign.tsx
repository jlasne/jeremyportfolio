import { useState } from 'react'
import {
  QUALIFIED_SHARE, addCampaignAgent, audienceFromWebsite, campaignLeadsPerDay, campaignTally, createCampaign, deleteCampaign,
  getCampaign, getCampaigns, getDailyRows, getDashboard, qualifiedFrom, removeCampaignAgent, setCampaignBrief, setCampaignWebsite,
  updateCampaign, updateCampaignAgent,
} from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'
import { DailyChart } from '../components/DailyChart'

/** A count of qualified always carries its total and its share. */
function rate(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : '0%'
}

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

/** How many leads come in a day, and which campaigns bring them. */
export function Campaigns() {
  useStore()
  const campaigns = getCampaigns()
  const [pick, setPick] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const d = getDashboard(pick, new Date(), days)
  const rows = getDailyRows(pick, days)
  const shown = pick ? campaigns.filter((c) => c.id === pick) : campaigns

  return (
    <div className="page">
      <div className="page-head">
        <h1>Campaigns</h1>
        <span className="count">Each one run by its agents, every morning</span>
        <span className="spacer" />
        <button type="button" className="btn primary" onClick={() => navigate(`campaign/${createCampaign().id}`)}>New campaign</button>
      </div>

      <div className="card">
        <h2>
          Leads a day
          <select className="select inline-select" value={pick ?? ''} onChange={(e) => setPick(e.target.value || null)} aria-label="Campaign">
            <option value="">Every campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="spacer" />
          <span className="chips period">
            {PERIODS.map((p) => (
              <button key={p.days} type="button" className={`chip small${days === p.days ? ' on' : ''}`} aria-pressed={days === p.days} onClick={() => setDays(p.days)}>
                {p.label}
              </button>
            ))}
          </span>
        </h2>
        <DailyChart rows={rows} campaigns={shown.map((c) => ({ id: c.id, name: c.name }))} />
        <div className="star-split">
          <div><b className="num">{d.leadsToday.toLocaleString('en-US')}</b><span>leads today</span></div>
          <div>
            <b className="num">{d.qualifiedToday.toLocaleString('en-US')}</b>
            <span>qualified of {d.leadsToday.toLocaleString('en-US')}, {rate(d.qualifiedToday, d.leadsToday)}</span>
          </div>
          <div>
            <b className="num">{d.daily.reduce((sum, x) => sum + x.leads, 0).toLocaleString('en-US')}</b>
            <span>leads over {days} days</span>
          </div>
          <div><b className="num">{shown.filter((c) => c.active).length}</b><span>{shown.length === 1 ? 'campaign' : 'campaigns'} running</span></div>
        </div>
      </div>

      <div className="list" style={{ marginTop: 14 }}>
        {campaigns.map((c) => {
          const t = campaignTally(c.id)
          const running = c.agents.filter((a) => a.active).length
          return (
            <a className="campaign-row" key={c.id} href={`#/campaign/${c.id}`}>
              <span className={`dot${c.active ? ' on' : ''}`} aria-hidden="true" />
              <span className="who">
                <span className="name">{c.name}</span>
                <span className="handle">{c.brief.summary}</span>
              </span>
              <span className="state">
                {c.active ? `${running} agent${running === 1 ? '' : 's'} running, ${campaignLeadsPerDay(c)} leads a day at ${c.runAt}` : 'Paused'}
              </span>
              <span className="metric">
                <b className="num">{t.found}</b>
                <small>leads, {t.high} qualified</small>
              </span>
            </a>
          )
        })}
        {campaigns.length === 0 && (
          <div className="empty">
            <h2>No campaign yet</h2>
            <p>A campaign starts from your website. Its agents run every morning and fill your contact list.</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => navigate(`campaign/${createCampaign().id}`)}>Create the first campaign</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** One campaign: the website, the audience, its agents, and when it lands. */
export function CampaignEditor({ campaignId, firstRun = false }: { campaignId: string; firstRun?: boolean }) {
  useStore()
  const campaign = getCampaign(campaignId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reading, setReading] = useState(false)

  if (!campaign) {
    return (
      <div className="page">
        <div className="page-head"><h1>Campaign not found</h1></div>
        <a className="btn" href="#/campaign">Back to campaigns</a>
      </div>
    )
  }

  const tally = campaignTally(campaign.id)
  const perDay = campaignLeadsPerDay(campaign)
  const canRun = campaign.brief.who.trim().length > 0 && perDay > 0

  return (
    <div className="page editor">
      {firstRun ? (
        <div className="page-head">
          <h1>Set up your first campaign</h1>
        </div>
      ) : (
        <div className="page-head">
          <a className="back" href="#/campaign">Campaigns</a>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => updateCampaign(campaign.id, { active: !campaign.active })}>
            {campaign.active ? 'Pause' : 'Run every day'}
          </button>
          <a className="btn primary" href={`#/contacts/${campaign.id}`}>See {tally.found} leads</a>
        </div>
      )}
      {firstRun && (
        <p className="subhead">Put in your website. We read it and write who your agents should look for. Edit anything, then start it.</p>
      )}

      <input
        className="input title-input"
        value={campaign.name}
        aria-label="Campaign name"
        placeholder="Name this campaign"
        autoFocus={firstRun}
        onChange={(e) => updateCampaign(campaign.id, { name: e.target.value })}
      />

      <section className="ask">
        <h2><label htmlFor="site">Your website</label></h2>
        <div className="site-row">
          <input id="site" className="input big" placeholder="strongher.co" value={campaign.website} onChange={(e) => setCampaignWebsite(campaign.id, e.target.value)} />
          <button
            type="button"
            className="btn primary"
            disabled={!campaign.website.trim() || reading}
            onClick={() => {
              setReading(true)
              window.setTimeout(() => {
                setCampaignBrief(campaign.id, audienceFromWebsite(campaign.website))
                if (!campaign.name.trim()) {
                  const domain = campaign.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0]
                  updateCampaign(campaign.id, { name: domain.charAt(0).toUpperCase() + domain.slice(1) + ' creators' })
                }
                setReading(false)
              }, 1400)
            }}
          >
            {reading ? 'Reading it' : campaign.brief.who ? 'Read it again' : 'Read my site'}
          </button>
        </div>
        <p className="helper">We read your site and write the audience below. Change any of it.</p>
      </section>

      <section className="ask">
        <h2><label htmlFor="who">The audience your agents look for</label></h2>
        {reading ? (
          <div className="reading" aria-live="polite">
            <span className="dots"><i /><i /><i /></span>
            Reading {campaign.website} and writing your audience.
          </div>
        ) : (
          <textarea
            id="who"
            className="textarea audience"
            placeholder="Write it yourself, or put your website above and let us draft it."
            value={campaign.brief.who}
            onChange={(e) => setCampaignBrief(campaign.id, e.target.value)}
          />
        )}
        <p className="helper">This is what the agents hunt for. The more precise it is, the better the leads.</p>
      </section>

      <section className="ask">
        <h2>Agents</h2>
        <p className="muted">Each agent takes one angle on the audience and brings its own share of the day.</p>
        <div className="agents">
          {campaign.agents.map((a) => (
            <div className={`agent-card${a.active ? '' : ' off'}`} key={a.id}>
              <div className="agent-top">
                <input
                  className="input agent-name"
                  value={a.name}
                  aria-label="Agent name"
                  onChange={(e) => updateCampaignAgent(campaign.id, a.id, { name: e.target.value })}
                />
                <label className="agent-leads">
                  <input
                    className="input num"
                    inputMode="numeric"
                    value={a.leadsPerDay}
                    aria-label="Leads a day for this agent"
                    onChange={(e) => updateCampaignAgent(campaign.id, a.id, { leadsPerDay: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) })}
                  />
                  <span>a day</span>
                </label>
                <button type="button" className={`btn small${a.active ? '' : ' on'}`} onClick={() => updateCampaignAgent(campaign.id, a.id, { active: !a.active })}>
                  {a.active ? 'Pause' : 'Paused'}
                </button>
                {campaign.agents.length > 1 && (
                  <button type="button" className="btn small quiet" aria-label={`Remove ${a.name}`} onClick={() => removeCampaignAgent(campaign.id, a.id)}>
                    Remove
                  </button>
                )}
              </div>
              <input
                className="input"
                placeholder="What this agent hunts for, in one line"
                value={a.focus}
                aria-label="Agent focus"
                onChange={(e) => updateCampaignAgent(campaign.id, a.id, { focus: e.target.value })}
              />
            </div>
          ))}
          <button type="button" className="btn" onClick={() => addCampaignAgent(campaign.id)}>Add an agent</button>
        </div>
      </section>

      <section className="ask">
        <h2>Delivery</h2>
        <label className="field" style={{ maxWidth: 260 }}>
          <span>Ready at</span>
          <input className="input" type="time" value={campaign.runAt} onChange={(e) => updateCampaign(campaign.id, { runAt: e.target.value })} />
        </label>
        <p className="estimate">
          <b className="num">{perDay.toLocaleString('en-US')}</b> leads in your list every morning across {campaign.agents.filter((a) => a.active).length} running
          agent{campaign.agents.filter((a) => a.active).length === 1 ? '' : 's'}, about <b className="num">{qualifiedFrom(perDay).toLocaleString('en-US')}</b> of
          them qualified. About {Math.round(QUALIFIED_SHARE * 10)} leads in 10 reach half a star.
        </p>
        {!firstRun && (
          <p className="hint">Found {tally.found} leads so far, {tally.high} qualified, {rate(tally.high, tally.found)}. Narrow the list on Contacts, where the filters live.</p>
        )}
      </section>

      {firstRun ? (
        <div className="editor-foot">
          <span className="faint">You can add more campaigns later.</span>
          <span className="spacer" />
          <button type="button" className="btn primary" disabled={!canRun} onClick={() => navigate(`onboarding/${campaign.id}/running`)}>
            Find my leads
          </button>
        </div>
      ) : (
        <div className="editor-foot">
          {confirmDelete ? (
            <>
              <button type="button" className="btn danger" onClick={() => { deleteCampaign(campaign.id); navigate('campaign') }}>Confirm delete</button>
              <button type="button" className="btn quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
            </>
          ) : (
            <button type="button" className="btn quiet danger" onClick={() => setConfirmDelete(true)}>Delete this campaign</button>
          )}
          <span className="spacer" />
          <a className="btn primary" href={`#/contacts/${campaign.id}`}>See {tally.found} leads</a>
        </div>
      )}
    </div>
  )
}
