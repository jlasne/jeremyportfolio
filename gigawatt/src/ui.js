/**
 * Gigawatt: the interface.
 *
 * Panels sit in the 4 corners. One rule covers all of them: every number eases
 * toward the truth instead of jumping, so the eye can follow what changed.
 */

import { KIND, MODEL, GIGAWATT_MW, RESTART_BELOW, MAX_LINES, restingHeat, spec } from './rules.js';
import { coolScore } from './world.js';
import * as G from './game.js';

const $ = (id) => document.getElementById(id);

/** Writing markup every frame is a parse every frame. Only write on change. */
const setHTML = (el, html) => { if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; } };
const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function money(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `$${Math.round(n / 1e3)}k`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  if (a >= 10 || a === 0) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;          // upkeep starts at $0.22, so show it
}

export const rate = (n) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}/s`;

export function mw(n) {
  if (n >= 100) return Math.round(n).toLocaleString();
  if (n >= 10) return n.toFixed(0);
  return n.toFixed(1);
}

export const clock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** A displayed number that walks to where it is going. */
class Counter {
  constructor(el, format, speed = 7) {
    this.el = el; this.format = format; this.speed = speed;
    this.shown = 0; this.target = 0; this.last = null;
  }
  set(v) { this.target = v; }
  jump(v) { this.target = this.shown = v; }
  step(dt) {
    const gap = this.target - this.shown;
    this.shown += Math.abs(gap) < 0.01 ? gap : gap * Math.min(1, dt * this.speed);
    const text = this.format(this.shown);
    if (text !== this.last) { this.el.textContent = this.last = text; }
  }
}

// ---------------------------------------------------------------------------

export function createUI(game, actions) {
  const gridEl = $('grid-value');
  const cMoney = new Counter($('money'), money, 9);
  const cGrid = new Counter({ set textContent(v) { gridEl.innerHTML = `${v} <small>MW</small>`; } }, mw, 5);
  const cUsed = new Counter($('l-used'), mw, 5);
  const cLost = new Counter($('l-lost'), mw, 5);
  const cSpare = new Counter($('l-spare'), mw, 5);
  const ticking = [cMoney, cGrid, cUsed, cLost, cSpare];

  const tools = {
    [KIND.PLANT]: $('tool-plant'),
    [KIND.DC]: $('tool-dc'),
  };
  tools[KIND.PLANT].onclick = () => actions.toggle(KIND.PLANT);
  tools[KIND.DC].onclick = () => actions.toggle(KIND.DC);
  $('upgrade-model').onclick = actions.upgradeModel;

  let armed = null;
  let selected = null;

  function setArmed(kind) {
    armed = kind;
    for (const [k, el] of Object.entries(tools)) el.setAttribute('aria-pressed', String(k === kind));
  }
  function setSelected(b) {
    selected = b;
    $('inspect').classList.toggle('on', !!b);
  }

  function frame(s, dt) {
    cMoney.set(game.money);
    cGrid.set(s.grid);
    cUsed.set(s.grid);
    cLost.set(s.lostInLines);
    cSpare.set(s.spare);
    for (const c of ticking) c.step(dt);

    // Where every megawatt the plants made ends up.
    const made = Math.max(s.supply, 0.001);
    setText($('made'), `Power made ${mw(s.supply)} MW`);
    const split = $('split');
    split.querySelector('.used').style.width = `${(s.grid / made) * 100}%`;
    split.querySelector('.lost').style.width = `${(s.lostInLines / made) * 100}%`;
    split.querySelector('.spare').style.width = `${(s.spare / made) * 100}%`;

    $('bar').firstElementChild.style.width = `${Math.min(100, (s.grid / GIGAWATT_MW) * 100)}%`;
    setText($('clock'), clock(game.won ? game.winTime : game.elapsed));

    const net = s.profit;
    setHTML($('flow'),
      `<b class="${net >= 0 ? 'up' : 'down'}">${rate(net)}</b> ` +
      `<span style="color:#5d6880">·</span> ${money(s.income)}/s in, ${money(s.upkeep)}/s upkeep`);

    // Build buttons
    for (const kind of [KIND.PLANT, KIND.DC]) {
      const el = tools[kind];
      const base = G.buildCostFor(game, kind);
      setText(el.querySelector('.c'), `${money(base.low)}–${money(base.high)}`);
      el.disabled = game.money < base.low;
      if (el.disabled && armed === kind) setArmed(null);
    }

    // The model
    const tier = s.tier;
    const next = MODEL.tiers[game.modelLevel];
    setText($('tier'), tier.label);
    setHTML($('use'), s.tokensDropped > 0.5
      ? `<span style="color:var(--heat)">full. ${mw(s.tokensDropped)} tokens/s wasted</span>`
      : `${mw(s.tokensUsed)} of ${tier.cap} tokens/s · ${money(tier.rate)} each`);
    const up = $('upgrade-model');
    up.disabled = !next || game.money < next.cost;
    setHTML(up, next
      ? `Upgrade to ${next.label}<span class="cost">${money(next.cost)}</span>`
      : 'Top tier reached');

    if (selected && !game.buildings.includes(selected)) setSelected(null);
    if (selected) drawInspector(game, s, selected, actions);
    setText($('hintbar'), hint(game, s, armed));
  }

  return { frame, setArmed, setSelected, get armed() { return armed; }, get selected() { return selected; } };
}

// ---------------------------------------------------------------------------
// The selected building
// ---------------------------------------------------------------------------

function drawInspector(game, s, b, actions) {
  const panel = $('inspect');
  const kindSpec = spec(b.kind);
  const lv = kindSpec.levels[b.level - 1];
  const next = kindSpec.levels[b.level];
  const cool = coolScore(b.x, b.y);
  const cost = G.priceToUpgrade(game, b);
  const canUp = Boolean(next) && game.money >= cost;

  // The panel holds live buttons, so it is only rebuilt when something
  // structural changes. Heat moves every frame and is written in place.
  const key = `${b.id}:${b.level}:${b.dark}:${canUp}`;
  if (panel.dataset.key !== key) {
    panel.dataset.key = key;
    const rows = [];
    if (b.kind === KIND.PLANT) {
      rows.push(['Output', `${mw(lv.mw)} MW`, next && `${mw(next.mw)} MW`]);
      rows.push(['Upkeep', `${money(lv.upkeep)}/s`, next && `${money(next.upkeep)}/s`]);
      rows.push(['Sending', '<span data-live="flow">0 MW</span>', null]);
    } else {
      rows.push(['Draw', `${mw(lv.draw)} MW`, next && `${mw(next.draw)} MW`]);
      rows.push(['Getting', '<span data-live="flow">0 MW</span>', null]);
      rows.push(['Tokens', '<span data-live="tokens">0/s</span>', next && `${mw(next.tokens)}/s`]);
      rows.push(['Cooling', cool > 0 ? `+${cool}` : `${cool}`, null]);
    }
    rows.push(['Lines', `<span data-live="lines">0</span>`, null]);
    const restNext = b.kind === KIND.DC && next ? restingHeat(b.level + 1, cool, game.modelLevel) : 0;
    panel.innerHTML = `
      <h3>${lv.label}</h3>
      <div class="sub">${kindSpec.name} · level ${b.level} of 5</div>
      <dl>${rows.map(([k, v, n]) =>
        `<dt>${k}</dt><dd>${v}${n ? ` <span style="color:var(--dim)">→ ${n}</span>` : ''}</dd>`).join('')}</dl>
      ${b.kind === KIND.DC ? `
        <div class="k" data-live="rest"></div>
        <div id="thermo"><i></i></div>` : ''}
      ${b.dark
        ? '<button class="go" id="act"></button>'
        : next
          ? `<button class="go" id="act" ${canUp ? '' : 'disabled'}>Upgrade to ${next.label}<span class="cost">${money(cost)}</span></button>`
          : '<button class="go" disabled>Fully upgraded</button>'}
      ${restNext >= 100 ? `<div class="note">Level ${b.level + 1} here settles at ${Math.round(Math.min(restNext, 999))}% and shuts down. Move to colder ground, or upgrade the model.</div>` : ''}
    `;
    const act = $('act');
    if (act) act.onclick = () => (b.dark ? actions.restart(b) : actions.upgrade(b));
  }

  const put = (name, text) => {
    const el = panel.querySelector(`[data-live="${name}"]`);
    if (el && el.textContent !== text) el.textContent = text;
  };
  const used = G.linksOf(game, b).length;
  put('lines', `${used} of ${MAX_LINES}`);

  if (b.kind === KIND.PLANT) {
    const sent = s.lines.filter((l) => l.from === b).reduce((n, l) => n + l.got, 0);
    put('flow', `${mw(sent)} MW`);
    return;
  }

  const live = s.live.find((l) => l.b === b);
  put('flow', `${mw(live ? live.got : 0)} of ${mw(lv.draw)} MW`);
  put('tokens', `${mw(lv.tokens * (live ? live.work : 0))}/s`);
  put('rest', b.dark
    ? 'Heat · shut down'
    : `Heat · settles at ${Math.round(Math.min(restingHeat(b.level, cool, game.modelLevel), 999))}%`);

  const bar = panel.querySelector('#thermo i');
  if (bar) {
    bar.style.width = `${Math.min(100, b.heat)}%`;
    bar.style.background = heatColour(b.heat);
  }
  const act = $('act');
  if (act && b.dark) {
    const ready = b.heat <= RESTART_BELOW;
    const label = ready ? 'Restart it' : `Cooling down… ${Math.round(b.heat)}%`;
    if (act.textContent !== label) act.textContent = label;
    act.disabled = !ready;
  }
}

const heatColour = (h) => (h > 72 ? 'var(--heat)' : h > 45 ? 'var(--power)' : 'var(--money)');

// ---------------------------------------------------------------------------
// One line of advice, and only when it is needed
// ---------------------------------------------------------------------------

function hint(game, s, armed) {
  if (armed) return 'Click a tile to place it. Esc puts the tool down.';
  if (game.buildings.length === 0) return 'Place a power plant, then a datacenter within 6 tiles of it.';
  if (s.dcs.length === 0) return 'A plant with nothing to feed earns $0. Build a datacenter beside it.';
  const cold = s.dcs.find((d) => d.dark && d.heat <= RESTART_BELOW);
  if (cold) return 'A datacenter has cooled off. Click it to start it again.';
  const starved = s.live.find((l) => l.got < l.draw * 0.98);
  if (starved) return `A datacenter is running at ${Math.round(100 * starved.work)}%. Feed it more power.`;
  if (s.tokensDropped > 0.5) return 'Your model is full. Upgrade it to keep the extra tokens.';
  if (s.spare > s.supply * 0.2) return `${Math.round(s.spare)} MW is going spare. Add a datacenter, or a line to one.`;
  if (game.buildings.length < 6) return 'Drag from a plant to a datacenter to wire them together.';
  return '';
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function toast(text, big = false) {
  const el = document.createElement('div');
  el.className = big ? 'toast big' : 'toast';
  el.textContent = text;
  $('toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}

export function floatText(text, colour, rect) {
  const el = document.createElement('div');
  el.className = 'float';
  el.style.color = colour;
  el.style.left = `${rect.left + rect.size / 2}px`;
  el.style.top = `${rect.top - 4}px`;
  el.textContent = text;
  $('labels').append(el);
  setTimeout(() => el.remove(), 1100);
}
