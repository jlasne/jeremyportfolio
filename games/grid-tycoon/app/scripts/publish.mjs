// Copy the built game up to /games/grid-tycoon, the folder the site serves.
// The host has no build step, so the output is committed.
import { cp, readdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(app, 'dist')
const out = resolve(app, '..')

await rm(resolve(out, 'assets'), { recursive: true, force: true })
for (const name of await readdir(dist)) {
  await rm(resolve(out, name), { recursive: true, force: true })
  await cp(resolve(dist, name), resolve(out, name), { recursive: true })
}
console.log('published to /games/grid-tycoon')
