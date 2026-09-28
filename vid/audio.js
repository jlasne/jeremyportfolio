/* The soundtrack, synthesized. The score is rendered once, offline, into one
   buffer; playback then runs that buffer and the picture follows its clock. */
(() => {
  'use strict';
  const SR = 48000;
  const A = window.ReelAudio = { SR, buffer: null };
  const R = window.Reel;

  // 'A2', 'C#4', 'Eb3' or a MIDI number -> Hz
  const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = n => {
    if (typeof n === 'number') return n;
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    if (!m) throw new Error('bad note ' + n);
    return 12 * (+m[3] + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
  const hz = A.hz = n => 440 * Math.pow(2, (midi(n) - 69) / 12);
  A.midi = midi;

  // Build an instrument set bound to one (offline) context. Returns the score API.
  function studio(ctx) {
    const rng = R.rng(909);
    const noiseBuf = ctx.createBuffer(2, SR * 2, SR);
    for (let c = 0; c < 2; c++) { const d = noiseBuf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1; }

    // ---- buses: drums, music (ducked by the kick), fx; sends to reverb and delay ----
    const master = ctx.createGain(); master.gain.value = .9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .12;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -2; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = .001; limit.release.value = .05;
    master.connect(comp); comp.connect(limit); limit.connect(ctx.destination);

    const drums = ctx.createGain(); drums.gain.value = 1; drums.connect(master);
    const musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 20000; musicFilter.Q.value = .8;
    const duck = ctx.createGain(); duck.gain.value = 1;
    const music = ctx.createGain(); music.gain.value = 1;
    music.connect(musicFilter); musicFilter.connect(duck); duck.connect(master);
    const fx = ctx.createGain(); fx.gain.value = 1; fx.connect(master);

    // reverb from seeded noise with an exponential tail
    const verb = ctx.createConvolver();
    { const len = SR * 2.6, ir = ctx.createBuffer(2, len, SR), r2 = R.rng(77);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (r2() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      verb.buffer = ir; }
    const verbIn = ctx.createGain(); verbIn.gain.value = .5;
    const verbHP = ctx.createBiquadFilter(); verbHP.type = 'highpass'; verbHP.frequency.value = 250;
    verbIn.connect(verbHP); verbHP.connect(verb); verb.connect(master);

    // dotted-eighth ping-pong delay
    const dl = ctx.createDelay(2), dr = ctx.createDelay(2), fb = ctx.createGain(), dIn = ctx.createGain();
    const merge = ctx.createChannelMerger(2), dLP = ctx.createBiquadFilter();
    dl.delayTime.value = R.BEAT * .75; dr.delayTime.value = R.BEAT * .75; fb.gain.value = .38; dIn.gain.value = .35;
    dLP.type = 'lowpass'; dLP.frequency.value = 3200;
    dIn.connect(dl); dl.connect(dr); dr.connect(fb); fb.connect(dLP); dLP.connect(dl);
    dl.connect(merge, 0, 0); dr.connect(merge, 0, 1); merge.connect(master);

    const out = (node, bus, { rev = 0, del = 0, pan = 0 } = {}) => {
      let n = node;
      if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
      n.connect(bus);
      if (rev) { const g = ctx.createGain(); g.gain.value = rev; n.connect(g); g.connect(verbIn); }
      if (del) { const g = ctx.createGain(); g.gain.value = del; n.connect(g); g.connect(dIn); }
      return n;
    };
    const env = (g, t, a, peak, d, sustain = 0, rel = 0, len = 0) => {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      if (len) {
        g.gain.setTargetAtTime(peak * sustain, t + a, d / 3);
        g.gain.setValueAtTime(peak * sustain, t + len);
        g.gain.setTargetAtTime(0, t + len, rel / 4);
      } else g.gain.setTargetAtTime(0, t + a, d / 4);
    };
    const noise = (t, dur, seed = 0) => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      s.start(t, (seed * .173) % 1.8); s.stop(t + dur + .05); return s;
    };
    const osc = (type, f, t, dur, detune = 0) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
      o.start(t); o.stop(t + dur + .05); return o;
    };
    const shaper = amt => {
      const w = ctx.createWaveShaper(), n = 2048, c = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * amt) / Math.tanh(amt); }
      w.curve = c; return w;
    };

    const S = { ctx, hz, midi, at: R.at, BEAT: R.BEAT, BAR: R.BAR, rng };

    // sidechain pump on the music bus
    S.pump = (t, depth = .55, rel = .22) => {
      duck.gain.setValueAtTime(1 - depth, t);
      duck.gain.setTargetAtTime(1, t + .01, rel / 3);
    };
    S.kick = (t, { gain = 1, tone = 48, punch = 170, decay = .42, click = .35, pump = .5 } = {}) => {
      const o = osc('sine', punch, t, decay + .2);
      o.frequency.setValueAtTime(punch, t);
      o.frequency.exponentialRampToValueAtTime(tone, t + .07);
      const g = ctx.createGain(); env(g, t, .002, gain, decay);
      const sh = shaper(2.2);
      o.connect(sh); sh.connect(g); out(g, drums);
      if (click) {
        const n = noise(t, .02, 3), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
        hp.type = 'highpass'; hp.frequency.value = 3000; env(cg, t, .0005, click * gain, .012);
        n.connect(hp); hp.connect(cg); out(cg, drums);
      }
      if (pump) S.pump(t, pump);
    };
    S.snare = (t, { gain = .7, tone = 190, decay = .2, rev = .25 } = {}) => {
      const n = noise(t, decay + .1, 7), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = .7; env(g, t, .001, gain, decay);
      n.connect(bp); bp.connect(g); out(g, drums, { rev });
      const o = osc('triangle', tone * 1.6, t, .12), og = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(tone, t + .05); env(og, t, .001, gain * .6, .09);
      o.connect(og); out(og, drums);
    };
    S.clap = (t, { gain = .7, rev = .35 } = {}) => {
      const n = noise(t, .35, 11), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.1;
      g.gain.setValueAtTime(0, t);
      for (let i = 0; i < 3; i++) { const tt = t + i * .011; g.gain.setValueAtTime(gain, tt); g.gain.setTargetAtTime(0, tt + .001, .003); }
      g.gain.setValueAtTime(gain * .8, t + .034); g.gain.setTargetAtTime(0, t + .035, .05);
      n.connect(bp); bp.connect(g); out(g, drums, { rev });
    };
    S.hat = (t, { gain = .22, open = false, pan = 0 } = {}) => {
      const d = open ? .28 : .045;
      const n = noise(t, d + .05, 13 + t * 3), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 7500; env(g, t, .0008, gain, d);
      n.connect(hp); hp.connect(g); out(g, drums, { pan });
    };
    S.shaker = (t, { gain = .12, pan = 0 } = {}) => {
      const n = noise(t, .08, 17 + t), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 9000; bp.Q.value = 1.5;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .02); g.gain.setTargetAtTime(0, t + .025, .015);
      n.connect(bp); bp.connect(g); out(g, drums, { pan });
    };
    S.bass = (t, note, dur, { gain = .5, cutoff = 700, env: fe = 2200, res = 5, glideFrom = null } = {}) => {
      const f = hz(note), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = res;
      lp.frequency.setValueAtTime(cutoff + fe, t); lp.frequency.setTargetAtTime(cutoff, t, .06);
      for (const det of [-7, 7]) {
        const o = osc('sawtooth', glideFrom ? hz(glideFrom) : f, t, dur + .1, det), og = ctx.createGain();
        if (glideFrom) o.frequency.exponentialRampToValueAtTime(f, t + .08);
        og.gain.value = .5; o.connect(og); og.connect(lp);
      }
      const so = osc('sine', f / 2, t, dur + .1), sg = ctx.createGain();
      sg.gain.value = .9; so.connect(sg); sg.connect(g);
      lp.connect(g);
      env(g, t, .004, gain, .3, .75, .06, dur);
      out(g, music);
    };
    S.sub = (t, note, dur, { gain = .5 } = {}) => {
      const o = osc('sine', hz(note), t, dur + .1), g = ctx.createGain();
      env(g, t, .01, gain, .2, .9, .08, dur); o.connect(g); out(g, music);
    };
    S.stab = (t, notes, dur = .25, { gain = .22, cutoff = 900, bright = 5200, rev = .35, del = .15, pan = 0 } = {}) => {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(bright, t); lp.frequency.setTargetAtTime(cutoff, t, dur / 3);
      for (const n of notes) for (const det of [-9, 0, 9]) {
        const o = osc('sawtooth', hz(n), t, dur + .3, det), og = ctx.createGain(); og.gain.value = 1 / (notes.length * 2.2);
        o.connect(og); og.connect(lp);
      }
      lp.connect(g); env(g, t, .003, gain, dur * .8, .3, .12, dur);
      out(g, music, { rev, del, pan });
    };
    S.pad = (t, notes, dur, { gain = .12, attack = .6, release = .8, cutoff = 1400, rev = .6 } = {}) => {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff * .5, t); lp.frequency.linearRampToValueAtTime(cutoff, t + dur);
      for (const n of notes) for (const det of [-14, -5, 5, 14]) {
        const o = osc('sawtooth', hz(n), t, dur + release + .2, det), og = ctx.createGain(); og.gain.value = 1 / (notes.length * 3);
        o.connect(og); og.connect(lp);
      }
      lp.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.setValueAtTime(gain, t + dur); g.gain.setTargetAtTime(0, t + dur, release / 4);
      out(g, music, { rev });
    };
    S.pluck = (t, note, { gain = .2, dur = .25, type = 'square', cutoff = 5000, rev = .25, del = .3, pan = 0 } = {}) => {
      const o = osc(type, hz(note), t, dur + .2), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t); lp.frequency.setTargetAtTime(400, t, dur / 4);
      env(g, t, .002, gain, dur); o.connect(lp); lp.connect(g); out(g, music, { rev, del, pan });
    };
    S.bell = (t, note, { gain = .18, dur = 1.2, ratio = 3.5, index = 2.5, rev = .5, pan = 0 } = {}) => {
      const f = hz(note), car = osc('sine', f, t, dur), mod = osc('sine', f * ratio, t, dur), mg = ctx.createGain(), g = ctx.createGain();
      mg.gain.setValueAtTime(f * index, t); mg.gain.setTargetAtTime(0, t, dur / 5);
      mod.connect(mg); mg.connect(car.frequency);
      env(g, t, .002, gain, dur); car.connect(g); out(g, music, { rev, pan });
    };
    S.blip = (t, note = 'A5', { gain = .12, dur = .06, drop = 1.5, pan = 0 } = {}) => {
      const f = hz(note), o = osc('sine', f * drop, t, dur + .05), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(f, t + dur * .4); env(g, t, .001, gain, dur);
      o.connect(g); out(g, fx, { pan, rev: .15 });
    };
    S.tick = (t, { gain = .15, freq = 3200, pan = 0 } = {}) => {
      const o = osc('square', freq, t, .02), g = ctx.createGain(), hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1500; env(g, t, .0005, gain, .012);
      o.connect(hp); hp.connect(g); out(g, fx, { pan });
    };
    S.riser = (t0, t1, { gain = .22, from = 180, to = 1400, noiseGain = .3, rev = .3 } = {}) => {
      const d = t1 - t0, g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t1); g.gain.setValueAtTime(0, t1 + .005);
      for (const det of [-12, 0, 12]) {
        const o = osc('sawtooth', from, t0, d, det); o.frequency.exponentialRampToValueAtTime(to, t1);
        const og = ctx.createGain(); og.gain.value = .33; o.connect(og); og.connect(g);
      }
      const n = noise(t0, d, 21), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(400, t0); bp.frequency.exponentialRampToValueAtTime(9000, t1);
      ng.gain.value = noiseGain / Math.max(gain, .01); n.connect(bp); bp.connect(ng); ng.connect(g);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t0); lp.frequency.exponentialRampToValueAtTime(12000, t1);
      g.connect(lp); out(lp, fx, { rev });
    };
    S.whoosh = (t, dur = .5, { gain = .35, from = 300, to = 5000, pan = [-.8, .8], rev = .25, peak = .6 } = {}) => {
      const n = noise(t, dur, 29 + t), bp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
      bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur * peak);
      bp.frequency.exponentialRampToValueAtTime(from * 1.5, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * peak); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      p.pan.setValueAtTime(pan[0], t); p.pan.linearRampToValueAtTime(pan[1], t + dur);
      n.connect(bp); bp.connect(g); g.connect(p); out(p, fx, { rev });
    };
    S.impact = (t, { gain = .8, size = 1, rev = .6 } = {}) => {
      const o = osc('sine', 90, t, 1.6 * size), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(32, t + .5 * size);
      env(g, t, .002, gain, 1.2 * size); const sh = shaper(3); o.connect(sh); sh.connect(g); out(g, drums);
      const n = noise(t, .6 * size, 31), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(200, t + .5 * size);
      env(ng, t, .001, gain * .5, .5 * size); n.connect(lp); lp.connect(ng); out(ng, fx, { rev });
    };
    S.reverse = (tEnd, dur = 1, { gain = .3, rev = .2 } = {}) => {
      const t0 = tEnd - dur, n = noise(t0, dur, 37), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.setValueAtTime(1500, t0); hp.frequency.exponentialRampToValueAtTime(5000, tEnd);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, tEnd - .005); g.gain.linearRampToValueAtTime(0, tEnd);
      n.connect(hp); hp.connect(g); out(g, fx, { rev });
    };
    S.glitch = (t, dur = .23, { gain = .14, step = R.BEAT / 8, seed = 1, pan = 0 } = {}) => {
      const r = R.rng(seed * 101 + 7), steps = Math.max(1, Math.round(dur / step));
      for (let i = 0; i < steps; i++) {
        const tt = t + i * step, f = 200 + r() * 2400, o = osc(r() < .5 ? 'square' : 'sawtooth', f, tt, step), g = ctx.createGain();
        g.gain.setValueAtTime(gain * (.5 + r() * .5), tt); g.gain.setValueAtTime(0, tt + step * .8);
        o.connect(g); out(g, fx, { pan: pan || (r() * 2 - 1) * .6 });
      }
    };
    S.tapeStop = (t, dur = .35, { gain = .25 } = {}) => {
      const o = osc('sawtooth', 220, t, dur), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(30, t + dur);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
      g.gain.setValueAtTime(gain, t); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(lp); lp.connect(g); out(g, fx);
    };
    // automation on the music bus
    S.filter = (t, freq, ramp = 0) => {
      if (ramp) { musicFilter.frequency.setValueAtTime(musicFilter.frequency.value, t); musicFilter.frequency.exponentialRampToValueAtTime(freq, t + ramp); }
      else musicFilter.frequency.setValueAtTime(freq, t);
    };
    S.filterRamp = (t0, t1, from, to) => {
      musicFilter.frequency.setValueAtTime(from, t0);
      musicFilter.frequency.exponentialRampToValueAtTime(to, t1);
    };
    S.musicGain = (t, v, ramp = 0) => {
      if (ramp) { music.gain.setValueAtTime(music.gain.value, t); music.gain.linearRampToValueAtTime(v, t + ramp); }
      else music.gain.setValueAtTime(v, t);
    };
    S.masterGain = (t, v, ramp = 0) => {
      if (ramp) master.gain.linearRampToValueAtTime(v, t + ramp); else master.gain.setValueAtTime(v, t);
    };
    return S;
  }

  // the score is a function (S) => void, set by score.js
  A.score = null;

  A.render = async () => {
    const len = Math.round(R.DUR * SR);
    const ctx = new OfflineAudioContext(2, len, SR);
    const S = studio(ctx);
    if (A.score) A.score(S);
    const buf = await ctx.startRendering();
    // 6 ms edges so the loop point never clicks
    const f = Math.round(SR * .006);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[len - 1 - i] *= k; }
    }
    A.buffer = buf;
    return buf;
  };

  // 16-bit PCM WAV of the rendered buffer, for the MP4 export
  A.wav = () => {
    const b = A.buffer, n = b.length, ch = b.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
    out.setUint32(24, SR, true); out.setUint32(28, SR * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(b.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    return out.buffer;
  };

  // ---- live playback against a real context ----
  let ac = null, src = null, gainNode = null, startedAt = 0, startOffset = 0;
  A.context = () => {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      gainNode = ac.createGain(); gainNode.connect(ac.destination);
    }
    return ac;
  };
  A.playing = () => !!src;
  A.start = (offset, loop = true) => {
    if (!A.buffer) return false;
    const c = A.context();
    A.stop();
    src = c.createBufferSource();
    src.buffer = A.buffer;
    src.loop = loop;
    src.connect(gainNode);
    startOffset = ((offset % R.DUR) + R.DUR) % R.DUR;
    startedAt = c.currentTime + .03;
    src.start(startedAt, startOffset);
    const me = src;
    src.onended = () => { if (src === me) src = null; };
    return true;
  };
  A.stop = () => { if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; } };
  A.setLoop = v => { if (src) src.loop = v; };
  // where the listener is in the reel right now, latency included
  A.time = () => {
    if (!src || !ac) return null;
    const lat = (ac.outputLatency || 0) + (ac.baseLatency || 0);
    const el = Math.max(0, ac.currentTime - startedAt - lat) + startOffset;
    return src.loop ? ((el % R.DUR) + R.DUR) % R.DUR : Math.max(0, el);
  };
})();
