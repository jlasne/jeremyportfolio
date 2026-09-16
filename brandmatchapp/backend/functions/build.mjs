// Each function deploys as one folder. The shared file is the source of truth
// in _shared and is copied in next to the entrypoint at build time.
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '.build')
await rm(out, { recursive: true, force: true })

for (const name of await readdir(here)) {
  if (name.startsWith('_') || name.startsWith('.') || name.endsWith('.mjs')) continue
  if (!(await stat(resolve(here, name))).isDirectory()) continue
  await mkdir(resolve(out, name), { recursive: true })
  await cp(resolve(here, name, 'index.ts'), resolve(out, name, 'index.ts'))
  await cp(resolve(here, '_shared/lib.ts'), resolve(out, name, 'lib.ts'))
  console.log('bundled', name)
}
