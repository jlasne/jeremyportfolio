import { Stagehand } from '@browserbasehq/stagehand'
import type { Settings } from '../config/settings.js'
import type { Candidate, PageState, Role } from './types.js'
import { sleep, pick } from '../instagram/pacing.js'

// Stagehand drives a real Chrome on this machine, on a profile that stays
// logged in between runs.
//
// The page is read as text. Everything that can be clicked or typed into is
// collected with its accessible name, the same string a screen reader would
// announce, and that list is the whole picture the model gets. No screenshot,
// no pixels, unless the fallback is switched on and the list settles nothing.

const MAX_CANDIDATES = 40

export class Browser {
  private constructor(
    private readonly sh: InstanceType<typeof Stagehand>,
    private readonly typing: [number, number],
    private readonly entry: 'paste' | 'type',
  ) {}

  static async open(s: Settings, userDataDir: string): Promise<Browser> {
    // Stagehand still wires up a default provider it will never be asked to
    // use, and complains at startup about the key for it. Nothing here calls a
    // model, so a placeholder keeps that noise out of a run's output. It is
    // set on this process only and reaches nothing outside it.
    if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = 'unused-by-this-agent'

    const sh = new Stagehand({
      env: 'LOCAL',
      verbose: 0,
      // No model is named here on purpose.
      //
      // Stagehand checks the name against its own list of providers before it
      // opens anything, and ours is not on it, so naming the loop's model
      // stopped the browser from starting at all. Nothing in this file asks a
      // model: act, extract and observe are never called, and the loop talks
      // to OpenRouter itself.
      localBrowserLaunchOptions: {
        userDataDir,
        // Without this Stagehand deletes the profile folder when it closes, and
        // the account is logged out again on the next run. The whole point of a
        // persistent profile is that the login survives.
        preserveUserDataDir: true,
        headless: s.browser.headless,
        viewport: s.browser.viewport,
        executablePath: s.browser.executablePath,
      },
    })
    try {
      await sh.init()
    } catch (err) {
      // The one failure everybody hits on a fresh machine, answered with the
      // two ways out rather than with Playwright's own message.
      if (/Executable doesn't exist|playwright install/i.test(String(err))) {
        throw new Error(
          'No browser to drive. Either point CHROME_PATH at the Chrome on this machine, ' +
            'or run: npx playwright install chromium',
        )
      }
      throw err
    }
    return new Browser(sh, s.instagram.typing, s.instagram.entry)
  }

  get page() {
    return this.sh.page
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' })
  }

  /** The page as a numbered list. The number is written into the element too. */
  async state(): Promise<PageState> {
    const candidates = await this.page.evaluate((cap: number) => {
      const sel = [
        'a[href]',
        'button',
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        '[role="tab"]',
        'input:not([type="hidden"])',
        'textarea',
        '[contenteditable="true"]',
        '[role="textbox"]',
      ].join(',')

      // Last scan's numbers are cleared first. Instagram rebuilds the page
      // constantly, so a number left behind from an earlier scan can end up on
      // a different element, and a click on it lands somewhere nobody chose.
      for (const old of Array.from(document.querySelectorAll('[data-bm-i]'))) old.removeAttribute('data-bm-i')

      const seen = new Set<string>()
      const out: { i: number; role: string; name: string; editable: boolean }[] = []
      let i = 0
      let found = 0

      for (const node of Array.from(document.querySelectorAll(sel))) {
        const el = node as HTMLElement
        const style = window.getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue
        const box = el.getBoundingClientRect()
        if (box.width < 4 || box.height < 4) continue
        if (box.bottom < 0 || box.top > window.innerHeight * 2) continue

        const input = el as HTMLInputElement
        const editable =
          el.isContentEditable ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'INPUT' ||
          el.getAttribute('role') === 'textbox'

        const name = (
          el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          (el.innerText || '') ||
          input.value ||
          el.getAttribute('title') ||
          ''
        )
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80)

        // An unnamed control cannot be described to the model, and an empty
        // message box is the one exception worth keeping.
        if (!name && !editable) continue

        const role = el.getAttribute('role') || el.tagName.toLowerCase()
        const key = `${role}:${name}`
        if (seen.has(key)) continue
        seen.add(key)

        found++
        // Counted before the cap, so the log can say the list was cut rather
        // than leaving a missing button looking like a missing button.
        if (i >= cap) continue

        el.setAttribute('data-bm-i', String(i))
        out.push({ i, role, name: name || '(empty text box)', editable })
        i++
      }
      return { list: out, found }
    }, MAX_CANDIDATES)

    return {
      url: this.page.url(),
      title: await this.page.title(),
      candidates: candidates.list.map((c): Candidate => ({ i: c.i, role: asRole(c.role, c.editable), name: c.name, editable: c.editable })),
      found: candidates.found,
    }
  }

  async click(i: number): Promise<void> {
    // Strict: two elements wearing one number is a bug, and picking the first
    // of them quietly is how a run spends eight steps clicking nothing.
    await this.page.locator(`[data-bm-i="${i}"]`).click({ timeout: 10_000 })
  }

  /**
   * Puts text into a box. The model never supplies it: it chooses where the
   * text goes, the caller decides what the text is.
   *
   * Pasting is the default. A box the page rebuilds while you type loses
   * keystrokes, and a prepared message arriving at once is what a person
   * pasting one looks like anyway.
   */
  async type(i: number, text: string): Promise<void> {
    await this.page.locator(`[data-bm-i="${i}"]`).click({ timeout: 10_000 })
    if (this.entry === 'paste') {
      await this.page.keyboard.insertText(text)
      return
    }
    for (const ch of text) {
      await this.page.keyboard.type(ch)
      await sleep(pick(this.typing))
    }
  }

  async pressEnter(): Promise<void> {
    await this.page.keyboard.press('Enter')
  }

  /** What a box holds now. The only way the run can tell a sent message from a stuck one. */
  async textOf(i: number): Promise<string> {
    return await this.page.evaluate((n: number) => {
      const el = document.querySelector(`[data-bm-i="${n}"]`) as HTMLInputElement | null
      if (!el) return ""
      return el.value ?? el.innerText ?? ""
    }, i)
  }

  async screenshot(): Promise<string> {
    const buf = await this.page.screenshot({ type: 'jpeg', quality: 55 })
    return Buffer.from(buf).toString('base64')
  }

  async settle(ms = 1200): Promise<void> {
    await sleep(ms)
  }

  async close(): Promise<void> {
    await this.sh.close()
  }
}

function asRole(raw: string, editable: boolean): Role {
  if (editable) return 'textbox'
  if (raw === 'a' || raw === 'link') return 'link'
  if (raw === 'button' || raw === 'menuitem' || raw === 'tab') return 'button'
  return 'other'
}
