/* jeremylasne.com/bio: the one place the log's rules live.

   Imported by the page (bio/index.html) and by the server
   (overlap/convex/bio.ts), so the two agree on which fields exist, what a
   saved day may contain, and how a correlation is worked out. Plain
   JavaScript on purpose: the page has no build step. */

export const SPEC = {
  /* The challenge. 31 days, nothing outside them is shown or saved. */
  start: '2026-10-01',
  end: '2026-10-31',

  /* Days of data before the matrix will show a cell. Under this the
     numbers are noise dressed as a finding. */
  minDays: 21,
  /* Days needed on each side of a split before that one cell is read. */
  minPerSide: 4,

  /* What I log by hand. Taps first, then the two numbers no sensor sees.
     `kind` drives the control: tap is a counter, flag is on/off, num is
     typed. `max` is the ceiling a save is clamped to. */
  manual: [
    { id: 'coffee',  name: 'Coffee',      unit: 'cups',  kind: 'tap',  max: 12,  icon: '☕️',
      why: 'One tap per cup, at the cup. Recall after six hours is fiction.' },
    { id: 'water',   name: 'Water',       unit: '×50cl', kind: 'tap',  max: 16,  icon: '💧',
      why: 'One tap per bottle.' },
    { id: 'alcohol', name: 'Alcohol',     unit: 'units', kind: 'tap',  max: 20,  icon: '🍺',
      why: 'One tap per drink. The strongest single lever on overnight recovery.' },
    { id: 'showers', name: 'Showers',     unit: '',      kind: 'tap',  max: 4,   icon: '🚿',
      why: 'How many times today.' },
    { id: 'cold',    name: 'Cold shower', unit: '',      kind: 'flag',           icon: '🧊',
      why: 'On if any shower today finished cold.' },
    { id: 'gym',     name: 'Gym',         unit: '',      kind: 'flag',           icon: '🏋️',
      why: 'On for a lifting session. Cardio is read from the watch instead.' },
    { id: 'bath',    name: 'Bath',        unit: 'min',   kind: 'num',  max: 180, icon: '🛁',
      why: 'Minutes in the water. Zero on a day without one.' },
    { id: 'sun',     name: 'Sun',         unit: 'min',   kind: 'num',  max: 600, icon: '☀️',
      why: 'Minutes of skin in daylight.' },
    { id: 'deep',    name: 'Deep work',   unit: 'h',     kind: 'num',  max: 16, step: 0.5, icon: '🧠',
      why: 'Hours of focused work, in half hours.' },
  ],

  /* What the watch, the scale and Yazio know. Typed each morning until the
     Google Health sync lands, then written by the sync and left alone. */
  body: [
    { id: 'sleepScore', name: 'Sleep score', unit: '/100', max: 100,    src: 'Fitbit' },
    { id: 'sleepMin',   name: 'Sleep',       unit: 'min',  max: 960,    src: 'Fitbit', clock: true },
    { id: 'readiness',  name: 'Recovery',    unit: '/100', max: 100,    src: 'Fitbit' },
    { id: 'rhr',        name: 'Resting HR',  unit: 'bpm',  max: 140,    src: 'Fitbit' },
    { id: 'hrv',        name: 'HRV',         unit: 'ms',   max: 300,    src: 'Fitbit' },
    { id: 'steps',      name: 'Steps',       unit: '',     max: 100000, src: 'Fitbit' },
    { id: 'azm',        name: 'Zone minutes', unit: '',    max: 600,    src: 'Fitbit' },
    { id: 'weight',     name: 'Weight',      unit: 'kg',   max: 250, step: 0.1, src: 'Scale' },
    { id: 'eaten',      name: 'Eaten',       unit: 'kcal', max: 12000,  src: 'Yazio' },
  ],

  /* The four columns of the matrix. `better` says which direction is a win,
     so a cell is coloured by what it means, not by its sign. Each one is
     read the morning AFTER the factor, because a night is what answers a
     day. */
  outcomes: [
    { id: 'readiness',  name: 'Recovery',    better: 'high' },
    { id: 'rhr',        name: 'Resting HR',  better: 'low' },
    { id: 'sleepMin',   name: 'Sleep',       better: 'high' },
    { id: 'sleepScore', name: 'Sleep score', better: 'high' },
  ],

  /* The rows of the matrix. A flag splits on itself. A number splits at its
     own median across the logged days, so "high" always means high for me,
     not against a table. */
  factors: [
    { id: 'alcohol', name: 'Alcohol',      icon: '🍺', split: 'zero' },
    { id: 'gym',     name: 'Gym',          icon: '🏋️', split: 'flag' },
    { id: 'cold',    name: 'Cold shower',  icon: '🧊', split: 'flag' },
    { id: 'bath',    name: 'Bath',         icon: '🛁', split: 'zero' },
    { id: 'coffee',  name: 'Coffee',       icon: '☕️', split: 'median' },
    { id: 'water',   name: 'Water',        icon: '💧', split: 'median' },
    { id: 'sun',     name: 'Sun',          icon: '☀️', split: 'median' },
    { id: 'deep',    name: 'Deep work',    icon: '🧠', split: 'median' },
    { id: 'showers', name: 'Showers',      icon: '🚿', split: 'median' },
    { id: 'steps',   name: 'Steps',        icon: '👟', split: 'median' },
    { id: 'azm',     name: 'Zone minutes', icon: '❤️', split: 'median' },
    { id: 'eaten',   name: 'Calories',     icon: '🍽️', split: 'median' },
  ],
};

/* Every field that may sit on a day, by id. */
export const FIELDS = new Map(
  [...SPEC.manual, ...SPEC.body].map(f => [f.id, f])
);

/* ── dates ──────────────────────────────────────────────────────────── */

/* Local calendar date as YYYY-MM-DD. */
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const utcOf = key => { const m = KEY.exec(key); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
export const isKey = key => typeof key === 'string' && !Number.isNaN(utcOf(key));

/* The key n days after another one, and the whole days between two keys.
   UTC arithmetic on the calendar parts, so DST cannot shift a day. */
export const shift = (key, n) => new Date(utcOf(key) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (from, to) => Math.round((utcOf(to) - utcOf(from)) / 86400000);

/* The 31 days of the challenge, first to last. */
export const allDays = () => {
  const out = [];
  for (let k = SPEC.start; k <= SPEC.end; k = shift(k, 1)) out.push(k);
  return out;
};

/* ── what a save may contain ────────────────────────────────────────── */

/* Decided once for both sides: only days inside the challenge and not
   after today, only known fields, every number finite and inside range.
   Flags are booleans, everything else is a clamped number. */
export function clean(input, today) {
  const log = {};
  const last = today < SPEC.end ? today : SPEC.end;
  const keys = Object.keys(input?.log ?? {})
    .filter(k => isKey(k) && k >= SPEC.start && k <= last)
    .sort();
  for (const key of keys) {
    const day = input.log[key];
    if (!day || typeof day !== 'object') continue;
    const entry = {};
    for (const f of SPEC.manual.concat(SPEC.body)) {
      const raw = day[f.id];
      if (f.kind === 'flag') { if (raw === true) entry[f.id] = true; continue; }
      if (raw === '' || raw == null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      entry[f.id] = Math.min(f.max, Math.max(0, Math.round(n * 100) / 100));
    }
    const note = typeof day.note === 'string' ? day.note.trim().slice(0, 120) : '';
    if (note) entry.note = note;
    if (Object.keys(entry).length) log[key] = entry;
  }
  return { log };
}

/* A day counts as logged once the taps have been saved: any manual field
   set, including a zero typed on purpose. */
export const isLogged = day => !!day && SPEC.manual.some(f => day[f.id] != null);
export const hasBody = day => !!day && SPEC.body.some(f => day[f.id] != null);

/* ── the matrix ─────────────────────────────────────────────────────── */

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = xs => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/* Cohen's d on the pooled spread: how far apart the two groups sit,
   measured in the spread of the days themselves. A big percent on a wild
   metric says less than a small one on a steady metric, and this is what
   tells them apart. */
function strength(on, off) {
  const n1 = on.length, n2 = off.length;
  if (n1 < SPEC.minPerSide || n2 < SPEC.minPerSide) return null;
  const s1 = sd(on), s2 = sd(off);
  const pooled = Math.sqrt(((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2));
  if (!pooled) return { d: 0, label: 'weak' };
  const d = Math.abs(mean(on) - mean(off)) / pooled;
  const label = d >= 1 ? 'v. strong' : d >= 0.6 ? 'strong' : d >= 0.3 ? 'medium' : 'weak';
  return { d, label };
}

/* One cell: the factor on day D against the outcome the morning after.
   Returns null while either side is too thin to read. */
export function cell(log, factor, outcome) {
  const days = allDays();
  const pairs = [];
  for (const key of days) {
    const d = log[key];
    const next = log[shift(key, 1)];
    if (!d || !next) continue;
    const y = next[outcome.id];
    if (!Number.isFinite(y)) continue;
    if (factor.split === 'flag') { pairs.push({ x: d[factor.id] === true ? 1 : 0, y }); continue; }
    const x = d[factor.id];
    if (!Number.isFinite(x)) continue;
    pairs.push({ x, y });
  }
  if (pairs.length < SPEC.minPerSide * 2) return null;

  let on, off;
  if (factor.split === 'median') {
    const cut = median(pairs.map(p => p.x));
    on = pairs.filter(p => p.x > cut).map(p => p.y);
    off = pairs.filter(p => p.x <= cut).map(p => p.y);
  } else {
    on = pairs.filter(p => p.x > 0).map(p => p.y);
    off = pairs.filter(p => p.x <= 0).map(p => p.y);
  }
  const s = strength(on, off);
  if (!s) return null;

  const base = mean(off);
  if (!base) return null;
  const delta = (mean(on) - base) / base * 100;
  const good = outcome.better === 'high' ? delta > 0 : delta < 0;
  return { delta, label: s.label, good, n: on.length + off.length, nOn: on.length };
}

/* The whole matrix, rows ordered by the loudest thing they say. */
export function matrix(log) {
  const rows = SPEC.factors.map(f => {
    const cells = SPEC.outcomes.map(o => cell(log, f, o));
    const loudest = Math.max(0, ...cells.filter(Boolean).map(c => Math.abs(c.delta)));
    return { factor: f, cells, loudest };
  });
  rows.sort((a, b) => b.loudest - a.loudest);
  return rows;
}

/* Days with both the taps and the body numbers on them: what the matrix
   actually runs on. */
export function readyDays(log) {
  return allDays().filter(k => isLogged(log[k]) && hasBody(log[k])).length;
}
