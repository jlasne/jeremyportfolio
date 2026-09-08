// Copy the built app up to /brandmatchapp, the folder the site serves.
// The host has no build step, so the output is committed.
import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(app, 'dist')
const out = resolve(app, '..')

await rm(resolve(out, 'assets'), { recursive: true, force: true })
await mkdir(resolve(out, 'assets'), { recursive: true })
for (const name of await readdir(dist)) {
  await cp(resolve(dist, name), resolve(out, name), { recursive: true })
}
console.log('published to /brandmatchapp')
