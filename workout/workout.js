/* jeremylasne.com/workout: the program, the 11-week wave, the maxes and the log.

   The maxes live in the wellness log (the same server as /wellness): each
   session is a Gym session of that day, each max an exercise of it (a name,
   reps, kg). So a max logged here shows on /wellness/details too, and the
   maxes logged there show here.

   Program weeks count sessions, not dates: every 3 Gym sessions from START
   is one week. A missed week moves the plan, it never skips a step. */

import { state, load, api, today, entry, allSessions, copy, esc, short } from '/wellness/data.js';
import { exercises, e1rm, SPEC } from '/wellness/spec.js';

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

/* ── the program, read off the log ──────────────────────────────────── */

/* every Gym session since START, in order, with its week, its type
   (read from its lifts, else the next in the push, pull, legs turn) and
   its top set per goal lift */
function program() {
  const list = allSessions().filter(s => s.s === 'lift' && s.day >= START);
  let last = null;
  return list.map((s, i) => {
    const top = {};
    for (const x of exercises(s)) {
      const l = liftOf(x.n);
      if (!l || !(x.kg >= 0) || x.kg === undefined) continue;
      const b = top[l.id];
      if (!b || x.kg > b.kg || (x.kg === b.kg && (x.reps || 0) > (b.reps || 0))) top[l.id] = { kg: x.kg, reps: x.reps || 1 };
    }
    const has = DAYS.map(d => d.lifts.filter(id => top[id]).length);
    const best = Math.max(...has);
    const type = best > 0 && has.filter(n => n === best).length === 1 ? DAYS[has.indexOf(best)].id : best > 0 ? 'mix' : next(last);
    if (type !== 'mix') last = type;
    return { day: s.day, i, week: Math.floor(i / PER_WEEK) + 1, type, top, guess: best === 0 };
  });
}
const next = last => DAYS[(DAYS.findIndex(d => d.id === last) + 1) % DAYS.length].id;
const lastType = rows => [...rows].reverse().find(r => r.type !== 'mix')?.type || null;

/* the best set of a lift over some sessions: the highest estimated
   1-rep max for a barbell lift, the heaviest added weight for a body one */
function best(rows, id) {
  const l = LIFT.get(id);
  let b = null;
  for (const r of rows) {
    const t = r.top[id];
    if (!t) continue;
    const score = l.body ? t.kg + t.reps / 1000 : e1rm(t) ?? t.kg;
    if (!b || score > b.score) b = { ...t, day: r.day, week: r.week, score, est: l.body ? undefined : Math.round(e1rm(t) * 2) / 2 };
  }
  return b;
}

/* ── drawing ────────────────────────────────────────────────────────── */

function drawNow(rows) {
  const done = rows.length;
  const finished = done >= WEEKS.length * PER_WEEK;
  const week = Math.min(WEEKS.length, Math.floor(done / PER_WEEK) + 1);
  const slot = done % PER_WEEK;
  const nextId = next(lastType(rows) || DAYS[DAYS.length - 1].id);
  const d = DAY.get(nextId);
  $('nowCount').textContent = `${done} of ${WEEKS.length * PER_WEEK} sessions`;
  if (finished) {
    $('nowWeek').textContent = 'Program done';
    $('nowReps').textContent = '33 sessions';
    $('nowLine').textContent = 'Week 11 set the new maxes. Start week 1 again from them.';
  } else {
    $('nowWeek').textContent = `Week ${week} of ${WEEKS.length}`;
    $('nowReps').textContent = WEEKS[week - 1] ? `${repsText(WEEKS[week - 1])} per set` : 'Light week';
    $('nowLine').textContent = WEEKS[week - 1]
      ? `Session ${slot + 1} of ${PER_WEEK} this week. Work up to the heaviest set of ${repsText(WEEKS[week - 1])}.`
      : `Session ${slot + 1} of ${PER_WEEK} this week. About 60 % of my max, to recover before the way down.`;
  }
  $('nowDay').textContent = d.name;
  $('nowLifts').textContent = d.lifts.map(id => LIFT.get(id).name).join(' and ') + ' to max';
  return { week: finished ? WEEKS.length : week, nextId };
}

function drawWave(cur) {
  const top = Math.max(...WEEKS);
  $('waveChart').innerHTML = WEEKS.map((r, i) => {
    const w = i + 1, cls = w < cur ? 'past' : w === cur ? 'cur' : '';
    const h = r === 0 ? 34 : Math.round(r / top * 100);
    return `<li class="${cls}${r === 0 ? ' light' : ''}" data-tip="Week ${w}: ${r ? repsText(r) + ' per set' : 'light week'}">
      <span class="bar-v">${r || 'L'}</span>
      <span class="bar" style="--h:${h}%"></span>
      <span class="bar-w">W${w}</span></li>`;
  }).join('');
}

function drawDays(nextId) {
  $('dayGrid').innerHTML = DAYS.map(d => `<li><div class="cell day${d.id === nextId ? ' is-next' : ''}">
    <span class="day-h"><b>${d.name}</b>${d.id === nextId ? '<span class="tag tag-max">Next</span>' : ''}</span>
    <ol class="ex">${d.list.map(([n, k]) => `<li class="${k === M ? 'ex-max' : k === C ? 'ex-c' : ''}">${esc(n)}${k === M ? '<span class="tag tag-max">Max</span>' : ''}</li>`).join('')}</ol>
  </div></li>`).join('');
}

/* one small line per lift: its best estimated 1-rep max per program week,
   on a track of all 11 weeks */
function spark(rows, id) {
  const l = LIFT.get(id), pts = [];
  for (let w = 1; w <= WEEKS.length; w++) {
    const b = best(rows.filter(r => r.week === w), id);
    if (b) pts.push({ w, v: e1rm(b) ?? b.kg, b });
  }
  if (pts.length < 2) return '';
  const W = 220, H = 48, P = 6;
  const lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  const x = w => P + (w - 1) / (WEEKS.length - 1) * (W - 2 * P);
  const y = v => hi === lo ? H / 2 : H - P - (v - lo) / (hi - lo) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.w).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const dots = pts.map(p => `<circle cx="${x(p.w).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" data-tip="Week ${p.w}: ${kgText(l, p.b.kg)} &times; ${p.b.reps}, est. 1RM ${kgText(l, Math.round(p.v * 2) / 2)}"></circle>`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${l.name}, estimated 1-rep max week by week"><path class="track" d="M${x(1)},${H - 1}L${x(WEEKS.length)},${H - 1}"></path><path d="${d}"></path>${dots}</svg>`;
}

function drawMaxes(rows) {
  let n = 0;
  $('liftCards').innerHTML = LIFTS.map(l => {
    const b = best(rows, l.id);
    if (b) n++;
    return `<li class="lift">
      <span class="lift-n">${l.name}</span>
      ${b ? `<b class="lift-v">${l.body ? kgText(l, b.kg) : `${b.est} kg`}</b>
      <span class="lift-s">${l.body ? `${b.reps === 1 ? '1 rep' : b.reps + ' reps'}, ${short(b.day)}` : `1RM from ${b.kg} kg &times; ${b.reps}, ${short(b.day)}`}</span>`
      : `<b class="lift-v lift-none">&ndash;</b><span class="lift-s">No max logged yet</span>`}
      ${spark(rows, l.id)}
    </li>`;
  }).join('');
  $('maxCount').textContent = `${n} of ${LIFTS.length} lifts`;

  const head = `<thead><tr><th scope="col">Week</th><th scope="col">Reps</th>${LIFTS.map(l => `<th scope="col">${l.name}</th>`).join('')}</tr></thead>`;
  const body = WEEKS.map((r, i) => {
    const w = i + 1, wr = rows.filter(x => x.week === w);
    const cells = LIFTS.map(l => { const b = best(wr, l.id); return `<td>${b ? `${kgText(l, b.kg)} <small>&times; ${b.reps}</small>` : '<span class="dim">&middot;</span>'}</td>`; }).join('');
    return `<tr class="${wr.length ? '' : 'empty'}"><th scope="row">W${w}</th><td>${r || 'Light'}</td>${cells}</tr>`;
  }).join('');
  $('maxTable').innerHTML = `<caption class="sr-only">Top set of each lift, week by week</caption>${head}<tbody>${body}</tbody>`;
}

/* ── the log ────────────────────────────────────────────────────────── */

let logType = 'push', week = 1;

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
  const got = rowsFor(day), target = WEEKS[week - 1] || '';
  $('logRows').innerHTML = DAY.get(logType).lifts.map(id => {
    const l = LIFT.get(id), g = got[id];
    return `<div class="log-row" data-id="${id}">
      <span class="log-n">${l.name}${l.body ? '<small>kg added</small>' : ''}</span>
      <label class="fld"><span>kg</span><input type="number" inputmode="decimal" step="0.5" min="0" max="500" name="kg" value="${g?.kg ?? ''}" placeholder="0"></label>
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
  const rows = program();
  const now = drawNow(rows);
  week = now.week;
  drawWave(now.week);
  drawDays(now.nextId);
  drawMaxes(rows);
  if (!drawAll.typed) logType = (() => {
    /* today already logged: its type; else the next session */
    const t = rows.find(r => r.day === ($('logDay').value || today));
    return t && DAY.has(t.type) ? t.type : now.nextId;
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
