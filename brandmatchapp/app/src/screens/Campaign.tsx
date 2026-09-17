import { useState } from 'react'
import emptyArt from '../art/empty-tray.png'
import {
  addCampaignAgent, campaignLeadsPerDay, campaignTally, createCampaign, deleteCampaign, getCampaign,
  getCampaigns, getDailyRows, getDashboard, proposeAgents, removeCampaignAgent, setCampaignBrief, setCampaignWebsite,
  updateCampaign, updateCampaignAgent,
} from '../data'
import { useStore } from '../data/hooks'
import { nextRunLabel } from '../lib/format'
import { navigate } from '../lib/router'
import { CAMPAIGN_COLOURS, DailyChart, type ChartCampaign } from '../components/DailyChart'

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

/** How many leads come in a day, and which agents bring them. */
export function Campaigns() {
  useStore()
  const campaigns = getCampaigns()
  /** The campaign kept on its own, picked from the legend under the chart. */
  const [pick, setPick] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const d = getDashboard(pick, new Date(), days)
  const rows = getDailyRows(pick, days)
  /** Unscoped, so the legend keeps every campaign's number whatever is picked. */
  const everyRow = getDailyRows(null, days)

  /** Every campaign, in order, so a colour sticks to a campaign. */
  const chartCampaigns: ChartCampaign[] = campaigns.map((c, i) => ({
    id: c.id,
    name: c.name,
    agents: c.agents.filter((a) => a.status !== 'proposed').length,
    colourIndex: i,
    leads: everyRow.filter((r) => r.campaignId === c.id).reduce((sum, r) => sum + r.leads, 0),
  }))
  const agentCount = campaigns.reduce((sum, c) => sum + c.agents.filter((a) => a.status === 'active').length, 0)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Campaigns</h1>
        <span className="count">A campaign is a group. Its agents each fill a daily quota of leads.</span>
        <span className="spacer" />
        <button type="button" className="btn primary" onClick={() => navigate(`campaign/${createCampaign().id}`)}>New campaign</button>
      </div>

      <div className="card">
        <h2>
          Leads a day
          <span className="spacer" />
          <span className="chips period">
            {PERIODS.map((p) => (
              <button key={p.days} type="button" className={`chip small${days === p.days ? ' on' : ''}`} aria-pressed={days === p.days} onClick={() => setDays(p.days)}>
                {p.label}
              </button>
            ))}
          </span>
        </h2>
        <DailyChart rows={rows} campaigns={chartCampaigns} selected={pick} onSelect={setPick} />
        <div className="star-split">
          <div><b className="num">{d.leadsToday.toLocaleString('en-US')}</b><span>leads today</span></div>
          <div>
            <b className="num">{d.daily.reduce((sum, x) => sum + x.leads, 0).toLocaleString('en-US')}</b>
            <span>leads over {days} days</span>
          </div>
          <div>
            <b className="num">{agentCount}</b>
            <span>{agentCount === 1 ? 'agent' : 'agents'} running</span>
          </div>
          <div><b className="num">{campaigns.filter((c) => c.active).length}</b><span>{campaigns.length === 1 ? 'campaign' : 'campaigns'} live</span></div>
        </div>
      </div>

      <div className="list campaign-groups" style={{ marginTop: 14 }}>
        {campaigns.map((c) => {
          const t = campaignTally(c.id)
          const live = c.agents.filter((a) => a.status !== 'proposed')
          const waiting = c.agents.filter((a) => a.status === 'proposed').length
          const running = c.agents.filter((a) => a.status === 'active').length
          const colour = CAMPAIGN_COLOURS[chartCampaigns.findIndex((x) => x.id === c.id) % CAMPAIGN_COLOURS.length]
          return (
            <section className="campaign-group" key={c.id}>
              <div className="group-head">
                <span className={`dot${running > 0 ? ' on' : ''}`} aria-hidden="true" />
                <span className="who">
                  <a className="name" href={`#/campaign/${c.id}`}>{c.name || 'Untitled campaign'}</a>
                  <span className="handle">{c.brief.summary}</span>
                </span>
                <span className="state">
                  {running > 0
                    ? `${running} of ${live.length} agent${live.length === 1 ? '' : 's'} running, ${campaignLeadsPerDay(c)} leads a day in quota`
                    : `${live.length} agent${live.length === 1 ? '' : 's'}, none running`}
                </span>
                {waiting > 0 && (
                  <a className="badge waiting" href={`#/campaign/${c.id}`}>
                    {waiting} waiting for you
                  </a>
                )}
                <span className="metric">
                  <b className="num">{t.found.toLocaleString('en-US')}</b>
                  <small>leads found</small>
                </span>
                <a className="btn small" href={`#/campaign/${c.id}`}>Open</a>
              </div>

              {/* Read only here. Every change happens inside the campaign. */}
              <ul className="agent-list">
                {live.map((a) => (
                  <li
                    className={`agent-line${a.status === 'active' ? '' : ' off'}`}
                    key={a.id}
                    style={{ borderLeftColor: a.status === 'active' ? colour : undefined }}
                  >
                    <span className="agent-line-name">
                      {a.status === 'active' && <i className="pulse" aria-hidden="true" />}
                      {a.name}
                    </span>
                    <span className="agent-line-focus">{a.focus || 'No angle written yet'}</span>
                    <span className="agent-quota">
                      <b className="num">{a.leadsPerDay}</b>
                      <span>a day quota</span>
                    </span>
                    <span className="agent-when">
                      {a.status === 'active' ? `Next run ${nextRunLabel(c.runAt)}` : 'Paused, no next run'}
                    </span>
                    <button
                      type="button"
                      className={`btn small toggle${a.status === 'active' ? ' on' : ''}`}
                      aria-pressed={a.status === 'active'}
                      onClick={() => updateCampaignAgent(c.id, a.id, { status: a.status === 'active' ? 'paused' : 'active' })}
                    >
                      {a.status === 'active' ? 'Running' : 'Paused'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {campaigns.length === 0 && (
          <div className="empty">
            <img className="empty-art" src={emptyArt} alt="" width={1254} height={1254} />
            <h2>No campaign yet</h2>
            <p>A campaign is a group. Its agents each carry a daily quota and fill it every morning.</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => navigate(`campaign/${createCampaign().id}`)}>Create the first campaign</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The hashtags an agent searches, so what it does is never a guess. */
function Hashtags({ tags }: { tags: string[] }) {
  if (!tags.length) return null
  return (
    <span className="tagrow">
      {tags.slice(0, 6).map((t) => <span className="hashtag" key={t}>#{t}</span>)}
    </span>
  )
}

/** A quota you set by stepping it, or by typing over it. */
function Quota({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const step = (by: number) => onChange(Math.max(0, Math.min(500, value + by)))
  return (
    <span className="quota">
      <button type="button" className="quota-step" aria-label="Fewer leads a day" onClick={() => step(-25)}>&minus;</button>
      <input
        className="input num"
        inputMode="numeric"
        value={value}
        aria-label="Daily quota for this agent"
        onChange={(e) => onChange(Math.max(0, Math.min(500, Number(e.target.value.replace(/\D/g, '')) || 0)))}
      />
      <button type="button" className="quota-step" aria-label="More leads a day" onClick={() => step(25)}>+</button>
      <span className="quota-unit">a day</span>
    </span>
  )
}

/** One campaign: the website, the audience, its agents, and when it lands. */
export function CampaignEditor({ campaignId, firstRun = false }: { campaignId: string; firstRun?: boolean }) {
  useStore()
  const campaign = getCampaign(campaignId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reading, setReading] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

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
  const proposed = campaign.agents.filter((a) => a.status === 'proposed')
  const live = campaign.agents.filter((a) => a.status !== 'proposed')
  const running = campaign.agents.filter((a) => a.status === 'active')

  /** Read the site, then let the model write the audience and the agents. */
  function read(): void {
    if (!campaign || reading || !campaign.website.trim()) return
    setReading(true)
    setFailed(null)
    proposeAgents(campaign.id, campaign.website)
      .then(() => {
        if (!campaign.name.trim()) {
          const domain = campaign.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0]
          updateCampaign(campaign.id, { name: domain.charAt(0).toUpperCase() + domain.slice(1) + ' creators' })
        }
      })
      .catch((e: Error) => setFailed(e.message || 'Could not read that site. Try the full address.'))
      .finally(() => setReading(false))
  }

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
          <a className="btn primary" href={`#/contacts/${campaign.id}`}>See {tally.found.toLocaleString('en-US')} leads</a>
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
          <input
            id="site"
            className="input big"
            placeholder="strongher.co"
            value={campaign.website}
            onChange={(e) => setCampaignWebsite(campaign.id, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') read() }}
          />
          <button type="button" className="btn primary" disabled={!campaign.website.trim() || reading} onClick={read}>
            {reading ? 'Reading it' : campaign.agents.length ? 'Read it again' : 'Read my site'}
          </button>
        </div>
        <p className="helper">
          We read your site, write the audience, and propose three agents. Nothing searches until you approve one.
        </p>
        {failed && <p className="warn">{failed}</p>}
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

      {proposed.length > 0 && (
        <section className="ask proposals">
          <h2>Three agents proposed</h2>
          <p className="muted">
            Each takes one angle and searches its own hashtags. Approve the ones you want. The rest cost nothing.
          </p>
          <div className="agents">
            {proposed.map((a) => (
              <div className="agent-card proposed" key={a.id}>
                <div className="agent-top">
                  <span className="agent-title">{a.name}</span>
                  <span className="spacer" />
                  <button
                    type="button"
                    className="btn small primary"
                    onClick={() => updateCampaignAgent(campaign.id, a.id, { status: 'active' })}
                  >
                    Approve
                  </button>
                  <button type="button" className="btn small quiet" onClick={() => removeCampaignAgent(campaign.id, a.id)}>
                    Drop
                  </button>
                </div>
                <p className="agent-focus">{a.focus}</p>
                {a.why && <p className="agent-why">{a.why}</p>}
                <Hashtags tags={a.hashtags} />
                <span className="agent-quota-note">{a.leadsPerDay} leads a day once it runs</span>
              </div>
            ))}
          </div>
          <div className="proposal-foot">
            <button
              type="button"
              className="btn primary"
              onClick={() => proposed.forEach((a) => updateCampaignAgent(campaign.id, a.id, { status: 'active' }))}
            >
              Approve all three
            </button>
            <span className="faint">{proposed.reduce((n, a) => n + a.leadsPerDay, 0)} leads a day if you take them all</span>
          </div>
        </section>
      )}

      <section className="ask">
        <h2>{live.length > 0 ? `Your agents (${live.length})` : 'Agents'}</h2>
        {live.length === 0 ? (
          <p className="muted">
            No agent yet. Put your website above and we propose three, or write one yourself.
          </p>
        ) : (
          <p className="muted">
            An agent is the filter: what it hunts for, the hashtags it searches, and how many leads a day it brings.
            The campaign around it is only a name for the group.
          </p>
        )}
        <div className="agents">
          {live.map((a) => (
            <div className={`agent-card${a.status === 'active' ? '' : ' off'}`} key={a.id}>
              <div className="agent-top">
                <input
                  className="input agent-name"
                  value={a.name}
                  aria-label="Agent name"
                  onChange={(e) => updateCampaignAgent(campaign.id, a.id, { name: e.target.value })}
                />
                <span className="spacer" />
                <Quota
                  value={a.leadsPerDay}
                  onChange={(n) => updateCampaignAgent(campaign.id, a.id, { leadsPerDay: n })}
                />
                <button
                  type="button"
                  className={`btn small toggle${a.status === 'active' ? ' on' : ''}`}
                  aria-pressed={a.status === 'active'}
                  onClick={() => updateCampaignAgent(campaign.id, a.id, { status: a.status === 'active' ? 'paused' : 'active' })}
                >
                  {a.status === 'active' ? 'Running' : 'Paused'}
                </button>
                <button type="button" className="btn small quiet" aria-label={`Remove ${a.name}`} onClick={() => removeCampaignAgent(campaign.id, a.id)}>
                  Remove
                </button>
              </div>
              <label className="agent-field">
                <span>Hunts for</span>
                <input
                  className="input"
                  placeholder="What this agent hunts for, in one line"
                  value={a.focus}
                  onChange={(e) => updateCampaignAgent(campaign.id, a.id, { focus: e.target.value })}
                />
              </label>
              <label className="agent-field">
                <span>Searches</span>
                <input
                  className="input"
                  placeholder="squatform, liftingcoach, strengthcoach"
                  value={a.hashtags.join(', ')}
                  onChange={(e) => updateCampaignAgent(campaign.id, a.id, {
                    hashtags: e.target.value.split(',')
                      .map((h) => h.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''))
                      .filter(Boolean).slice(0, 6),
                  })}
                />
              </label>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => addCampaignAgent(campaign.id)}>Add an agent myself</button>
        </div>
      </section>

      <section className="ask">
        <h2>Delivery</h2>
        <label className="field" style={{ maxWidth: 260 }}>
          <span>Quotas filled by</span>
          <input className="input" type="time" value={campaign.runAt} onChange={(e) => updateCampaign(campaign.id, { runAt: e.target.value })} />
        </label>
        <p className="estimate">
          <b className="num">{perDay.toLocaleString('en-US')}</b> leads in your list every morning, the quotas of your{' '}
          {running.length} running agent{running.length === 1 ? '' : 's'} added up.
          Next run {nextRunLabel(campaign.runAt)}.
        </p>
        {!firstRun && (
          <p className="hint">Found {tally.found.toLocaleString('en-US')} leads so far. Narrow the list on Contacts, where the filters live.</p>
        )}
      </section>

      {firstRun ? (
        <div className="editor-foot">
          <span className="faint">You can add more campaigns later.</span>
          <span className="spacer" />
          <button type="button" className="btn primary" disabled={!canRun} onClick={() => navigate(`onboarding/${campaign.id}/plan`)}>
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
          <a className="btn primary" href={`#/contacts/${campaign.id}`}>See {tally.found.toLocaleString('en-US')} leads</a>
        </div>
      )}
    </div>
  )
}
