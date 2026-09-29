/* The score: MATCH CUT, 128 BPM, A minor lifting to C major, 8 bars, 15.000 s.
   Storyboard section 5. Every principal hit is on the grid (R.at); ornaments are
   32nd/64th/128th offsets inside a gesture that starts on a 16th.
   One offline pass with a short silent pre-roll (the bus compressor is at rest at the first hit), cropped
   to the reel by the measured compressor+limiter latency, so the drop's 7-frame hole is exact on the
   cropped buffer (5.4), then trimmed to a fixed true peak. */
(() => {
  'use strict';
  const A = window.ReelAudio, R = window.Reel;
  const at = R.at, B = R.BEAT, S16 = B / 4, S32 = B / 8, S64 = B / 16, S128 = B / 32;

  // ---- constants of the mix ----
  const MASTER = .4;                                  // engine master level the mixer sets; the hits ride on top of it
  const PEAK = -.7;                                   // dBTP of the finished buffer
  const PRE = .25;                                    // s of silent pre-roll (compressor at rest at the first hit)
  const HOLE = [at(3, 4, 4), at(4, 1)];               // 5.5078125 .. 5.625, the one digital silence
  const PREGAIN = 1.9;                                // drive into the mastering limiter (pre-map)
  const KNOCK = 0;                                    // 0: no knock layer under the kick (5.1); raise for small speakers

  // ---- chords (5.1): the A minor pentatonic is also the C major pentatonic ----
  const CH = {
    Am9: ['A3', 'C4', 'E4', 'G4', 'B4'],
    Fmaj9: ['F3', 'A3', 'C4', 'E4', 'G4'],
    Cmaj9: ['C4', 'E4', 'G4', 'B4', 'D5'],
    Dm9: ['D3', 'F3', 'A3', 'C4', 'E4'],
    G69: ['G3', 'B3', 'D4', 'E4', 'A4'],
    C69: ['C4', 'E4', 'G4', 'A4', 'D5'],
  };
  // the fundamental of the sounding chord root (kick, impact and sub share it, phase-locked)
  const rootAt = t => t < at(3, 1) ? 'A1' : t < at(4, 1) ? 'F1' : t < at(5, 1) ? 'C2' : t < at(5, 3) ? 'A1'
    : t < at(6, 1) ? 'F1' : t < at(6, 3) ? 'D2' : t < at(7, 3) ? 'G1' : 'C2';

  // ---- the re-cast principal hits (5.2): ONE object, so the voices of every hit change in one place ----
  const HIT = {
    kick: { punch: 215, decay: .34, click: .62, pump: .45, drive: 2.8 },
    snare: { tone: 430, decay: .085, rev: .2 },
    clap: { rev: .55 },
    stab: { cutoff: 3000, bright: 10000 },
    impact: { size: .6 },
    crash: { from: 12000, to: 7000, end: 6000, peak: .008, rev: .45 },
  };

  // ---- the mixer: per-instrument trims on top of the cue-sheet gains (the sheet's gains are starting points) ----
  const TRIM = {
    kick: .9, snare: 2.0, clap: 2.4, hat: 3.2, bass: .9, sub: .15, stab: 8, pad: 8, pluck: 3, bell: 1.5,
    blip: 1.4, tick: 1.8, riser: 1.7, whoosh: 2.2, impact: .3, reverse: 1.4, glitch: 1.3, knock: 1, swell: 1,
  };
  // where each instrument takes its options object, and its default gain
  const SIG = {
    kick: [1, 1], snare: [1, .7], clap: [1, .7], hat: [1, .22], bass: [3, .5], sub: [3, .5], stab: [3, .22],
    pad: [3, .12], pluck: [2, .2], bell: [2, .18], blip: [2, .12], tick: [1, .15], riser: [2, .22],
    whoosh: [2, .35], impact: [1, .8], reverse: [2, .3], glitch: [2, .14], knock: [1, .3], swell: [3, .3],
  };
  // arguments that are times, per instrument (everything else takes its time as argument 0)
  const TIMES = { riser: [0, 1], filterRamp: [0, 1] };
  const TIMED = [...Object.keys(SIG), 'shaker', 'filter', 'filterRamp', 'musicGain', 'masterGain', 'pump'];

  // phase lock: a sine swept exponentially from f0 to f1 over T ends (T[(f0-f1)/ln(f0/f1) - f1]) cycles
  // ahead of a steady f1 sine started at the same time. Nudge f0 so that is a whole number: the swept voice
  // (kick body, impact boom) then lands IN phase with the sub on the same root instead of cancelling it.
  const lockFrom = (f0, f1, T) => {
    const g = f => T * ((f - f1) / Math.log(f / f1) - f1), n = Math.max(1, Math.round(g(f0)));
    let lo = f1 * 1.001, hi = f0 * 4;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (g(mid) < n) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };

  // shift: seconds added to every scheduled time (the pre-roll). solo: debug, a list of instrument names to keep
  const mixer = (S, shift, solo, part) => {
    // the two passes are split at the drop's hole: a cue belongs to 'pre' if it starts before the hole, to 'post' if it starts after it
    const keep = t => part === 'pre' ? t < HOLE[1] - 1e-6 : part === 'post' ? t >= HOLE[1] - 1e-6 : true;
    const T = Object.create(S);
    for (const k of TIMED) {
      const f = S[k], ix = TIMES[k] || [0];
      T[k] = (...a) => { if (!keep(a[0])) return; if (A._cues) A._cues.push([k, a[0]]); for (const i of ix) a[i] += shift; return f(...a); };
    }
    const M = Object.create(T);
    let hatN = 0;
    for (const k in SIG) {
      const [ix, g0] = SIG[k], f = T[k], tr = TRIM[k];
      M[k] = (...a) => {
        if (solo && solo.indexOf(k) < 0) return;
        const o = { ...(a[ix] || {}) };
        o.gain = (o.gain ?? g0) * tr;
        if (k === 'riser') o.noiseGain = (o.noiseGain ?? .3) * tr;
        if (k === 'hat' && !o.open) {                // a little longer and wider than the stock tick
          if (o.pan === undefined) o.pan = hatN++ % 2 ? .2 : -.2;
          o.decay = o.decay ?? .06; o.hp = o.hp ?? 5200;
        }
        if (k === 'kick') {
          o.tone = o.tone ?? S.hz('A1');
          o.punch = lockFrom(o.punch ?? 170, o.tone, .07);
          if (KNOCK && (o.click ?? .35) > 0) M.knock(a[0], { gain: KNOCK * o.gain, freq: 185, decay: .05 + .06 * (o.gain - .8) });
        }
        if (k === 'impact') {
          o.to = o.to ?? S.hz('A1');                 // the boom settles on the root, not 32 Hz
          o.from = lockFrom(110, o.to, .5 * (o.size ?? 1));
          o.drive = o.drive ?? 4;
        }
        if (k === 'stab' || k === 'pad') o.spread = o.spread ?? (k === 'stab' ? .35 : .55);
        a[ix] = o;
        return f(...a);
      };
    }
    // the bass: a sine on the fundamental under the saw pair, so the note is heard on a phone too
    M.bass = (t, n, d, o = {}) => { if (solo && solo.indexOf('bass') < 0) return; return T.bass(t, n, d, { sub: .25, subRatio: 1, ...o, gain: (o.gain ?? .5) * TRIM.bass }); };
    M.filter = T.filter; M.filterRamp = T.filterRamp; M.musicGain = T.musicGain; M.masterGain = T.masterGain;
    S.masterGain(0, MASTER);                         // unshifted: the level from sample 0 of the pass
    S.pumpAttack = .002;                             // soft-knee sidechain: no click on sustained subs
    return M;
  };

  // ---- the master level over time (in the graph): MASTER, the drop's hole and the tail fade. One sorted event list,
  //      emitted in order so no ramp starts from the wrong anchor. The loudness ranking of the hits is done after the
  //      render (levelMap), where the bus compressor cannot flatten it. ----
  const masterCurve = S => {
    S.masterGain(HOLE[0] - .003, MASTER);              // anchor the ramp FIRST (do not reorder)
    S.masterGain(HOLE[0] - .003, 0, .003);             // 3 ms to zero, silent from HOLE[0]
    S.masterGain(HOLE[1], MASTER);                     // the drop is scheduled on HOLE[1], on the same sample
    S.masterGain(14.1, MASTER); S.masterGain(14.1, 0, .6);   // the tail fades to zero by 14.7, then 0.3 s of true silence
  };

  // ---- the loudness map, applied to the rendered buffer: a per-bar base level plus a pulse on each principal hit (dB) ----
  const LEVEL = {
    base: [[0, -4.8], [at(2, 1), -4.8], [at(3, 1), -4.8], [at(4, 1), -4.4], [at(5, 1), -4.8], [at(6, 1), -5.6], [at(7, 1), -5.6], [at(7, 3), -4.6], [at(8, 1), -4.6]],
    // [time, peak dB, hold, release]: the final hit, the drop, the landing, the flip, the lock, in that order
    pulse: [[at(2, 1), -2.9, .12, .4], [at(3, 3), -4.0, .1, .3], [at(4, 1), -.8, .15, .3], [at(7, 3), -1.9, .15, .3], [at(8, 1), 0, .3, .9]],
  };
  const levelMap = (N, SR) => {
    const g = new Float32Array(N), K = LEVEL.base, P = LEVEL.pulse;
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      let d = K[0][1];
      for (let k = 1; k < K.length; k++) {                 // piecewise constant with 20 ms glides into each key
        if (t < K[k][0] - .02) break;
        d = K[k - 1][1] + (K[k][1] - K[k - 1][1]) * R.clamp((t - (K[k][0] - .02)) / .02, 0, 1);
      }
      for (const [tp, pk, hold, rel] of P) {
        if (t < tp - .004 || t > tp + hold + rel) continue;
        const e = t < tp ? pk + (d - pk) * (tp - t) / .004 : t < tp + hold ? pk : pk + (d - pk) * (t - tp - hold) / rel;
        if (e > d) d = e;
      }
      g[i] = Math.pow(10, d / 20);
    }
    return g;
  };

  // ---- mastering EQ: RBJ biquads run over the two sections of the buffer (state reset across the drop's hole) ----
  const biquad = (type, f0, q, gainDb, SR) => {
    const A_ = Math.pow(10, gainDb / 40), w = 2 * Math.PI * f0 / SR, c = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'peak') { b0 = 1 + al * A_; b1 = -2 * c; b2 = 1 - al * A_; a0 = 1 + al / A_; a1 = -2 * c; a2 = 1 - al / A_; }
    else { const sq = 2 * Math.sqrt(A_) * al;                       // high shelf
      b0 = A_ * ((A_ + 1) + (A_ - 1) * c + sq); b1 = -2 * A_ * ((A_ - 1) + (A_ + 1) * c); b2 = A_ * ((A_ + 1) + (A_ - 1) * c - sq);
      a0 = (A_ + 1) - (A_ - 1) * c + sq; a1 = 2 * ((A_ - 1) - (A_ + 1) * c); a2 = (A_ + 1) - (A_ - 1) * c - sq; }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  };
  const EQ = [['hp', 30, .7, 0], ['peak', 70, .8, 2], ['peak', 400, .8, -1.5], ['peak', 1200, .7, -3.5], ['peak', 2800, .6, 4], ['shelf', 5000, .8, 1]];
  const runEQ = (chans, SR, from, to) => {
    const cf = EQ.map(([t, f, q, g]) => biquad(t, f, q, g, SR));
    for (const d of chans) {
      for (const [b0, b1, b2, a1, a2] of cf) {
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i = from; i < to; i++) {
          const x = d[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
          x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
        }
      }
    }
  };

  // a lookahead peak limiter, offline: gain = box average of a release-smoothed sliding minimum of the per-sample target,
  // so no sample ever exceeds the ceiling and the gain moves smoothly (look: seconds, attack/rel: seconds)
  const limiter = (chans, SR, ceil, look = .004, rel = .09) => {
    const N = chans[0].length, L = Math.max(1, Math.round(look * SR)), tg = new Float32Array(N);
    for (let i = 0; i < N; i++) { let m = 0; for (const d of chans) { const v = Math.abs(d[i]); if (v > m) m = v; } tg[i] = m > ceil ? ceil / m : 1; }
    // sliding minimum over [i-L+1, i] (monotonic deque)
    const mn = new Float32Array(N), dq = new Int32Array(N); let h = 0, t = 0;
    for (let i = 0; i < N; i++) {
      while (t > h && tg[dq[t - 1]] >= tg[i]) t--;
      dq[t++] = i;
      if (dq[h] <= i - L) h++;
      mn[i] = tg[dq[h]];
    }
    // release: instant attack, exponential recovery
    const a = Math.exp(-1 / (rel * SR)), e = new Float32Array(N); let y = 1;
    for (let i = 0; i < N; i++) { y = mn[i] < y ? mn[i] : mn[i] + (y - mn[i]) * a; e[i] = y; }
    // box average over [j, j+L-1]: the gain arrives before the peak and never exceeds any target in its window
    let minK = 1, gr = 0, grN = 0;
    const acc = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) acc[i + 1] = acc[i] + e[i];
    for (let j = 0; j < N; j++) {
      const z = Math.min(N, j + L), g = (acc[z] + (j + L - z)) - acc[j];   // beyond the end, gain 1
      const k = g / L;
      if (k < minK) minK = k; if (k < .99) { gr += -20 * Math.log10(k); grN++; }
      for (const d of chans) d[j] *= k;
    }
    A.limiterStats = { maxGR: -20 * Math.log10(minK), meanGRwhenActive: gr / Math.max(1, grN), activeFrac: grN / N };
  };

  // a "Crash" (5.2): darkening as it decays like a real cymbal
  const crashOf = S => (t, dur, o = {}) => S.whoosh(t, dur, { ...HIT.crash, pan: [-.3, .3], ...o });

  // ------------------------------------------------------------------------------------------ the song
  function song(S) {
    const crash = crashOf(S);
    // named voices (5.2)
    const K = (t, g = 1, tone = rootAt(t), o = {}) => S.kick(t, { gain: g, tone: S.hz(tone), ...HIT.kick, ...o });
    const Clap = (t, g) => { S.clap(t, { gain: g, ...HIT.clap }); S.clap(t + S64, { gain: g * .5, ...HIT.clap }); };
    const Sn = (t, g) => S.snare(t, { gain: g, ...HIT.snare });
    const H = (t, g) => S.hat(t, { gain: g, pan: Math.round(t / S16) % 2 ? .2 : -.2 });
    const Ho = (t, g) => S.hat(t, { gain: g, open: true, pan: Math.round(t / S16) % 2 ? .2 : -.2 });
    const Glass = (t, n, g, o = {}) => S.bell(t, n, { dur: .9, ratio: 3.5, index: 1.6, gain: g, rev: .5, ...o });
    const Marimba = (t, n, g) => {
      S.pluck(t, n, { type: 'sine', dur: .18, gain: g, cutoff: 4000, rev: .3, del: .25 });
      S.bell(t, n, { dur: .35, ratio: 4, index: 1.0, gain: g * .55, rev: .2 });
    };
    const Pl = (t, n, g) => S.pluck(t, n, { type: 'triangle', dur: .10, gain: g, del: .2 });
    const Tk = (t, f, g, pan = 0) => S.tick(t, { freq: f, gain: g, pan });
    const Bp = (t, n, g, drop, dur) => S.blip(t, n, { gain: g, drop, dur });
    const Stab = (t, ch, dur, g, o = {}) => {
      S.stab(t, CH[ch], dur, { gain: g, ...HIT.stab, ...o });
      S.bell(t, CH[ch][0], { dur: .9, ratio: 3.5, index: 1.4, gain: g * .5, rev: .4 });   // the glass note on the chord root
    };
    const sixteenths = (bar, k0, k1, fn) => { for (let k = k0; k < k1; k++) fn(at(bar, 1) + k * S16, k); };
    const bassLine = (bar, notes, ks, o = {}) => ks.forEach((k, i) => S.bass(at(bar, 1) + k * S16, notes[i], .1, { gain: .38, cutoff: 500, env: 1600, ...o }));

    masterCurve(S);

    // ================================================= bar 1 · 0.000 -> 1.875 · Am9 · count-in, audible from sample 0
    K(0, 1); Stab(0, 'Am9', .2, .26, { cutoff: 1100, bright: 6500 }); S.sub(0, 'A1', 1.3, { gain: .5 });
    ['A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'].forEach((n, i) => Bp(i * S32, n, i === 6 ? .22 : .19, 1.6, .07));   // the seven landings
    S.kick(at(1, 1, 4), { gain: .4, tone: S.hz('A1'), punch: 95, decay: .22, click: 0, pump: 0 }); Sn(at(1, 1, 4), .3);
    Tk(S32, 5200, .04);
    sixteenths(1, 1, 15, (t, k) => H(t, .03 + .006 * (k - 1)));
    K(at(1, 2), .9); Clap(at(1, 2), .5);
    Tk(at(1, 1, 4), 4200, .05); Tk(at(1, 2), 4800, .05); Tk(at(1, 2, 2), 5400, .05);
    K(at(1, 3), .9); Pl(at(1, 3), 'E5', .10); Tk(at(1, 3), 900, .08);
    Pl(at(1, 3, 3), 'G5', .08);
    K(at(1, 4), 1); Clap(at(1, 4), .55);
    [[0, .25], [1, .32], [2, .40], [3, .50]].forEach(([k, g]) => Sn(at(1, 4) + k * S16, g));
    Bp(at(1, 4) + 3 * S128, 'E5', .18, .5, .12);
    S.riser(at(1, 4), at(2, 1), { gain: .2, from: 220, to: 2600, noiseGain: .25, rev: .2 });
    S.reverse(at(2, 1), .47, { gain: .3 });
    S.pad(0, CH.Am9, 1.875, { gain: .09, attack: .5, cutoff: 9000, rev: .5, spread: .55 });
    S.filterRamp(0, at(2, 1), 1600, 12000);
    bassLine(1, ['A1', 'A1', 'A2', 'A1', 'E2', 'A1'], [3, 6, 8, 10, 12, 14]);

    // ================================================= bar 2 · 1.875 -> 3.75 · Am9 · CreatorMatch
    { const t = at(2, 1);                                                                       // MATCH CUT 1: the flip
      K(t, 1.15); S.impact(t, { gain: .7, size: .6, rev: .4 }); Clap(t, .6); Sn(t, .45);
      Stab(t, 'Am9', .2, .26); S.sub(t, 'A1', 1.7, { gain: .5 }); Glass(t, 'A4', .16, { dur: 1.0 });
      S.blip(t, 'C5', { gain: .07, drop: 1.5, dur: .09, pan: -.5 }); Tk(t, 4600, .05); }
    [at(2, 2), at(2, 3), at(2, 4)].forEach(t => K(t, .95));
    [at(2, 2), at(2, 4)].forEach(t => Clap(t, .5));
    sixteenths(2, 0, 16, (t, k) => { if (k % 4 === 2) Ho(t, .10); else H(t, .05); });
    for (let n = 0; n < 12; n++) Tk(at(2, 1, 3) + n * S32, 3000 + 160 * n, .045);              // the twelve letters
    Glass(at(2, 2), 'E6', .14); Tk(at(2, 2), 6000, .06);                                        // the click
    sixteenths(2, 4, 16, (t, k) => S.pluck(t, ['A3', 'C4', 'E4', 'G4'][(k - 4) % 4], { type: 'square', dur: .10, cutoff: 2400, gain: .05, del: .3 }));
    [['G5', at(2, 2, 3)], ['A5', at(2, 2, 4)], ['C6', at(2, 3)]].forEach(([n, t]) => Pl(t, n, .08));
    S.whoosh(at(2, 3, 2), .35, { gain: .10, from: 2000, to: 7000, pan: [-.4, .4], peak: .7 });
    S.whoosh(at(2, 3), .94, { gain: .08, from: 300, to: 1200, pan: [-.2, .2] });
    bassLine(2, ['A1', 'A1', 'A2', 'A1', 'E2', 'A1'], [3, 6, 8, 10, 12, 14]);
    S.pad(at(2, 1), CH.Am9, 1.875, { gain: .09 });

    // ================================================= bar 3 · 3.75 -> 5.625 · Fmaj9 · tension, the match, the silence
    { const t = at(3, 1);
      K(t, 1);
      S.pad(t, CH.Fmaj9, 1.875, { gain: .10, attack: .3, cutoff: 3600, spread: .55 });
      S.sub(t, 'F1', 1.5, { gain: .5 });
      S.riser(t, HOLE[0], { gain: .4, from: 180, to: 1600, noiseGain: .6, rev: .3 });
      S.filterRamp(t, HOLE[0], 3000, 9000);
      S.whoosh(t, .12, { gain: .08, from: 1200, to: 300, pan: [.3, -.3] });
      [0, 2, 4, 6, 8].forEach(k => S.bass(t + k * S16, 'F1', .2, { gain: .38 })); }
    K(at(3, 2), .95); Clap(at(3, 2), .5);
    S.reverse(4.5845, 4.5845 - at(3, 2), { gain: .22 });                                         // the pull-back
    S.whoosh(4.5845, .103, { gain: .18, from: 500, to: 4000, pan: [-.5, .5], peak: .8 });       // the slam is released
    { const t = at(3, 3);                                                                       // MATCH CUT 2: the lock
      K(t, 1); S.impact(t, { gain: .5, size: .5, rev: .4, to: S.hz('F1') });
      ['A5', 'C6', 'E6'].forEach(n => Glass(t, n, .14)); Tk(t, 6800, .10);
      S.glitch(t, .35, { gain: .05, step: .0117, seed: 3 }); }
    [[at(3, 3, 2), .22], [at(3, 3, 3), .30], [at(3, 3, 4), .38], [at(3, 4), .46], [at(3, 4, 2), .54]].forEach(([t, g]) => Sn(t, g));
    [0, 1, 2, 3].forEach(i => Sn(at(3, 4, 3) + i * S64, .50));
    S.whoosh(at(3, 3, 4), .47, { gain: .28, from: 400, to: 3000, pan: [-.6, .6], peak: .8 });
    // the kick and the bass are out from 3.4 (5.15625); the riser and the music are cut at 5.5078 by the hole
    sixteenths(3, 0, 8, (t, k) => { if (k % 4 === 2) Ho(t, .10); else H(t, .05); });

    // ================================================= bar 4 · 5.625 -> 7.5 · Cmaj9 · THE DROP, i dare you
    { const t = at(4, 1);
      K(t, 1.25, 'C2'); S.impact(t, { gain: .95, size: .6, rev: .5, to: S.hz('C1') });
      crash(t, 1.4, { gain: .3 }); Clap(t, .7);
      Stab(t, 'Cmaj9', .3, .26);
      S.pad(t, CH.Cmaj9, 1.8, { gain: .10, attack: .06, cutoff: 5000, spread: .55 });
      S.sub(t, 'C1', 1.7, { gain: .5 });
      S.glitch(t, .0586, { gain: .09, step: .0037, seed: 11 });
      S.filter(t, 20000); }
    [['A5', 0], ['C6', 1], ['E6', 2], ['G6', 3]].forEach(([n, i]) => Marimba(at(4, 1) + i * S16, n, .14));
    Bp(at(4, 1, 3) + S32, 'G6', .05, 1.4, .15); Bp(at(4, 1, 4) + S32, 'G6', .05, 1.4, .15);
    Tk(at(4, 2, 2), 5000, .04); Tk(at(4, 2, 3), 5000, .04);
    [at(4, 2), at(4, 3), at(4, 4)].forEach(t => K(t, 1));
    Clap(at(4, 2), .6); Clap(at(4, 4), .6);
    sixteenths(4, 0, 16, (t, k) => { if (k % 4 === 2) Ho(t, .14); else H(t, .08); });
    { const ns = ['C2', 'C2', 'G1', 'C2', 'E2', 'G2'];
      [0, 3, 6, 8, 11, 14].forEach((k, i) => S.bass(at(4, 1) + k * S16, ns[i], .18, { gain: .34, cutoff: 500, env: 1800 })); }
    { const arp = ['C5', 'D5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5'];
      for (let k = 0; k < 12; k++) S.bell(at(4, 2) + k * S16, arp[k % 8], { dur: .3, ratio: 4, gain: .05, rev: .3 }); }
    [['G5', 0], ['A5', 1], ['C6', 2]].forEach(([n, i]) => Bp(at(4, 2) + i * S16, n, .10, .8, .09));
    Pl(at(4, 3), 'E5', .10); Tk(at(4, 3), 3200, .05); Bp(at(4, 3), 'A5', .08, 1.5, .1);
    S.whoosh(at(4, 4, 3), .9, { gain: .12, from: 500, to: 4000, pan: [-.8, .8], peak: .4, rev: .3 });

    // ================================================= bar 5 · 7.5 -> 9.375 · Am9 -> Fmaj9 · Kaught, Soon, dusk
    { const t = at(5, 1);
      K(t, 1); Stab(t, 'Am9', .2, .22); S.pad(t, CH.Am9, .94, { gain: .08, attack: .05 }); S.sub(t, 'A1', .9, { gain: .45 });
      Pl(t, 'E5', .10); }
    { const ns = ['A1', 'A1', 'E2', 'F1', 'F1', 'C2'];
      [0, 3, 6, 8, 11, 14].forEach((k, i) => S.bass(at(5, 1) + k * S16, ns[i], .18, { gain: .34, cutoff: 500, env: 1800 })); }
    K(at(5, 2), 1); Clap(at(5, 2), .6);
    { const t = at(5, 3);
      K(t, 1); S.pad(t, CH.Fmaj9, .94, { gain: .09 }); S.sub(t, 'F1', .5, { gain: .45 }); Glass(t, 'E5', .10); }
    Glass(at(5, 3) + S16, 'G5', .10);
    Bp(at(5, 3) + S32, 'A5', .06, 1.2, .20); Bp(at(5, 3) + 3 * S32, 'C6', .06, 1.2, .20);
    Pl(at(5, 3, 3), 'E6', .10); Pl(at(5, 3, 4), 'G6', .10);
    { const t = at(5, 4);
      Clap(t, .6); K(t, 1); S.reverse(at(6, 1), .47, { gain: .3 });
      S.whoosh(t, .47, { gain: .14, from: 6000, to: 400 });
      S.filterRamp(t, at(6, 1), 20000, 1800); }
    S.whoosh(at(5, 4, 2), .35, { gain: .10, from: 800, to: 3000, pan: [.6, -.6] });
    Bp(at(5, 4, 3), 'A5', .10, 1.8, .22); Tk(at(5, 4, 3), 3000, .06);
    sixteenths(5, 0, 16, (t, k) => { if (k % 4 === 2) Ho(t, .14); else H(t, .08); });

    // ================================================= bar 6 · 9.375 -> 11.25 · Dm9 -> G6/9 · the list (half-time)
    { const t = at(6, 1);                                                                       // MATCH CUT 5
      K(t, .9); S.pad(t, CH.Dm9, 1.875, { gain: .10, attack: .04, cutoff: 3000, spread: .55 });
      S.sub(t, 'D2', .94, { gain: .45 }); Glass(t, 'A4', .14);
      S.pluck(t, 'A4', { type: 'sine', dur: .08, gain: .16 }); Tk(t, 900, .08, -.6);
      S.filterRamp(t, t + .225, 1800, 12000); }
    [['C5', at(6, 1) + S32], ['D5', at(6, 1, 2)], ['E5', at(6, 1, 2) + S32]].forEach(([n, t]) => { Pl(t, n, .10); Tk(t, 3600, .04); });
    { const t = at(6, 2);
      Clap(t, .5); Sn(t, .3); Glass(t, 'C5', .12); }
    [['G4', 0], ['A4', 1], ['C5', 2]].forEach(([n, i]) => { const t = at(6, 2) + S32 + i * S32; Pl(t, n, .09); Tk(t, 3600, .04); });
    { const t = at(6, 3);
      K(t, .85); S.pad(t, CH.G69, 1.875, { gain: .10, attack: .04, spread: .55 }); S.sub(t, 'G1', .94, { gain: .45 });
      Glass(t, 'E5', .12); Bp(t, 'E6', .10, 2, .10); }
    { const t = at(6, 3, 3);
      Sn(t, .3); Sn(t + S64, .3); Clap(t, .5); Glass(t, 'G5', .12); S.reverse(t, .30, { gain: .16 }); }
    Bp(at(6, 3, 4), 'A5', .12, 1.4, .18); Glass(at(6, 3, 4), 'A5', .10, { dur: 1.2 });
    [['A5', 0], ['C6', 1], ['E6', 2], ['G6', 3]].forEach(([n, i]) => Marimba(at(6, 4) + [0, S32, S16, S16 + S32][i], n, .10));
    ['A5', 'C6', 'E6', 'G6'].forEach(n => Glass(at(6, 4, 2) + S32, n, .10, { dur: 1.2 }));
    for (let k = 0; k < 8; k++) H(at(6, 1) + k * B / 2, .06);

    // ================================================= bar 7 · 11.25 -> 13.125 · G6/9 -> C6/9 · Brain, the scroll, the landing
    K(at(7, 1), .8, 'G1'); S.sub(at(7, 1), 'G1', .94, { gain: .45 });
    S.riser(at(7, 1, 3), at(7, 2, 4), { gain: .45, from: 250, to: 3500, noiseGain: .6, rev: .25 });
    S.filterRamp(at(7, 1, 3), at(7, 2, 4), 12000, 900);
    S.whoosh(at(7, 1, 4), .47, { gain: .7, from: 800, to: 6000, pan: [-.6, .6], peak: .22, end: 1500 });   // the page whip: fast attack, long fall
    [[at(7, 1, 4), .32], [at(7, 2), .42], [at(7, 2, 2), .52], [at(7, 2, 3), .65], [at(7, 2, 3) + S32, .65], [at(7, 2, 3) + S32 + S64, .65]].forEach(([t, g]) => Sn(t, g));
    // 7.2a -> 7.3: the air. The riser has stopped, kicks and hats stay out; the G6/9 pad and its reverb ring through the 900 Hz low-pass
    { const t = at(7, 3);                                                                       // THE LANDING
      K(t, 1.15, 'C2'); S.impact(t, { gain: .7, size: .6, rev: .5, to: S.hz('C1') }); Clap(t, .6); Sn(t, .45);
      Stab(t, 'C69', .3, .24, { rev: .5 });
      S.pad(t, CH.C69, 3.0, { gain: .09, attack: .02, release: 1.0 });
      S.sub(t, 'C1', 1.7, { gain: .5 });
      S.filter(t, 20000); }
    ['C5', 'E5', 'G5', 'A5', 'D6'].forEach((n, i) => S.bell(at(7, 3) + i * S16, n, { dur: 1.6, ratio: 3.5, index: 1.2, gain: .08, rev: .6 }));
    Bp(at(7, 3, 2), 'C7', .05, 1.5, .08); Tk(at(7, 3, 2), 6400, .04); Tk(at(7, 3, 2), 3000, .05);
    { const t = at(7, 4);
      K(t, .85, 'C2');
      S.reverse(at(8, 1), .469, { gain: .30 });
      S.swell(at(8, 1), ['A5', 'C6', 'E6', 'G6'], .469, { gain: .22, ratio: 3.5, index: 1.6, rev: .4 }); }
    sixteenths(7, 8, 16, (t, k) => H(t, .04 + .08 * (k - 8) / 7));

    // ================================================= bar 8 · 13.125 -> 15.000 · C6/9 · the final hit and the tail
    { const t = at(8, 1);
      K(t, 1.3, 'C2', { decay: .6, pump: 0 }); S.impact(t, { gain: 1.0, size: .6, rev: .7, to: S.hz('C1') });
      crash(t, 2.2, { gain: .30 }); Clap(t, .7);
      Stab(t, 'C69', 1.4, .26, { rev: .6 });
      S.pad(t, CH.C69, 1.5, { gain: .08, attack: .02, release: 1.0 });
      ['C6', 'E6', 'G6', 'A6'].forEach(n => S.bell(t, n, { dur: 2.6, ratio: 2.76, index: 1.6, gain: .18, rev: .7 }));
      S.sub(t, 'C1', 1.4, { gain: .5 });
      S.whoosh(t, .35, { gain: .12, from: 1500, to: 9000, pan: [-.4, .6], peak: .6 }); }
    S.bell(at(8, 2), 'C6', { gain: .05, dur: 1.6, rev: .7 });
    S.bell(at(8, 3), 'E6', { gain: .05, dur: 1.6, rev: .7 });
  }

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

  // shift = the pre-roll: every time the song schedules is late by PRE
  A.score = S0 => {
    const part = A._part || null;
    song(mixer(S0, part === 'post' ? PRE - HOLE[1] : PRE, A._solo || null, part));
  };

  // ---- render alignment (5.4) ----
  // Two offline passes, split at the drop's hole (bars 1-3 and bar 3.4a onward), rendered in parallel. The hole is where the
  // score is digitally silent anyway, so the drop is born from a clean bus: no reverb, delay or pad tail crosses it.
  // Each pass starts after PRE s of silence so the bus compressor is at rest at its first hit, and is late by the
  // compressor + limiter lookahead (measured), so both are cropped by the same offset.
  const baseRender = A.render;
  A.render = async () => {
    const SR = A.SR, N = Math.round(R.DUR * SR), h0 = Math.round(HOLE[0] * SR), h1 = Math.round(HOLE[1] * SR);
    A._part = 'pre';
    const pa = baseRender(PRE + HOLE[0] + .06);
    A._part = 'post';
    const pb = baseRender(PRE + (R.DUR - HOLE[1]) + .06);
    A._part = null;
    const latency = probeLatency();
    const [a, b] = await Promise.all([pa, pb]);
    const lat = await latency;
    A.latency = lat / SR;
    const o = Math.round(PRE * SR) + lat;             // pass index = pass time + o
    const buf = new AudioBuffer({ length: N, numberOfChannels: 2, sampleRate: SR });
    const chans = [];
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      d.set(a.getChannelData(c).subarray(o, o + h0), 0);                 // bars 1-3 up to the hole
      d.set(b.getChannelData(c).subarray(o, o + N - h1), h1);            // the drop onward, on its own sample
      chans.push(d);                                                      // [h0, h1) stays exact zeros
    }
    runEQ(chans, SR, 0, h0); runEQ(chans, SR, h1, N);                      // the hole stays exact zeros: each section has its own filter state
    // mastering: drive into a lookahead limiter, then the loudness map (ranks the hits), then a fixed true peak, so the
    // level does not depend on the bus limiter's overshoot and the AAC export has headroom for intersample overs
    for (const d of chans) for (let i = 0; i < N; i++) d[i] *= PREGAIN;
    limiter(chans, SR, .9);
    { const g = levelMap(N, SR); for (const d of chans) for (let i = 0; i < N; i++) d[i] *= g[i]; }
    const tp = truePeak(chans), k = A._fixedK ?? (tp > 0 ? Math.pow(10, PEAK / 20) / tp : 1);
    A.trimK = k;
    for (const d of chans) for (let i = 0; i < N; i++) d[i] *= k;
    A.buffer = buf;
    return buf;
  };
})();
