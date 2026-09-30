/* s8: the tally chip and the corner identity tag. A true count at the top left that ticks with every arrival
   (odometer rolls, a plural that pops), and `jeremylasne.com` in the top right for the first 3.84 s.
   Sits on top of everything (layer 10). Never writes R.fx. Every frame is a pure function of t (all closed form). */
(() => {
  const R = Reel, E = R.ease;

  // ---- time on the grid ----
  const B = 0.46875, S16 = B / 4, S32 = B / 8, S128 = B / 32, S256 = B / 64, S512 = B / 128;
  const T = {
    chip: R.at(1, 1) + S32,                 // 0.0586  the chip enters
    tagIn: R.at(1, 2),                      // 0.4688  the tag enters after the last landing (the falling H, O and P used to cross it)
    fall: R.at(1, 4),                       // 1.40625 they fall away with the type
    flip: R.at(2, 1),                       // 1.875   the world flips: ICE, `2 projects`
    plural2: R.at(2, 1, 2),                 // 1.9922  the `s` of `2 projects`
    tagSink: R.at(3, 1),                    // 3.75    the tag sinks with the lockup
    apps: R.at(4, 1),                       // 5.625   section change: `1 mobile app`
    appTick: [R.at(4, 1, 2), R.at(4, 1, 3), R.at(4, 1, 4)],   // 5.7422 5.8594 5.9766  counts 2, 3, 4
    pers: R.at(6, 1),                       // 9.375   section change: `1 personal project`
    persTick: [R.at(6, 2), R.at(6, 3), R.at(6, 3, 3)],        // 9.84375 10.3125 10.546875  counts 2, 3, 4
    chipOut: R.at(7, 1, 2),                 // 11.3672 the chip leaves
    end: R.at(7, 1, 4),                     // 11.6016
  };

  // ---- layout (logical px) ----
  const BASE = 150, LEFT = 96, DIGIT_BOX = 49, WORD_X = 165;
  const CLIP = { x: 80, y: 68, w: 820, h: 106 };               // every roll and rise is clipped to this window
  const TAG = { size: 44, right: 1824, clip: { x: 1380, y: 68, w: 480, h: 106 } };
  const SHOP = R.C.shopInk, ICE = R.C.ice;

  // ---- the sections of the count: word, plural, arrival of its own line, its exit, its ladder of digit rolls ----
  //   glyph index i: 0 = the digit slot, 1..L = the letters of the word (spaces skipped), L + 1 = the plural `s`
  const SECTIONS = [
    { word: 'project', plural: false, digit: 1, enter: T.chip, exit: { kind: 'fall', at: T.fall }, end: T.fall + .2 },
    { word: 'project', plural: true, digit: 2, enter: T.flip + 1 / 60, pop: T.plural2, exit: { kind: 'up', at: T.apps }, end: T.apps + .35 },
    { word: 'mobile app', plural: true, digit: 1, enter: T.apps, pop: T.appTick[0], ticks: T.appTick, roll: .109375, exit: { kind: 'up', at: T.pers }, end: T.pers + .35 },
    { word: 'personal project', plural: true, digit: 1, enter: T.pers, pop: T.persTick[0], ticks: T.persTick, roll: .15625, exit: { kind: 'fallR', at: T.chipOut }, end: T.end },
  ];
  // the section 0 line is drawn from its own start; the window a section occupies on screen
  SECTIONS[0].from = T.chip; SECTIONS[1].from = T.flip; SECTIONS[2].from = T.apps; SECTIONS[3].from = T.pers;

  // glyph origins with the kern pair BEFORE each glyph included: origin i = width(prefix through i) - width(i) + i * tracking
  // (R.glyphs measures the prefix that excludes glyph i, so every kern pair lands one glyph late)
  const kernGlyphs = (c, str, tr) => { const ch = Array.from(str), w = s => c.measureText(s).width; let pre = '';
    return { chars: ch.map((g, i) => { pre += g; return { ch: g, x: w(pre) - w(g) + i * tr, w: w(g), i }; }), width: w(str) + (ch.length - 1) * tr }; };
  let placed = null;      // glyph x positions per section (measured after fonts load)
  const measure = () => {
    if (placed) return;
    const c = document.createElement('canvas').getContext('2d');
    placed = SECTIONS.map(sec => {
      R.font(c, 72, 'sans', 700);
      const full = sec.word + 's';
      const g = kernGlyphs(c, full, 0);
      const letters = [];
      g.chars.forEach(ch => { if (ch.ch !== ' ') letters.push({ ch: ch.ch, x: WORD_X + ch.x }); });
      // letters: the word's glyphs, then the `s` (last)
      const word = letters.slice(0, letters.length - 1), s = letters[letters.length - 1];
      R.font(c, 72, 'sans', 800);
      const dig = {};
      for (const d of '01234') dig[d] = R.textWidth(c, d, 0);
      return { word, s, dig };
    });
    R.font(c, 44, 'mono', 500);
    placed.tagW = R.textWidth(c, 'jeremylasne.com', 0);
  };

  // ---- pieces of motion ----
  const rise = (t, t0) => 112 * (1 - E.outExpo(R.prog(t, t0, t0 + .18)));

  // vertical offset of glyph i of a section from the arrival and the exit of its line (px, + = down)
  function lineOffset(sec, i, n, t) {
    let y = 0;
    y += rise(t, sec.enter + Math.min(i, n) * .014);                // the plural `s` (i = n + 1) is drawn only by its pop and rides with the last letter
    const ex = sec.exit;
    if (ex.kind === 'fall') y += 90 * E.inQuart(R.prog(t, ex.at + (n - i) * S128, ex.at + (n - i) * S128 + .09));   // right to left, n = 8 glyphs (0..7)
    else if (ex.kind === 'up') y -= 112 * E.outQuart(R.prog(t, ex.at, ex.at + .11));   // fast start: the old glyph is a full line height clear of the arriving one on every frame
    else y += 90 * E.inQuart(R.prog(t, ex.at + i * S256, ex.at + i * S256 + .09));
    return y;
  }

  // the digit slot: the digit at rest, or the leaving and entering digits of a roll
  function digitStates(sec, t) {
    const out = [];
    if (!sec.ticks) { out.push({ d: sec.digit, y: 0, a: 1 }); return out; }
    let cur = sec.digit;
    for (let k = 0; k < sec.ticks.length; k++) {
      const t0 = sec.ticks[k], p = R.prog(t, t0, t0 + sec.roll);
      if (t < t0) break;
      const next = sec.digit + k + 1;
      if (p >= 1) { cur = next; continue; }
      out.push({ d: cur, y: -100 * E.outQuart(Math.min(1, p / .6)), a: 1 - p });   // the old digit leaves fast (never shares the slot with the new one)
      out.push({ d: next, y: 80 * (1 - E.outBack(p, 1.2)), a: 1 });           // the new one comes from below and settles
      return out;
    }
    out.push({ d: cur, y: 0, a: 1 });
    return out;
  }

  function drawChip(ctx, t) {
    let si = -1;
    for (let k = 0; k < SECTIONS.length; k++) {
      // a section is on screen from its own start to the end of its exit
      const s = SECTIONS[k];
      if (t >= s.from && t < s.end) { si = k; }
    }
    // during a section change two sections are on screen (the old one leaving, the new one arriving)
    const col = t < T.flip ? SHOP : ICE;
    ctx.save();
    ctx.beginPath(); ctx.rect(CLIP.x, CLIP.y, CLIP.w, CLIP.h); ctx.clip();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    // 5.13 to 5.27: the cream TL petal of s3 passes behind the last letters of `2 projects`; a dark rim keeps them readable
    const rim = R.prog(t, 5.1328, 5.1445) * (1 - R.prog(t, 5.2617, 5.2734));
    const put = (str, x, y) => {
      if (rim > .01) { const a = ctx.globalAlpha; ctx.globalAlpha = a * .8 * rim; ctx.strokeStyle = '#050b16'; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); ctx.globalAlpha = a; }
      ctx.fillText(str, x, y);
    };
    for (let k = 0; k < SECTIONS.length; k++) {
      const sec = SECTIONS[k];
      if (t < sec.from || t >= sec.end) continue;
      const P = placed[k], L = P.word.length, n = L;                       // glyphs 0..L (digit + letters); the `s` is L + 1
      // digit
      const nDigits = sec.ticks ? 1 : 1;
      R.font(ctx, 72, 'sans', 800);
      ctx.fillStyle = col;
      const base = lineOffset(sec, 0, n, t);
      for (const ds of digitStates(sec, t)) {
        ctx.globalAlpha = ds.a;
        put(String(ds.d), LEFT + (DIGIT_BOX - P.dig[ds.d]) / 2, BASE + base + ds.y);
      }
      // the word
      R.font(ctx, 72, 'sans', 700);
      ctx.globalAlpha = .84;
      for (let i = 0; i < L; i++) {
        const y = lineOffset(sec, i + 1, n, t);
        if (y > 100 || y < -100) continue;
        put(P.word[i].ch, P.word[i].x, BASE + y);
      }
      // the plural `s`: only its pop, then it travels with the line
      if (sec.plural) {
        const p = R.prog(t, sec.pop, sec.pop + .18);
        if (t >= sec.pop) {
          const sc = E.outBack(p, 1.6), y = lineOffset(sec, L + 1, n, t);
          ctx.save(); ctx.translate(P.s.x, BASE + y); ctx.scale(sc, sc);
          put(P.s.ch, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  function drawTag(ctx, t) {
    let y, a = 1;
    if (t < T.flip) {
      if (t < T.tagIn || t >= T.fall + .1) return;
      y = 90 * (1 - E.outExpo(R.prog(t, T.tagIn, T.tagIn + .18))) + 90 * E.inQuart(R.prog(t, T.fall, T.fall + .0898));
    } else {
      if (t >= T.tagSink + .09) return;
      const q = R.prog(t, T.tagSink, T.tagSink + .09);
      y = 90 * (1 - E.outExpo(R.prog(t, T.flip, T.flip + .18))) + 44 * E.inQuart(q);
      a = 1 - q;
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(TAG.clip.x, TAG.clip.y, TAG.clip.w, TAG.clip.h); ctx.clip();
    R.font(ctx, TAG.size, 'mono', 500);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right';
    ctx.fillStyle = t < T.flip ? R.rgba(SHOP, .72) : R.rgba(ICE, .62 * a);
    ctx.fillText('jeremylasne.com', TAG.right, BASE + y);
    ctx.restore();
  }

  R.scene({
    id: 's8', start: 0, end: T.end, layer: 10,
    setup() { measure(); },
    draw(ctx, t) {
      if (!placed) measure();
      drawChip(ctx, t);
      drawTag(ctx, t);
    },
  });
})();
