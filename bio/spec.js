/* jeremylasne.com/bio: the one place the content and the log rules live.

   Imported by the page (bio/index.html) and by the server
   (overlap/convex/bio.ts), so the two agree on which habits and tests
   exist and what a saved day may look like. Plain JavaScript on purpose:
   the page has no build step. */

export const SPEC = {
  /* One test per discipline, one test a day at most. The card shows the
     best result so far, or the target as a placeholder until the first
     session. */
  exercises: [
    {
      id: 'pullup', discipline: 'Strength', name: 'Weighted pull-up', short: 'Pull-up', protocol: '1 rep max',
      unit: 'kg', step: 2.5, max: 200, best: 'max', target: 20,
    },
    {
      id: 'swim', discipline: 'Cardio', name: 'Swim', short: 'Swim', protocol: '30 minutes',
      unit: 'm', step: 25, max: 5000, best: 'max', target: 1200,
    },
    {
      id: 'sprint', discipline: 'Sprint', name: '100 m', short: '100 m', protocol: 'standing start',
      unit: 's', step: 0.1, max: 60, best: 'min', target: 14,
    },
  ],

  /* Hours slept, logged per day next to the habits. */
  sleep: { unit: 'h', step: 0.25, max: 24 },

  /* The five habits, one check each per day. */
  habits: [
    { id: 'light', short: 'Light', name: 'Morning light & water',
      why: '10 minutes of daylight and 500 ml of water within 30 minutes of waking. Sets the body clock and replaces the water lost over 7 hours of sleep.' },
    { id: 'walk', short: 'Walk', name: 'Walk after eating',
      why: '10 to 15 minutes after each meal. Lowers the glucose spike, so the afternoon stays awake.' },
    { id: 'collagen', short: 'Collagen', name: 'Collagen & vitamin C',
      why: '10 g of collagen with vitamin C, taken together. Vitamin C is what turns the collagen into tendon and joint tissue.' },
    { id: 'coffee', short: 'Coffee', name: 'Caffeine, coffee only',
      why: 'Coffee only, 90 minutes after waking, last cup before noon.' },
  ],
};

/* Local calendar date as YYYY-MM-DD. */
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const utcOf = key => { const m = KEY.exec(key); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
export const isKey = key => typeof key === 'string' && !Number.isNaN(utcOf(key));

/* The key n days after another one (negative n for earlier), and the
   whole days from one key to another. UTC arithmetic on the calendar
   parts, so DST cannot shift a day. */
export const shift = (key, n) => new Date(utcOf(key) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (from, to) => Math.round((utcOf(to) - utcOf(from)) / 86400000);

/* What a save may contain, decided once for both sides: only days up to
   today, only known habits, every number finite and inside its range,
   sleep and the training result kept only when given, the session note
   trimmed to 80 characters. */
export function clean(input, today) {
  const num = (x, m) => {
    if (x === '' || x == null) return undefined;
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(m.max, Math.max(0, Math.round(n * 100) / 100)) : undefined;
  };
  const log = {};
  const keys = Object.keys(input?.log ?? {}).filter(k => isKey(k) && k <= today).sort().slice(-3650);
  for (const key of keys) {
    const day = input.log[key];
    if (!day || typeof day !== 'object') continue;
    const habits = {}, train = {};
    for (const h of SPEC.habits) habits[h.id] = day.habits?.[h.id] === true;
    /* one test a day: the first valid result wins */
    for (const e of SPEC.exercises) { const v = num(day.train?.[e.id], e); if (v !== undefined) { train[e.id] = v; break; } }
    const entry = { habits };
    const sleep = num(day.sleep, SPEC.sleep);
    if (sleep !== undefined) entry.sleep = sleep;
    if (Object.keys(train).length) entry.train = train;
    const note = typeof day.note === 'string' ? day.note.trim().slice(0, 80) : '';
    if (note) entry.note = note;
    log[key] = entry;
  }
  return { log };
}

/* The headline number of a discipline: the best result in the log, and
   how many sessions it came from. Zero sessions means the target. */
export function bestOf(e, log) {
  let best, sessions = 0;
  for (const key in log) {
    const v = log[key]?.train?.[e.id];
    if (!Number.isFinite(v)) continue;
    sessions++;
    best = best === undefined || (e.best === 'min' ? v < best : v > best) ? v : best;
  }
  return { value: sessions ? best : e.target, sessions };
}

/* Every result of one test, oldest first, for the curve. */
export const series = (e, log) =>
  Object.keys(log).sort().map(key => ({ key, v: log[key]?.train?.[e.id] })).filter(p => Number.isFinite(p.v));
