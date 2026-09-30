/* jeremylasne.com/bio/demo: a made-up October, so the page can be seen full.

   Only the demo loads this. It writes the same shape of day the real log
   does, with a handful of effects planted so the grids have something to
   find: early morning sun and an early bedtime help the night, a late
   coffee and a late dinner hurt it, a hard or late session costs the next
   morning, calories move the scale. Creatine and collagen do nothing here,
   so they show what a neutral row looks like. Seeded, so every visit sees
   the same month. */

import { SPEC, allDays, shift } from '/bio/spec.js';

export function demoMonth(seed = 20261001) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const noise = (sd = 1) => (rnd() + rnd() + rnd() - 1.5) * 1.15 * sd;
  const pick = xs => xs[Math.floor(rnd() * xs.length)];
  const span = (t, len) => ({ t: Math.round(t), e: Math.round(t + len) % 1440 });
  const days = allDays(), log = {};

  /* what I did each day */
  for (const k of days) {
    const wake = 390 + Math.floor(rnd() * 105);                 // 06:30–08:15
    const d = { wake, water: 3 + Math.floor(rnd() * 7), steps: 5000 + Math.floor(rnd() * 10000) };
    if (rnd() < .75) d.sunlight = [span(wake + 10 + rnd() * 70, 5 + rnd() * 25)];
    const cups = [span(wake + 20 + rnd() * 40, 10 + rnd() * 15)];
    for (let c = 1; c < 1 + Math.floor(rnd() * 3); c++) cups.push(span(600 + rnd() * 390, 10 + rnd() * 15));
    d.cups = cups.sort((a, b) => a.t - b.t);
    d.coffee = d.cups.length;
    const meals = [];
    if (rnd() < .8) meals.push({ ...span(450 + rnd() * 90, 15 + rnd() * 15), k: 400 + Math.floor(rnd() * 250) });
    meals.push({ ...span(720 + rnd() * 120, 30 + rnd() * 30), k: 600 + Math.floor(rnd() * 350) });
    meals.push({ ...span(1140 + rnd() * 195, 30 + rnd() * 40), k: 550 + Math.floor(rnd() * 500) });
    d.meals = meals;
    if (rnd() < .8) { d.creatine = true; d.creatineAt = meals[0].t; }
    if (rnd() < .65) { d.collagen = true; d.collagenAt = meals[0].t + 5; }
    if (rnd() < .68) {
      const i = 1 + Math.floor(rnd() * 3), len = 45 + rnd() * 50;
      d.sessions = [{ s: pick(['Padel', 'Gym', 'Run']), ...span(420 + rnd() * 780, len), k: Math.round(len * (5 + i * 2.5)), i }];
    }
    d.bed = 1335 + Math.floor(rnd() * 150);                     // 22:15–00:45, for the night into this morning
    log[k] = d;
  }

  /* what the body said the morning after */
  for (const k of days) {
    const me = log[k], y = log[shift(k, -1)] || {};
    const lateCup = (y.cups || []).some(c => (c.e < c.t ? c.e + 1440 : c.e) >= 840) ? 1 : 0;
    /* more morning sun helps, and earlier helps more */
    const sun = (y.sunlight || [])[0];
    const sunBonus = sun ? Math.min(25, (sun.e - sun.t + 1440) % 1440) / 25 * 6 + (sun.t < 480 ? 6 : 0) : 0;
    const ses = (y.sessions || [])[0];
    const hard = ses ? (ses.i === 3 ? 1 : ses.i === 2 ? .3 : 0) : 0;
    const lateSes = ses && (ses.e < ses.t ? ses.e + 1440 : ses.e) >= 1170 ? 1 : 0;
    const lastMeal = Math.max(...(y.meals || [{ e: 1230 }]).map(m => m.e < m.t ? m.e + 1440 : m.e));
    const lateMeal = lastMeal >= 1290 ? 1 : 0;
    const kcal = y.meals ? y.meals.reduce((a, m) => a + m.k, 0) : 2000;

    me.sleepMin = Math.round(Math.max(300, me.wake + 1440 - me.bed - 20 - lateCup * 25 + noise(12)));
    me.sleepScore = Math.round(Math.min(98, 80 + noise(3) + sunBonus - lateCup * 5 - lateMeal * 3 - (me.bed - 1380) / 22));
    me.hrv = Math.round(62 + noise(3) - lateMeal * 7 - lateSes * 9);
    me.rhr = Math.round(53 + noise(1) + lateSes * 3 + hard * 1.5);
    me.readiness = Math.round(Math.min(99, 68 + noise(4) - hard * 10 + (me.sleepMin - 420) / 6));
    me.weight = Math.round((79 + noise(.15) + (kcal - 2000) / 400 * .25) * 10) / 10;
    if (me.sunlight) me.sun = Math.round(((me.sunlight[0].e - me.sunlight[0].t) + 1440) % 1440);
  }
  return log;
}

/* The demo reads as the evening of the last day. */
export const demoToday = () => SPEC.end;
