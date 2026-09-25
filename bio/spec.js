/* jeremylasne.com/bio: the one place the log's rules live.

   Imported by the page (bio/index.html) and by the server
   (overlap/convex/bio.ts), so the two agree on which fields exist, what a
   saved day may contain, and how a correlation is worked out. Plain
   JavaScript on purpose: the page has no build step. */

export const SPEC = {
  /* The challenge. 31 days; only these are shown in the month and read by
     the matrix. */
  start: '2026-10-01',
  end: '2026-10-31',
  /* Days before the start that can be filled in to learn the page. They
     are saved like any day and never counted. */
  practice: 14,

  /* Days with both halves logged before the grid shows, so it can be
     watched from day 2. Each cell still waits for its own days (minPerSide),
     and the luck check keeps early noise neutral. */
  minDays: 2,
  /* Days before the colours can be trusted as a whole. Until then the page
     says it is early, and most cells stay neutral anyway. */
  reliableAt: 21,
  /* Days needed on each side of a split before that one cell is read. */
  minPerSide: 3,
  /* The share of shown findings allowed to be luck: 1 in 10. */
  maxLuck: 0.1,
  /* A finding at least this far apart (Cohen's d, "large") is very good or
     very bad. */
  veryAt: 0.8,

  /* What a day is made of, in the order it is logged. */
  groups: [
    { id: 'intake',  name: 'Intake',    icon: '🍽️', when: 'Tap it as it happens' },
    { id: 'sport',   name: 'Sport',     icon: '🏃',  when: 'After the session' },
    { id: 'sleep',   name: 'Sleep',     icon: '😴',  when: 'Each morning, the night just ended' },
    { id: 'observe', name: 'Observing', icon: '📊',  when: 'Each morning, off the watch' },
    { id: 'levers',  name: 'Levers',    icon: '🌿',  when: 'Tonight, 10 seconds' },
  ],

  /* Every field on a day. `kind` drives the control: tap is a counter,
     flag is on/off, num is typed, time is a clock time kept as minutes after
     midnight. A counter with `spans` keeps a start and an end for each tap
     (each cup of coffee). `goal` is the daily target and `goalDir`
     says which way it points, so 2 cups of coffee is a ceiling while 4
     litres of water is a floor. `scale` turns the count into what the goal
     is spoken in: eight bottles of 50cl read as 4 L. `max` is the ceiling a
     save is clamped to. */
  fields: [
    { id: 'coffee', group: 'intake', name: 'Coffee', unit: 'cups', kind: 'tap', max: 12, icon: '☕️',
      goal: 2, goalDir: 'max', spans: 'cups' },
    { id: 'water', group: 'intake', name: 'Water', unit: '×50cl', kind: 'tap', max: 16, icon: '💧',
      goal: 8, goalDir: 'min', scale: 0.5, scaleUnit: 'L' },

    { id: 'steps', group: 'sport', name: 'Steps', unit: '', kind: 'num', max: 100000, icon: '👟', src: 'Fitbit' },

    { id: 'sleepScore', group: 'sleep', name: 'Sleep score', unit: '/100', kind: 'num', max: 100, icon: '💤', src: 'Fitbit' },
    { id: 'sleepMin', group: 'sleep', name: 'Sleep', unit: '', kind: 'num', max: 960, icon: '🛌', src: 'Fitbit', clock: true },
    { id: 'bed', group: 'sleep', name: 'Went to bed', unit: '', kind: 'time', max: 2159, icon: '🌙', src: 'Fitbit', night: true },
    { id: 'wake', group: 'sleep', name: 'Woke up', unit: '', kind: 'time', max: 1439, icon: '🌅', src: 'Fitbit' },

    { id: 'weight', group: 'observe', name: 'Weight', unit: 'kg', kind: 'num', max: 250, step: 0.1, icon: '⚖️', src: 'Scale' },
    { id: 'hrv', group: 'observe', name: 'HRV', unit: 'ms', kind: 'num', max: 300, icon: '📈', src: 'Fitbit' },
    { id: 'rhr', group: 'observe', name: 'Resting HR', unit: 'bpm', kind: 'num', max: 140, icon: '❤️', src: 'Fitbit' },
    { id: 'readiness', group: 'observe', name: 'Recovery', unit: '/100', kind: 'num', max: 100, icon: '🔋', src: 'Fitbit' },

    { id: 'sun', group: 'levers', name: 'Sun', unit: 'min', kind: 'num', max: 600, icon: '☀️' },
  ],

  /* Anything that takes time (a cup, a meal, a session) is a span: when it
     started and when it finished, minutes after midnight. A span may end
     after midnight; its end is then read as the next day.

     A session is a sport, its span, the calories it burned and how hard it
     was: light, moderate or high, kept as 1, 2, 3. Up to four a day. The
     sport list only seeds the picker: any name typed once joins it, and a
     sport logged often enough earns its own row in the matrix. */
  sports: ['Run', 'Gym', 'Bike', 'Swim', 'Yoga', 'Hike', 'Football', 'Tennis', 'Climb'],
  levels: ['Light', 'Moderate', 'High'],
  session: { perDay: 4, kcal: 5000, name: 24 },

  /* A meal is its span and the calories it held, from Yazio. The day's
     calories are the sum of its meals. */
  meal: { perDay: 8, kcal: 5000 },

  /* A cup still going after this time, in minutes after midnight, counts as
     a late one. */
  lateCoffee: 14 * 60,

  /* What the body reports. Each gets its own list of what moved it. Each
     is read the morning AFTER the factor, because a night is what answers a
     day. `better` says which direction is a win, so a finding is coloured
     by what it means, not by its sign. For weight lower is better: the goal
     is a leaner body, though a heavier morning after more water is water,
     not fat. `unit` and `digits` say how a difference is spoken: "-7 ms",
     "+0.4 kg". */
  outcomes: [
    { id: 'readiness',  name: 'Recovery',       icon: '🔋', unit: 'pts', better: 'high' },
    { id: 'sleepScore', name: 'Sleep score',    icon: '💤', unit: 'pts', better: 'high' },
    { id: 'sleepMin',   name: 'Sleep duration', icon: '🛌', unit: 'min', better: 'high' },
    { id: 'weight',     name: 'Weight',         icon: '⚖️', unit: 'kg',  better: 'low', digits: 1 },
    { id: 'hrv',        name: 'HRV',            icon: '📈', unit: 'ms',  better: 'high' },
    { id: 'rhr',        name: 'Resting HR',     icon: '❤️', unit: 'bpm', better: 'low' },
  ],

  /* Everything logged, each tested against every outcome. A flag splits on
     itself, `zero` splits did-it against did-not, and `median` splits at the
     field's own median across the logged days, so "more" always means more
     for me, and "later" later than my usual. `on` is how the factor reads in
     a sentence: "-16 pts after a harder session", and `fmt` how its median
     is spoken: "over 17:10", "over 45 min".

     Sport is read one dimension at a time. A training day is set against a
     rest day; everything else about a session (its sport, intensity,
     length, start, finish, calories) is set against my other sessions, so
     "a harder session" means harder than my usual session, not harder than
     resting.

     `lag` is the gap between the factor and what it is tested against. A
     day's doings (lag 1) are read against the night and morning after. The
     night itself and the morning's own numbers (bedtime, wake-up, hours
     slept, sleep score, weight, HRV, resting HR, recovery, all logged on the
     morning the night ended) are read against that same morning (lag 0).
     Every measure is a row and every outcome a column; a measure is never
     read against itself. `group` is the section the row sits under. */
  factors: [
    { group: 'intake', id: 'coffee',      name: 'Coffee',           icon: '☕️', split: 'median', on: 'more coffee', fmt: 'cups' },
    { group: 'intake', id: 'coffeeFirst', name: 'First coffee',     icon: '☕️', split: 'median', from: 'coffee', on: 'a later first coffee', fmt: 'clock' },
    { group: 'intake', id: 'coffeeLast',  name: 'Last coffee',      icon: '☕️', split: 'median', from: 'coffee', on: 'a later last coffee', fmt: 'clock' },
    { group: 'intake', id: 'coffeeLate',  name: 'Afternoon coffee', icon: '☕️', split: 'flag',   from: 'coffee', on: 'coffee after 14:00' },
    { group: 'intake', id: 'water',       name: 'Water',            icon: '💧', split: 'median', on: 'more water', fmt: '×50cl' },
    { group: 'intake', id: 'eaten',       name: 'Calories eaten',   icon: '🍽️', split: 'median', from: 'meals', on: 'more calories eaten', fmt: 'kcal' },
    { group: 'intake', id: 'mealFirst',   name: 'First meal',       icon: '🥐', split: 'median', from: 'meals', on: 'a later first meal', fmt: 'clock' },
    { group: 'intake', id: 'mealLast',    name: 'Last meal',        icon: '🍝', split: 'median', from: 'meals', on: 'a later last meal', fmt: 'clock' },
    { group: 'intake', id: 'mealWindow',  name: 'Eating window',    icon: '⏳', split: 'median', from: 'meals', on: 'a longer eating window', fmt: 'dur' },
    { group: 'intake', id: 'mealTime',    name: 'Time at the table', icon: '🍴', split: 'median', from: 'meals', on: 'more time spent eating', fmt: 'min' },
    { group: 'sport',  id: 'sportAny',    name: 'Training day',     icon: '🏃', split: 'flag',   from: 'sessions', on: 'a training day, against a rest day' },
    { group: 'sport',  id: 'sportHard',   name: 'Intensity',        icon: '🔥', split: 'median', from: 'sessions', on: 'a harder session', fmt: 'level' },
    { group: 'sport',  id: 'sportMin',    name: 'Session length',   icon: '⏱️', split: 'median', from: 'sessions', on: 'a longer session', fmt: 'min' },
    { group: 'sport',  id: 'sportStart',  name: 'Session start',    icon: '🕒', split: 'median', from: 'sessions', on: 'a later start', fmt: 'clock' },
    { group: 'sport',  id: 'sportEnd',    name: 'Session end',      icon: '🏁', split: 'median', from: 'sessions', on: 'a later finish', fmt: 'clock' },
    { group: 'sport',  id: 'sportKcal',   name: 'Sport calories',   icon: '⚡️', split: 'median', from: 'sessions', on: 'more calories burned', fmt: 'kcal' },
    { group: 'sport',  id: 'steps',       name: 'Steps',            icon: '👟', split: 'median', on: 'more steps', fmt: 'steps' },
    { group: 'sleep',  id: 'bed',         name: 'Bedtime',          icon: '🌙', split: 'median', lag: 0, on: 'a later bedtime', fmt: 'clock' },
    { group: 'sleep',  id: 'wake',        name: 'Wake-up',          icon: '🌅', split: 'median', lag: 0, on: 'a later wake-up', fmt: 'clock' },
    { group: 'sleep',  id: 'sleepMin',    name: 'Hours slept',      icon: '🛌', split: 'median', lag: 0, on: 'more sleep', fmt: 'dur' },
    { group: 'sleep',  id: 'sleepScore',  name: 'Sleep score',      icon: '💤', split: 'median', lag: 0, on: 'a higher sleep score', fmt: 'pts' },
    { group: 'observe', id: 'weight',     name: 'Weight',           icon: '⚖️', split: 'median', lag: 0, on: 'a heavier morning', fmt: 'kg' },
    { group: 'observe', id: 'hrv',        name: 'HRV',              icon: '📈', split: 'median', lag: 0, on: 'a higher HRV', fmt: 'ms' },
    { group: 'observe', id: 'rhr',        name: 'Resting HR',       icon: '❤️', split: 'median', lag: 0, on: 'a higher resting HR', fmt: 'bpm' },
    { group: 'observe', id: 'readiness',  name: 'Recovery',         icon: '🔋', split: 'median', lag: 0, on: 'a higher recovery', fmt: 'pts' },
    { group: 'levers', id: 'sun',         name: 'Sun',              icon: '☀️', split: 'median', on: 'more sun', fmt: 'min' },
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

/* The first day that may be filled in: the practice days before the start. */
export const firstDay = () => shift(SPEC.start, -SPEC.practice);
export const isPractice = key => key < SPEC.start;

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

/* A span's start and end, each kept when it is a clock time. */
function cleanSpan(x, out = {}) {
  for (const key of ['t', 'e']) {
    const v = clampNum(x?.[key], 1439);
    if (v !== undefined) out[key] = Math.round(v);
  }
  return out;
}

/* One session, or nothing: a sport with a name, its span, calories and
   intensity. A session without a sport is half-typed, not data. */
function cleanSession(s) {
  if (!s || typeof s !== 'object') return undefined;
  const name = typeof s.s === 'string' ? s.s.trim().slice(0, SPEC.session.name) : '';
  if (!name) return undefined;
  const out = cleanSpan(s, { s: name });
  const k = clampNum(s.k, SPEC.session.kcal);
  if (k !== undefined) out.k = Math.round(k);
  const i = clampNum(s.i, SPEC.levels.length, 1);
  if (i !== undefined) out.i = Math.round(i);
  return out;
}

/* One meal, or nothing: its span, its calories, or both. */
function cleanMeal(m) {
  if (!m || typeof m !== 'object') return undefined;
  const out = cleanSpan(m);
  const k = clampNum(m.k, SPEC.meal.kcal);
  if (k !== undefined) out.k = Math.round(k);
  return Object.keys(out).length ? out : undefined;
}

/* When a span ends, as minutes after the day's midnight: past 24:00 when
   it ran over midnight, the start when no end was logged. */
export const spanEnd = x => x?.e == null ? x?.t : x.t != null && x.e < x.t ? x.e + 1440 : x.e;
/* How long a span lasted, when both ends are known. */
export const spanMin = x => x?.t == null || x?.e == null ? undefined : (x.e - x.t + 1440) % 1440;

/* Decided once for both sides: only days from the first practice day to
   the end, and not after today; only known fields; every number finite and
   inside range. Flags are booleans, cups, meals and sessions short lists of
   spans, everything else a number. */
export function clean(input, today) {
  const log = {};
  const last = today < SPEC.end ? today : SPEC.end;
  const keys = Object.keys(input?.log ?? {})
    .filter(k => isKey(k) && k >= firstDay() && k <= last)
    .sort();
  for (const key of keys) {
    const day = input.log[key];
    if (!day || typeof day !== 'object') continue;
    const entry = {};
    for (const f of SPEC.fields) {
      const raw = day[f.id];
      if (f.kind === 'flag') { if (raw === true) entry[f.id] = true; continue; }
      if (f.spans) {
        /* the spans are the taps: one per cup, timed or not, and the count
           is how many there are */
        const list = Array.isArray(day[f.spans]) ? day[f.spans].slice(0, f.max).map(x => cleanSpan(x))
          : Array.from({ length: clampNum(raw, f.max) ?? 0 }, () => ({}));
        if (list.length || raw === 0) entry[f.id] = list.length;
        if (list.length) entry[f.spans] = list;
        continue;
      }
      const v = clampNum(raw, f.max);
      if (v !== undefined) entry[f.id] = f.kind === 'time' ? Math.round(v) : v;
    }
    const sessions = (Array.isArray(day.sessions) ? day.sessions : [])
      .map(cleanSession).filter(Boolean).slice(0, SPEC.session.perDay);
    if (sessions.length) entry.sessions = sessions;
    const meals = (Array.isArray(day.meals) ? day.meals : [])
      .map(cleanMeal).filter(Boolean).slice(0, SPEC.meal.perDay)
      .sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
    if (meals.length) entry.meals = meals;
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
  !!day && (SPEC.fields.some(f => IN.has(f.group) && day[f.id] != null) || !!day.sessions?.length || !!day.meals?.length);
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
  const has = xs => xs.length > 0;
  const sum = xs => has(xs) ? xs.reduce((a, b) => a + b, 0) : undefined;
  const nums = xs => xs.filter(Number.isFinite);
  if (f.from === 'sessions') {
    const ss = Array.isArray(day.sessions) ? day.sessions.filter(s => s?.s) : [];
    if (f.id === 'sportAny') return ss.length ? 1 : 0;
    /* everything else describes a session, so a rest day has no value, and
       a detail I did not log is unknown, not zero */
    if (!ss.length) return undefined;
    if (f.sport) return ss.some(s => s.s === f.sport) ? 1 : 0;
    if (f.id === 'sportMin') return sum(nums(ss.map(spanMin)));
    if (f.id === 'sportKcal') return sum(nums(ss.map(s => s.k)));
    if (f.id === 'sportHard') { const xs = nums(ss.map(s => s.i)); return has(xs) ? Math.max(...xs) : undefined; }
    if (f.id === 'sportStart') { const xs = nums(ss.map(s => s.t)); return has(xs) ? Math.max(...xs) : undefined; }
    if (f.id === 'sportEnd') { const xs = nums(ss.map(spanEnd)); return has(xs) ? Math.max(...xs) : undefined; }
    return undefined;
  }
  if (f.from === 'meals') {
    const ms = Array.isArray(day.meals) ? day.meals : [];
    const starts = nums(ms.map(m => m.t)), ends = nums(ms.map(spanEnd));
    if (f.id === 'eaten') return sum(nums(ms.map(m => m.k)));
    if (f.id === 'mealFirst') return has(starts) ? Math.min(...starts) : undefined;
    if (f.id === 'mealLast') return has(ends) ? Math.max(...ends) : undefined;
    if (f.id === 'mealWindow') return has(starts) && has(ends) ? Math.max(0, Math.max(...ends) - Math.min(...starts)) : undefined;
    if (f.id === 'mealTime') return sum(nums(ms.map(spanMin)));
    return undefined;
  }
  if (f.from === 'coffee') {
    const cups = Array.isArray(day.cups) ? day.cups : [];
    const starts = nums(cups.map(c => c.t)), ends = nums(cups.map(spanEnd));
    if (f.id === 'coffeeLate') return ends.some(t => t >= SPEC.lateCoffee) ? 1 : has(ends) || !(day.coffee ?? 0) ? 0 : undefined;
    if (f.id === 'coffeeFirst') return has(starts) ? Math.min(...starts) : undefined;
    return has(ends) ? Math.max(...ends) : undefined;
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

/* One link: the factor on day D against the outcome the morning after.
   Returns null while either side is too thin to read. `diff` is the move in
   the outcome's own unit, `delta` the same move as a percent of the
   baseline, `d` how far apart the two groups sit. */
/* The days that can be compared for one factor and one outcome: the factor
   on a day, the outcome `lag` days later, both logged. */
export function pairsOf(log, factor, outcome) {
  const lag = factor.lag ?? 1;
  const pairs = [];
  for (const key of allDays()) {
    const d = log[key], next = log[shift(key, lag)];
    if (!d || !next) continue;
    const y = next[outcome.id];
    if (!Number.isFinite(y)) continue;
    const x = valueOf(d, factor);
    if (!Number.isFinite(x)) continue;
    pairs.push({ x, y });
  }
  return pairs;
}
/* How many comparable days a cell needs before it is read. */
export const needPairs = () => SPEC.minPerSide * 2;

export function cell(log, factor, outcome) {
  if (factor.id === outcome.id) return null;
  const pairs = pairsOf(log, factor, outcome);
  if (pairs.length < needPairs()) return null;

  let on, off, cut = null;
  if (factor.split === 'median') {
    cut = median(pairs.map(p => p.x));
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
  const diff = mean(on) - base;
  const delta = diff / base * 100;
  const good = outcome.better === 'high' ? diff > 0 : diff < 0;
  return { diff, delta, d: s.d, label: s.label, good, base, cut, p: welchP(on, off), n: on.length + off.length, nOn: on.length };
}

/* Two-sided p-value of Welch's t-test: how often a gap this size would turn
   up between two groups drawn from the same days. The t distribution is
   read through the regularised incomplete beta function. */
export function welchP(a, b) {
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length, se = Math.sqrt(va + vb);
  const gap = Math.abs(mean(a) - mean(b));
  if (!se) return gap ? 0 : 1;
  const t = gap / se;
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return ibeta(df / (df + t * t), df / 2, 0.5);
}
function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b + lgamma(a + b) - lgamma(a) - lgamma(b));
  return x < (a + 1) / (a + b + 2) ? front * betacf(x, a, b) / a : 1 - front * betacf(1 - x, b, a) / b;
}
function betacf(x, a, b) {
  const tiny = 1e-30, fix = v => Math.abs(v) < tiny ? tiny : v;
  let c = 1, d = 1 / fix(1 - (a + b) * x / (a + 1)), h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 / fix(1 + aa * d); c = fix(1 + aa / c); h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 / fix(1 + aa * d); c = fix(1 + aa / c);
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function lgamma(z) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z, tmp = z + 5.5, ser = 1.000000000190015;
  tmp -= (z + 0.5) * Math.log(tmp);
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / z);
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

/* Every factor worth testing: the fixed ones, plus each sport done on
   enough days to stand as its own line. */
export function factorsFor(log) {
  const sports = [...sportCounts(log).entries()]
    .filter(([, c]) => c >= SPEC.minPerSide)
    .map(([name]) => ({ group: 'sport', id: `sport:${name}`, name, icon: '🏅', split: 'flag', from: 'sessions', sport: name, on: `${name.toLowerCase()}, against my other sports` }));
  return [...SPEC.factors, ...sports];
}

/* Every factor against every outcome, at once. Testing a hundred links
   over 31 days guarantees some look real by luck, and the more that is
   tracked the more of them there are. So each link gets a q-value
   (Benjamini-Hochberg over all the links tested together): the share of
   findings at that level expected to be luck. A finding needs
   q <= SPEC.maxLuck, however many factors are tracked.

   Returns one row per measure with a link per outcome (null when the days
   are too few, or the measure is the outcome itself), and how many links
   were tested. */
export function analyze(log) {
  const all = [];
  for (const outcome of SPEC.outcomes)
    for (const factor of factorsFor(log)) {
      const link = cell(log, factor, outcome);
      if (link) all.push({ outcome, factor, link });
    }
  const byP = [...all].sort((a, b) => a.link.p - b.link.p);
  let q = 1;
  for (let i = byP.length - 1; i >= 0; i--) {
    q = Math.min(q, byP[i].link.p * byP.length / (i + 1));
    byP[i].link.q = q;
  }
  const rows = factorsFor(log).map(factor => ({
    factor,
    cells: SPEC.outcomes.map(o => all.find(x => x.factor === factor && x.outcome === o)?.link ?? null),
    /* comparable days so far, for the cells still waiting */
    counts: SPEC.outcomes.map(o => factor.id === o.id ? 0 : pairsOf(log, factor, o).length),
  }));
  return { rows, tested: all.length };
}

/* The outcome's own average over the month, as a reference for a move. */
export function average(log, outcome) {
  const xs = allDays().map(k => log[k]?.[outcome.id]).filter(Number.isFinite);
  return xs.length ? mean(xs) : null;
}

/* A finding survives the false-discovery check and is at least a medium
   gap. */
export const isFinding = link => link.q <= SPEC.maxLuck && link.d >= 0.3;

/* The impact of one link on the five-step scale, very bad to very good
   with neutral in the middle. Anything that is not a finding is neutral. A
   finding is good or bad by what the outcome counts as better, and "very"
   once the gap is large (d >= SPEC.veryAt, Cohen's large). */
export function impact(link) {
  if (!link) return null;
  if (!isFinding(link)) return { level: 'neutral', very: false, lean: leanOf(link) };
  return { level: link.good ? 'good' : 'bad', very: link.d >= SPEC.veryAt };
}

/* Which way a neutral link is heading before it is clear of luck. A lean
   needs a medium gap that would pass on its own (p < 0.05); it has not
   passed the check across all links, so it is shown faint and never as a
   verdict. On simulated months with no real effect about 7 cells of 150
   lean by chance, so a lean is a thing to watch, not a finding. */
const leanOf = link => link.p < 0.05 && link.d >= 0.3 ? (link.good ? 'good' : 'bad') : null;

/* Days with both halves on them: what the matrix actually runs on. */
export function readyDays(log) {
  return allDays().filter(k => isLogged(log[k]) && hasBody(log[k])).length;
}
