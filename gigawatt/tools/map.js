/** Prints the island's cooling geography, so the map can be tuned by eye. */
import { ISLAND, WIDTH, HEIGHT, coolScore, isBuildable, tileAt, buildableTiles } from '../src/world.js';
import { restingHeat, MODEL } from '../src/rules.js';

const pad = (s, n) => String(s).padStart(n);
console.log('    ' + Array.from({ length: WIDTH }, (_, i) => pad(i % 10, 4)).join(''));
for (let y = 0; y < HEIGHT; y++) {
  let row = pad(y, 3) + ' ';
  for (let x = 0; x < WIDTH; x++) {
    row += isBuildable(x, y) ? pad(coolScore(x, y), 4) : pad(tileAt(x, y), 4);
  }
  console.log(row);
}
const t = buildableTiles();
const cs = t.map((p) => coolScore(p.x, p.y));
console.log(`\nbuildable ${t.length}   grass ${t.filter(p=>tileAt(p.x,p.y)==='.').length}   desert ${t.filter(p=>tileAt(p.x,p.y)===':').length}`);
for (const lv of [3, 4, 5]) {
  const row = MODEL.tiers.map((_, mi) =>
    `M${mi + 1}:${cs.filter((c) => restingHeat(lv, c, mi + 1) < 95).length}`).join('  ');
  console.log(`tiles that can host a level-${lv} datacenter   ${row}`);
}
