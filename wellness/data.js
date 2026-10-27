/* jeremylasne.com/wellness: the data both pages read.

   Exp 0's October first, then the days logged on /wellness on top, then any
   day this device still holds because the server could not take it yet.
   Imported by /wellness and /wellness/details. */

import { SPEC, SLEEP, SPORT, dateKey, shift, fromExp0, exercises, bests, form, effort, hrTop, minutes, runSec, tests, mps, load as loadOf } from '/wellness/spec.js';

export const API = 'https://fiery-eel-944.eu-west-1.convex.site/overlap';
export const today = dateKey();
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const COLOR = { run: '#fbbf24', swim: '#38bdf8', lift: '#f472b6', other: '#a78bfa', good: '#6ee7b7', bad: '#fb7185', blue: '#5fa8d3' };

/* ── words and numbers ─────────────────────────────────────────────── */
export const pad = n => String(n).padStart(2, '0');
/* a swim time to the hundredth: 38.45 seconds is 0:38,45 */
export const swimTime = s => { const c = Math.round(s * 100); return `${Math.floor(c / 6000)}:${pad(Math.floor(c % 6000 / 100))},${pad(c % 100)}`; };
const ymd = k => k.split('-').map(Number);
export const dayName = k => { const [y, m, d] = ymd(k); return `${DOW[new Date(y, m - 1, d).getDay()]} ${d} ${MON[m - 1]}`; };
export const short = k => { const [, m, d] = ymd(k); return `${d} ${MON[m - 1]}`; };
export const weekday = k => { const [y, m, d] = ymd(k); return new Date(y, m - 1, d).getDay(); };
/* rounded to the minute first, so 479.7 reads 8h00, never 7h60 */
export const clock = n => { n = Math.round(n); return `${pad(Math.floor(n / 60) % 24)}:${pad(n % 60)}`; };
export const hm = n => { n = Math.round(n); return `${Math.floor(n / 60)}h${pad(n % 60)}`; };
export const mmss = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
export const cap = s => s[0].toUpperCase() + s.slice(1);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const copy = x => JSON.parse(JSON.stringify(x ?? {}));
/* what a session is called: Other sessions go by the name I gave them */
export const label = s => s.s === 'other' && s.n ? s.n : SPORT.get(s.s).name;
export const fmtVal = (id, v) => id === 'min' ? hm(v) : id === 'bed' || id === 'wake' ? clock(v) : String(Math.round(v));
export const unitOf = id => ({ hrv: 'ms', rhr: 'bpm' })[id] ?? '';

/* ── the days ──────────────────────────────────────────────────────── */
export const state = { exp0: {}, days: {}, server: true, maxes: [], maxServer: true };
export const entry = k => state.days[k] || state.exp0[k] || null;
export const allKeys = () => { const out = []; for (let k = SPEC.start; k <= today; k = shift(k, 1)) out.push(k); return out; };
/* the last 30 days, today included: the window the night score is read in */
export const MONTH = 30;
export const monthKeys = () => allKeys().slice(-MONTH);
export const val = (k, id) => { const v = entry(k)?.sleep?.[id]; return typeof v === 'number' ? v : undefined; };
export const sessionsOf = k => entry(k)?.sessions || [];
export const allSessions = () => allKeys().flatMap(k => sessionsOf(k).map(s => ({ ...s, day: k })));
/* a night answers the day that led to it */
export const sportBefore = k => sessionsOf(shift(k, -1));

/* Days kept on this device while the server cannot take them (before its
   update, or offline). They show at once and go up the next time the
   server answers. */
const HELD = 'wellness.held';
export const held = (() => { try { return JSON.parse(localStorage.getItem(HELD) || '{}') || {}; } catch { return {}; } })();
export const keepHeld = () => { try { localStorage.setItem(HELD, JSON.stringify(held)); } catch {} };
/* a target kept as "endurance" before reads as cardio */
const cardio = d => { for (const s of d?.sessions || []) if (s.f === 'endurance') s.f = 'cardio'; return d; };
for (const d of Object.values(held)) cardio(d);
Object.assign(state.days, held);

/* My max, kept on this device while the server does not know max.save yet
   (before its update) or cannot be reached. */
const MAXES = 'wellness.maxes';
export const heldMax = (() => { try { const v = JSON.parse(localStorage.getItem(MAXES) || 'null'); return Array.isArray(v) ? v : null; } catch { return null; } })();
export const keepMax = list => { try { if (list) localStorage.setItem(MAXES, JSON.stringify(list)); else localStorage.removeItem(MAXES); } catch {} };
if (heldMax) state.maxes = heldMax;

export function api(op, args) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, args: args || {} }), signal: ctl.signal })
    .then(r => r.json())
    .then(j => { clearTimeout(t); if (j && j.ok) return j.value; throw new Error((j && j.error) || 'Something went wrong'); },
          e => { clearTimeout(t); throw new Error(e.name === 'AbortError' ? 'The server timed out after 9 seconds' : 'The server is unreachable right now'); });
}

/* Reads Exp 0 and the logged days. Resolves with the error to show, if
   any; before the server update the door does not know days.list, which
   is not an error, only a reason to keep days on the device. */
export async function load(pass) {
  const [old, days, maxes] = await Promise.allSettled([api('bio.get'), api('days.list'), api('max.get')]);
  if (maxes.status === 'fulfilled') {
    /* what this device held is newer than the server's copy: send it up */
    if (heldMax && pass) api('max.save', { passphrase: pass, today, list: heldMax }).then(out => { state.maxes = out; keepMax(null); }, () => {});
    else if (!heldMax) state.maxes = maxes.value || [];
  } else state.maxServer = false;
  if (old.status === 'fulfilled' && old.value?.log) {
    for (const [k, d] of Object.entries(old.value.log)) if (k >= SPEC.start && k <= today) { const x = fromExp0(d); if (x) state.exp0[k] = x; }
  }
  if (days.status === 'fulfilled') {
    for (const d of days.value || []) state.days[d.day] = cardio(d);
    /* what this device held is newer than the server's copy: send it up */
    for (const [k, d] of Object.entries(held)) {
      state.days[k] = d;
      if (pass) api('days.save', { passphrase: pass, today, day: k, entry: d }).then(out => { if (kept(d, out)) { delete held[k]; keepHeld(); } }, () => {});
    }
    return '';
  }
  state.server = false;
  return days.reason?.message === 'Unknown operation' ? '' : days.reason?.message || 'Something went wrong';
}

/* My max from the Gym sessions, found by itself: for each exercise, the
   heaviest weight lifted (more reps wins a tie), with its reps and day. */
export function gymMaxes() {
  const out = new Map();
  for (const s of allSessions()) if (s.s === 'lift') for (const x of exercises(s)) {
    if (!x.n || !(x.kg > 0)) continue;
    const k = x.n.toLowerCase(), b = out.get(k);
    if (!b || x.kg > b.kg || (x.kg === b.kg && (x.reps || 0) > (b.reps || 0))) out.set(k, { n: x.n, d: s.day, kg: x.kg, ...(x.reps ? { reps: x.reps } : {}), from: 'Gym' });
  }
  return [...out.values()];
}
/* My fastest 1, 5 and 10 km, found by themselves from the runs: a run at
   least that long (2 % short is allowed, a watch rounds), its time scaled
   to the distance at the run's average pace. */
export const RUN_MAX = [1000, 5000, 10000];
export function runMaxes() {
  const out = [];
  for (const D of RUN_MAX) {
    let b = null;
    for (const s of allSessions()) {
      const sec = s.s === 'run' && s.m >= D * .98 ? runSec(s) : undefined;
      if (!sec) continue;
      const t = sec * D / s.m;
      if (!b || t < b.sec) b = { n: `Run ${D / 1000} km`, d: s.day, sec: Math.round(t), from: 'Run', pace: t / (D / 1000) };
    }
    if (b) out.push(b);
  }
  return out;
}

/* My fastest swim at each distance, found by itself from the tests: the
   best speed in m/s, with its time and day. */
export function swimMaxes() {
  const out = new Map();
  for (const s of allSessions()) if (s.s === 'swim') for (const t of tests(s)) {
    const v = mps(t), b = out.get(t.m);
    if (v && (!b || v > b.mps)) out.set(t.m, { n: `${t.m} m`, d: s.day, m: t.m, sec: t.sec, from: 'Swim', mps: v });
  }
  return [...out.values()];
}

/* Every max: the ones I typed, the Gym, run and swim ones. A typed max and a Gym
   one with the same name: the heavier one shows. */
export function allMaxes() {
  const list = state.maxes.filter(x => x.n).map(x => ({ ...x }));
  list.push(...runMaxes(), ...swimMaxes());
  for (const g of gymMaxes()) {
    const i = list.findIndex(x => x.n.toLowerCase() === g.n.toLowerCase());
    if (i < 0) list.push(g);
    else if (!(list[i].kg >= g.kg)) list[i] = g;
  }
  return list;
}

/* One max in words: 12 reps · 80 kg · 2000 m · 32 km/h · 3:10 */
export function maxText(x) {
  return SPEC.maxUnits.filter(f => x[f.id] !== undefined)
    .map(f => f.id === 'sec' ? mmss(x.sec) : f.id === 'reps' && x.reps === 1 ? '1 rep' : `${x[f.id]} ${f.unit}`).join(' · ');
}

/* ── normal: the middle half of my nights ──────────────────────────── */
export function quant(sorted, q) { const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
export function spread(values) {
  const v = values.filter(x => x !== undefined).sort((a, b) => a - b);
  if (v.length < 3) return null;
  return { n: v.length, min: v[0], max: v[v.length - 1], q1: quant(v, .25), med: quant(v, .5), q3: quant(v, .75) };
}
export const normal = (id, keys = allKeys()) => spread(keys.map(k => val(k, id)));
/* good, bad or normal, by which way the measure is better */
export function tone(v, nm, better = 'high') {
  if (!nm || v === undefined) return 'mid';
  if (v > nm.q3) return better === 'high' ? 'good' : 'bad';
  if (v < nm.q1) return better === 'high' ? 'bad' : 'good';
  return 'mid';
}
export const verdict = (id, v, nm = normal(id)) => SLEEP.get(id).better ? tone(v, nm, SLEEP.get(id).better) : 'mid';

/* ── the night score ───────────────────────────────────────────────── */
/* Five measures of a night, each put on 0 to 100 against the last 30 days:
   100 is the best of the month on that measure, 0 the worst, whichever way
   is better (a lower night heart rate scores higher). The night score is
   their average, kept when at least 3 of the 5 are logged. */
export const INDICATORS = ['score', 'hrv', 'rhr', 'ready', 'min'];
export function nightScores(keys = monthKeys()) {
  const range = {};
  for (const id of INDICATORS) {
    const v = keys.map(k => val(k, id)).filter(x => x !== undefined);
    if (v.length >= 2) range[id] = { lo: Math.min(...v), hi: Math.max(...v) };
  }
  const out = {};
  for (const k of keys) {
    const parts = {};
    for (const id of INDICATORS) {
      const v = val(k, id), r = range[id];
      if (v === undefined || !r) continue;
      const up = SLEEP.get(id).better === 'high' ? v - r.lo : r.hi - v;
      parts[id] = r.hi === r.lo ? 50 : up / (r.hi - r.lo) * 100;
    }
    const got = Object.values(parts);
    if (got.length >= 3) out[k] = { score: got.reduce((a, b) => a + b, 0) / got.length, parts };
  }
  return out;
}

/* ── sport ─────────────────────────────────────────────────────────── */
/* One exercise in words: Bench 3 × 8 60 kg, or Squat 5 reps 100 kg */
export const exText = e => [e.n, e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.reps ? `${e.reps} reps` : e.sets ? `${e.sets} sets` : '', e.kg ? `${e.kg} kg` : ''].filter(Boolean).join(' ');

/* One swim test in words: 100 m in 1:20, 1.25 m/s */
export const testText = t => mps(t) ? `${t.m} m in ${swimTime(t.sec)}, ${mps(t).toFixed(2)} m/s` : `${t.m} m`;

/* What a session measured, in words: distance, time and pace or speed, or the top set. */
export function measure(s) {
  if (s.s === 'lift') return exercises(s).map(exText).filter(Boolean).join(' · ');
  const sec = runSec(s);
  if (s.s === 'swim') return tests(s).map(testText).join(' · ');
  if (s.s !== 'run' || !s.m || !sec) return '';
  return `${(s.m / 1000).toFixed(2).replace(/\.?0+$/, '')} km · ${mmss(sec)} · ${mmss(sec / (s.m / 1000))}/km`;
}
export const formCls = f => f === undefined ? 'f-none' : f >= .97 ? 'f-good' : f >= .9 ? 'f-mid' : 'f-bad';
const avg = v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined);

/* My maximum heart rate so far, read off every session logged, and my
   resting heart rate: the normal of my nights. Effort reads between them. */
export const top = () => hrTop(allSessions());
export const hrOf = (sessions = allSessions()) => ({ max: hrTop(sessions), rest: normal('rhr')?.med });

/* The load of each day: the sum of its sessions' minutes times effort,
   kept with each sport's share so the column can stack them. */
export function dayLoads(keys = monthKeys()) {
  const t = hrOf(), out = {};
  for (const k of keys) {
    const parts = sessionsOf(k).map(s => ({ s: s.s, v: loadOf(s, t) })).filter(p => p.v !== undefined);
    if (parts.length) out[k] = { total: parts.reduce((a, p) => a + p.v, 0), parts };
  }
  return out;
}
export { avg };

/* Did the server keep every field it was sent? An older server drops the
   ones it does not know yet. */
export function kept(sent, got) {
  const a = sent?.sessions || [], b = got?.sessions || [];
  return ['gf', 'cold'].every(k => !sent?.[k] || got?.[k])
    && a.length === b.length && a.every((s, i) => Object.keys(s).every(key => s[key] === undefined || b[i]?.[key] !== undefined));
}

/* ── every day as one CSV ──────────────────────────────────────────── */
/* One row per session, with the night of that morning beside it; a day
   with no session gets one row for its night. Clock times as HH:MM, a
   bedtime after midnight past 24:00 as logged. */
export function csv() {
  const t = hrOf(), best = bests(allSessions());
  const head = ['date', ...SPEC.sleep.map(f => f.id === 'min' ? 'sleep_min' : f.unit === 'clock' ? f.id : 'sleep_' + f.id),
    'sport', 'name', 'target', 'effort_level', 'start', 'end', 'minutes', 'hr_avg', 'hr_peak', 'hr_max_used',
    'effort_pct', 'load', 'distance_m', 'time_sec', 'lift', 'kg', 'reps', 'exercises', 'form_pct', 'note', 'girlfriend', 'cold_dark'];
  const hhmm = n => n == null ? '' : `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
  const cell = v => v === undefined || v === null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const r1 = v => v === undefined ? '' : Math.round(v * 10) / 10;
  const rows = [];
  for (const k of allKeys()) {
    const d = entry(k); if (!d) continue;
    const night = SPEC.sleep.map(f => f.unit === 'clock' ? hhmm(d.sleep?.[f.id]) : d.sleep?.[f.id]);
    const ss = d.sessions?.length ? d.sessions : [null];
    for (const s of ss) {
      const e = s && effort(s, t), f = s && form(s, best);
      rows.push([k, ...night, ...(s ? [s.s, s.n, s.f, s.lv, hhmm(s.t), hhmm(s.e), minutes(s), s.hr, s.pk, s.hr || s.pk ? t.max : '',
        e === undefined ? '' : Math.round(e * 100), r1(loadOf(s, t)), s.s === 'run' ? s.m : '', s.s === 'run' ? runSec(s) : '', s.lift, s.kg, s.reps, s.s === 'lift' ? exercises(s).map(exText).join('; ') : s.s === 'swim' ? tests(s).map(testText).join('; ') : '', f === undefined ? '' : Math.round(f * 100)]
        : Array(19).fill('')), d.note, d.gf ? 1 : '', d.cold ? 1 : '']);
    }
  }
  return [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
