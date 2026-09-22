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

  /* What a day is made of, in the order it is logged. */
  groups: [
    { id: 'intake',  name: 'Intake',    icon: '🍽️', when: 'Tap it as it happens' },
    { id: 'sport',   name: 'Sport',     icon: '🏃',  when: 'After the session' },
    { id: 'sleep',   name: 'Sleep',     icon: '😴',  when: 'Each morning' },
    { id: 'observe', name: 'Observing', icon: '📊',  when: 'Each morning, off the watch' },
    { id: 'levers',  name: 'Levers',    icon: '🌿',  when: 'Tonight, 20 seconds' },
  ],

  /* Every field on a day. `kind` drives the control: tap is a counter,
     flag is on/off, num is typed. `goal` is the daily target and `goalDir`
     says which way it points, so 2 cups of coffee is a ceiling while 4
     litres of water is a floor. `scale` turns the count into what the goal
     is spoken in: eight bottles of 50cl read as 4 L. `max` is the ceiling a
     save is clamped to. */
  fields: [
    { id: 'coffee', group: 'intake', name: 'Coffee', unit: 'cups', kind: 'tap', max: 12, icon: '☕️',
      goal: 2, goalDir: 'max' },
    { id: 'water', group: 'intake', name: 'Water', unit: '×50cl', kind: 'tap', max: 16, icon: '💧',
      goal: 8, goalDir: 'min', scale: 0.5, scaleUnit: 'L' },
    { id: 'eaten', group: 'intake', name: 'Eaten', unit: 'kcal', kind: 'num', max: 12000, icon: '🍽️', src: 'Yazio' },

    { id: 'steps', group: 'sport', name: 'Steps', unit: '', kind: 'num', max: 100000, icon: '👟', src: 'Fitbit' },

    { id: 'sleepScore', group: 'sleep', name: 'Sleep score', unit: '/100', kind: 'num', max: 100, icon: '💤', src: 'Fitbit' },
    { id: 'sleepMin', group: 'sleep', name: 'Sleep', unit: '', kind: 'num', max: 960, icon: '🛌', src: 'Fitbit', clock: true },

    { id: 'weight', group: 'observe', name: 'Weight', unit: 'kg', kind: 'num', max: 250, step: 0.1, icon: '⚖️', src: 'Scale' },
    { id: 'hrv', group: 'observe', name: 'HRV', unit: 'ms', kind: 'num', max: 300, icon: '📈', src: 'Fitbit' },
    { id: 'rhr', group: 'observe', name: 'Resting HR', unit: 'bpm', kind: 'num', max: 140, icon: '❤️', src: 'Fitbit' },
    { id: 'readiness', group: 'observe', name: 'Recovery', unit: '/100', kind: 'num', max: 100, icon: '🔋', src: 'Fitbit' },

    { id: 'cold', group: 'levers', name: 'Cold shower', kind: 'flag', max: 1, icon: '🧊' },
    { id: 'bath', group: 'levers', name: 'Bath', unit: 'min', kind: 'num', max: 180, icon: '🛁' },
    { id: 'sun', group: 'levers', name: 'Sun', unit: 'min', kind: 'num', max: 600, icon: '☀️' },
    { id: 'deep', group: 'levers', name: 'Deep work', unit: 'h', kind: 'num', max: 16, step: 0.5, icon: '🧠' },
  ],

  /* A session is a sport, its minutes and how hard it felt, 1 to 10. Up to
     four a day. The list only seeds the picker: any name typed once joins
     it, and a sport logged often enough earns its own row in the matrix. */
  sports: ['Run', 'Gym', 'Bike', 'Swim', 'Yoga', 'Hike', 'Football', 'Tennis', 'Climb'],
  session: { perDay: 4, minutes: 600, hard: 10, name: 24 },

  /* The four columns of the matrix. `better` says which direction is a win,
     so a cell is coloured by what it means, not by its sign. Each one is
     read the morning AFTER the factor, because a night is what answers a
     day. */
  outcomes: [
    { id: 'readiness',  name: 'Recovery',    better: 'high' },
    { id: 'rhr',        name: 'Resting HR',  better: 'low' },
    { id: 'hrv',        name: 'HRV',         better: 'high' },
    { id: 'sleepScore', name: 'Sleep score', better: 'high' },
  ],

  /* The fixed rows of the matrix. A flag splits on itself, `zero` splits
     did-it against did-not, and `median` splits at the field's own median
     across the logged days, so "high" always means high for me. */
  factors: [
    { id: 'sportMin',  name: 'Sport minutes', icon: '🏃', split: 'median', from: 'sessions' },
    { id: 'sportHard', name: 'Hard session',  icon: '🔥', split: 'median', from: 'sessions' },
    { id: 'coffee',    name: 'Coffee',        icon: '☕️', split: 'median' },
    { id: 'water',     name: 'Water',         icon: '💧', split: 'median' },
    { id: 'eaten',     name: 'Calories',      icon: '🍽️', split: 'median' },
    { id: 'steps',     name: 'Steps',         icon: '👟', split: 'median' },
    { id: 'cold',      name: 'Cold shower',   icon: '🧊', split: 'flag' },
    { id: 'bath',      name: 'Bath',          icon: '🛁', split: 'zero' },
    { id: 'sun',       name: 'Sun',           icon: '☀️', split: 'median' },
    { id: 'deep',      name: 'Deep work',     icon: '🧠', split: 'median' },
  ],
};

/* Every field by id, and the fields of one group in order. */
export const FIELDS = new Map(SPEC.fields.map(f => [f.id, f]));
export const inGroup = id => SPEC.fields.filter(f => f.group === id);

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

const clampNum = (raw, max, floor = 0) => {
  if (raw === '' || raw == null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(floor, Math.round(n * 100) / 100));
};

/* One session, or nothing: a sport with a name, and minutes and intensity
   inside their range. A session without a sport is half-typed, not data. */
function cleanSession(s) {
  if (!s || typeof s !== 'object') return undefined;
  const name = typeof s.s === 'string' ? s.s.trim().slice(0, SPEC.session.name) : '';
  if (!name) return undefined;
  const out = { s: name };
  const m = clampNum(s.m, SPEC.session.minutes);
  if (m !== undefined) out.m = m;
  const i = clampNum(s.i, SPEC.session.hard, 1);
  if (i !== undefined) out.i = i;
  return out;
}

/* Decided once for both sides: only days inside the challenge and not
   after today, only known fields, every number finite and inside range.
   Flags are booleans, sessions a short list, everything else a number. */
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
    for (const f of SPEC.fields) {
      const raw = day[f.id];
      if (f.kind === 'flag') { if (raw === true) entry[f.id] = true; continue; }
      const v = clampNum(raw, f.max);
      if (v !== undefined) entry[f.id] = v;
    }
    const sessions = (Array.isArray(day.sessions) ? day.sessions : [])
      .map(cleanSession).filter(Boolean).slice(0, SPEC.session.perDay);
    if (sessions.length) entry.sessions = sessions;
    const note = typeof day.note === 'string' ? day.note.trim().slice(0, 120) : '';
    if (note) entry.note = note;
    if (Object.keys(entry).length) log[key] = entry;
  }
  return { log };
}

/* What I put in against what the body reported: the two halves of a day,
   each decided once so the strip and the matrix agree on what is missing. */
const IN = new Set(['intake', 'levers']);
export const isLogged = day =>
  !!day && (SPEC.fields.some(f => IN.has(f.group) && day[f.id] != null) || !!day.sessions?.length);
export const hasBody = day =>
  !!day && SPEC.fields.some(f => !IN.has(f.group) && day[f.id] != null);

/* A goal is met by staying under a ceiling or reaching a floor. */
export const goalMet = (f, v) => v == null ? null : f.goalDir === 'max' ? v <= f.goal : v >= f.goal;

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

/* One factor's value on one day. Sessions are rolled up here, so the
   matrix can ask about total minutes, the hardest effort, or one sport,
   without any of that being a field on the form. */
export function valueOf(day, f) {
  if (!day) return undefined;
  if (f.from === 'sessions') {
    const ss = Array.isArray(day.sessions) ? day.sessions : [];
    if (f.sport) return ss.some(s => s.s === f.sport) ? 1 : 0;
    if (f.id === 'sportHard') return ss.length ? Math.max(...ss.map(s => s.i || 0)) : 0;
    return ss.reduce((a, s) => a + (s.m || 0), 0);
  }
  const v = day[f.id];
  if (v === true) return 1;
  if (v == null) return f.split === 'flag' ? 0 : undefined;
  return Number.isFinite(v) ? v : undefined;
}

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
  const pairs = [];
  for (const key of allDays()) {
    const d = log[key], next = log[shift(key, 1)];
    if (!d || !next) continue;
    const y = next[outcome.id];
    if (!Number.isFinite(y)) continue;
    const x = valueOf(d, factor);
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

/* Every sport typed so far with how many days it was done, most first. */
function sportCounts(log) {
  const seen = new Map();
  for (const d of Object.values(log || {})) {
    const names = new Set((Array.isArray(d?.sessions) ? d.sessions : []).map(s => s?.s).filter(Boolean));
    for (const n of names) seen.set(n, (seen.get(n) || 0) + 1);
  }
  return seen;
}

/* The picker: the seeds plus every sport I have typed, mine first. */
export function sportList(log) {
  const mine = [...sportCounts(log).entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  return [...new Set([...mine, ...SPEC.sports])];
}

/* The whole matrix, rows ordered by the loudest thing they say. A sport
   done on enough days joins the fixed rows as its own line. */
export function matrix(log) {
  const sports = [...sportCounts(log).entries()]
    .filter(([, c]) => c >= SPEC.minPerSide)
    .map(([name]) => ({ id: `sport:${name}`, name, icon: '🏅', split: 'flag', from: 'sessions', sport: name }));
  const rows = [...SPEC.factors, ...sports].map(f => {
    const cells = SPEC.outcomes.map(o => cell(log, f, o));
    const loudest = Math.max(0, ...cells.filter(Boolean).map(c => Math.abs(c.delta)));
    return { factor: f, cells, loudest };
  });
  rows.sort((a, b) => b.loudest - a.loudest);
  return rows;
}

/* Days with both halves on them: what the matrix actually runs on. */
export function readyDays(log) {
  return allDays().filter(k => isLogged(log[k]) && hasBody(log[k])).length;
}
