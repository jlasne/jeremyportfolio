/* The score: SET IN MOTION, 128 BPM, F minor, 8 bars, 15.000 s.
   Storyboard section 5. Every principal hit is on the grid (R.at); ornaments are
   32nd/64th/128th offsets inside a gesture that starts on a 16th.
   The mix is rendered in two offline passes (bars 1-4, then bars 5-8) so the
   tape stop (5.3) is a true stop: nothing from before 7.5 leaks past the drop.
   Each pass starts with a short silent pre-roll so the bus compressor is at rest
   when its first hit arrives (it starts at full gain reduction). */
(() => {
  'use strict';
  const A = window.ReelAudio, R = window.Reel;
  const at = R.at, B = R.BEAT, S16 = B / 4, S32 = B / 8, S64 = B / 16, S128 = B / 32;

  // chord voicings (5.1)
  const CH = {
    Fm9: ['F3', 'Ab3', 'C4', 'Eb4', 'G4'],
    Dbmaj9: ['Db3', 'F3', 'Ab3', 'C4', 'Eb4'],
    Ebsus4: ['Eb3', 'Ab3', 'Bb3', 'Eb4'],
    Eb: ['Eb3', 'G3', 'Bb3', 'Eb4'],
    Fmadd9: ['F3', 'G3', 'Ab3', 'C4', 'F4'],
  };

  // ---- the mix: per-instrument trims on top of the cue-sheet gains (5.2 gains are starting points) ----
  // drive into the bus compressor (engine default .9). Kept low so only the principal hits reach the limiter, and
  // the final hit, driven hardest, is the one that sets the reel's peak
  const MASTER = .3;
  // extra drive: the 5.1 downbeat, bar 5 after it, the 4.3 lock explosion, the final hit
  // (5.1 outranks 4.3, as in the picture's flash order: .30 against .25; 8.1 stays the biggest)
  const DROP_IN = 1.2, DROP = 1.25, LOCK = 1.0, FINAL = 3.4;
  const PEAK = -1.0;                                  // dBTP: the finished buffer is trimmed to this true peak
  const PRE = 0.25;                                   // s of silent pre-roll per pass (compressor settles)
  const SPLIT = 7.5;                                  // bars 5-8 are rendered from here
  const TRIM = {
    kick: 1, snare: 1.8, clap: 2.2, hat: 3.6, bass: .8, sub: .3, stab: 7.5, pad: 4.5, pluck: 2.2, bell: 1.3,
    blip: 1.2, tick: 1.1, riser: 1, whoosh: 1.2, impact: .42, reverse: 1, glitch: 1.3, knock: 1,
  };
  // where each instrument takes its options object, and its default gain
  const SIG = {
    kick: [1, 1], snare: [1, .7], clap: [1, .7], hat: [1, .22], bass: [3, .5], sub: [3, .5], stab: [3, .22],
    pad: [3, .12], pluck: [2, .2], bell: [2, .18], blip: [2, .12], tick: [1, .15], riser: [2, .22],
    whoosh: [2, .35], impact: [1, .8], reverse: [2, .3], glitch: [2, .14], knock: [1, .3],
  };
  // arguments that are times, per instrument (everything else takes its time as argument 0)
  const TIMES = { riser: [0, 1], filterRamp: [0, 1] };
  const TIMED = [...Object.keys(SIG), 'shaker', 'tapeStop', 'filter', 'filterRamp', 'musicGain', 'masterGain', 'pump'];

  // phase lock: a sine swept exponentially from f0 to f1 over T ends (T[(f0-f1)/ln(f0/f1) - f1]) cycles
  // ahead of a steady f1 sine started at the same time. Nudge f0 so that is a whole number: the swept voice
  // (kick body, impact boom) then lands IN phase with the sub on the same root instead of cancelling it.
  const lockFrom = (f0, f1, T) => {
    const g = f => T * ((f - f1) / Math.log(f / f1) - f1), n = Math.max(1, Math.round(g(f0)));
    let lo = f1 * 1.001, hi = f0 * 4;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (g(mid) < n) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };

  // shift: seconds added to every scheduled time (the pass's pre-roll, minus where the pass starts)
  const mixer = (S, shift) => {
    const T = Object.create(S);
    for (const k of TIMED) {
      const f = S[k], ix = TIMES[k] || [0];
      T[k] = (...a) => { for (const i of ix) a[i] += shift; return f(...a); };
    }
    const M = Object.create(T);
    let hatN = 0;
    for (const k in SIG) {
      const [ix, g0] = SIG[k], f = T[k], tr = TRIM[k];
      M[k] = (...a) => {
        const o = { ...(a[ix] || {}) };
        o.gain = (o.gain ?? g0) * tr;
        if (k === 'riser') o.noiseGain = (o.noiseGain ?? .3) * tr;
        if (k === 'hat' && !o.open) {                // a little longer and wider than the stock tick
          if (o.pan === undefined) o.pan = hatN++ % 2 ? .14 : -.14;   // alternate hit by hit
          o.decay = o.decay ?? .075; o.hp = o.hp ?? 6500;
        }
        if (k === 'kick') {
          o.decay = (o.decay ?? .42) * .8;           // tighter tails: punch, not boom
          o.tone = o.tone ?? S.hz('F1');             // unspecified kicks are tuned to the root
          o.punch = lockFrom(o.punch ?? 170, o.tone, .07);
          // the knock: the kick's 150-400 Hz body, so the hits still punch on laptop and phone speakers
          if ((o.click ?? .35) > 0) M.knock(a[0], { gain: .34 * o.gain, freq: 185, decay: .05 + .06 * (o.gain - .8) });
        }
        if (k === 'bell') o.duck = o.duck ?? false;  // the dot sings above the pump
        if (k === 'impact') {
          o.to = o.to ?? S.hz('F1');                 // the boom settles on the root, not 32 Hz
          o.from = lockFrom(110, o.to, .5 * (o.size ?? 1));
          o.drive = o.drive ?? 4;
        }
        if (k === 'stab' || k === 'pad') o.spread = o.spread ?? (k === 'stab' ? .35 : .55);
        a[ix] = o;
        return f(...a);
      };
    }
    M.bass = (t, n, d, o = {}) => T.bass(t, n, d, { sub: .25, subRatio: 1, ...o, gain: (o.gain ?? .5) * TRIM.bass });
    S.masterGain(0, MASTER);                         // unshifted: the level from sample 0 of the pass
    S.pumpAttack = .002;                             // soft-knee sidechain: no click on sustained subs
    return M;
  };

  // "Crash" (5.2), darkening as it decays like a real cymbal
  const crashOf = S => (t, dur, o = {}) => S.whoosh(t, dur, { from: 9500, to: 5000, peak: .015, pan: [-.3, .3], rev: .45, end: 3500, ...o });

  // ---------------------------------------------------------------- bars 1-4
  function pre(S) {
    // named voices from the cue sheet
    const crash = crashOf(S);
    const woodblock = (t, n) => S.bell(t, n, { dur: .16, ratio: 2.0, index: 1.1, gain: .22, rev: .12 });
    const thump = t => S.kick(t, { gain: .4, punch: 95, tone: 42, decay: .22, click: 0, pump: 0 });
    const plock = (t, n) => { S.bell(t, n, { dur: .4, ratio: 4, index: 1.3, gain: .2, rev: .25 }); S.pluck(t, n, { type: 'triangle', dur: .12, gain: .08, duck: false }); };

    // ---- bar 1 · count-in ----
    S.blip(0, 'C7', { dur: .066, drop: 1, gain: .07 });
    woodblock(0, 'F5'); thump(0);
    const vd = [12, 138, 162, 288, 312, 438, 462, 588, 612, 738, 762, 888];
    vd.forEach((d, n) => {
      S.tick(n * S64, { freq: 3200, gain: .035, pan: -d / 960 });
      S.tick(n * S64, { freq: 3200, gain: .035, pan: d / 960 });
    });
    for (let n = 0; n < 16; n++) S.hat(n * S16, { gain: .015 + .003 * n, pan: n % 2 ? .2 : -.2 });   // under the count, so '1 2 3 .' reads on a phone
    woodblock(at(1, 2), 'Ab5'); thump(at(1, 2));
    const hd = [12, 148, 172, 308, 332, 468];
    hd.forEach((d, n) => {
      S.tick(at(1, 2) + n * S64, { freq: 2600, gain: .03, pan: -d / 1400 });
      S.tick(at(1, 2) + n * S64, { freq: 2600, gain: .03, pan: d / 1400 });
    });
    S.riser(at(1, 2), at(2, 1), { gain: .12, from: 200, to: 1800, noiseGain: .22, rev: .2 });
    woodblock(at(1, 3), 'C6'); thump(at(1, 3));
    S.blip(at(1, 3, 2), 'C6', { drop: 2.5, dur: .8, gain: .06 });   // glide .32 s: whistles over the whole visible fall
    S.bell(at(1, 4), 'Eb6', { dur: 1.0, ratio: 3.5, index: 2.5, gain: .16, rev: .5 }); thump(at(1, 4));
    S.whoosh(at(1, 4, 3), .234, { gain: .16, from: 400, to: 3200, pan: [-.5, .5], peak: .7 });
    S.blip(at(1, 4, 3), 'F5', { drop: .5, dur: .12, gain: .08 });
    S.reverse(at(2, 1), .9375, { gain: .26 });

    // ---- bar 2 · type ----
    // the slam; tone F1 (spec 46 Hz, a semitone sharp of the F1 sub and boom it sits on)
    const slam = t => {
      S.kick(t, { gain: 1.15, punch: 185, tone: S.hz('F1'), decay: .5, click: .45, pump: .6, drive: 4 });
      S.impact(t, { gain: .75, size: .9, rev: .5 });
      S.clap(t, { gain: .6, rev: .3 });
      S.snare(t, { gain: .45, tone: 300, decay: .12, rev: .2 });
      S.stab(t, CH.Fm9, .18, { gain: .28, cutoff: 900, bright: 6000 });
    };
    slam(at(2, 1));
    S.sub(at(2, 1), 'F1', 1.7, { gain: .5 });
    S.pluck(at(2, 1, 3), 'Eb5', { type: 'triangle', dur: .1, gain: .1, del: .2 });
    S.kick(at(2, 2), { gain: .85 });
    // the split: two independent noises, so top-right and bottom-left really move apart
    S.whoosh(at(2, 2), .35, { gain: .22, from: 300, to: 4000, pan: [0, .9] });
    S.whoosh(at(2, 2), .35, { gain: .22, from: 300, to: 4000, pan: [0, -.9], seed: 83 });
    for (let k = 2; k <= 4; k++) S.tick(at(2, 2, k), { freq: 5200, gain: .03 });
    S.reverse(at(2, 3), S16, { gain: .14 });
    S.kick(at(2, 3), { gain: .9 }); S.clap(at(2, 3), { gain: .5 });
    S.blip(at(2, 3), 'A5', { drop: .25, dur: .45, gain: .3 });   // rubber gliss: the stretch's only voice
    S.tick(at(2, 3, 3), { freq: 6000, gain: .05 });
    S.tick(at(2, 3, 3) + S128, { freq: 6000, gain: .04 });
    S.pluck(at(2, 3, 3), 'C5', { type: 'triangle', gain: .09 });   // the dot lands on the N at 2.3&
    S.kick(at(2, 4), { gain: .9 });
    const fall = { type: 'square', dur: .09, cutoff: 2400, del: .15 };
    [['F4', .6], ['Eb4', .2], ['C4', .1]].forEach(([n, pan]) => S.pluck(at(2, 4) + S64, n, { ...fall, gain: .07, pan }));
    S.pluck(at(2, 4) + 2 * S64, 'Ab3', { ...fall, gain: .1, pan: -.2 });
    S.pluck(at(2, 4) + 5 * S64, 'F3', { ...fall, gain: .1, pan: -.6 });
    S.blip(at(2, 4, 2), 'C6', { drop: 2.2, dur: .12, gain: .07 });
    S.bell(at(2, 4, 3), 'F5', { dur: .35, ratio: 3.5, index: 2, gain: .12 });
    S.riser(at(2, 4, 3), at(3, 1), { gain: .22, from: 250, to: 3500, noiseGain: .3 });
    for (let b = 1; b <= 4; b++) {
      S.hat(at(2, b, 3), { gain: .12, open: true });
      S.hat(at(2, b, 2), { gain: .05 }); S.hat(at(2, b, 4), { gain: .05 });
    }

    // ---- bar 3 · timing ----
    for (let b = 1; b <= 4; b++) S.kick(at(3, b), { gain: .95, pump: .45 });
    S.clap(at(3, 2), { gain: .4 }); S.clap(at(3, 4), { gain: .4 });
    S.pad(at(3, 1), CH.Fm9, 1.4, { gain: .06, attack: .25, cutoff: 1800 });
    const bass3 = [[at(3, 1), 'F1', .35], [at(3, 1, 4), 'F1', .1], [at(3, 2, 3), 'Ab1', .2], [at(3, 3), 'C2', .35], [at(3, 4), 'Bb1', .2], [at(3, 4, 3), 'Ab1', .2]];
    for (const [t, n, d] of bass3) S.bass(t, n, d, { gain: .34, cutoff: 600, env: 1600 });
    [[at(3, 1, 3), 'F4'], [at(3, 2), 'Ab4'], [at(3, 2, 3), 'C5'], [at(3, 3), 'Eb5']].forEach(([t, n]) => {
      plock(t, n); S.tick(t, { freq: 8000, gain: .02 });
    });
    S.whoosh(at(3, 2, 3), .234, { gain: .3, from: 600, to: 4500, pan: [-.4, .6], peak: .6 });
    S.blip(at(3, 3), 'C5', { drop: .5, dur: .25, gain: .06 });
    S.bell(at(3, 4), 'F6', { dur: 1.3, ratio: 2.76, index: 1.6, gain: .14, rev: .65 });
    for (let k = 0; k < 12; k++) {                   // 16ths up to 3.4 (the reading hold is dry)
      const t = at(3, 1) + k * S16;
      if (k === 6) continue;                         // 3.2&: the whip-hop whoosh owns this 16th
      if (k % 4 === 2) S.hat(t, { gain: .12, open: true }); else S.hat(t, { gain: .05 });
    }
    S.blip(at(3, 4, 3) + S64, 'C6', { drop: .5, dur: .1, gain: .07 });   // take-off at s2's T_FLY (the Ab1 marks the sink)
    S.blip(at(3, 4, 4), 'F6', { drop: .25, dur: .11, gain: .08 });
    S.whoosh(at(3, 4, 4), S16, { gain: .12, from: 2000, to: 9000, pan: [-.8, .8] });
    S.reverse(at(4, 1), .469, { gain: .1 });   // resolves UP into 4.1, not down

    // ---- bar 4 · depth, particles, tape stop ----
    S.kick(at(4, 1), { gain: 1.0 }); S.impact(at(4, 1), { gain: .35, size: .5, to: S.hz('Db1') });
    S.pad(at(4, 1), CH.Dbmaj9, .9, { gain: .1, attack: .06, cutoff: 3200, rev: .5 });
    // 5.1's bar-4 bass line, Db1 · F1 · Eb1 (the cue sheet had no F1): Db1 on 4.1, F1 on 4.2, Eb1 on 4.3
    S.sub(at(4, 1), 'Db1', .42, { gain: .45 });
    S.sub(at(4, 2), 'F1', .42, { gain: .45 });
    for (let n = 0; n < 8; n++) S.tick(at(4, 1) + n * S64, { freq: 2200, gain: .05 });
    const arp = ['Db4', 'F4', 'Ab4', 'C5', 'Eb5', 'C5', 'Ab4', 'F4'];
    for (let k = 0; k < 8; k++) {
      if (k >= 2 && k <= 4) continue;               // the ratchet locks take over the arp's square voice here
      S.pluck(at(4, 1) + k * S16, arp[k], { type: 'square', dur: .1, cutoff: 2200, gain: .06, del: .3 });
    }
    ['C5', 'Eb5', 'F5', 'G5', 'Ab5', 'C6'].forEach((n, i) => {
      const t = at(4, 1, 3) + i * S32;
      const last = i === 5;                          // M completes 128 BPM: accented over the 4.2 clap tail
      S.tick(t, { freq: 1800, gain: last ? .45 : .22 });
      S.pluck(t, n, { type: 'square', dur: .07, cutoff: 3000, gain: last ? .3 : .14, pan: -.6 + 1.2 * i / 5 });
    });
    S.kick(at(4, 2), { gain: .95 }); S.clap(at(4, 2), { gain: .4 });
    S.whoosh(at(4, 2), .469, { gain: .15, from: 300, to: 2600, pan: [-.8, .8] });
    for (let k = 0; k < 8; k++) S.hat(at(4, 1) + k * S16, { gain: .05 });
    // 4.3: the lock explodes. A 32nd of air before it, its own drive push, and the metallic slam layer
    const t43 = at(4, 3);
    S.masterGain(t43 - S32, MASTER); S.masterGain(t43 - S32, MASTER * .8, .02);
    S.masterGain(t43 - .002, MASTER * .8); S.masterGain(t43 - .002, MASTER * LOCK, .002);
    S.masterGain(6.9, MASTER * LOCK); S.masterGain(6.9, MASTER, 7.02 - 6.9);
    S.kick(t43, { gain: 1.2, punch: 185, decay: .5, click: .45, pump: .6, drive: 4 });
    S.impact(t43, { gain: 1.1, size: 1, to: S.hz('Eb1') }); S.snare(t43, { gain: .5 });
    S.clap(t43, { gain: .6, rev: .35 });
    crash(t43, 1.2, { gain: .5 });
    S.stab(t43, CH.Ebsus4, .3, { gain: .26, bright: 7000 });
    S.sub(t43, 'Eb1', .5);
    { const r = R.rng(33), notes = ['F6', 'Ab6', 'Bb6', 'C7', 'Eb7'];
      for (let i = 0; i < 24; i++) S.blip(6.57 + r() * .43, notes[Math.floor(r() * 5)], { dur: .05, gain: .025, pan: r() * 2 - 1 }); }
    S.stab(at(4, 3, 3), CH.Ebsus4, .12, { gain: .12 });
    const t44 = at(4, 4);
    S.kick(t44, { gain: .9 }); S.clap(t44, { gain: .4 });
    S.bass(t44, 'Eb1', .4); S.stab(t44, CH.Eb, .2);
    for (let t = t43 + S16; t < 7.3; t += S16) S.hat(t, { gain: .07 });   // 16ths after the explosion
  }

  // ---------------------------------------------------------------- bars 5-8
  function post(S) {
    const crash = crashOf(S);

    // ---- bar 5 · the drop ----
    const t51 = at(5, 1);
    // the drop is the loudest bar of the reel: more music, and more drive into the bus compressor
    S.musicGain(t51, 1.3); S.musicGain(at(6, 1), 1);
    // the downbeat hits out of dead silence (the biggest contrast in the reel); the bar's drive then swells in
    // behind it, so bar 5 is the loudest bar while 8.1 stays the biggest single hit
    S.masterGain(t51, MASTER * DROP_IN); S.masterGain(t51 + S16, MASTER * DROP, at(5, 2) - t51 - S16);
    S.masterGain(at(6, 1) - .012, MASTER * DROP); S.masterGain(at(6, 1) - .012, MASTER, .012);
    S.kick(t51, { gain: 1.15, punch: 195, decay: .55, click: .5, pump: .65, drive: 4 });
    S.impact(t51, { gain: .85, size: 1.25, rev: .5 });
    crash(t51, 1.4);
    S.clap(t51, { gain: .7 });
    S.stab(t51, CH.Fm9, .3, { gain: .26, bright: 7000 });
    S.sub(t51, 'F1', .45, { gain: .5 });
    S.glitch(t51, .0586, { step: .0037, gain: .09, seed: 5 });
    // a wide Fm9 wash under the stabs, pumped by the kick: the drop breathes on the grid
    S.pad(t51, CH.Fm9, 1.8, { gain: .08, attack: .02, release: .15, cutoff: 2600, rev: .3 });
    for (let b = 2; b <= 4; b++) { S.kick(at(5, b), { gain: 1.0 }); S.sub(at(5, b), 'F1', .4, { gain: .45 }); }
    S.clap(at(5, 2), { gain: .7 }); S.clap(at(5, 4), { gain: .7 });
    for (let k = 0; k < 16; k++) {
      const t = t51 + k * S16;
      if (k === 14) continue;                        // 5.4&: the spin tick owns this 16th
      if (k % 4 === 2) S.hat(t, { gain: .16, open: true }); else S.hat(t, { gain: .1 });
    }
    // the pump: opened up (cutoff 500 -> 900) so the line has harmonics a small speaker can play
    const pump = [['F1', 'F1', 'F1'], ['F1', 'F1', 'Ab1'], ['F1', 'F1', 'F1'], ['C2', 'Bb1', 'Ab1']];
    pump.forEach((ns, b) => ns.forEach((n, j) => S.bass(at(5, b + 1, j + 2), n, .09, { gain: .36, cutoff: 900, env: 2600 })));
    for (let b = 1; b <= 3; b++) S.stab(at(5, b, 3), CH.Fm9, .14, { gain: b === 3 ? .12 : .24 });   // 5.3&: under the ring pops
    for (let n = 1; n <= 15; n++) S.tick(t51 + B * (-Math.log2(1 - n / 16) / 10), { freq: 4200, gain: .03 - .015 * (n - 1) / 14 });
    S.riser(at(5, 3), at(5, 3) + 3 * S32, { gain: .15, from: 400, to: 3200, noiseGain: .08 });   // the zip: 8.4375 -> 8.6133
    const rings = ['C6', 'Eb6', 'F6', 'Ab6'];
    for (let c = 0; c < 12; c++) S.pluck(at(5, 3, 2) + c * S128, rings[c % 4], { type: 'triangle', dur: .06, gain: .1, pan: -.6 + 1.2 * c / 11 });
    S.blip(at(5, 4), 'F6', { drop: .5, dur: .3, gain: .09 });
    S.whoosh(at(5, 4), .352, { gain: .16, from: 500, to: 3500, pan: [.7, -.7] });
    S.tick(at(5, 4, 3), { freq: 1800, gain: .25 });
    S.whoosh(at(5, 4, 4), S16, { gain: .2, from: 800, to: 7000, peak: .95 });
    S.reverse(at(6, 1), .234, { gain: .14 });

    // ---- bar 6 · interface ----
    const t61 = at(6, 1);
    S.kick(t61, { gain: .9 });
    S.pad(t61, CH.Dbmaj9, 1.3, { gain: .05, attack: .03, cutoff: 3000 });   // bar 6 bed pulled back: the UI foley carries s5
    S.sub(t61, 'Db1', .9);
    { // typing (s5): words start on 16ths, visible characters every 128th
      const words = ['Make', 'me', 'a', 'showreel.'];
      let ci = 0;
      words.forEach((w, wi) => {
        for (let i = 0; i < w.length; i++, ci++) S.tick(t61 + wi * S16 + i * S128, { freq: 3600, gain: .05, pan: -.4 + .5 * ci / 15 });
      });
    }
    S.pluck(at(6, 1, 3), 'F4', { type: 'sine', dur: .08, gain: .16 });
    S.tick(at(6, 1, 3), { freq: 900, gain: .08, pan: .5 });
    const t62 = at(6, 2);
    S.tick(t62, { freq: 3000, gain: .3, pan: .5 });
    S.tick(t62 + S128, { freq: 1300, gain: .25, pan: .5 });
    ['F5', 'Ab5', 'C6'].forEach((n, i) => S.blip(t62 + i * S64, n, { drop: .8, dur: .05, gain: .18, pan: .5 }));
    S.bass(t62, 'F2', .1, { cutoff: 700, env: 300, gain: .4 });   // the haptic buzz: the switch's weight
    S.tick(at(6, 2, 3) - S32, { freq: 1500, gain: .12, pan: .5 });
    S.whoosh(at(6, 2, 3), .234, { gain: .29, from: 500, to: 5000, pan: [.8, .5] });
    S.blip(at(6, 2, 3), 'C6', { drop: .4, dur: .06, gain: .2 });
    const t63 = at(6, 3);
    S.kick(t63, { gain: .8 });
    S.blip(t63, 'F5', { drop: .5, dur: .06, gain: .12, pan: -.5 });
    S.pad(t63, CH.Eb, .9, { gain: .04 });
    S.sub(t63, 'Eb1', .45, { gain: .4 });
    ['Ab5', 'C6', 'Eb6'].forEach((n, i) => S.pluck(at(6, 3, i + 2), n, { type: 'triangle', dur: .09, gain: .1, pan: -.4 }));
    S.reverse(at(6, 4), S16, { gain: .2 });
    S.blip(at(6, 3, 4), 'A4', { drop: 2, dur: .11, gain: .08 });
    const t64 = at(6, 4);
    S.kick(t64, { gain: .8 });
    S.blip(t64, 'C5', { drop: 2.4, dur: .09, gain: .15, pan: -.4 });
    S.blip(t64 + S32, 'C6', { drop: .4, dur: .05, gain: .2, pan: -.4 });
    // whip down: peaks while the band is still up where noise has energy, and settles low instead of sweeping back up
    S.whoosh(at(6, 4, 2), .2, { gain: .4, from: 6000, to: 900, end: 500, peak: .4, pan: [0, 0] });
    S.filterRamp(at(6, 4, 2), at(6, 4, 3), 18000, 700);
    for (let k = 0; k < 8; k++) S.hat(t61 + k * B / 2, { gain: .036 });

    // ---- bar 7 · liquid -> end card ----
    const t71 = at(7, 1);
    S.kick(t71, { gain: .7, click: 0, tone: 44 });
    S.sub(t71, 'Eb1', 1.0, { gain: .45 });
    S.pad(t71, CH.Ebsus4, .95, { gain: .09, cutoff: 1400 });
    const splash = (t, n, g, pan) => {
      S.blip(t, n, { drop: 2.5, dur: .1, gain: g });
      S.whoosh(t, .35, { gain: g === .2 ? .16 : .14, from: 1400, to: 300, peak: .25, pan });
    };
    splash(t71, 'F4', .2, [-.6, -.2]);
    splash(at(7, 1, 3), 'Ab4', .17, [-.3, .1]);
    S.kick(at(7, 2), { gain: .7, click: 0, tone: 44 });
    splash(at(7, 2), 'C5', .17, [.1, .5]);
    { const r = R.rng(71);
      for (let i = 0; i < 6; i++) S.blip(11.3 + r() * .6, r() < .5 ? 'A6' : 'C7', { gain: .02, dur: .05, pan: r() * 1.2 - .6 }); }
    S.reverse(at(7, 2, 3), S16, { gain: .12 });
    S.blip(at(7, 2, 3), 'F5', { drop: .35, dur: .29, gain: .28, pan: .7 });   // glide .116 s: rises with the jet to the pinch
    const t72a = at(7, 2, 4);
    S.pluck(t72a, 'C6', { type: 'triangle', dur: .08, gain: .1, pan: .8 });
    S.whoosh(t72a, S16, { gain: .22, from: 400, to: 7500, peak: .95, pan: [.6, .8] });
    S.filterRamp(t72a, at(7, 3), 700, 18000);
    // 7.3: CLAUDE slam, the 2.1 slam re-voiced (kick tone F1, as on 2.1)
    const t73 = at(7, 3);
    S.kick(t73, { gain: 1.15, punch: 185, tone: S.hz('F1'), decay: .5, click: .45, pump: .6, drive: 4 });
    S.impact(t73, { gain: .7, size: .9, rev: .5 });
    S.clap(t73, { gain: .6, rev: .3 });
    S.snare(t73, { gain: .45, tone: 300, decay: .12, rev: .2 });
    S.stab(t73, CH.Fm9, .2, { gain: .24, cutoff: 900, bright: 6000 });
    S.sub(t73, 'F1', .9, { gain: .5 });
    S.bell(at(7, 3, 3), 'C6', { dur: .9, ratio: 3, index: 1.5, gain: .07, rev: .6 });
    S.kick(at(7, 4), { gain: .85 });
    S.pluck(at(7, 4), 'F5', { type: 'sine', dur: .2, gain: .06 });
    // the build is cut dead on 7.4a: one 16th of air (the dot drops) before the biggest hit
    S.riser(at(7, 4), at(7, 4, 4), { gain: .13, from: 300, to: 2000, noiseGain: .18 });
    S.reverse(at(8, 1), .469, { gain: .3 });
    for (let k = 0; k < 7; k++) S.hat(t73 + k * S16, { gain: .04 + .08 * k / 6 });
    S.blip(at(7, 4, 3), 'C5', { drop: .5, dur: .2, gain: .06 });
    S.blip(at(7, 4, 4), 'C6', { drop: 3, dur: .117, gain: .08 });
    S.musicGain(at(7, 4, 4), 1); S.musicGain(at(7, 4, 4), .5, .03); S.musicGain(at(8, 1) - .003, 1);

    // ---- bar 8 · final ----
    const t81 = at(8, 1);
    S.masterGain(t81 - .003, MASTER); S.masterGain(t81 - .003, MASTER * FINAL, .003);   // the biggest single hit
    S.kick(t81, { gain: 1.3, punch: 190, decay: .7, click: .5, pump: 0, drive: 4 });
    S.knock(t81, { gain: .3, freq: 150, decay: .12 });
    S.impact(t81, { gain: 1.3, size: 1.6, rev: .7 });
    crash(t81, 2.2, { gain: .42, from: 9500, to: 4000, peak: .01 });
    S.clap(t81, { gain: .85 });
    S.snare(t81, { gain: .4, tone: 300, decay: .14, rev: .3 });
    S.stab(t81, CH.Fmadd9, .8, { gain: .3, cutoff: 1300, bright: 7000, rev: .6 });
    S.pad(t81, CH.Fmadd9, 1.5, { gain: .08, attack: .02, release: 1.0 });
    S.bell(t81, 'F6', { dur: 2.6, ratio: 2.76, index: 1.6, gain: .14, rev: .7 });
    // sub cut to .45 s (spec 1.4): held under the boom's sweep it passes through anti-phase at ~13.78 and
    // leaves a hole; the boom (tuned to F1) carries the root into the fade instead
    S.sub(t81, 'F1', .45, { gain: .5 });
    // after the hit the drive eases back so the tails sit under the drop bar
    // eased in dB, not in gain (a linear gain ramp is steepest in dB at its end and collapsed the F6 bell's tail):
    // x3.4 -> x.8 at a constant ~0.6 dB per 50 ms, in 11 short linear pieces, ending 14.459 (before the 8.4 anchor)
    { const t0 = at(8, 1, 3), D = 1.1, N = 11;
      S.masterGain(t0, MASTER * FINAL);
      for (let i = 1; i <= N; i++) S.masterGain(t0, MASTER * FINAL * Math.pow(.8 / FINAL, i / N), D * i / N); }
    S.tick(at(8, 3), { freq: 2600, gain: .065 });   // blink gains even out the drive easing and the fade
    S.tick(at(8, 3, 3), { freq: 2600, gain: .06 });
    S.tick(at(8, 4), { freq: 2600, gain: .1 });
    S.whoosh(at(8, 4), .44, { gain: .05, from: 2500, to: 500 });
    S.tick(at(8, 4, 3), { freq: 2600, gain: .15 });   // rides over the fade (master x.48 by here)
    S.masterGain(at(8, 4), MASTER * .8);
    S.masterGain(at(8, 4), 0, 0.45);                       // true silence from 14.98125
  }

  // part: 'pre' (bars 1-4), 'post' (bars 5-8) or both (a direct call: no pre-roll, no split)
  A.score = S0 => {
    const p = A._part;
    const S = mixer(S0, p === 'pre' ? PRE : p === 'post' ? PRE - SPLIT : 0);
    if (p !== 'post') pre(S);
    if (p !== 'pre') post(S);
  };

  // an impulse through a copy of the studio's compressor + limiter: returns their combined delay in samples
  const probeLatency = async () => {
    try {
      const n = 4800, c = new OfflineAudioContext(1, n, A.SR), b = c.createBuffer(1, n, A.SR);
      b.getChannelData(0)[0] = .5;
      const src = c.createBufferSource(); src.buffer = b;
      const comp = c.createDynamicsCompressor(), lim = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .12;
      lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .05;
      src.connect(comp); comp.connect(lim); lim.connect(c.destination); src.start(0);
      const d = (await c.startRendering()).getChannelData(0);
      for (let i = 0; i < n; i++) if (Math.abs(d[i]) > 1e-6) return i;
    } catch (e) {}
    return 576;                                      // Chromium's 2 x 6 ms
  };

  // true peak: sample peak, refined between samples (4x, windowed sinc) around every sample near it
  const truePeak = chans => {
    let pk = 0;
    for (const d of chans) for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    const H = 8, fr = [.25, .5, .75], W = fr.map(f => {
      const w = [];
      for (let k = -H + 1; k <= H; k++) { const x = k - f, s = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); w.push(s * (.5 + .5 * Math.cos(Math.PI * x / H))); }
      return w;
    });
    let tp = pk;
    for (const d of chans) for (let i = H; i < d.length - H; i++) {
      if (Math.abs(d[i]) < pk * .6) continue;
      for (const w of W) { let s = 0; for (let k = 0; k < 2 * H; k++) s += w[k] * d[i - H + 1 + k]; if (Math.abs(s) > tp) tp = Math.abs(s); }
    }
    return tp;
  };

  // ---- 5.3 the tape stop, after the offline render ----
  const baseRender = A.render;
  A.render = async () => {
    const SR = A.SR, N = Math.round(R.DUR * SR), T0 = 7.03125, D = 0.3515625, T1 = T0 + D, T2 = SPLIT, TICK = 7.44140625;
    // both passes schedule synchronously, then render in parallel (each offline context has its own thread).
    // Each renders only what it needs: bars 1-4 up to where the tape stop has consumed its source (7.21 s),
    // bars 5-8 from 7.5; both after PRE s of silence.
    A._part = 'pre';
    const pa = baseRender(PRE + 7.3);
    A._part = 'post';
    const pb = baseRender(PRE + (R.DUR - SPLIT) + .05);
    A._part = null;
    const latency = probeLatency();
    const [a, b] = await Promise.all([pa, pb]);
    // latency: the bus compressor and the limiter each look ahead (6 ms each in Chromium), so a pass is late
    // by a fixed amount. Measured with an impulse through the same pair (runs alongside the passes).
    const lat = await latency;
    A.latency = lat / SR;
    const oa = lat + Math.round(PRE * SR), ob = lat + Math.round((PRE - SPLIT) * SR);   // pass index = reel index + o
    const buf = new AudioBuffer({ length: N, numberOfChannels: 2, sampleRate: SR });
    const i0 = Math.floor(T0 * SR), i2 = Math.floor(T2 * SR);
    for (let c = 0; c < 2; c++) {
      const s = a.getChannelData(c), p = b.getChannelData(c), d = buf.getChannelData(c);
      d.set(s.subarray(oa, oa + i0), 0);                  // bars 1-4 untouched up to the stop
      for (let i = i0; i < i2; i++) {
        const t = i / SR;
        if (t < T1) {
          const u = (t - T0) / D, f = oa + i0 + D * (u - u * u / 2) * SR;   // source position: rate falls 1 -> 0
          const k = Math.floor(f), fr = f - k;
          d[i] = (s[k] * (1 - fr) + s[k + 1] * fr) * (1 - u ** 4);
        } else d[i] = 0;                                  // dead silence to 7.5
      }
      d.set(p.subarray(i2 + ob, N + ob), i2);             // bars 5-8
      const j0 = Math.round(TICK * SR);                   // the pickup blink tick
      for (let j = 0; j < SR * 0.02; j++) d[j0 + j] += 0.28 * Math.sin(2 * Math.PI * 1000 * j / SR) * Math.exp(-j / (SR * 0.005));
    }
    // final trim to a fixed true peak, so the level does not depend on the limiter's overshoot and the
    // AAC export has headroom for intersample overs
    const chans = [buf.getChannelData(0), buf.getChannelData(1)];
    const tp = truePeak(chans), k = tp > 0 ? Math.pow(10, PEAK / 20) / tp : 1;
    for (const d of chans) for (let i = 0; i < N; i++) d[i] *= k;
    A.buffer = buf;
    return buf;
  };
})();
