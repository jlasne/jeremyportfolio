/**
 * Gigawatt: wiring.
 *
 * Holds the clock, the pointer and the celebrations. It asks game.js for the
 * state and hands render.js the drawing.
 */

import { KIND, MODEL } from './rules.js';
import * as G from './game.js';
import * as world from './world.js';
import { createRenderer } from './render.js';
import { createUI, toast, floatText, money, clock } from './ui.js';
import * as board from './leaderboard.js';

const $ = (id) => document.getElementById(id);

const game = G.newGame();
const view = { hover: null, armed: null, selected: null, affordable: false, reachable: [], wireTo: null };
const renderer = createRenderer($('world'));

const actions = {
  /** Clicking the tool toggles it; the number key always picks it up. */
  toggle: (kind) => ui.setArmed(ui.armed === kind ? null : kind),
  arm: (kind) => ui.setArmed(kind),
  upgrade: (b) => {
    const cost = G.priceToUpgrade(game, b);
    if (!G.upgrade(game, b)) return;
    spend(cost, b);
    b.placedAt = now;
    celebrateUpgrade(b);
  },
  restart: (b) => {
    if (!G.restart(game, b)) return;
    floatText('back online', '#7ee06a', renderer.tileRect(b.x, b.y));
  },
  upgradeModel: () => {
    const next = MODEL.tiers[game.modelLevel];
    if (!G.upgradeModel(game)) return;
    toast(`${next.label} is live. Every datacenter runs ${Math.round((next.cool / MODEL.tiers[game.modelLevel - 2].cool - 1) * 100)}% cooler.`, true);
    once('first-model', () => toast('A better model cools the whole island. Level 5 datacenters need Ember 4 Ultra.'));
  },
};

const ui = createUI(game, actions);

// ---------------------------------------------------------------------------
// Celebrations, doled out once each
// ---------------------------------------------------------------------------

const seen = new Set();
const once = (key, fn) => { if (!seen.has(key)) { seen.add(key); fn(); } };

function celebrateUpgrade(b) {
  if (b.level === 5) once(`max-${b.kind}`, () =>
    toast(b.kind === KIND.PLANT
      ? 'A fusion ring. 81 MW, the most one tile carries.'
      : 'A compute mesa. 75 MW in, 81 tokens out.', true));
}

function celebrateProgress(s) {
  if (s.dcs.length) once('first-dc', () => toast('Your first datacenter. Tokens are money now.', true));
  const hundred = Math.floor(s.grid / 100) * 100;
  if (hundred >= 100) once(`mw-${hundred}`, () =>
    toast(`${hundred} megawatts`, hundred % 500 === 0));
  if (s.dcs.some((d) => d.dark)) once('first-dark', () =>
    toast('It hit 100% heat and shut down. Wait for 60%, then click it.', true));
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function spend(amount, at) {
  floatText(`−${money(amount)}`, '#ff9a76', renderer.tileRect(at.x, at.y));
}

$('world').addEventListener('mousemove', (e) => { view.hover = renderer.tileFromEvent(e); });
$('world').addEventListener('mouseleave', () => { view.hover = null; });

/**
 * Building is a click. Wiring is a drag: press a plant, pull to a datacenter,
 * let go. Pressing and releasing on the same building selects it.
 */
let dragFrom = null;

$('world').addEventListener('mousedown', (e) => {
  const tile = renderer.tileFromEvent(e);
  dragFrom = tile ? G.at(game, tile.x, tile.y) : null;
});

$('world').addEventListener('mouseup', (e) => {
  const tile = renderer.tileFromEvent(e);
  const from = dragFrom;
  dragFrom = null;
  if (!tile) return;
  const target = G.at(game, tile.x, tile.y);

  if (from && target && target !== from) {
    const pair = from.kind === KIND.PLANT ? [from, target] : [target, from];
    if (G.canLink(game, pair[0], pair[1])) {
      const did = G.toggleLink(game, pair[0], pair[1]);
      floatText(did === 'drawn' ? 'wired' : 'cut',
        did === 'drawn' ? '#ffd97a' : '#93a0b4', renderer.tileRect(tile.x, tile.y));
    }
    return;
  }

  if (target) {
    if (G.canRestart(target)) actions.restart(target);
    ui.setSelected(target);
    ui.setArmed(null);
    return;
  }

  if (ui.armed) {
    const cost = G.priceToBuild(game, ui.armed, tile.x, tile.y);
    const built = G.build(game, ui.armed, tile.x, tile.y);
    if (!built) return;
    built.placedAt = now;
    spend(cost, tile);
    ui.setSelected(built);
    return;
  }
  ui.setSelected(null);
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === '1') actions.arm(KIND.PLANT);
  if (e.key === '2') actions.arm(KIND.DC);
  if (e.key === 'Escape') { ui.setArmed(null); ui.setSelected(null); }
  if ((e.key === 'u' || e.key === 'U') && ui.selected) actions.upgrade(ui.selected);
});

window.addEventListener('resize', () => renderer.resize());

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

let now = 0;
let last = performance.now();
let running = false;

/**
 * Speed multiplies real seconds, never game seconds. A 26 minute run stays a
 * 26 minute run on the clock and the board, and 10x just gives you it back in
 * under 3 minutes of your own time. The world is stepped in 0.25s slices, so
 * heat and money behave the same at every speed.
 */
let speed = 1;
const SLICE = 0.25;

for (const button of document.querySelectorAll('#speeds button')) {
  button.onclick = () => {
    speed = Number(button.dataset.speed);
    for (const b of document.querySelectorAll('#speeds button')) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed));
    }
  };
}

function loop(t) {
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  now = t / 1000;

  if (running && !game.won) {
    let left = dt * speed;
    while (left > 0) { G.tick(game, Math.min(SLICE, left)); left -= SLICE; }
  }
  const s = G.snapshot(game);

  view.armed = ui.armed;
  view.selected = ui.selected;
  view.reachable = ui.selected
    ? game.buildings.filter((b) => {
        const pair = ui.selected.kind === KIND.PLANT ? [ui.selected, b] : [b, ui.selected];
        return b !== ui.selected && G.canLink(game, pair[0], pair[1]);
      })
    : [];
  view.dragFrom = dragFrom;
  view.wireTo = view.hover && (dragFrom
    ? G.at(game, view.hover.x, view.hover.y)
    : view.reachable.find((b) => b.x === view.hover.x && b.y === view.hover.y));
  view.affordable = ui.armed && view.hover
    ? game.money >= G.priceToBuild(game, ui.armed, view.hover.x, view.hover.y)
    : false;

  renderer.draw(game, s, view, now);
  ui.frame(s, dt);
  if (running) celebrateProgress(s);
  if (game.won && !$('win').classList.contains('on')) showWin();

  requestAnimationFrame(loop);
}

renderer.resize();
requestAnimationFrame(loop);

// The clock and the money live in this tab, so anyone who wants to rewrite
// them can. Hiding the handle would not change that, only the theatre of it.
window.gigawatt = { game, api: G, world };

$('start').onclick = () => {
  $('intro').classList.remove('on');
  running = true;
  ui.setArmed(KIND.PLANT);
};

// ---------------------------------------------------------------------------
// Finishing
// ---------------------------------------------------------------------------

async function showWin() {
  running = false;
  $('final').textContent = clock(game.winTime);
  const s = G.snapshot(game);
  $('win-line').innerHTML =
    `${game.buildings.length} buildings, ${s.plants.length} of them power plants, ` +
    `wired with ${game.links.length} lines, running ${s.tier.label}. ` +
    (game.darkSeconds > 5
      ? `Heat cost you ${Math.round(game.darkSeconds)} seconds of datacenter time.`
      : 'Every datacenter stayed lit the whole way.');
  $('win').classList.add('on');
  $('who').focus();
  paint(await board.load());
  $('board-note').textContent = board.isPublic
    ? 'The clock runs in your browser. Anyone can edit it. This board trusts you.'
    : 'This board stays on your machine. Your time is as honest as you are.';
}

function paint(rows, mine) {
  $('board').innerHTML = rows.length
    ? rows.map((r, i) => `<li${r === mine ? ' class="you"' : ''}>` +
        `<span>${i + 1}. ${escape(r.name)}</span><span class="t">${clock(r.seconds)}</span></li>`).join('')
    : '<li><span>Nobody yet</span><span class="t">00:00</span></li>';
}

const escape = (s) => String(s).replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

$('submit').onclick = async () => {
  $('submit').disabled = true;
  const { row, rows } = await board.submit($('who').value, Math.round(game.winTime * 100) / 100);
  paint(rows, rows.find((r) => r.at === row.at) || row);
  $('who').disabled = true;
};

$('again').onclick = () => location.reload();
