/* jeremylasne.com/workout: the program, the 11-week wave, the maxes and the log.

   The maxes live in the wellness log (the same server as /wellness): each
   session is a Gym session of that day, each max an exercise of it (a name,
   reps, kg). So a max logged here shows on /wellness/details too, and the
   maxes logged there show here.

   Program weeks count sessions, not dates: every 3 Gym sessions from START
   is one week. A missed week moves the plan, it never skips a step. */

import { state, load, api, today, entry, allSessions, copy, esc, short } from '/wellness/data.js';
import { exercises, SPEC } from '/wellness/spec.js';

/* the first session of the program: the day of the first logged maxes */
const START = '2026-10-20';
const PER_WEEK = 3;
const WEEKS = [1, 3, 5, 7, 9, 0, 9, 7, 5, 3, 1]; /* 0: the light week */

/* the five goal lifts; `body` lifts are logged as the weight added to me */
const LIFTS = [
  { id: 'pull-up',  name: 'Pull-up',  body: true,  alias: ['pullup', 'pull up', 'traction', 'tractions'] },
  { id: 'dip',      name: 'Dips',     body: true,  alias: ['dips'] },
  { id: 'squat',    name: 'Squat',    body: false, alias: [] },
  { id: 'deadlift', name: 'Deadlift', body: false, alias: ['dead lift', 'soulevé de terre'] },
  { id: 'bench',    name: 'Bench',    body: false, alias: ['bench press', 'développé couché'] },
];
const LIFT = new Map(LIFTS.map(l => [l.id, l]));
const liftOf = name => {
  const n = String(name || '').trim().toLowerCase();
  return LIFTS.find(l => l.id === n || l.name.toLowerCase() === n || l.alias.includes(n));
};

/* the three sessions, in the order I wrote them */
const C = 'c', M = 'max';
const DAYS = [
  { id: 'push', name: 'Push', lifts: ['dip', 'bench'], list: [
    ['Wrist warm-up', C], ['Push-ups, a few'], ['Dips', M], ['Dips, iso hold', C], ['Bench', M], ['Bench, iso hold', C], ['Core (gainage), optional', C]] },
  { id: 'pull', name: 'Pull', lifts: ['pull-up', 'deadlift'], list: [
    ['Wrist warm-up', C], ['Pull-up', M], ['Pull-up, iso hold', C], ['Deadlift', M], ['Barbell row', C], ['Core (gainage)', C]] },
  { id: 'leg', name: 'Legs', lifts: ['squat'], list: [
    ['Squat', M], ['Wrist warm-up', C], ['Pull-up, iso hold', C], ['Hip thrust'], ['Dips, iso hold', C], ['Bench, iso hold', C], ['Core (gainage)', C]] },
];
const DAY = new Map(DAYS.map(d => [d.id, d]));

const $ = id => document.getElementById(id);
const repsText = r => r === 0 ? 'Light' : r === 1 ? '1 rep' : `${r} reps`;
const kgText = (l, kg) => `${l.body && kg > 0 ? '+' : ''}${kg} kg`;

let pass = ''; try { pass = localStorage.getItem('bio.pass') || ''; } catch {}

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

/* every Gym session since START, in order, with its week, its type
   (read from its lifts, else the next in the push, pull, legs turn) and
   every set of each goal lift */
function program() {
  const list = allSessions().filter(s => s.s === 'lift' && s.day >= START);
  let last = null;
  return list.map((s, i) => {
    const sets = {};
    for (const x of exercises(s)) {
      const l = liftOf(x.n);
      if (!l || !(x.kg >= 0)) continue;
      (sets[l.id] ||= []).push({ kg: x.kg, reps: x.reps || 1 });
    }
    const has = DAYS.map(d => d.lifts.filter(id => sets[id]).length);
    const top = Math.max(...has);
    const type = top > 0 && has.filter(n => n === top).length === 1 ? DAYS[has.indexOf(top)].id : top > 0 ? 'mix' : next(last);
    if (type !== 'mix') last = type;
    return { day: s.day, i, week: Math.floor(i / PER_WEEK) + 1, type, sets };
  });
}
const next = last => DAYS[(DAYS.findIndex(d => d.id === last) + 1) % DAYS.length].id;
const lastType = rows => [...rows].reverse().find(r => r.type !== 'mix')?.type || null;

/* the best set of a lift over some sessions: the highest estimated max */
function best(rows, id) {
  const l = LIFT.get(id);
  let b = null;
  for (const r of rows) for (const t of r.sets[id] || []) {
    const e = est(l, t.kg, t.reps);
    if (!b || e > b.est) b = { ...t, day: r.day, week: r.week, est: e };
  }
  return b;
}

/* ── drawing ────────────────────────────────────────────────────────── */

let ctx = { rows: [], week: 1, nextId: 'push', maxes: {} };

function drawNow() {
  const { rows } = ctx, done = rows.length;
  const finished = done >= WEEKS.length * PER_WEEK;
  const week = Math.min(WEEKS.length, Math.floor(done / PER_WEEK) + 1);
  const slot = done % PER_WEEK;
  const nextId = next(lastType(rows) || DAYS[DAYS.length - 1].id);
  const d = DAY.get(nextId), reps = WEEKS[week - 1];
  ctx.week = finished ? WEEKS.length : week; ctx.nextId = nextId;
  $('nowCount').textContent = `${done} of ${WEEKS.length * PER_WEEK} sessions`;
  if (finished) {
    $('nowWeek').textContent = 'Program done';
    $('nowReps').textContent = '33 sessions';
    $('nowLine').textContent = 'Week 11 set the new maxes. Start week 1 again from them.';
  } else {
    $('nowWeek').textContent = `Week ${week} of ${WEEKS.length}`;
    $('nowReps').textContent = reps ? `${repsText(reps)} per set` : 'Light week';
    $('nowLine').textContent = reps
      ? `Session ${slot + 1} of ${PER_WEEK} this week. Work up to the heaviest set of ${repsText(reps)}.`
      : `Session ${slot + 1} of ${PER_WEEK} this week. About 60 % of my max, to recover before the way down.`;
  }
  $('nowDay').textContent = d.name;
  $('nowLifts').innerHTML = d.lifts.map(id => {
    const l = LIFT.get(id), m = ctx.maxes[id];
    return reps && m ? `${l.name}: goal <b>${kgText(l, goalKg(l, m.est, reps))} &times; ${reps}</b>` : `${l.name}: ${reps ? `test a set of ${reps}` : 'light'}`;
  }).join('<br>');
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

function drawDays() {
  $('dayGrid').innerHTML = DAYS.map(d => `<li><div class="cell day${d.id === ctx.nextId ? ' is-next' : ''}">
    <span class="day-h"><b>${d.name}</b>${d.id === ctx.nextId ? '<span class="tag tag-max">Next</span>' : ''}</span>
    <ol class="ex">${d.list.map(([n, k]) => `<li class="${k === M ? 'ex-max' : k === C ? 'ex-c' : ''}">${esc(n)}${k === M ? '<span class="tag tag-max">Max</span>' : ''}</li>`).join('')}</ol>
  </div></li>`).join('');
}

/* the total: the five estimated maxes added up (pull-up and dips count the
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
  $('totalLine').innerHTML = got.length
    ? `${got.length} of ${LIFTS.length} lifts. ${got.map(l => `${l.name} ${kgText(l, half(ctx.maxes[l.id].est))}`).join(' + ')}.`
      + (got.length < LIFTS.length ? ` ${LIFTS.filter(l => !ctx.maxes[l.id]).map(l => l.name).join(', ')}: no set logged yet.` : '')
    : 'No set logged yet.';
  $('totalTested').textContent = tested ? `${tested} kg` : '–';
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
      <span class="lift-s">From ${kgText(l, b.kg)} &times; ${b.reps}, ${short(b.day)}</span>
      ${reps ? `<span class="lift-g">W${week} goal: ${kgText(l, goalKg(l, b.est, reps))} &times; ${reps}</span>` : ''}`
      : `<b class="lift-v lift-none">&ndash;</b><span class="lift-s">No set logged yet</span>`}
    </button></li>`;
  }).join('');
  drawChart();

  /* the table: what I lifted, then the goal of every week still to come */
  const head = `<thead><tr><th scope="col">Week</th><th scope="col">Reps</th>${LIFTS.map(l => `<th scope="col">${l.name}</th>`).join('')}</tr></thead>`;
  const body = WEEKS.map((r, i) => {
    const w = i + 1, wr = rows.filter(x => x.week === w);
    const cells = LIFTS.map(l => {
      const b = best(wr, l.id), m = ctx.maxes[l.id];
      if (b) return `<td>${kgText(l, b.kg)} <small>&times; ${b.reps}</small></td>`;
      if (w >= week && m && r) return `<td class="goal" data-tip="Goal: the theory weight for ${repsText(r)} from my max">${kgText(l, goalKg(l, m.est, r))} <small>goal</small></td>`;
      return '<td><span class="dim">&middot;</span></td>';
    }).join('');
    return `<tr class="${w === week ? 'cur' : ''}"><th scope="row">W${w}</th><td>${r || 'Light'}</td>${cells}</tr>`;
  }).join('');
  $('maxTable').innerHTML = `<caption class="sr-only">Top set of each lift per week, and the goal of each week to come</caption>${head}<tbody>${body}</tbody>`;
}

/* the chart of one lift: kg against reps. The theory line is what my best
   set says I can lift for 1 to 10 reps; the actual line, the most I lifted
   at each rep count; the rings, the goals of this week and the next. */
function drawChart() {
  const l = LIFT.get(pick), m = ctx.maxes[pick], box = $('chart');
  $('chartT').textContent = l.name;
  if (!m) { box.innerHTML = `<p class="chart-empty">No ${l.name.toLowerCase()} set logged yet. Log one set and the theory line appears.</p>`; $('chartNote').textContent = ''; return; }
  const R = 10, W = Math.max(300, Math.round(box.clientWidth) || 720), H = W < 520 ? 250 : 300, L = 48, Rt = 14, T = 26, B = 40;
  const theory = Array.from({ length: R }, (_, i) => ({ r: i + 1, kg: repMax(l, m.est, i + 1) }));
  const byRep = new Map();
  for (const row of ctx.rows) for (const t of row.sets[pick] || []) if (t.reps <= R && !(byRep.get(t.reps)?.kg >= t.kg)) byRep.set(t.reps, { ...t, day: row.day });
  const actual = [...byRep.values()].sort((a, b) => a.reps - b.reps);
  const goals = [ctx.week, ctx.week + 1].filter(w => w <= WEEKS.length && WEEKS[w - 1]).map(w => ({ w, r: WEEKS[w - 1], kg: goalKg(l, m.est, WEEKS[w - 1]) }));
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
      <text class="gl-t" x="${x(g.r)}" y="${y(g.kg) - 14}" text-anchor="middle">W${g.w}: ${kgText(l, g.kg)}</text>`).join('')}
    ${actual.map(p => `<circle class="ac-d" cx="${x(p.reps)}" cy="${y(p.kg)}" r="5" data-tip="Actual, ${repsText(p.reps)}: ${kgText(l, p.kg)} on ${short(p.day)}"></circle>`).join('')}
  </svg>`;
  $('chartNote').innerHTML = `Theory from ${kgText(l, m.kg)} &times; ${m.reps} on ${short(m.day)}: an estimated max of ${kgText(l, half(m.est))}${l.body ? `, at ${BW} kg bodyweight` : ''}. A set above the line raises the max and every goal after it.`;
}
let rs = 0, lastW = 0;
addEventListener('resize', () => { cancelAnimationFrame(rs); rs = requestAnimationFrame(() => { const w = $('chart').clientWidth; if (w !== lastW) { lastW = w; drawChart(); } }); });
document.addEventListener('click', e => {
  const b = e.target.closest('.lift[data-id]');
  if (!b) return;
  pick = b.dataset.id; drawMaxes();
});

/* ── the log ────────────────────────────────────────────────────────── */

let logType = 'push';

function rowsFor(day) {
  /* what that day already holds, to start from */
  const s = (entry(day)?.sessions || []).filter(x => x.s === 'lift').pop();
  const got = {};
  for (const x of s ? exercises(s) : []) { const l = liftOf(x.n); if (l && (!got[l.id] || x.kg > got[l.id].kg)) got[l.id] = x; }
  return got;
}

function drawLog() {
  const day = $('logDay').value || today;
  $('logType').innerHTML = DAYS.map(d => `<button type="button" role="radio" aria-checked="${d.id === logType}" data-id="${d.id}">${d.name}</button>`).join('');
  const got = rowsFor(day), target = WEEKS[ctx.week - 1] || '';
  $('logRows').innerHTML = DAY.get(logType).lifts.map(id => {
    const l = LIFT.get(id), g = got[id];
    return `<div class="log-row" data-id="${id}">
      <span class="log-n">${l.name}${l.body ? '<small>kg added</small>' : ''}</span>
      <label class="fld"><span>kg</span><input type="number" inputmode="decimal" step="0.5" min="0" max="500" name="kg" value="${g?.kg ?? ''}" placeholder="${target && ctx.maxes[id] ? goalKg(l, ctx.maxes[id].est, target) : 0}"></label>
      <label class="fld"><span>Reps</span><input type="number" inputmode="numeric" step="1" min="1" max="30" name="reps" value="${g?.reps ?? target}" placeholder="${target || 5}"></label>
    </div>`;
  }).join('');
  $('logLock').hidden = !!pass;
  $('logState').textContent = pass ? 'Unlocked' : 'Locked';
}

$('logType').addEventListener('click', e => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  logType = b.dataset.id; drawLog();
});
$('logDay').addEventListener('change', drawLog);

const say = (t, ok) => { $('logMsg').textContent = t; $('logMsg').className = 'log-msg' + (ok === true ? ' ok' : ok === false ? ' bad' : ''); };

$('logForm').addEventListener('submit', async e => {
  e.preventDefault();
  const day = $('logDay').value;
  if (!day || day < START || day > today) return say(`Pick a day from ${short(START)} to today.`, false);
  const sets = [...$('logRows').querySelectorAll('.log-row')].map(r => ({
    l: LIFT.get(r.dataset.id), kg: r.querySelector('[name=kg]').value, reps: r.querySelector('[name=reps]').value,
  })).filter(x => x.kg !== '');
  if (!sets.length) return say('Type the kg of at least one lift.', false);
  for (const x of sets) {
    const kg = Number(x.kg), reps = Number(x.reps || 1);
    if (!(kg >= 0 && kg <= 500) || !(reps >= 1 && reps <= 30)) return say(`${x.l.name}: kg from 0 to 500, reps from 1 to 30.`, false);
    x.kg = kg; x.reps = Math.round(reps);
  }

  if (!pass) {
    const p = $('logPass').value;
    if (!p) { $('logPass').focus(); return say('Type the passphrase to save.', false); }
    try { await api('bio.unlock', { passphrase: p }); } catch (err) { return say(err.message, false); }
    pass = p; $('logPass').value = '';
    try { localStorage.setItem('bio.pass', pass); } catch {}
  }

  /* the day as it is, with its Gym session holding the new top sets: one
     per lift, in place of what that lift had that day */
  const d = copy(entry(day)); d.day = day;
  const sessions = d.sessions || [];
  let s = [...sessions].reverse().find(x => x.s === 'lift');
  if (!s) {
    if (sessions.length >= SPEC.perDay) return say(`That day already holds ${SPEC.perDay} sessions.`, false);
    s = { s: 'lift', f: 'strength' }; sessions.push(s);
  }
  const ids = new Set(sets.map(x => x.l.id));
  const x = exercises(s).filter(ex => !ids.has(liftOf(ex.n)?.id));
  x.push(...sets.map(t => ({ n: t.l.id, kg: t.kg, reps: t.reps })));
  if (x.length > SPEC.exMax) return say(`That session already holds ${SPEC.exMax} exercises.`, false);
  s.x = x; delete s.lift; delete s.kg; delete s.reps;
  d.sessions = sessions;

  $('logSave').disabled = true; say('Saving…');
  try {
    const out = await api('days.save', { passphrase: pass, today, day, entry: d });
    state.days[day] = out;
    say(`Saved: ${sets.map(t => `${t.l.name} ${kgText(t.l, t.kg)} × ${t.reps}`).join(', ')}.`, true);
    drawAll();
  } catch (err) {
    if (/Wrong passphrase/.test(err.message)) { pass = ''; try { localStorage.removeItem('bio.pass'); } catch {} drawLog(); }
    say(err.message, false);
  } finally { $('logSave').disabled = false; }
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
  drawNow();
  if (!pick) pick = DAY.get(ctx.nextId).lifts.find(id => ctx.maxes[id]) || LIFTS.find(l => ctx.maxes[l.id])?.id || LIFTS[0].id;
  drawWave();
  drawDays();
  drawTotal();
  drawMaxes();
  if (!drawAll.typed) logType = (() => {
    /* today already logged: its type; else the next session */
    const t = ctx.rows.find(r => r.day === ($('logDay').value || today));
    return t && DAY.has(t.type) ? t.type : ctx.nextId;
  })();
  drawLog();
}
$('logDay').value = today; $('logDay').max = today; $('logDay').min = START;
$('logType').addEventListener('click', () => { drawAll.typed = true; });
drawAll();
load(pass).then(err => {
  drawAll();
  if (err || !state.server) say(err || 'The server is unreachable right now. Try again in a minute.', false);
});
