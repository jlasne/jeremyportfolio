(() => {
  'use strict';
  const CFG = window.REEL || {}, FILES = CFG.files || [];      // set by each reel's page: absolute script paths, in play order
  const R = Reel, A = ReelAudio, q = new URLSearchParams(location.search);
  const EXPORT = q.has('export');
  const only = q.get('only');           // ?only=s3 loads just that scene (and the score)
  const $ = id => document.getElementById(id);
  const stage = $('stage'), out = $('out');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (EXPORT) document.body.classList.add('export');

  const load = src => new Promise(res => {
    const s = document.createElement('script');
    s.src = src; s.async = false; s.onload = res;
    s.onerror = () => { console.warn('missing', src); res(); };
    document.head.appendChild(s);
  });

  const fonts = [['Unbounded', 900], ['Unbounded', 400], ['Inter Tight', 800], ['Inter Tight', 400], ['Space Grotesk', 700],
    ['Instrument Serif', 400], ['Instrument Serif', 400, 'italic'], ['JetBrains Mono', 500]];

  // ---- sizes: render at the displayed resolution, capped ----
  const CAP = q.has('hq') ? 2560 : 1920;
  let scale = 1, stageW = 1920;
  function resize() {
    const r = stage.getBoundingClientRect(), dpr = EXPORT ? 1 : Math.min(devicePixelRatio || 1, 2);
    stageW = Math.min(r.width, r.height * 16 / 9) || r.width;   // the picture's CSS width (letterboxed in fullscreen)
    const w = EXPORT ? 1920 : Math.max(320, Math.round(stageW * dpr));
    out.width = Math.min(w, CAP); out.height = Math.round(out.width * 9 / 16);
    R.setRenderSize(Math.min(w, CAP) * scale);
    dirty = true; lastUI = -1;
  }

  // ---- clock ----
  let t = 0, playing = !reduced && !EXPORT, loop = q.has('loop'), sound = false, dirty = true, last = -1, lastUI = -1;
  const FR = 1 / R.FPS, D = R.DUR;
  const snap = x => Math.round(x * R.FPS) / R.FPS;
  if (q.has('t')) { t = Math.max(0, Math.min(D - FR, +q.get('t') || 0)); playing = false; }

  function setPlaying(v) {
    playing = v;
    $('play').dataset.state = v ? 'on' : 'off';
    $('play').setAttribute('aria-label', v ? 'Pause' : 'Play');
    if (v) $('big').classList.remove('on');
    if (sound) { if (v) A.start(t, loop); else A.stop(); }
    last = -1;   // the next rAF re-anchors the clock (dt 0): never step t backwards
  }
  function seek(x) {
    t = Math.max(0, Math.min(D - FR, x));
    if (t < D - FR * 1.5) $('replay').hidden = true;
    if (sound && playing) A.start(t, loop);
    dirty = true;
  }

  // feedback is immediate (chip goes, button lights, the reel parks on frame 0); playback starts once the score is rendered
  let soundReq = 0;
  const sndIcon = on => {
    $('snd').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('snd').querySelector('.alt-on').style.display = on ? '' : 'none';
    $('snd').querySelector('.alt-off').style.display = on ? 'none' : '';
  };
  async function soundOn(fromStart) {
    const c = A.context();                                   // created and resumed inside the user gesture
    const resumed = c.state !== 'running' ? c.resume() : null;
    const my = ++soundReq;
    sndIcon(true);
    if (fromStart) { $('chip').hidden = true; $('replay').hidden = true; setPlaying(false); t = 0; dirty = true; }
    await resumed; await window.__reel.ready; await audioReady;
    if (my !== soundReq || !A.buffer) { if (my === soundReq) sndIcon(false); return; }
    sound = true;
    $('chip').hidden = true;
    setPlaying(fromStart || playing);                        // a sound toggle never changes the play state
  }
  function soundOff() {
    ++soundReq;
    sound = false; A.stop();
    $('snd').setAttribute('aria-pressed', 'false');
    $('snd').querySelector('.alt-on').style.display = 'none';
    $('snd').querySelector('.alt-off').style.display = '';
  }

  // ---- adaptive quality: drop resolution if frames are slow ----
  // fed the real rAF interval while playing (renderAt's JS time misses the GPU raster, which is the actual cost).
  // Slow = under 25 fps, so a display or battery mode capped at 30 Hz is not mistaken for a struggling device.
  // Down after 1 s spent in slow frames; up only after 600 consecutive fast frames (no oscillation at the vsync cap).
  let slowMs = 0, fast = 0;
  function adapt(ms) {
    if (EXPORT || ms > 2000) return;                         // a background tab, not a slow frame
    // each slow frame counts at most 200 ms, so one hitch (GC, first paint) never downgrades on its own
    if (ms > 40) { slowMs += Math.min(ms, 200); fast = 0; }
    else { slowMs = Math.max(0, slowMs - ms); if (ms < 20) fast++; }
    if (slowMs > 1000 && scale > .5) { scale = Math.max(.5, scale - .25); R.quality = scale < 1 ? 0 : 1; slowMs = 0; fast = 0; resize(); }
    if (fast > 600 && scale < 1) { scale = Math.min(1, scale + .25); R.quality = scale < 1 ? 0 : 1; fast = 0; resize(); }
  }

  // ---- UI ----
  const scrub = $('scrub'), fillbar = $('fillbar'), head = $('head'), tc = $('tc'), hud = $('hud');
  const pad2 = n => String(n).padStart(2, '0');
  const code = x => { const f = Math.round(x * R.FPS); return pad2(Math.floor(f / R.FPS)) + ':' + pad2(f % R.FPS); };
  const secs = x => (Math.round(x * R.FPS) / R.FPS).toFixed(2).padStart(5, '0');
  function buildScrub() {
    for (let b = 0; b <= 32; b++) {
      const el = document.createElement('i');
      el.className = 'tick' + (b % 4 ? ' beat' : '');
      el.style.left = (b * R.BEAT / D * 100) + '%';
      scrub.appendChild(el);
    }
    const seen = new Set();
    for (const s of R.scenes) {
      if (!s.name || seen.has(s.name)) continue;
      seen.add(s.name);
      const el = document.createElement('span');
      el.className = 'seg';
      el.textContent = s.name;
      el.style.left = (s.start / D * 100) + '%';
      el.style.width = ((s.end - s.start) / D * 100) + '%';
      scrub.appendChild(el);
    }
  }
  function ui() {
    const f = Math.round(t * R.FPS);
    if (f === lastUI) return;
    lastUI = f;
    const p = t / (D - FR);
    fillbar.style.transform = `scaleX(${p})`;
    head.style.left = (p * 100) + '%';
    tc.innerHTML = `<b>${secs(t)}</b> / ${secs(D)} s`;
    scrub.setAttribute('aria-valuenow', t.toFixed(2));
    scrub.setAttribute('aria-valuetext', secs(t) + ' of 15 seconds');
    if ($('guides').classList.contains('on')) {
      const beat = Math.floor(t / R.BEAT), sc = R.scenes.filter(s => t >= s.start && t < s.end).map(s => s.id).join(' + ');
      hud.textContent = `${code(t)}  F ${String(f).padStart(3, '0')}   BAR ${Math.floor(beat / 4) + 1}.${beat % 4 + 1}  ${R.BPM} BPM   ${sc}`;
    }
    // the chip: icon only after the count-in when the label would cover the picture; ink on the s5 ice field
    $('chip').classList.toggle('mini', stageW < 1228 && t >= R.at(3, 1));
    $('chip').classList.toggle('ink', (CFG.ink || [[9.375, 11.015625]]).some(([a, b]) => t >= a && t < b));
    // the chip's meter breathes on the beat
    const bars = $('chip').querySelectorAll('.eq i'), ph = (t / R.BEAT) % 1;
    bars.forEach((b, i) => { const k = Math.exp(-((ph + i * .13) % 1) * 5); b.style.height = (25 + 75 * k) + '%'; });
  }

  let dragging = false, wasPlaying = false;
  const fromEvent = e => { const r = scrub.getBoundingClientRect(); return snap(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * D); };
  scrub.addEventListener('pointerdown', e => {
    dragging = true; wasPlaying = playing; scrub.setPointerCapture(e.pointerId);
    if (playing) setPlaying(false);
    seek(fromEvent(e));
  });
  scrub.addEventListener('pointermove', e => { if (dragging) seek(fromEvent(e)); });
  const endDrag = () => { if (!dragging) return; dragging = false; if (wasPlaying) setPlaying(true); };
  scrub.addEventListener('pointerup', endDrag);
  scrub.addEventListener('pointercancel', endDrag);

  const replay = () => { $('replay').hidden = true; t = 0; setPlaying(true); };
  $('play').onclick = () => {
    if (!playing && $('big').classList.contains('on')) return $('big').click();   // reduced motion: start from 0, like the poster button
    if (!playing && t >= D - FR * 1.5) return replay();
    setPlaying(!playing);
  };
  $('replay').onclick = replay;
  $('big').onclick = () => { $('big').classList.remove('on'); soundOn(true); };
  $('chip').onclick = () => soundOn(true);
  $('snd').onclick = () => $('snd').getAttribute('aria-pressed') === 'true' ? soundOff() : soundOn(false);
  // re-anchor the source at the current (wrapped) t: flipping src.loop mid-pass would unwrap A.time() past 15 s
  $('loop').onclick = () => { loop = !loop; $('loop').setAttribute('aria-pressed', loop); if (sound && playing) A.start(t, loop); else A.setLoop(loop); };
  $('grid').onclick = () => { const on = $('guides').classList.toggle('on'); $('grid').setAttribute('aria-pressed', on); lastUI = -1; dirty = true; };
  $('fs').onclick = () => {
    const el = stage;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { const go = el.requestFullscreen || el.webkitRequestFullscreen; if (go) { const p = go.call(el); if (p && p.catch) p.catch(() => {}); } }
  };
  document.addEventListener('fullscreenchange', resize);
  document.addEventListener('webkitfullscreenchange', resize);
  // click the picture: play/pause (delayed so a double click can mean fullscreen instead)
  // A button hides itself on the first click, so a double click on it lands its second half on the canvas: ignore that too.
  let clickT = 0, btnAt = -1e9;
  stage.addEventListener('click', e => { if (e.target.closest('button')) btnAt = e.timeStamp; });
  out.addEventListener('click', e => {
    clearTimeout(clickT);
    if (e.timeStamp - btnAt < 600) return;
    clickT = setTimeout(() => $('play').click(), 250);
  });
  stage.addEventListener('dblclick', e => { clearTimeout(clickT); if (e.target.closest('button') || e.timeStamp - btnAt < 600) return; $('fs').click(); });

  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' && e.target.closest && e.target.closest('button, a')) return;   // Space activates the focused control
    const k = e.key;
    if (k === ' ' || k === 'k' || k === 'K') { e.preventDefault(); $('play').click(); }
    else if (k === 'ArrowRight' || k === 'ArrowLeft') {
      e.preventDefault();
      if (playing) setPlaying(false);
      const dir = k === 'ArrowRight' ? 1 : -1;
      if (e.shiftKey) {
        // next/previous beat, landing on the first frame that shows the hit: ceil(T * 60)
        const f = Math.round(t * R.FPS), BF = R.BEAT * R.FPS, hf = b => Math.ceil(b * BF - 1e-9);
        let b = Math.floor(f / BF);
        if (dir > 0) while (hf(b) <= f) b++; else while (b > 0 && hf(b) >= f) b--;
        seek(hf(b) / R.FPS);
      }
      else seek(snap(t + dir * FR));
    }
    else if (k === 'Home') { e.preventDefault(); seek(0); }
    else if (k === 'End') { e.preventDefault(); seek(D - FR); }
    else if (k === 'm' || k === 'M') $('snd').click();
    else if (k === 'g' || k === 'G') $('grid').click();
    else if (k === 'f' || k === 'F') $('fs').click();
    else if (k === 'l' || k === 'L') $('loop').click();
    else if (/^[0-9]$/.test(k)) seek(snap(+k / 10 * D));
  });

  // ---- the loop ----
  let prevFrame = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = last < 0 ? 0 : Math.min(.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (playing && !dragging) {
      const at = sound ? A.time() : null;
      if (at !== null && at !== undefined) t = at;
      else t += dt;
      if (t >= D) {
        if (loop) t %= D;
        else { t = D - FR; setPlaying(false); $('replay').hidden = false; }
      }
      dirty = true;
    }
    if (!dirty) { prevFrame = 0; return; }
    dirty = false;
    R.renderAt(t);
    if (playing && !dragging && prevFrame) adapt(now - prevFrame);
    prevFrame = playing ? now : 0;
    ui();
  }

  let audioReady;
  window.__reel = {
    ready: (async () => {
      await Promise.all(fonts.map(([f, w, st]) => document.fonts.load(`${st ? st + ' ' : ''}${w} 64px "${f}"`)));
      for (const f of FILES) {
        if (only && /\/scenes\//.test(f) && !only.split(',').some(o => f.endsWith('/' + o + '.js'))) continue;
        await load(f);
      }
      for (const f of (q.get('extra') || '').split(',').filter(Boolean)) await load(f);   // test stand-ins for unbuilt neighbours
      audioReady = A.render().catch(e => console.warn('audio', e));   // the offline render overlaps shader compile and setup
      await R.assetsReady();                                   // images the scenes asked for (Reel.preload)
      R.initOutput(out, { preserve: EXPORT });
      resize();
      R.setup();
      if (EXPORT) return true;
      buildScrub();
      addEventListener('resize', resize);
      new ResizeObserver(resize).observe(stage);
      setPlaying(playing);
      $('chip').hidden = reduced;
      $('fs').hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);   // iPhone: no element fullscreen
      if (reduced && !q.has('t')) { t = R.poster || CFG.poster || 14.5; $('big').classList.add('on'); }
      requestAnimationFrame(tick);
      return true;
    })(),
    // export hooks: render one exact frame; get the soundtrack as base64 WAV
    seek(x) { t = x; R.renderAt(x); return true; },
    async wav() {
      await audioReady;
      const b = new Uint8Array(A.wav());
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return btoa(s);
    },
    get t() { return t; },
  };
})();
