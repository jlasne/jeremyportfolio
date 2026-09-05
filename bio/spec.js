/* jeremylasne.com/bio: the one place the content and the log rules live.

   Imported by the page (bio/index.html) and by the server
   (overlap/convex/bio.ts), so the two agree on which days exist, which
   habits exist and what a saved number may look like. Plain JavaScript on
   purpose: the page has no build step. */

export const SPEC = {
  /* Day 1 of the log. A local calendar date, daily resolution. */
  start: '2026-09-05',
  days: 15,

  /* One flagship test per discipline, one number each. */
  exercises: [
    {
      id: 'pullup', discipline: 'Strength', name: 'Pull-up', protocol: 'strict, one set',
      unit: 'reps', step: 1, max: 100, fallback: 10,
      note: 'Dead hang to chin over the bar, one set to failure. Reps per kilo of bodyweight is the strength number.',
    },
    {
      id: 'swim', discipline: 'Cardio', name: 'Swim', protocol: '30 minutes',
      unit: 'm', step: 25, max: 5000, fallback: 1200,
      note: 'Meters covered in 30 minutes at one even pace. Water loads the heart with zero impact on the joints.',
    },
    {
      id: 'sprint', discipline: 'Sprint', name: '100 m', protocol: 'standing start',
      unit: 's', step: 0.1, max: 60, fallback: 14,
      note: 'One timed run on the track. The shortest test of top speed and power.',
    },
  ],

  /* Hours slept, logged per day next to the habits. */
  sleep: { unit: 'h', step: 0.25, max: 24 },

  /* The five habits. All five are open from day 1; the log is the ramp. */
  habits: [
    { id: 'light', short: 'Light', name: 'Morning light & water',
      why: '10 minutes of daylight and 500 ml of water within 30 minutes of waking. Sets the body clock and replaces the water lost over 7 hours of sleep.' },
    { id: 'walk', short: 'Walk', name: 'Walk after eating',
      why: '10 to 15 minutes after each meal. Lowers the glucose spike, so the afternoon stays awake.' },
    { id: 'collagen', short: 'Collagen', name: 'Collagen',
      why: '10 g a day for tendons and joints, the parts that fail first under load.' },
    { id: 'vitc', short: 'Vit C', name: 'Vitamin C',
      why: 'Taken with the collagen. The body needs it to turn collagen into tissue.' },
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

/* Which day of the log a date is: 1 on the start date, 0 the day before.
   Whole-day arithmetic on the calendar parts, so DST cannot shift it. */
export const dayOf = key => Math.floor((utcOf(key) - utcOf(SPEC.start)) / 86400000) + 1;

/* The date of day n of the log, as a key. */
export const keyOfDay = n => new Date(utcOf(SPEC.start) + (n - 1) * 86400000).toISOString().slice(0, 10);

/* What a save may contain, decided once for both sides: every number
   finite and inside its range, only the days of the log up to today, only
   known habits, sleep kept only when a number was given. */
export function clean(input, today) {
  const num = (x, m) => {
    if (x === '' || x == null) return undefined;
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(m.max, Math.max(0, Math.round(n * 100) / 100)) : undefined;
  };
  const values = {}, log = {};
  for (const e of SPEC.exercises) values[e.id] = num(input?.values?.[e.id], e) ?? e.fallback;
  for (let n = 1; n <= SPEC.days; n++) {
    const key = keyOfDay(n), day = input?.log?.[key];
    if (key > today || !day || typeof day !== 'object') continue;
    const habits = {};
    for (const h of SPEC.habits) habits[h.id] = day.habits?.[h.id] === true;
    const sleep = num(day.sleep, SPEC.sleep);
    log[key] = sleep === undefined ? { habits } : { habits, sleep };
  }
  return { values, log };
}
