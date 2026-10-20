/* jeremylasne.com/wellness: the data both pages read.

   Exp 0's October first, then the days logged on /wellness on top, then any
   day this device still holds because the server could not take it yet.
   Imported by /wellness and /wellness/details. */

import { SPEC, SLEEP, SPORT, dateKey, shift, fromExp0, bests, form, effort, hrTop, minutes, load as loadOf } from '/wellness/spec.js';

export const API = 'https://fiery-eel-944.eu-west-1.convex.site/overlap';
export const today = dateKey();
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const COLOR = { run: '#fbbf24', swim: '#38bdf8', lift: '#f472b6', other: '#a78bfa', good: '#6ee7b7', bad: '#fb7185', blue: '#5fa8d3' };

/* ── words and numbers ─────────────────────────────────────────────── */
export const pad = n => String(n).padStart(2, '0');
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
export const state = { exp0: {}, days: {}, server: true };
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
  const [old, days] = await Promise.allSettled([api('bio.get'), api('days.list')]);
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
/* What a session measured, in words: distance, time and pace, or the top set. */
export function measure(s) {
  if (s.s === 'lift') return s.kg && s.reps ? `${s.lift ? cap(s.lift) + ' ' : ''}${s.kg} kg × ${s.reps}` : '';
  if (s.s !== 'run' || !s.m || !s.sec) return '';
  return `${(s.m / 1000).toFixed(2).replace(/\.?0+$/, '')} km · ${mmss(s.sec)} · ${mmss(s.sec / (s.m / 1000))}/km`;
}
export const formCls = f => f === undefined ? 'f-none' : f >= .97 ? 'f-good' : f >= .9 ? 'f-mid' : 'f-bad';
const avg = v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined);

/* My maximum heart rate so far, read off every session logged. */
export const top = () => hrTop(allSessions());

/* The load of each day: the sum of its sessions' minutes times effort,
   kept with each sport's share so the column can stack them. */
export function dayLoads(keys = monthKeys()) {
  const t = top(), out = {};
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
  return a.length === b.length && a.every((s, i) => Object.keys(s).every(key => s[key] === undefined || b[i]?.[key] !== undefined));
}

/* ── every day as one CSV ──────────────────────────────────────────── */
/* One row per session, with the night of that morning beside it; a day
   with no session gets one row for its night. Clock times as HH:MM, a
   bedtime after midnight past 24:00 as logged. */
export function csv() {
  const t = top(), best = bests(allSessions());
  const head = ['date', ...SPEC.sleep.map(f => f.id === 'min' ? 'sleep_min' : f.unit === 'clock' ? f.id : 'sleep_' + f.id),
    'sport', 'name', 'target', 'effort_level', 'start', 'end', 'minutes', 'hr_avg', 'hr_peak', 'hr_max_used',
    'effort_pct', 'load', 'distance_m', 'time_sec', 'lift', 'kg', 'reps', 'form_pct', 'note'];
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
      rows.push([k, ...night, ...(s ? [s.s, s.n, s.f, s.lv, hhmm(s.t), hhmm(s.e), minutes(s), s.hr, s.pk, s.hr || s.pk ? t : '',
        e === undefined ? '' : Math.round(e * 100), r1(loadOf(s, t)), s.m, s.sec, s.lift, s.kg, s.reps, f === undefined ? '' : Math.round(f * 100)]
        : Array(18).fill('')), d.note]);
    }
  }
  return [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
