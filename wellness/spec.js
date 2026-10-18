/* jeremylasne.com/wellness: the rules of the log, in one file.

   Phase 0 is "normal": I log my sleep and my sport and change nothing, so
   the numbers show what an ordinary week looks like before any habit is
   tested against it.

   Imported by the page (wellness/index.html) and by the server
   (wellness-api/convex/days.ts), so both agree on what a saved day may hold.
   Plain JavaScript on purpose: the page has no build step. */

export const SPEC = {
  /* The first day the page shows. Exp 0 began on 1 October, so its nights
     and sessions are the start of normal. */
  start: '2026-10-01',

  /* The heart rate that counts as 100 % effort. 220 minus age is a rough
     guess; a measured maximum is better. Change it here and every effort
     on the page follows. */
  hrMax: 190,

  /* The night, read off the watch each morning. `better` says which way is
     a win. Bed and wake are clock times in minutes after midnight; a
     bedtime after midnight is kept past 24:00 (00:40 is 1480). */
  sleep: [
    { id: 'score', name: 'Sleep score', short: 'Score', unit: '/100', max: 100, better: 'high' },
    { id: 'hrv',   name: 'HRV',         short: 'HRV',   unit: 'ms',   max: 300, better: 'high' },
    { id: 'rhr',   name: 'Night heart rate', short: 'Night HR', unit: 'bpm', max: 140, better: 'low' },
    { id: 'ready', name: 'Readiness',   short: 'Ready', unit: '/100', max: 100, better: 'high' },
    { id: 'min',   name: 'Time asleep', short: 'Asleep', unit: 'min', max: 960, better: 'high' },
    { id: 'bed',   name: 'Bedtime',     short: 'Bed',   unit: 'clock', max: 2159 },
    { id: 'wake',  name: 'Wake-up',     short: 'Wake',  unit: 'clock', max: 1439 },
  ],

  /* The sports, and what one session of each is measured by.
     Run and swim: a distance and a time. Lift: the top set of one lift. */
  sports: [
    { id: 'run',  name: 'Run',  focus: 'endurance' },
    { id: 'swim', name: 'Swim', focus: 'endurance' },
    { id: 'lift', name: 'Lift', focus: 'strength' },
  ],
  lifts: ['squat', 'bench', 'deadlift'],
  focus: ['speed', 'strength', 'endurance'],
  perDay: 4,
};

export const SLEEP = new Map(SPEC.sleep.map(f => [f.id, f]));
export const SPORT = new Map(SPEC.sports.map(s => [s.id, s]));

/* ── dates ──────────────────────────────────────────────────────────── */

export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const utcOf = key => { const m = KEY.exec(key); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
export const isKey = key => typeof key === 'string' && !Number.isNaN(utcOf(key));
export const shift = (key, n) => new Date(utcOf(key) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (from, to) => Math.round((utcOf(to) - utcOf(from)) / 86400000);

/* ── what a save may contain ────────────────────────────────────────── */

const num = (raw, max, floor = 0) => {
  if (raw === '' || raw == null || typeof raw === 'boolean') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(floor, Math.round(n * 100) / 100));
};
const word = (raw, list) => (typeof raw === 'string' && list.includes(raw) ? raw : undefined);

/* One session, or nothing. A session needs a sport; everything else is
   what was measured. `t` and `e` are when it started and ended (minutes
   after midnight), `hr` its average heart rate, `m` its distance in metres
   and `sec` its time in seconds (run, swim), `lift`, `kg` and `reps` the
   top set (lift). */
function cleanSession(s) {
  if (!s || typeof s !== 'object') return undefined;
  const sport = word(s.s, SPEC.sports.map(x => x.id));
  if (!sport) return undefined;
  const out = { s: sport };
  const put = (k, v) => { if (v !== undefined) out[k] = v; };
  put('f', word(s.f, SPEC.focus));
  put('t', num(s.t, 1439)); put('e', num(s.e, 1439));
  if (out.t !== undefined) out.t = Math.round(out.t);
  if (out.e !== undefined) out.e = Math.round(out.e);
  put('hr', num(s.hr, 230));
  if (sport === 'lift') {
    put('lift', word(s.lift, SPEC.lifts));
    put('kg', num(s.kg, 500));
    put('reps', num(s.reps, 30, 1));
    if (out.reps !== undefined) out.reps = Math.round(out.reps);
  } else {
    put('m', num(s.m, 100000));
    put('sec', num(s.sec, 86400));
  }
  return out;
}

/* One day as the server keeps it: the night that ended that morning and
   the day's sessions. Days before the start or after today are refused. */
export function cleanDay(day, input, today) {
  if (!isKey(day) || day < SPEC.start || day > today) return null;
  const sleep = {};
  for (const f of SPEC.sleep) {
    const v = num(input?.sleep?.[f.id], f.max);
    if (v !== undefined) sleep[f.id] = f.unit === 'clock' || f.id === 'min' ? Math.round(v) : v;
  }
  const sessions = (Array.isArray(input?.sessions) ? input.sessions : [])
    .map(cleanSession).filter(Boolean).slice(0, SPEC.perDay);
  const note = typeof input?.note === 'string' ? input.note.trim().slice(0, 120) : '';
  const out = { day };
  if (Object.keys(sleep).length) out.sleep = sleep;
  if (sessions.length) out.sessions = sessions;
  if (note) out.note = note;
  return out;
}

/* ── reading Exp 0 ──────────────────────────────────────────────────── */

/* A few Exp 0 bedtimes were typed as four digits and kept as the number
   itself: 2143 for 21:43. Nobody goes to bed after 10:00 the next morning,
   so a bedtime past 34:00 is read that way. */
export function fixBed(bed) {
  if (bed == null) return undefined;
  if (bed > 2040 && bed % 100 < 60) return Math.floor(bed / 100) * 60 + (bed % 100);
  return bed;
}

/* An Exp 0 day in this page's shape: the night as it is, and its sessions
   with Gym read as lifting. Intake and meals stay in Exp 0. */
const OLD_SPORT = { Run: 'run', Swim: 'swim', Gym: 'lift' };
export function fromExp0(d) {
  if (!d || typeof d !== 'object') return null;
  const sleep = {};
  const map = { sleepScore: 'score', hrv: 'hrv', rhr: 'rhr', readiness: 'ready', sleepMin: 'min', bed: 'bed', wake: 'wake' };
  for (const [from, to] of Object.entries(map)) if (typeof d[from] === 'number') sleep[to] = d[from];
  if (sleep.bed !== undefined) sleep.bed = fixBed(sleep.bed);
  const sessions = (d.sessions || []).map(s => {
    const id = OLD_SPORT[s.s];
    if (!id) return null;
    const out = { s: id, f: SPORT.get(id).focus };
    if (s.t != null) out.t = s.t;
    if (s.e != null) out.e = s.e;
    return out;
  }).filter(Boolean);
  const out = {};
  if (Object.keys(sleep).length) out.sleep = sleep;
  if (sessions.length) out.sessions = sessions;
  return Object.keys(out).length ? out : null;
}

/* ── performance ────────────────────────────────────────────────────── */

/* A run or a swim at any distance, as the time it would take over a
   reference distance (Riegel: T2 = T1 x (D2/D1)^1.06), so a 3 km and an
   8 km run can be compared. 5 km for a run, 400 m for a swim. */
export const REF = { run: 5000, swim: 400 };
export const equivalent = s => (s.m > 0 && s.sec > 0 ? s.sec * Math.pow(REF[s.s] / s.m, 1.06) : undefined);
/* The most a lift could be done once, from a set of several (Epley). */
export const e1rm = s => (s.kg > 0 && s.reps > 0 ? (s.reps === 1 ? s.kg : s.kg * (1 + s.reps / 30)) : undefined);
/* Average heart rate as a share of the maximum. */
export const effort = s => (s.hr > 0 ? s.hr / SPEC.hrMax : undefined);

/* The one number of a session and the key its best is kept under: lower
   is better for times, higher for lifts. */
export function score(s) {
  if (s.s === 'lift') { const v = e1rm(s); return v && s.lift ? { key: `lift:${s.lift}`, v, high: true } : null; }
  const v = equivalent(s);
  return v ? { key: s.s, v, high: false } : null;
}

/* Form: a session against the best of its kind so far, best = 100 %. */
export function bests(sessions) {
  const best = {};
  for (const s of sessions) {
    const r = score(s);
    if (!r) continue;
    const b = best[r.key];
    if (b === undefined || (r.high ? r.v > b : r.v < b)) best[r.key] = r.v;
  }
  return best;
}
export function form(s, best) {
  const r = score(s);
  if (!r || !best[r.key]) return undefined;
  return r.high ? r.v / best[r.key] : best[r.key] / r.v;
}
