import type { Settings } from '../config/settings.js'

// The target list comes from brandmatch, through the same client API the app
// uses, with the same key. No CSV in the middle, so a lead written to here is
// a lead the pipeline already shows as contacted.

export type Target = {
  leadId: string
  handle: string
  name: string
  followers: number
  bio: string
  note: string
  tags: string[]
  score: number
}

type ApiLead = {
  id: string
  score: number
  status: string
  saved?: boolean
  note?: string
  tags?: string[]
  creator?: { handle?: string; name?: string; bio?: string; followers?: number }
}

export class Leads {
  constructor(private readonly s: Settings) {}

  private async req(path: string, init?: RequestInit): Promise<unknown> {
    const res = await fetch(`${this.s.brandmatch.apiBase}/api${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.s.brandmatch.apiKey}`,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) throw new Error(`brandmatch ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`)
    return res.json()
  }

  /** The leads to write to today, best first, already filtered. */
  async next(limit: number): Promise<Target[]> {
    const q = new URLSearchParams({ status: this.s.brandmatch.status, limit: String(Math.max(limit * 3, limit)) })
    if (this.s.brandmatch.campaignId) q.set('campaign', this.s.brandmatch.campaignId)

    const body = (await this.req(`/leads?${q}`)) as { leads?: ApiLead[] }
    const rows = body.leads ?? []

    const out: Target[] = []
    for (const l of rows) {
      const handle = l.creator?.handle?.replace(/^@/, '').trim()
      if (!handle) continue
      if (this.s.brandmatch.savedOnly && !l.saved) continue
      out.push({
        leadId: l.id,
        handle,
        name: (l.creator?.name ?? '').trim(),
        followers: l.creator?.followers ?? 0,
        bio: (l.creator?.bio ?? '').trim(),
        note: l.note ?? '',
        tags: l.tags ?? [],
        score: l.score,
      })
      if (out.length >= limit) break
    }
    return out
  }

  /** Moves the lead on, with the message in the note, so the pipeline matches what was sent. */
  async markContacted(leadId: string, note: string): Promise<void> {
    await this.req(`/leads/${leadId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: this.s.brandmatch.markAs, by: 'outreach-agent', note: note.slice(0, 500) }),
    })
  }
}
