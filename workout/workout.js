/* jeremylasne.com/workout: the program, the 11-week wave, the maxes and the log.

   Read only. The sets come from two places: workout/record.js, the top sets
   of each week I give by hand, and the Gym sessions of the wellness log (the
   same server as /wellness), each exercise a name, reps and kg.

   Program weeks are calendar weeks, Monday to Sunday, from START. */

import { load, today, allSessions, esc, short } from '/wellness/data.js';
import { exercises, daysBetween, shift } from '/wellness/spec.js';
import { RECORD, FINAL, WEEK } from '/workout/record.js';

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
/* to 0.05 kg: the exact number, to load the bar as I can */
const exact = v => Math.round(v * 20) / 20;

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
/* a week's goal: the exact theory weight for its reps from my max today.
   Lifting more than it raises the max. */
function goalFor(l, reps) {
  const m = ctx.maxes[l.id];
  return m ? exact(repMax(l, m.est, reps)) : undefined;
}

/* ── drawing ────────────────────────────────────────────────────────── */

let ctx = { rows: [], week: 1, maxes: {}, theory: [] };

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

/* the 1-rep max total week by week, up to this week: the theory (each lift's
   best estimated max so far, Epley) against the actual max (each lift's
   heaviest single so far) */
let upWeek = null;
function drawTotalChart() {
  const box = $('totalChart');
  const th = {}, ac = {}, theory = [], actual = [];
  const sum = o => Object.values(o).reduce((s, v) => s + v, 0);
  for (let w = 1; w <= Math.min(ctx.week, WEEKS.length); w++) {
    const wr = ctx.rows.filter(r => r.week === w);
    const up = [];
    for (const l of LIFTS) {
      const b = best(wr, l.id), one = best(wr, l.id, 1);
      if (b && th[l.id] !== undefined && b.est > th[l.id] + .25) up.push({ l, by: b.est - th[l.id], b });
      if (b) th[l.id] = Math.max(th[l.id] ?? 0, b.est);
      if (one) ac[l.id] = Math.max(ac[l.id] ?? 0, one.kg);
    }
    if (Object.keys(th).length) theory.push({ w, kg: sum(th), n: Object.keys(th).length, up });
    if (Object.keys(ac).length) actual.push({ w, kg: sum(ac), n: Object.keys(ac).length });
  }
  if (!theory.length) { box.innerHTML = '<p class="chart-empty">No set yet</p>'; return; }
  const W = Math.max(300, Math.round(box.clientWidth) || 720), H = W < 520 ? 230 : 280, L = 48, Rt = 14, T = 30, B = 40;
  /* the goal of the test day: the five final goals added up */
  const final = { w: WEEKS.length, kg: Object.values(FINAL).reduce((s, v) => s + v, 0) };
  const ys = [...theory, ...actual, final].map(p => p.kg), step = 10;
  const lo = Math.floor(Math.min(...ys) / step) * step - step, hi = Math.ceil(Math.max(...ys) / step) * step + step;
  const x = w => L + (w - 1) / (WEEKS.length - 1) * (W - L - Rt);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const gap = (hi - lo) / step > 5 ? step * 2 : step;
  const ticks = []; for (let v = Math.ceil(lo / gap) * gap; v <= hi + 1e-9; v += gap) ticks.push(v);
  const line = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.w).toFixed(1)},${y(p.kg).toFixed(1)}`).join('');
  const tipOf = (p, what) => `Week ${p.w}, ${what}: ${half(p.kg)} kg` + (p.up?.length ? ' · tap for what raised it' : '');
  ctx.theory = theory;
  const lastT = theory[theory.length - 1], lastA = actual[actual.length - 1];
  const tx = W - Rt;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="1-rep max total week by week: theory against actual max">
    ${ticks.map(v => `<line class="grid-l" x1="${L}" x2="${W - Rt}" y1="${y(v)}" y2="${y(v)}"></line><text class="ax" x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    ${WEEKS.map((_, i) => `<text class="ax${i + 1 === ctx.week ? ' ax-cur' : ''}" x="${x(i + 1)}" y="${H - B + 22}" text-anchor="middle">${W < 520 ? i + 1 : 'W' + (i + 1)}</text>`).join('')}
    <line class="test-l" x1="${tx}" x2="${tx}" y1="${T}" y2="${H - B}"></line>
    <text class="ax ax-t" x="${tx - 6}" y="${T + 4}" text-anchor="end">Test day</text>
    <text class="ax ax-t" x="${L - 10}" y="${T - 14}" text-anchor="end">kg</text>
    <path class="tg" d="${line([theory[theory.length - 1], final])}"></path>
    ${theory.length > 1 ? `<path class="th" d="${line(theory)}"></path>` : ''}
    ${actual.length > 1 ? `<path class="ac" d="${line(actual)}"></path>` : ''}
    <circle class="tg-d" cx="${x(final.w)}" cy="${y(final.kg)}" r="7" data-tip="Week 11 goal: ${final.kg} kg, ${LIFTS.filter(l => FINAL[l.id]).map(l => `${l.name} ${kgText(l, FINAL[l.id])}`).join(', ')}"></circle>
    <text class="gl-t" x="${x(final.w) - 12}" y="${y(final.kg) + 4}" text-anchor="end">Goal: ${final.kg} kg</text>
    ${theory.map(p => `<circle class="th-d${p.up.length ? ' th-up' : ''}${p.w === upWeek ? ' is-on' : ''}" cx="${x(p.w)}" cy="${y(p.kg)}" r="${p.up.length ? 6 : 4}" data-w="${p.w}" data-tip="${tipOf(p, 'theory')}"></circle>`).join('')}
    ${actual.map(p => `<circle class="ac-d" cx="${x(p.w)}" cy="${y(p.kg)}" r="5" data-tip="${tipOf(p, 'actual max')}"></circle>`).join('')}
    <text class="gl-t" x="${x(lastT.w) + 10}" y="${y(lastT.kg) + 4}">${half(lastT.kg)} kg</text>
    ${lastA ? `<text class="gl-t" x="${x(lastA.w) + 10}" y="${y(lastA.kg) + 4}">${half(lastA.kg)} kg</text>` : ''}
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
      const b = (r && best(wr, l.id, r)) || best(wr, l.id), m = ctx.maxes[l.id];
      if (b) return `<td>${kgText(l, b.kg)} <small>&times; ${b.reps}</small></td>`;
      if (w === WEEKS.length && FINAL[l.id]) return `<td class="goal goal-final" data-tip="My goal for the test day">${kgText(l, FINAL[l.id])} <small>goal</small></td>`;
      if (w === WEEKS.length && !m) return '<td class="goal">discovery</td>';
      if (w >= week && m && r) return `<td class="goal" data-tip="Theory for ${repsText(r)} from my max today">${kgText(l, goalFor(l, r))} <small>goal</small></td>`;
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
  const goals = [ctx.week, ctx.week + 1].filter(w => w < WEEKS.length && WEEKS[w - 1]).map(w => ({ w, r: WEEKS[w - 1], kg: goalFor(l, WEEKS[w - 1]) }));
  /* the final goal as a 1-rep max, and the weight it means for 1 to 10 reps */
  const fin = FINAL[pick], aim = fin ? Array.from({ length: R }, (_, i) => ({ r: i + 1, kg: repMax(l, fin, i + 1) })) : [];
  const ys = [...theory.map(p => p.kg), ...actual.map(p => p.kg), ...goals.map(g => g.kg), ...aim.map(p => p.kg)];
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
    ${aim.length ? `<path class="tg" d="${line(aim)}"></path>
      ${aim.map(p => `<circle class="hit" cx="${x(p.r)}" cy="${y(p.kg)}" r="10" data-tip="Final goal, ${repsText(p.r)}: ${kgText(l, exact(p.kg))}"></circle>`).join('')}
      <circle class="tg-d" cx="${x(1)}" cy="${y(fin)}" r="7" data-tip="Week 11 goal: ${kgText(l, fin)} &times; 1"></circle>
      <text class="gl-t" x="${x(1) + 14}" y="${y(fin) + 4}">W11 goal: ${kgText(l, fin)}</text>` : ''}
    <path class="th" d="${line(theory)}"></path>
    ${theory.map(p => `<circle class="hit" cx="${x(p.r)}" cy="${y(p.kg)}" r="12" data-tip="Theory, ${repsText(p.r)}: ${kgText(l, exact(p.kg))}"></circle>`).join('')}
    ${actual.length > 1 ? `<path class="ac" d="${line(actual)}"></path>` : ''}
    ${goals.map((g, i) => `<circle class="gl${i ? ' gl-next' : ''}" cx="${x(g.r)}" cy="${y(g.kg)}" r="7" data-tip="Week ${g.w} goal: ${kgText(l, g.kg)} &times; ${g.r}"></circle>
      <text class="gl-t" x="${x(g.r)}" y="${y(g.kg) + (i ? 24 : -14)}" text-anchor="middle">W${g.w}: ${kgText(l, g.kg)}</text>`).join('')}
    ${actual.map(p => `<circle class="ac-d" cx="${x(p.reps)}" cy="${y(p.kg)}" r="5" data-tip="Actual, ${repsText(p.reps)}: ${kgText(l, p.kg)}, ${when(p)}"></circle>`).join('')}
  </svg>`;
}
let rs = 0, lastW = 0;
addEventListener('resize', () => { cancelAnimationFrame(rs); rs = requestAnimationFrame(() => { const w = $('chart').clientWidth; if (w !== lastW) { lastW = w; drawChart(); drawTotalChart(); } }); });
/* a tap on a point of the theory: what raised it that week, in a panel */
function drawUp() {
  const box = $('totalInfo'), p = ctx.theory.find(t => t.w === upWeek), i = ctx.theory.indexOf(p);
  if (!p) { box.hidden = true; return; }
  const by = i > 0 ? p.kg - ctx.theory[i - 1].kg : 0;
  box.hidden = false;
  box.innerHTML = `<div class="up-h"><b>Week ${p.w}</b><span>${half(p.kg)} kg${by > .25 ? ` · +${half(by)} kg` : ''}</span><button type="button" class="up-x" aria-label="Close">&times;</button></div>`
    + (p.up.length ? `<ul class="up-l">${p.up.map(u => `<li><span>${u.l.name}</span><b>+${half(u.by)} kg</b><small>${kgText(u.l, u.b.kg)} &times; ${u.b.reps}</small></li>`).join('')}</ul>`
      : '<p class="up-none">No lift beat its max this week</p>');
}
document.addEventListener('click', e => {
  if (e.target.closest('.up-x')) { upWeek = null; drawTotalChart(); drawUp(); return; }
  const d = e.target.closest('#totalChart .th-d[data-w]');
  if (d) { upWeek = +d.dataset.w === upWeek ? null : +d.dataset.w; tip.hidden = true; drawTotalChart(); drawUp(); return; }
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
  ctx.week = Math.max(1, Math.min(WEEKS.length, WEEK));
  if (!pick) pick = LIFTS.find(l => ctx.maxes[l.id])?.id || LIFTS[0].id;
  drawWave();
  drawDays();
  drawTotal();
  drawMaxes();
}
drawAll();
load('').then(drawAll, () => {});
