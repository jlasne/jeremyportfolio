/**
 * Gigawatt — one file.
 *
 * The game runs unbundled: index.html loads src/main.js and the browser does
 * the rest, which is the point of having no build step. But a single file is
 * easier to hand to somebody, so this folds the modules into one page.
 *
 * It is not a general bundler and does not try to be. It handles the two
 * import forms this project actually uses — named and namespace, relative
 * paths only — and would rather throw than guess.
 *
 *   node tools/bundle.js out.html
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Depth-first through the import graph, so a module is emitted after its dependencies. */
function collect(entry, seen = new Map(), order = []) {
  if (seen.has(entry)) return order;
  const source = fs.readFileSync(path.join(ROOT, 'src', entry), 'utf8');
  const imports = [...source.matchAll(/^import\s+(?:\*\s+as\s+(\w+)|\{([\s\S]*?)\})\s+from\s+'\.\/([\w.]+)';/gm)]
    .map((m) => ({ namespace: m[1], names: m[2], from: m[3], text: m[0] }));
  seen.set(entry, true);
  for (const i of imports) collect(i.from, seen, order);

  const exports = [...source.matchAll(/^export\s+(?:async\s+)?(?:const|let|function|class)\s+([\w$]+)/gm)]
    .map((m) => m[1]);
  if (/^export\s/m.test(source.replace(/^export\s+(?:async\s+)?(?:const|let|function|class)\s/gm, ''))) {
    throw new Error(`${entry}: an export form this bundler does not understand`);
  }

  let body = source;
  for (const i of imports) body = body.replace(i.text, '');
  body = body.replace(/^export\s+/gm, '');

  order.push({ entry, imports, exports, body });
  return order;
}

const slug = (f) => '__' + f.replace(/\W/g, '_');

export function bundle(entry = 'main.js') {
  return collect(entry).map(({ entry: name, imports, exports, body }) => {
    const wiring = imports.map((i) => i.namespace
      ? `const ${i.namespace} = ${slug(i.from)};`
      : `const {${i.names.replace(/\s+/g, ' ').trim()}} = ${slug(i.from)};`).join('\n');
    return `// ${'─'.repeat(20)} src/${name}\n` +
      `const ${slug(name)} = (() => {\n${wiring}\n${body}\nreturn {${exports.join(', ')}};\n})();`;
  }).join('\n\n');
}

const out = process.argv[2];
if (out) {
  const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<link rel="icon"[^>]*>\n?/, '')
    .replace(/<meta property="og:[^>]*>\n?/g, '')
    .replace('<script type="module" src="./src/main.js"></script>',
      `<script type="module">\n${bundle()}\n</script>`);
  fs.writeFileSync(out, page);
  console.log(`${out} — ${(page.length / 1024).toFixed(0)} KB`);
}
