import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platform, homedir } from 'node:os'

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
   * Which door it answers at.
   *
   * 'chat' is the usual completions endpoint, and the answer arrives as text
   * to be read as JSON. 'decisions' is for models that return a typed choice:
   * the options go up as a question and the pick comes back named, with no
   * prose in between and nothing to parse.
   */
  endpoint?: 'chat' | 'decisions'
  /**
   * Tried in order when the first one errors. They can sit at different doors,
   * which is why this is a list of models and not a list of names.
   */
  fallbacks?: Omit<ModelSettings, 'fallbacks'>[]
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
    /**
     * Below this, a decision model saying "nothing here" is not believed.
     *
     * It answers with a spread over every option, so a 19% "nothing serves
     * the goal" is a shrug, not a finding, and the real options it scored
     * underneath are better evidence than the word on top.
     */
    minConfidence: number
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
    /**
     * How a conversation gets opened.
     *
     * 'direct' starts at the new-message screen and searches for the handle.
     * 'profile' opens the profile and presses its Message button, which on a
     * real account did nothing at all: the button changed neither the address
     * nor anything on the page.
     */
    openWith: 'direct' | 'profile'
    /** Messages a day, per account. The run stops at it and resumes tomorrow. */
    dailyCap: number
    /** Seconds between two messages. */
    betweenDms: Range
    /** Seconds on the profile before opening the composer. */
    afterProfile: Range
    /** Milliseconds between two characters, when typing one at a time. */
    typing: Range
    /**
     * How the message gets into the box.
     *
     * 'paste' puts it in at once, the way a person pasting a prepared message
     * does, and is far less fragile than keystrokes into a box the page
     * rebuilds as you type. 'type' sends it character by character with a
     * different pause after each, which takes about twelve seconds a message
     * and looks like someone writing it there and then.
     */
    entry: 'paste' | 'type'
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
    minConfidence: 0.35,
    // Jev is a decision model: it answers with a typed choice, which is
    // exactly the shape of every question this loop asks. Its output is free,
    // so a step costs only what the page description costs to read.
    decide: {
      model: 'typesafe/jev-1.13',
      endpoint: 'decisions',
      priceIn: 0.042,
      priceOut: 0,
      fallbacks: [
        { model: 'deepseek/deepseek-v4-flash-0731', endpoint: 'chat', priceIn: 0.04, priceOut: 0.64 },
      ],
    },
    vision: {
      enabled: false,
      model: 'deepseek/deepseek-v4-flash-vision-exp',
      priceIn: 0.22,
      priceOut: 0.66,
    },
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
    openWith: 'direct',
    dailyCap: 50,
    betweenDms: [15, 30],
    afterProfile: [3, 9],
    typing: [40, 160],
    entry: 'paste',
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
  s.browser.executablePath = process.env.CHROME_PATH ?? s.browser.executablePath ?? findChrome()
  return s
}

/**
 * The Chrome already on this machine.
 *
 * Playwright stopped downloading a browser on install, so without this the
 * first run dies on a missing binary. The Chrome someone already browses with
 * is the better one to drive anyway: it is the build, the fonts and the
 * version Instagram has seen this person use.
 *
 * Absent, Playwright is left to find its own, which is what `npx playwright
 * install chromium` provides.
 */
export function findChrome(): string | undefined {
  const home = homedir()
  const candidates: Record<string, string[]> = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      resolve(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ],
  }
  return (candidates[platform()] ?? []).find((p) => existsSync(p))
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
