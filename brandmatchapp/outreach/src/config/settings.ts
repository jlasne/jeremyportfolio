import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Every knob in one place, and one rule about where a value comes from:
// defaults, then config/settings.json, then the environment. The environment
// wins because that is where the keys live, and a key in a JSON file is a key
// that ends up in a commit.

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export type Range = [number, number]

export type ModelSettings = {
  /**
   * The OpenRouter slug, always `vendor/model`. A bare name is rejected.
   *
   * The defaults are the two the brandmatch backend already runs, so a first
   * run works before anything is tuned. Swap them for whatever judges best.
   */
  model: string
  /**
   * USD per million tokens. This feeds the cost log and nothing else: the
   * bill is whatever OpenRouter charges, whatever is written here. Copy the
   * two numbers off the model's page so the log matches the invoice.
   */
  priceIn: number
  priceOut: number
}

export type Settings = {
  openrouter: {
    apiKey: string
    baseUrl: string
    /** Reads the page as text and picks one action. Runs on every step. */
    decide: ModelSettings
    /**
     * Looks at a screenshot when the text alone settles nothing.
     *
     * Off by default. Off still logs the step it would have taken, so after a
     * week you know what the fallback is worth before paying for it.
     */
    vision: ModelSettings & { enabled: boolean }
  }
  brandmatch: {
    apiBase: string
    apiKey: string
    /** Absent means every campaign on the account. */
    campaignId?: string
    /** Which leads to write to. 'new' is the daily list nobody has touched. */
    status: 'new' | 'contacted' | 'replied' | 'call' | 'signed' | 'lost'
    /** Only leads the client saved. */
    savedOnly: boolean
    /** Written on the lead when a message goes out. */
    markAs: 'contacted'
  }
  instagram: {
    /** The Instagram account sending. One browser profile per account. */
    account: string
    /** Where profiles are opened. Moved only to point a test at a local page. */
    baseUrl: string
    /** Messages a day, per account. The run stops at it and resumes tomorrow. */
    dailyCap: number
    /** Seconds between two messages. */
    betweenDms: Range
    /** Seconds on the profile before opening the composer. */
    afterProfile: Range
    /** Milliseconds between two characters. */
    typing: Range
  }
  browser: {
    headless: boolean
    viewport: { width: number; height: number }
    /** Where the logged in profiles live. One folder per account. */
    sessionRoot: string
    /**
     * The Chrome to drive. Absent uses the one Playwright ships with.
     *
     * Point it at the everyday Chrome on this machine and the account runs on
     * the browser build, fonts and settings it already logs in from. Set it
     * with CHROME_PATH, or here.
     */
    executablePath?: string
  }
  costs: {
    /** Zero on a local browser. Kept so the log reads the same either way. */
    browserUsdPerHour: number
  }
  limits: {
    /** Steps the model gets to reach one goal before the lead is skipped. */
    maxStepsPerGoal: number
  }
  paths: { logs: string }
}

const DEFAULTS: Settings = {
  openrouter: {
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    decide: { model: 'deepseek/deepseek-v4-flash', priceIn: 0.1, priceOut: 0.3 },
    vision: { enabled: false, model: 'google/gemini-2.5-flash', priceIn: 0.3, priceOut: 0.9 },
  },
  brandmatch: {
    apiBase: 'https://limitless-ladybug-747.eu-west-1.convex.site',
    apiKey: '',
    status: 'new',
    savedOnly: false,
    markAs: 'contacted',
  },
  instagram: {
    account: 'default',
    baseUrl: 'https://www.instagram.com',
    dailyCap: 50,
    betweenDms: [20, 90],
    afterProfile: [3, 9],
    typing: [40, 160],
  },
  browser: {
    headless: false,
    viewport: { width: 1280, height: 900 },
    sessionRoot: resolve(ROOT, 'sessions'),
  },
  costs: { browserUsdPerHour: 0 },
  limits: { maxStepsPerGoal: 8 },
  paths: { logs: resolve(ROOT, 'logs') },
}

type Deep<T> = { [K in keyof T]?: T[K] extends object ? Deep<T[K]> : T[K] }

function merge<T>(base: T, over: Deep<T> | undefined): T {
  if (!over) return base
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (v === undefined) continue
    const prev = out[k]
    const plain = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x)
    out[k] = plain(prev) && plain(v) ? merge(prev, v as never) : v
  }
  return out as T
}

export function load(file = resolve(ROOT, 'config', 'settings.json')): Settings {
  const onDisk = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Deep<Settings>) : undefined
  const s = merge(DEFAULTS, onDisk)

  s.openrouter.apiKey = process.env.OPENROUTER_API_KEY ?? s.openrouter.apiKey
  // The same two names the Convex backend reads, so one export covers both.
  s.openrouter.decide.model = process.env.OPENROUTER_MODEL ?? s.openrouter.decide.model
  s.openrouter.vision.model = process.env.OPENROUTER_VISION_MODEL ?? s.openrouter.vision.model
  s.brandmatch.apiKey = process.env.BRANDMATCH_API_KEY ?? s.brandmatch.apiKey
  s.brandmatch.apiBase = (process.env.BRANDMATCH_API ?? s.brandmatch.apiBase).replace(/\/$/, '')
  s.browser.executablePath = process.env.CHROME_PATH ?? s.browser.executablePath
  return s
}

/** What the run cannot start without. Said once, in full, rather than crashing later. */
export function missing(s: Settings): string[] {
  const out: string[] = []
  if (!s.openrouter.apiKey) out.push('OPENROUTER_API_KEY is not set')
  if (!s.brandmatch.apiKey) out.push('BRANDMATCH_API_KEY is not set')
  if (!s.instagram.account || s.instagram.account === 'default') {
    out.push('instagram.account is still "default". Name the sending account, the browser profile follows it.')
  }
  return out
}
