/* jeremylasne.com/workout: the program, the 11-week wave, the maxes and the log.

   Read only. The sets come from two places: workout/record.js, the top sets
   of each week I give by hand, and the Gym sessions of the wellness log (the
   same server as /wellness), each exercise a name, reps and kg.

   Program weeks are calendar weeks, Monday to Sunday, from START. */

import { load, today, allSessions, esc, short } from '/wellness/data.js';
import { exercises, daysBetween, shift } from '/wellness/spec.js';
import { RECORD } from '/workout/record.js';

/* the Monday of week 1 */
const START = '2026-10-19';
const WEEKS = [1, 3, 5, 7, 9, 0, 9, 7, 5, 3, 1]; /* 0: the light week */

/* the five goal lifts; `body` lifts are logged as the weight added to me */
const LIFTS = [
  { id: 'pull-up',  name: 'Pull-up',  body: true,  alias: ['pullup', 'pull up', 'traction', 'tractions'] },
  { id: 'dip',      name: 'Dips',     body: true,  alias: ['dips'] },
  { id: 'squat',    name: 'Squat',    body: false, alias: [] },
  { id: 'deadlift', name: 'Deadlift', body: false, alias: ['dead lift', 'soulevé de terre'] },
  { id: 'bench',    name: 'Bench',    body: false, alias: ['bench press', 'développé couché'] },
  { id: 'hip-thrust', name: 'Hip thrust', body: false, alias: ['hip thrusts', 'hipthrust'] },
];
const LIFT = new Map(LIFTS.map(l => [l.id, l]));
const liftOf = name => {
  const n = String(name || '').trim().toLowerCase();
  return LIFTS.find(l => l.id === n || l.name.toLowerCase() === n || l.alias.includes(n));
};

/* the three sessions: pull, push, legs */
const C = 'c', M = 'max';
const WRIST = 'Wrist warm-up, 6 kg', CORE = 'Core (gainage), 3 × 1 min';
const DAYS = [
  { id: 'pull', name: 'Pull', lifts: ['pull-up', 'deadlift'], list: [
    [WRIST, C], ['Pull-up', M], ['Pull-up, iso hold', C], ['Deadlift', M], ['Barbell row', C, 'Sets of 8, currently 50 kg'], [CORE, C]] },
  { id: 'push', name: 'Push', lifts: ['dip', 'bench'], list: [
    [WRIST, C], ['Push-ups, a few'], ['Dips', M], ['Dips, iso hold', C], ['Bench', M], ['Bench, iso hold', C], [CORE, C]] },
  { id: 'leg', name: 'Legs', lifts: ['squat', 'hip-thrust'], list: [
    ['Squat', M], [WRIST, C], ['Pull-up, iso hold', C], ['Hip thrust', M], ['Dips, iso hold', C], ['Bench, iso hold', C], [CORE, C]] },
];
const DAY = new Map(DAYS.map(d => [d.id, d]));

const $ = id => document.getElementById(id);
const repsText = r => r === 0 ? 'Light' : r === 1 ? '1 rep' : `${r} reps`;
const kgText = (l, kg) => `${l.body && kg > 0 ? '+' : ''}${kg} kg`;


/* ── the maths: Epley, as maximehouel.com/myprogress estimates its maxes ──

   A set of `reps` at `kg` is worth a 1-rep max of kg × (1 + reps ÷ 30); one
   rep is the max itself. On a pull-up or a dip the load is my body plus the
   belt: (BW + kg) × (1 + reps ÷ 30), then BW comes off, so the max reads as
   the weight added, the way street lifting counts it. Read backwards, the
   same line gives the most I should lift for any number of reps. */
const BW = 85;
const factor = reps => reps <= 1 ? 1 : 1 + reps / 30;
const half = x => Math.round(x * 2) / 2;
const est = (l, kg, reps) => l.body ? (BW + kg) * factor(reps) - BW : kg * factor(reps);
const repMax = (l, e, reps) => l.body ? (BW + e) / factor(reps) - BW : e / factor(reps);
/* the goal of a week: the next 2.5 kg step above the theory weight for its
   reps, so making it sets a new max */
const goalKg = (l, e, reps) => (Math.floor(repMax(l, e, reps) / 2.5 + 1e-9) + 1) * 2.5;

/* ── the program, read off the log ──────────────────────────────────── */

const weekOf = day => Math.floor(daysBetween(START, day) / 7) + 1;

/* every Gym session since START, in order, with its week and every set of
   each goal lift; then the weeks of record.js, one row each */
function program() {
  return [...sessions(), ...Object.entries(RECORD).map(([w, lifts]) => ({
    rec: true, week: +w, day: shift(START, w * 7 - 1),
    sets: Object.fromEntries(Object.entries(lifts).map(([id, list]) => [id, list.map(([kg, reps]) => ({ kg, reps }))])),
  }))];
}
function sessions() {
  const list = allSessions().filter(s => s.s === 'lift' && s.day >= START);
  return list.map(s => {
    const sets = {};
    for (const x of exercises(s)) {
      const l = liftOf(x.n);
      if (!l || !(x.kg >= 0)) continue;
      (sets[l.id] ||= []).push({ kg: x.kg, reps: x.reps || 1 });
    }
    return { day: s.day, week: weekOf(s.day), sets };
  });
}

/* the best set of a lift over some sessions: the highest estimated max
   (only sets of `reps` reps, when given) */
function best(rows, id, reps) {
  const l = LIFT.get(id);
  let b = null;
  for (const r of rows) for (const t of r.sets[id] || []) {
    if (reps && t.reps !== reps) continue;
    const e = est(l, t.kg, t.reps);
    if (!b || e > b.est) b = { ...t, day: r.day, week: r.week, rec: r.rec, est: e };
  }
  return b;
}
const when = b => b.rec ? `week ${b.week}` : short(b.day);
/* my form: the best set of the last week before this one that has the lift.
   The goals come from it, so each week's sets set the next week's goals. */
/* a week's goal: the higher of the theory from my form and one 2.5 kg step
   above my best set at that many reps, so every goal is a new best */
function goalFor(l, reps) {
  /* a single: the test of week 11, one 2.5 kg step above my 1-rep max */
  if (reps === 1 && ctx.test[l.id]) return ctx.test[l.id];
  const f = ctx.form[l.id], b = best(ctx.rows, l.id, reps);
  return Math.max(f ? goalKg(l, f.est, reps) : 0, b ? b.kg + 2.5 : 0);
}
function formOf(id) {
  for (let w = ctx.week - 1; w >= 1; w--) { const b = best(ctx.rows.filter(r => r.week === w), id); if (b) return b; }
  return ctx.maxes[id];
}

/* ── drawing ────────────────────────────────────────────────────────── */

let ctx = { rows: [], week: 1, maxes: {}, form: {}, test: {}, path: [] };

/* the theoretical 1-rep max total, week by week. Each lift keeps its best
   estimated max so far: from the sets I did, then from the goals ahead. Week
   11 is the test day: one 2.5 kg step above the max each lift reached. */
function project() {
  const run = {}, path = [];
  ctx.test = {};
  for (let w = 1; w <= WEEKS.length; w++) {
    const wr = ctx.rows.filter(r => r.week === w), r = WEEKS[w - 1];
    let did = false;
    for (const l of LIFTS) {
      const b = best(wr, l.id);
      if (b) { did = true; run[l.id] = Math.max(run[l.id] ?? 0, b.est); continue; }
      if (w < ctx.week || run[l.id] === undefined || !r) continue;
      if (w === WEEKS.length) run[l.id] = ctx.test[l.id] = (Math.floor(run[l.id] / 2.5 + 1e-9) + 1) * 2.5;
      else if (r > 1) run[l.id] = Math.max(run[l.id], est(l, goalFor(l, r), r));
    }
    const ids = Object.keys(run);
    if (ids.length && (did || (w >= ctx.week && r))) path.push({ w, kg: ids.reduce((s, id) => s + run[id], 0), n: ids.length, did });
  }
  ctx.path = path;
}

function drawWave() {
  const top = Math.max(...WEEKS), cur = ctx.week;
  $('waveChart').innerHTML = WEEKS.map((r, i) => {
    const w = i + 1, cls = w < cur ? 'past' : w === cur ? 'cur' : '';
    const h = r === 0 ? 34 : Math.round(r / top * 100);
    return `<li class="${cls}${r === 0 ? ' light' : ''}" data-tip="Week ${w}: ${r ? repsText(r) + ' per set' : 'light week'}">
      <span class="bar-v">${r || 'L'}</span>
      <span class="bar" style="--h:${h}%"></span>
      <span class="bar-w">W${w}</span></li>`;
  }).join('');
}

/* the sets of a goal lift this week: a light load, then n, the reps of the
   week before, n and n reps (n: this week's reps) */
function setsText() {
  const n = WEEKS[ctx.week - 1];
  if (!n) return 'Light week: about 60 % of my max';
  let before = n;
  for (let w = ctx.week - 1; w >= 1; w--) if (WEEKS[w - 1]) { before = WEEKS[w - 1]; break; }
  return `Light load, then ${n}, ${before}, ${n}, ${n} reps`;
}
function drawDays() {
  const sets = setsText();
  $('dayGrid').innerHTML = DAYS.map(d => `<li><div class="cell day">
    <span class="day-h"><b>${d.name}</b></span>
    <ol class="ex">${d.list.map(([n, k, note]) => `<li class="${k === M ? 'ex-max' : k === C ? 'ex-c' : ''}"><span class="ex-n">${esc(n)}${k === M ? '<span class="tag tag-max">Max</span>' : ''}</span>${k === M || note ? `<ul class="ex-sets"><li>${k === M ? sets : esc(note)}</li></ul>` : ''}</li>`).join('')}</ol>
  </div></li>`).join('');
}

/* the total: the six estimated maxes added up (pull-up and dips count the
   weight added), and the total of the heaviest single reps */
function drawTotal() {
  const got = LIFTS.filter(l => ctx.maxes[l.id]);
  const total = half(got.reduce((s, l) => s + ctx.maxes[l.id].est, 0));
  const singles = LIFTS.map(l => {
    let kg; for (const r of ctx.rows) for (const t of r.sets[l.id] || []) if (t.reps === 1 && !(kg >= t.kg)) kg = t.kg;
    return kg;
  });
  const tested = singles.reduce((s, kg) => s + (kg || 0), 0);
  $('totalV').textContent = got.length ? `${total} kg` : '–';
  $('totalTested').textContent = tested ? `${tested} kg` : '–';
  drawTotalChart();
}

/* the theoretical 1-rep max total week by week: solid for the weeks done,
   dashed for the goals ahead, a ring on the test day */
function drawTotalChart() {
  const box = $('totalChart');
  const actual = ctx.path.filter(p => p.did), goal = ctx.path.filter(p => !p.did);
  if (!actual.length) { box.innerHTML = '<p class="chart-empty">No set yet</p>'; return; }
  const W = Math.max(300, Math.round(box.clientWidth) || 720), H = W < 520 ? 230 : 280, L = 48, Rt = 14, T = 30, B = 40;
  const ys = ctx.path.map(p => p.kg), step = 10;
  let lo = Math.floor(Math.min(...ys) / step) * step - step, hi = Math.ceil(Math.max(...ys) / step) * step + step;
  const x = w => L + (w - 1) / (WEEKS.length - 1) * (W - L - Rt);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const gap = (hi - lo) / step > 5 ? step * 2 : step;
  const ticks = []; for (let v = Math.ceil(lo / gap) * gap; v <= hi + 1e-9; v += gap) ticks.push(v);
  const line = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.w).toFixed(1)},${y(p.kg).toFixed(1)}`).join('');
  const lastA = actual[actual.length - 1], test = goal.find(p => p.w === WEEKS.length);
  const tipOf = (p, what) => `Week ${p.w}, ${what}: ${half(p.kg)} kg (${p.n} of ${LIFTS.length} lifts)`;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Theoretical 1-rep max total week by week, up to the test of week 11">
    ${ticks.map(v => `<line class="grid-l" x1="${L}" x2="${W - Rt}" y1="${y(v)}" y2="${y(v)}"></line><text class="ax" x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    ${WEEKS.map((_, i) => `<text class="ax${i + 1 === ctx.week ? ' ax-cur' : ''}" x="${x(i + 1)}" y="${H - B + 22}" text-anchor="middle">${W < 520 ? i + 1 : 'W' + (i + 1)}</text>`).join('')}
    <text class="ax ax-t" x="${L - 10}" y="${T - 14}" text-anchor="end">kg</text>
    ${goal.length ? `<path class="th" d="${line([lastA, ...goal])}"></path>` : ''}
    ${actual.length > 1 ? `<path class="ac" d="${line(actual)}"></path>` : ''}
    ${goal.filter(p => p !== test).map(p => `<circle class="gl gl-sm" cx="${x(p.w)}" cy="${y(p.kg)}" r="4" data-tip="${tipOf(p, 'goals')}"></circle>`).join('')}
    ${actual.map(p => `<circle class="ac-d" cx="${x(p.w)}" cy="${y(p.kg)}" r="5" data-tip="${tipOf(p, 'theoretical 1-rep max')}"></circle>`).join('')}
    <text class="gl-t" x="${x(lastA.w)}" y="${y(lastA.kg) + 22}" text-anchor="middle">${half(lastA.kg)} kg</text>
    ${test ? `<circle class="gl" cx="${x(test.w)}" cy="${y(test.kg)}" r="7" data-tip="${tipOf(test, 'test day')}"></circle>
      <text class="gl-t" x="${x(test.w) - 12}" y="${y(test.kg) - 14}" text-anchor="end">Test day: ${half(test.kg)} kg</text>` : ''}
  </svg>`;
}

let pick = null;
function drawMaxes() {
  const { rows, week } = ctx, reps = WEEKS[week - 1];
  $('maxCount').textContent = `${Object.keys(ctx.maxes).length} of ${LIFTS.length} lifts`;
  $('liftCards').innerHTML = LIFTS.map(l => {
    const b = ctx.maxes[l.id];
    return `<li><button type="button" class="lift${l.id === pick ? ' is-on' : ''}" data-id="${l.id}" aria-pressed="${l.id === pick}">
      <span class="lift-n">${l.name}</span>
      ${b ? `<b class="lift-v">${kgText(l, half(b.est))}</b>
      ${reps ? `<span class="lift-g">W${week} goal: ${kgText(l, goalFor(l, reps))} &times; ${reps}</span>` : ''}`
      : `<b class="lift-v lift-none">&ndash;</b>${reps ? `<span class="lift-g">W${week} goal: test ${reps} reps</span>` : ''}`}
    </button></li>`;
  }).join('');
  drawChart();

  /* the table: what I lifted, then the goal of every week still to come */
  const head = `<thead><tr><th scope="col">Week</th>${LIFTS.map(l => `<th scope="col">${l.name}</th>`).join('')}</tr></thead>`;
  const body = WEEKS.map((r, i) => {
    const w = i + 1, wr = rows.filter(x => x.week === w);
    const cells = LIFTS.map(l => {
      const b = (r && best(wr, l.id, r)) || best(wr, l.id), m = ctx.form[l.id];
      if (b) return `<td>${kgText(l, b.kg)} <small>&times; ${b.reps}</small></td>`;
      if (w >= week && m && r) return `<td class="goal" data-tip="Goal: a new best at ${repsText(r)}">${kgText(l, goalFor(l, r))} <small>goal</small></td>`;
      return '<td><span class="dim">&middot;</span></td>';
    }).join('');
    return `<tr class="${w === week ? 'cur' : ''}"><th scope="row">W${w}<small>${r ? repsText(r) : 'Light'}</small></th>${cells}</tr>`;
  }).join('');
  $('maxTable').innerHTML = `<caption class="sr-only">Top set of each lift per week, and the goal of each week to come</caption>${head}<tbody>${body}</tbody>`;
}

/* the chart of one lift: kg against reps. The theory line is what my best
   set says I can lift for 1 to 10 reps; the actual line, the most I lifted
   at each rep count; the rings, the goals of this week and the next. */
function drawChart() {
  const l = LIFT.get(pick), m = ctx.maxes[pick], box = $('chart');
  $('chartT').textContent = l.name;
  if (!m) { box.innerHTML = `<p class="chart-empty">No set yet</p>`; return; }
  const R = 10, W = Math.max(300, Math.round(box.clientWidth) || 720), H = W < 520 ? 250 : 300, L = 48, Rt = 14, T = 26, B = 40;
  const theory = Array.from({ length: R }, (_, i) => ({ r: i + 1, kg: repMax(l, m.est, i + 1) }));
  const byRep = new Map();
  for (const row of ctx.rows) for (const t of row.sets[pick] || []) if (t.reps <= R && !(byRep.get(t.reps)?.kg >= t.kg)) byRep.set(t.reps, { ...t, day: row.day, week: row.week, rec: row.rec });
  const actual = [...byRep.values()].sort((a, b) => a.reps - b.reps);
  const f = ctx.form[pick];
  const goals = [ctx.week, ctx.week + 1].filter(w => w <= WEEKS.length && WEEKS[w - 1]).map(w => ({ w, r: WEEKS[w - 1], kg: goalFor(l, WEEKS[w - 1]) }));
  const ys = [...theory.map(p => p.kg), ...actual.map(p => p.kg), ...goals.map(g => g.kg)];
  const step = 10;
  let lo = Math.floor(Math.min(...ys) / step) * step, hi = Math.ceil(Math.max(...ys) / step) * step;
  if (hi - lo < 20) hi = lo + 20;
  const x = r => L + (r - 1) / (R - 1) * (W - L - Rt);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const ticks = []; const gap = (hi - lo) / step > 6 ? step * 2 : step;
  for (let v = lo; v <= hi + 1e-9; v += gap) ticks.push(v);
  const line = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.r ?? p.reps).toFixed(1)},${y(p.kg).toFixed(1)}`).join('');
  const unit = l.body ? 'kg added' : 'kg';
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${l.name}: theory and actual weight for 1 to 10 reps">
    ${ticks.map(v => `<line class="grid-l" x1="${L}" x2="${W - Rt}" y1="${y(v)}" y2="${y(v)}"></line><text class="ax" x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${l.body && v > 0 ? '+' : ''}${v}</text>`).join('')}
    ${Array.from({ length: R }, (_, i) => `<text class="ax" x="${x(i + 1)}" y="${H - B + 22}" text-anchor="middle">${i + 1}</text>`).join('')}
    <text class="ax ax-t" x="${W - Rt}" y="${H - 4}" text-anchor="end">reps</text>
    <text class="ax ax-t" x="${L - 10}" y="${T - 12}" text-anchor="end">${unit}</text>
    <path class="th" d="${line(theory)}"></path>
    ${theory.map(p => `<circle class="hit" cx="${x(p.r)}" cy="${y(p.kg)}" r="12" data-tip="Theory, ${repsText(p.r)}: ${kgText(l, half(p.kg))}"></circle>`).join('')}
    ${actual.length > 1 ? `<path class="ac" d="${line(actual)}"></path>` : ''}
    ${goals.map((g, i) => `<circle class="gl${i ? ' gl-next' : ''}" cx="${x(g.r)}" cy="${y(g.kg)}" r="7" data-tip="Week ${g.w} goal: ${kgText(l, g.kg)} &times; ${g.r}"></circle>
      <text class="gl-t" x="${x(g.r)}" y="${y(g.kg) + (i ? 24 : -14)}" text-anchor="middle">W${g.w}: ${kgText(l, g.kg)}</text>`).join('')}
    ${actual.map(p => `<circle class="ac-d" cx="${x(p.reps)}" cy="${y(p.kg)}" r="5" data-tip="Actual, ${repsText(p.reps)}: ${kgText(l, p.kg)}, ${when(p)}"></circle>`).join('')}
  </svg>`;
}
let rs = 0, lastW = 0;
addEventListener('resize', () => { cancelAnimationFrame(rs); rs = requestAnimationFrame(() => { const w = $('chart').clientWidth; if (w !== lastW) { lastW = w; drawChart(); drawTotalChart(); } }); });
document.addEventListener('click', e => {
  const b = e.target.closest('.lift[data-id]');
  if (!b) return;
  pick = b.dataset.id; drawMaxes();
});

/* ── the tooltip: hover or tap on a bar or a dot ────────────────────── */
const tip = $('tip');
const show = (el, ev) => {
  tip.innerHTML = el.dataset.tip; tip.hidden = false;
  const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
  const x = Math.min(innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
  tip.style.left = `${x}px`; tip.style.top = `${Math.max(8, r.top - t.height - 8)}px`;
};
document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el) show(el, e); });
document.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) tip.hidden = true; });
addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

/* ── start ──────────────────────────────────────────────────────────── */
function drawAll() {
  ctx.rows = program();
  ctx.maxes = Object.fromEntries(LIFTS.map(l => [l.id, best(ctx.rows, l.id)]).filter(([, b]) => b));
  ctx.week = Math.max(1, Math.min(WEEKS.length, weekOf(today)));
  ctx.form = Object.fromEntries(LIFTS.map(l => [l.id, formOf(l.id)]).filter(([, b]) => b));
  project();
  if (!pick) pick = LIFTS.find(l => ctx.maxes[l.id])?.id || LIFTS[0].id;
  drawWave();
  drawDays();
  drawTotal();
  drawMaxes();
}
drawAll();
load('').then(drawAll, () => {});
