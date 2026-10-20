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

  /* The night, read off the watch each morning. `better` says which way is
     a win. Bed and wake are clock times in minutes after midnight; a
     bedtime after midnight is kept past 24:00 (00:40 is 1480). */
  sleep: [
    { id: 'score', name: 'Sleep score', short: 'Score', unit: '/100', max: 100, better: 'high' },
    { id: 'hrv',   name: 'HRV',         short: 'HRV',   unit: 'ms',   max: 300, better: 'high' },
    { id: 'rhr',   name: 'RHR', short: 'RHR', unit: 'bpm', max: 140, better: 'low' }, /* resting heart rate, read at night */
    { id: 'ready', name: 'Readiness',   short: 'Ready', unit: '/100', max: 100, better: 'high' },
    { id: 'min',   name: 'Time asleep', short: 'Asleep', unit: 'min', max: 960, better: 'high' },
    { id: 'bed',   name: 'Bedtime',     short: 'Bed',   unit: 'clock', max: 2159 },
    { id: 'wake',  name: 'Wake-up',     short: 'Wake',  unit: 'clock', max: 1439 },
  ],

  /* The sports, and what one session of each is measured by. Every
     session: a target, an effort level from 1 to 5, how long it lasted and
     its average and peak heart rate. Run: a distance on top. Gym:
     any exercises, each named, with sets, reps and weight. Swim: a training, nothing more. Other: any
     other activity, named when logged (padel, yoga, a hike). */
  sports: [
    { id: 'run',   name: 'Run',   focus: 'cardio' },
    { id: 'swim',  name: 'Swim',  focus: 'cardio' },
    { id: 'lift',  name: 'Gym',   focus: 'strength' },
    { id: 'other', name: 'Other', focus: 'cardio' },
  ],
  /* the longest name an Other session may carry */
  nameMax: 24,
  /* the lifts of the first Gym sessions, kept as one top set each */
  lifts: ['squat', 'bench', 'deadlift'],
  /* the most exercises one Gym session may hold */
  exMax: 12,
  focus: ['strength', 'speed', 'cardio'],
  /* How much each part counts in a session's effort, by target: the
     average heart rate, the peak heart rate and the level I felt. */
  mix: {
    cardio:   { avg: .6, peak: .2, felt: .2 },
    speed:    { avg: .2, peak: .5, felt: .3 },
    strength: { avg: .2, peak: .2, felt: .6 },
  },
  levels: 5,
  perDay: 4,

  /* My max: the most I did, typed by hand. Each one has a name and any of
     these measures, picked per max: 12 reps of pull-ups, 140 kg on the
     squat, 2000 m swum, 32 km/h on the bike, a 3:10 plank. */
  maxUnits: [
    { id: 'reps', name: 'Reps',   unit: 'reps', max: 10000 },
    { id: 'kg',   name: 'Weight', unit: 'kg',   max: 1000 },
    { id: 'm',    name: 'Metres', unit: 'm',    max: 1000000 },
    { id: 'kmh',  name: 'Speed',  unit: 'km/h', max: 200 },
    { id: 'sec',  name: 'Time',   unit: 'time', max: 86400 },
  ],
  maxCount: 40,
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
   after midnight) in sessions logged before `d`, how long it lasted in
   minutes, `f` its target, `lv` the effort I felt from 1 to 5,
   `hr` and `pk` its average and peak heart rate, `m` its distance in metres
   and `sec` its time in seconds (run), `x` the exercises
   (gym: a name, sets, reps and kg each; the first sessions kept one top
   set as `lift`, `kg` and `reps`), `n` the name of the activity (other). A target kept as
   "endurance" before is read as cardio. */
function cleanSession(s) {
  if (!s || typeof s !== 'object') return undefined;
  const sport = word(s.s, SPEC.sports.map(x => x.id));
  if (!sport) return undefined;
  const out = { s: sport };
  const put = (k, v) => { if (v !== undefined) out[k] = v; };
  put('f', word(s.f === 'endurance' ? 'cardio' : s.f, SPEC.focus));
  put('t', num(s.t, 1439)); put('e', num(s.e, 1439));
  if (out.t !== undefined) out.t = Math.round(out.t);
  if (out.e !== undefined) out.e = Math.round(out.e);
  put('d', num(s.d, 1440));
  if (out.d !== undefined) out.d = Math.round(out.d) || undefined;
  if (out.d === undefined) delete out.d;
  put('hr', num(s.hr, 230));
  put('pk', num(s.pk, 230));
  put('lv', num(s.lv, SPEC.levels, 1));
  if (out.lv !== undefined) out.lv = Math.round(out.lv);
  if (sport === 'other') {
    const n = typeof s.n === 'string' ? s.n.trim().slice(0, SPEC.nameMax) : '';
    if (n) out.n = n;
  } else if (sport === 'lift') {
    const x = (Array.isArray(s.x) ? s.x : []).map(cleanExercise).filter(Boolean).slice(0, SPEC.exMax);
    if (x.length) out.x = x;
    put('lift', word(s.lift, SPEC.lifts));
    put('kg', num(s.kg, 500));
    put('reps', num(s.reps, 30, 1));
    if (out.reps !== undefined) out.reps = Math.round(out.reps);
  } else if (sport === 'run') {
    put('m', num(s.m, 100000));
    put('sec', num(s.sec, 86400));
  }
  return out;
}

/* One exercise of a Gym session: a name, then sets, reps and kg. */
function cleanExercise(e) {
  if (!e || typeof e !== 'object') return undefined;
  const n = typeof e.n === 'string' ? e.n.trim().slice(0, SPEC.nameMax) : '';
  if (!n) return undefined;
  const out = { n };
  const sets = num(e.sets, 50, 1), reps = num(e.reps, 1000, 1), kg = num(e.kg, 1000);
  if (sets !== undefined) out.sets = Math.round(sets);
  if (reps !== undefined) out.reps = Math.round(reps);
  if (kg !== undefined) out.kg = kg;
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

/* My max as the server keeps it: a name, the day it was done, the
   measures picked (`u`) and a number for each one filled. A max with no
   name is dropped; 40 at most. */
export function cleanMaxes(input, today) {
  const ids = SPEC.maxUnits.map(u => u.id);
  return (Array.isArray(input) ? input : []).map(x => {
    if (!x || typeof x !== 'object') return null;
    const n = typeof x.n === 'string' ? x.n.trim().slice(0, SPEC.nameMax) : '';
    if (!n) return null;
    const out = { n };
    if (isKey(x.d) && x.d <= today) out.d = x.d;
    const u = (Array.isArray(x.u) ? x.u : []).filter((id, i, a) => ids.includes(id) && a.indexOf(id) === i);
    if (u.length) out.u = u;
    for (const f of SPEC.maxUnits) { const v = num(x[f.id], f.max); if (v !== undefined) out[f.id] = v; }
    return out;
  }).filter(Boolean).slice(0, SPEC.maxCount);
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
   with Gym read as lifting and any other sport as Other under its own
   name. Intake and meals stay in Exp 0. */
const OLD_SPORT = { Run: 'run', Swim: 'swim', Gym: 'lift' };
export function fromExp0(d) {
  if (!d || typeof d !== 'object') return null;
  const sleep = {};
  const map = { sleepScore: 'score', hrv: 'hrv', rhr: 'rhr', readiness: 'ready', sleepMin: 'min', bed: 'bed', wake: 'wake' };
  for (const [from, to] of Object.entries(map)) if (typeof d[from] === 'number') sleep[to] = d[from];
  if (sleep.bed !== undefined) sleep.bed = fixBed(sleep.bed);
  const sessions = (d.sessions || []).map(s => {
    if (typeof s?.s !== 'string' || !s.s) return null;
    const id = OLD_SPORT[s.s] || 'other';
    const out = { s: id, f: SPORT.get(id).focus };
    if (id === 'other') out.n = s.s.slice(0, SPEC.nameMax);
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

/* A run at any distance, as the time it would take over 5 km (Riegel:
   T2 = T1 x (D2/D1)^1.06), so a 3 km and an 8 km run can be compared. The
   time is how long the session lasted (or the time kept on older runs). */
export const REF = { run: 5000 };
export const runSec = s => s.sec > 0 ? s.sec : minutes(s) ? minutes(s) * 60 : undefined;
export const equivalent = s => (REF[s.s] && s.m > 0 && runSec(s) ? runSec(s) * Math.pow(REF[s.s] / s.m, 1.06) : undefined);
/* The exercises of a Gym session; a first session's top set reads as one. */
export const exercises = s => s.x?.length ? s.x : s.lift ? [{ n: s.lift[0].toUpperCase() + s.lift.slice(1), kg: s.kg, reps: s.reps }] : [];
/* The most a lift could be done once, from a set of several (Epley). */
export const e1rm = s => (s.kg > 0 && s.reps > 0 ? (s.reps === 1 ? s.kg : s.kg * (1 + s.reps / 30)) : undefined);
/* My maximum heart rate: the highest peak (or average) of all my sessions,
   so it rises the day I beat it. */
export function hrTop(sessions) {
  const v = sessions.flatMap(s => [s.pk, s.hr]).filter(x => x > 0);
  return v.length ? Math.max(...v) : undefined;
}
/* Effort, from 0 to 1: the average heart rate and the peak against my
   maximum, and the level I felt out of 5, mixed by the target (SPEC.mix).
   A part not logged leaves the others to share its weight. */
export function effort(s, top) {
  const mix = SPEC.mix[s.f] || { avg: 1, peak: 1, felt: 1 };
  const parts = [
    [mix.avg, s.hr > 0 && top ? s.hr / top : undefined],
    [mix.peak, s.pk > 0 && top ? s.pk / top : undefined],
    [mix.felt, s.lv > 0 ? s.lv / SPEC.levels : undefined],
  ].filter(([, v]) => v !== undefined);
  const w = parts.reduce((a, [m]) => a + m, 0);
  return w ? Math.min(1, parts.reduce((a, [m, v]) => a + m * v, 0) / w) : undefined;
}
/* How long a session lasted, in minutes: as logged, or from the start and
   end of older sessions. */
export const minutes = s => (s.d > 0 ? s.d : s.t != null && s.e != null ? (s.e - s.t + 1440) % 1440 || undefined : undefined);
/* Load: minutes times effort. 60 minutes at 80 % is 48. A day's load is the
   sum of its sessions, so every sport adds to the same number. */
export function load(s, top) {
  const m = minutes(s), e = effort(s, top);
  return m && e !== undefined ? m * e : undefined;
}

/* The numbers of a session and the key each best is kept under: lower is
   better for times, higher for lifts. A Gym session has one per exercise
   with a weight and reps, keyed by its name. */
export function scores(s) {
  if (s.s === 'lift') return exercises(s).map(e => { const v = e1rm(e); return v ? { key: `lift:${e.n.toLowerCase()}`, v, high: true } : null; }).filter(Boolean);
  const v = equivalent(s);
  return v ? [{ key: s.s, v, high: false }] : [];
}

/* Form: a session against the best of its kind so far, best = 100 %. */
export function bests(sessions) {
  const best = {};
  for (const s of sessions) for (const r of scores(s)) {
    const b = best[r.key];
    if (b === undefined || (r.high ? r.v > b : r.v < b)) best[r.key] = r.v;
  }
  return best;
}
/* A Gym session's form is the average of its exercises'. */
export function form(s, best) {
  const f = scores(s).filter(r => best[r.key]).map(r => r.high ? r.v / best[r.key] : best[r.key] / r.v);
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : undefined;
}
