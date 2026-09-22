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
  ) {}

  static async open(s: Settings, userDataDir: string): Promise<Browser> {
    const sh = new Stagehand({
      env: 'LOCAL',
      verbose: 0,
      // Stagehand needs a model for its own helpers. It is the same cheap one
      // the loop uses, so a stray call cannot quietly cost more than a step.
      modelName: s.openrouter.decide.model,
      modelClientOptions: { apiKey: s.openrouter.apiKey, baseURL: s.openrouter.baseUrl },
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
    return new Browser(sh, s.instagram.typing)
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

      const seen = new Set<string>()
      const out: { i: number; role: string; name: string; editable: boolean }[] = []
      let i = 0

      for (const node of Array.from(document.querySelectorAll(sel))) {
        if (i >= cap) break
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

        el.setAttribute('data-bm-i', String(i))
        out.push({ i, role, name: name || '(empty text box)', editable })
        i++
      }
      return out
    }, MAX_CANDIDATES)

    return {
      url: this.page.url(),
      title: await this.page.title(),
      candidates: candidates.map((c): Candidate => ({ i: c.i, role: asRole(c.role, c.editable), name: c.name, editable: c.editable })),
    }
  }

  async click(i: number): Promise<void> {
    await this.page.click(`[data-bm-i="${i}"]`, { timeout: 10_000 })
  }

  /**
   * Types into a box, one character at a time, with a different pause between
   * each. The model never supplies this text: it chooses where to type, the
   * caller decides what.
   */
  async type(i: number, text: string): Promise<void> {
    await this.page.click(`[data-bm-i="${i}"]`, { timeout: 10_000 })
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
