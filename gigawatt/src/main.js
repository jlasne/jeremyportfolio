/**
 * Gigawatt — wiring.
 *
 * Holds the clock, the pointer and the celebrations. Everything it knows about
 * the game it asks game.js for; everything it draws it hands to render.js.
 */

import { KIND, MODEL } from './rules.js';
import * as G from './game.js';
import { createRenderer } from './render.js';
import { createUI, toast, floatText, money, clock } from './ui.js';
import * as board from './leaderboard.js';

const $ = (id) => document.getElementById(id);

const game = G.newGame();
const view = { hover: null, armed: null, selected: null, affordable: false };
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
    toast(`${next.label} is live — every datacenter runs cooler`, true);
    once('first-model', () => toast('Better models schedule work better. That is what keeps the big machines alive.'));
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
    toast(b.kind === KIND.PLANT ? 'A fusion ring. Nothing on this island makes more power.' : 'A compute mesa. The biggest thing you can build.', true));
}

function celebrateProgress(s) {
  if (s.dcs.length) once('first-dc', () => toast('Your first datacenter. Tokens are money now.', true));
  const hundred = Math.floor(s.grid / 100) * 100;
  if (hundred >= 100) once(`mw-${hundred}`, () =>
    toast(`${hundred} megawatts`, hundred % 500 === 0));
  if (s.dcs.some((d) => d.dark)) once('first-dark', () =>
    toast('It overheated and shut down. Let it cool, then click it.', true));
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function spend(amount, at) {
  floatText(`−${money(amount)}`, '#ff9a76', renderer.tileRect(at.x, at.y));
}

$('world').addEventListener('mousemove', (e) => { view.hover = renderer.tileFromEvent(e); });
$('world').addEventListener('mouseleave', () => { view.hover = null; });

$('world').addEventListener('click', (e) => {
  const tile = renderer.tileFromEvent(e);
  if (!tile) return;
  const existing = G.at(game, tile.x, tile.y);

  if (ui.armed && !existing) {
    const cost = G.priceToBuild(game, ui.armed, tile.x, tile.y);
    const built = G.build(game, ui.armed, tile.x, tile.y);
    if (!built) return;
    built.placedAt = now;
    spend(cost, tile);
    ui.setSelected(built);
    return;
  }
  if (existing) {
    if (G.canRestart(existing)) actions.restart(existing);
    ui.setSelected(existing);
    ui.setArmed(null);
  } else {
    ui.setSelected(null);
  }
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

function loop(t) {
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  now = t / 1000;

  if (running && !game.won) G.tick(game, dt);
  const s = G.snapshot(game);

  view.armed = ui.armed;
  view.selected = ui.selected;
  view.affordable = ui.armed && view.hover
    ? game.money >= G.priceToBuild(game, ui.armed, view.hover.x, view.hover.y)
    : false;

  renderer.draw(game, view, now);
  ui.frame(s, dt);
  if (running) celebrateProgress(s);
  if (game.won && !$('win').classList.contains('on')) showWin();

  requestAnimationFrame(loop);
}

renderer.resize();
requestAnimationFrame(loop);

// The clock and the money live in this tab, so anyone who wants to rewrite
// them can. Hiding the handle would not change that, only the theatre of it.
window.gigawatt = { game, api: G };

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
    `${game.buildings.length} buildings, ${s.plants.length} of them power plants, on ${s.tier.label}.` +
    (game.darkSeconds > 5 ? ` You lost ${Math.round(game.darkSeconds)} seconds of datacenter time to heat.` : ' Nothing ever overheated.');
  $('win').classList.add('on');
  $('who').focus();
  paint(await board.load());
  $('board-note').textContent = board.isPublic
    ? 'The clock runs in your browser, so anyone who wants to can lie to it. There are no checks here, because none of them would work.'
    : 'This board lives on your machine only — nothing is sent anywhere. Times are as honest as you are.';
}

function paint(rows, mine) {
  $('board').innerHTML = rows.length
    ? rows.map((r, i) => `<li${r === mine ? ' class="you"' : ''}>` +
        `<span>${i + 1}. ${escape(r.name)}</span><span class="t">${clock(r.seconds)}</span></li>`).join('')
    : '<li><span>Nobody yet</span><span class="t">—</span></li>';
}

const escape = (s) => String(s).replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

$('submit').onclick = async () => {
  $('submit').disabled = true;
  const { row, rows } = await board.submit($('who').value, Math.round(game.winTime * 100) / 100);
  paint(rows, rows.find((r) => r.at === row.at) || row);
  $('who').disabled = true;
};

$('again').onclick = () => location.reload();
