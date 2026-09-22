import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// One browser profile per Instagram account, kept between runs.
//
// A fresh login every run is the thing that draws attention: a real person
// logs in once and stays logged in for months. The first run opens the browser
// on an empty profile and waits for the login to be done by hand.

export type Session = { dir: string; fresh: boolean }

export function sessionFor(root: string, account: string): Session {
  const dir = resolve(root, account.replace(/[^a-z0-9._-]/gi, '_'))
  const fresh = !existsSync(dir)
  mkdirSync(dir, { recursive: true })
  return { dir, fresh }
}
