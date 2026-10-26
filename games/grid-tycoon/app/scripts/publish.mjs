// Copy the built game to /games, the folder the site serves at
// jeremylasne.com/games. The host has no build step, so the output is
// committed. Only the names dist/ holds are replaced, so the source folder
// /games/grid-tycoon next to them is never touched.
import { cp, readdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(app, 'dist')
const out = resolve(app, '../..')

for (const name of await readdir(dist)) {
  if (name === 'grid-tycoon') throw new Error('dist must not hold a grid-tycoon entry: it would replace the source')
  await rm(resolve(out, name), { recursive: true, force: true })
  await cp(resolve(dist, name), resolve(out, name), { recursive: true })
}
console.log('published to /games')
