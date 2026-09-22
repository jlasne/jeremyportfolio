// The shapes the loop passes around. Small on purpose: the page arrives as a
// short list of named things, and a step leaves as one action.

export type Role = 'button' | 'link' | 'textbox' | 'other'

/** One thing on the page that can be clicked or typed into. */
export type Candidate = {
  /** Its number in the list shown to the model, and its handle in the page. */
  i: number
  role: Role
  /** The accessible name: aria-label, placeholder, or the visible text. */
  name: string
  editable: boolean
}

export type PageState = {
  url: string
  title: string
  candidates: Candidate[]
  /** How many the page really had. More than `candidates` means it was cut. */
  found: number
}

export type Usage = { tokensIn: number; tokensOut: number; usd: number }

export type Choice =
  | { kind: 'click'; i: number; why: string }
  | { kind: 'type'; i: number; why: string }
  | { kind: 'done'; why: string }
  | { kind: 'stuck'; why: string }

export type Decision = Choice & { source: 'text' | 'vision'; usage: Usage }

export type Step = {
  at: string
  goal: string
  url: string
  candidates: number
  decision: Decision | null
  /** Set when the text model gave up and the fallback is switched off. */
  visionSkipped?: boolean
  /** Set when the page answered the goal itself and no model was asked. */
  reachedWithoutModel?: boolean
  /**
   * What the model was shown, and what it said back.
   *
   * Written on every step. A rejected answer used to leave nothing behind but
   * "the page settled nothing", which says what happened and never why.
   */
  saw?: string[]
  replied?: string
  /** The page had more than the list could hold, so the answer may be off it. */
  truncated?: boolean
  /** Options withheld from the model because clicking them did nothing. */
  dropped?: string[]
  error?: string
}
