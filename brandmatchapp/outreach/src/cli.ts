import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { resolve } from 'node:path'
import { load, missing, ROOT, type Settings } from './config/settings.js'
import { Browser } from './core/browser.js'
import { Log } from './core/log.js'
import { DailyCap } from './instagram/limiter.js'
import { run } from './instagram/outreach.js'
import { sessionFor } from './instagram/session.js'
import { loadTemplates } from './instagram/template.js'

// The whole surface: run, status, login.
//
// Sending is behind a flag and stays behind it. The default writes the message
// into the box and stops, which is the only setting that can be run without
// reading the output first.

const HELP = `
brandmatch outreach

  npm run build
  node dist/cli.js run                 write the message, stop before sending
  node dist/cli.js run --send          send, at the configured pace
  node dist/cli.js run --send --approve   ask in the terminal before each send
  node dist/cli.js status              what was sent today, and what it cost
  node dist/cli.js login               open the browser to log the account in

Flags
  --account <name>      which Instagram account, and which browser profile
  --campaign <id>       one brandmatch campaign instead of all
  --limit <n>           stop after n leads this run
  --templates <path>    messages file, default config/templates.json
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const command = argv[0] ?? 'help'
  const flag = (name: string): string | undefined => {
    const at = argv.indexOf(`--${name}`)
    return at >= 0 ? argv[at + 1] : undefined
  }
  const has = (name: string) => argv.includes(`--${name}`)

  if (command === 'help' || has('help')) {
    console.log(HELP)
    return 0
  }

  const s: Settings = load()
  const account = flag('account')
  if (account) s.instagram.account = account
  const campaign = flag('campaign')
  if (campaign) s.brandmatch.campaignId = campaign

  if (command === 'status') {
    const log = new Log(s.paths.logs, s.costs.browserUsdPerHour)
    const cap = new DailyCap(s.paths.logs, s.instagram.dailyCap)
    const day = log.day()
    console.log(`account        ${s.instagram.account}`)
    console.log(`sent today     ${cap.sentToday(s.instagram.account)} of ${s.instagram.dailyCap}`)
    console.log(`leads touched  ${day.dms}`)
    console.log(`cost today     $${day.usd.toFixed(4)}`)
    console.log(`vision         ${s.openrouter.vision.enabled ? 'on' : 'off'}`)
    console.log(`chrome         ${s.browser.executablePath ?? "Playwright's own"}`)
    console.log(`profile        ${sessionFor(s.browser.sessionRoot, s.instagram.account).dir}`)
    return 0
  }

  if (command === 'login') {
    // No key is needed to log in. Opening a browser and typing a password is
    // not a decision, so no model is asked and none has to be paid for.
    const session = sessionFor(s.browser.sessionRoot, s.instagram.account)
    const browser = await Browser.open({ ...s, browser: { ...s.browser, headless: false } }, session.dir)
    await browser.goto(`${s.instagram.baseUrl}/`)
    console.log(`Log in as ${s.instagram.account} in the window that opened.`)
    console.log(`The profile is kept at ${session.dir} and reused every run.`)

    // The window has to outlive this line. Closing the browser is what writes
    // the profile to disk, and exiting here would take the window with it
    // before anything was typed into it.
    const wait = createInterface({ input: process.stdin, output: process.stdout })
    await wait.question('\nPress Enter once you are logged in. ')
    wait.close()
    await browser.close()
    console.log('Saved. Run a dry pass next: node dist/cli.js run --limit 3')
    return 0
  }

  if (command !== 'run') {
    console.log(HELP)
    return 1
  }

  const problems = missing(s)
  if (problems.length > 0) {
    for (const p of problems) console.error(`- ${p}`)
    return 1
  }

  const file = resolve(flag('templates') ?? resolve(ROOT, 'config', 'templates.json'))
  if (!existsSync(file)) {
    console.error(`No templates at ${file}. Copy src/config/templates.example.json and edit it.`)
    return 1
  }

  const templates = loadTemplates(file)
  const log = new Log(s.paths.logs, s.costs.browserUsdPerHour)
  const limitRaw = Number(flag('limit'))
  const send = has('send')

  console.log(send ? 'SENDING. Messages will leave the account.' : 'Dry run. The message is written and left unsent.')

  const summary = await run(s, log, templates, {
    send,
    approve: has('approve'),
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
  })

  console.log('')
  console.log(`attempted ${summary.attempted}  sent ${summary.sent}  drafted ${summary.drafted}  skipped ${summary.skipped}  failed ${summary.failed}`)
  console.log(`cost $${summary.usd.toFixed(4)}  left today ${summary.remainingToday}`)
  return summary.failed > 0 && summary.sent === 0 && summary.drafted === 0 ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
