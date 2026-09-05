/* jeremylasne.com/bio — the one place the content and the unlock rule live.

   Imported by the page (bio/index.html) and by the server
   (overlap/convex/bio.ts), so the two can never disagree about which
   habit unlocks on which day or what a saved number may look like. Plain
   JavaScript on purpose: the page has no build step. */

export const SPEC = {
  /* Day 1 of the ramp. A local calendar date, daily resolution. */
  start: '2026-09-05',
  rampDays: 15,

  /* One flagship exercise per discipline, one number each. */
  exercises: [
    {
      id: 'squat', discipline: 'Strength', name: 'Back Squat', protocol: '5 reps',
      unit: 'kg', step: 2.5, max: 500, fallback: 100,
      note: 'The lift that tells the truth about the whole body. Five reps, not one: strength you can repeat.',
    },
    {
      id: 'zone2', discipline: 'Cardio', name: 'Zone 2', protocol: 'steady',
      unit: 'min', step: 5, max: 600, fallback: 45,
      note: 'Conversational pace, held. The engine everything else runs on.',
    },
    {
      id: 'sprint', discipline: 'Sprint', name: '30 / 10 Intervals', protocol: '30s on · 10s off',
      unit: 'rounds', step: 1, max: 100, fallback: 8,
      note: 'Rounds finished at full effort before form breaks. The top end, and the will to keep it.',
    },
  ],

  /* Logged from day one and never gated: it is data, not a habit. */
  sleep: {
    id: 'sleep', name: 'Sleep', protocol: 'last night',
    unit: 'h', step: 0.25, max: 24, fallback: 7.5,
    note: 'Logged from day one, never gated. Data, not a habit.',
  },

  /* The ramp. A habit is dimmed and disabled until its day comes. */
  habits: [
    { id: 'light', unlockDay: 1, name: 'Morning light & water',
      why: 'Ten minutes of daylight and a big glass of water before anything else. Sets the clock, ends the night’s dehydration.' },
    { id: 'walk', unlockDay: 6, name: 'Walk after eating',
      why: 'Ten to fifteen minutes after the meal. Flattens the glucose spike, keeps the afternoon awake.' },
    { id: 'collagen', unlockDay: 11, name: 'Collagen',
      why: 'Tendons and joints give out before muscle does. Feed them.' },
    { id: 'vitc', unlockDay: 11, name: 'Vitamin C',
      why: 'Taken with the collagen. The cofactor the body needs to build with it.' },
    { id: 'coffee', unlockDay: 11, name: 'Caffeine, coffee only',
      why: 'Coffee and nothing else. Ninety minutes after waking, none after noon.' },
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

/* Which day of the ramp a date is: 1 on the start date, never lower.
   Whole-day arithmetic on the calendar parts, so DST cannot shift it. */
export function dayOf(key = dateKey()) {
  return Math.max(1, Math.floor((utcOf(key) - utcOf(SPEC.start)) / 86400000) + 1);
}

export const unlocked = (habit, day) => day >= habit.unlockDay;
export const fullRhythm = day => day > SPEC.rampDays;

/* What a save may contain, decided once for both sides: every number
   finite and inside its range, only known habits, and a locked habit is
   off no matter what the page sent. */
export function clean(input, day) {
  const num = (x, m) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(m.max, Math.max(0, Math.round(n * 100) / 100)) : m.fallback;
  };
  const values = {}, habits = {};
  for (const e of SPEC.exercises) values[e.id] = num(input?.values?.[e.id], e);
  for (const h of SPEC.habits) habits[h.id] = unlocked(h, day) && input?.habits?.[h.id] === true;
  return { values, habits, sleep: num(input?.sleep, SPEC.sleep) };
}
