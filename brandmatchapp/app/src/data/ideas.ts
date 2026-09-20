// The roadmap, and what people want on it.
//
// Ideas are public: everyone sees what has been asked for, what we picked up,
// and what shipped. A roadmap that only shows what we chose is a changelog,
// and a changelog does not tell a client whether the thing they need is
// coming.
//
// What this browser adds or votes for is kept in this browser until there is a
// server behind it. That is honest for a first version: the list is real, the
// votes are real, and a vote from here counts once.

export type IdeaState = 'considering' | 'planned' | 'building' | 'shipped'

export interface Idea {
  id: string
  title: string
  body: string
  by: string
  at: string
  tag: string
  state: IdeaState
  votes: number
  comments: number
}

export const STATE_LABEL: Record<IdeaState, string> = {
  considering: 'Considering',
  planned: 'Planned',
  building: 'In development',
  shipped: 'Shipped',
}

const SEED: Idea[] = [
  {
    id: 'idea_outreach',
    title: 'Write to leads from inside the list',
    body: 'I copy handles into another tool every morning. Let the extension send the first message from my own account, and move the lead to contacted on its own.',
    by: 'Jeremy L', at: '2026-09-02', tag: 'Outreach', state: 'building', votes: 34, comments: 6,
  },
  {
    id: 'idea_tiktok',
    title: 'Find the same people on TikTok',
    body: 'Half the coaches I want post on both. Same rules, same scoring, one more place to look.',
    by: 'Marion T', at: '2026-08-21', tag: 'Sourcing', state: 'planned', votes: 27, comments: 4,
  },
  {
    id: 'idea_slack',
    title: 'Push new leads into Slack',
    body: 'A message in a channel every morning with the five best, so the team sees them without opening anything.',
    by: 'Tom S', at: '2026-08-14', tag: 'Integrations', state: 'considering', votes: 19, comments: 2,
  },
  {
    id: 'idea_dedupe',
    title: 'Tell me when a lead is already in my CRM',
    body: 'We pay for people we have already spoken to. Match on email and handle against an import and flag the row.',
    by: 'Bradford C', at: '2026-08-09', tag: 'CRM', state: 'considering', votes: 16, comments: 3,
  },
  {
    id: 'idea_weekly',
    title: 'A weekly email with what changed',
    body: 'How many were scored, how many qualified, which rule cost me the most people. I would read that on a Monday.',
    by: 'Amelia W', at: '2026-07-30', tag: 'Reporting', state: 'considering', votes: 11, comments: 1,
  },
  {
    id: 'idea_tags',
    title: 'My own tags on a lead',
    body: 'Your statuses are your pipeline. I need my own labels beside them, and I need to set them from the API.',
    by: 'Sacha M', at: '2026-07-11', tag: 'CRM', state: 'shipped', votes: 22, comments: 5,
  },
]

const MINE = 'brandmatch.ideas'
const VOTED = 'brandmatch.voted'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage off */ }
}

/**
 * What the operator has changed about an idea: where it stands, and what it
 * is about. The text belongs to whoever wrote it and is never rewritten from
 * here; the state and the tag are ours to keep honest.
 */
const EDITS = 'brandmatch.ideaEdits'
type Edit = { state?: IdeaState; tag?: string }

export function listIdeas(): Idea[] {
  const mine = read<Idea[]>(MINE, [])
  const voted = read<string[]>(VOTED, [])
  const edits = read<Record<string, Edit>>(EDITS, {})
  return [...mine, ...SEED].map((i) => ({
    ...i,
    ...edits[i.id],
    votes: i.votes + (voted.includes(i.id) ? 1 : 0),
  }))
}

/** Operator only. Moves an idea along, or files it under something else. */
export function editIdea(id: string, patch: Edit): void {
  const edits = read<Record<string, Edit>>(EDITS, {})
  write(EDITS, { ...edits, [id]: { ...edits[id], ...patch } })
}

export function hasVoted(id: string): boolean {
  return read<string[]>(VOTED, []).includes(id)
}

/** One vote a browser, and it can be taken back. */
export function toggleVote(id: string): void {
  const voted = read<string[]>(VOTED, [])
  write(VOTED, voted.includes(id) ? voted.filter((x) => x !== id) : [...voted, id])
}

export function addIdea(title: string, body: string, tag: string, by: string): Idea {
  const idea: Idea = {
    id: `idea_${Math.random().toString(36).slice(2, 9)}`,
    title: title.trim().slice(0, 90),
    body: body.trim().slice(0, 600),
    by,
    at: new Date().toISOString().slice(0, 10),
    tag: tag || 'Idea',
    state: 'considering',
    votes: 1,
    comments: 0,
  }
  write(MINE, [idea, ...read<Idea[]>(MINE, [])])
  return idea
}

export const TAGS = ['Sourcing', 'CRM', 'Outreach', 'Integrations', 'Reporting', 'Rules']

/** What we have said we are doing, newest first. */
export interface Note { at: string; title: string; body: string }

export const NOTES: Note[] = [
  {
    at: '2026-09-20',
    title: 'A dashboard, and your own tags',
    body: 'The morning page is back with the work behind your leads on it. Tags are yours to make, filter on and write from the API.',
  },
  {
    at: '2026-09-19',
    title: 'Four ways of finding people',
    body: 'Instagram account search joins hashtags, neighbours and your own handles. Every lead says which one found it.',
  },
  {
    at: '2026-09-18',
    title: 'The judge reads the posts',
    body: 'Scoring now reads the last twelve posts, not only the bio, and says which country and language it found.',
  },
]
