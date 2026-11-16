/* design.js: the style guide builder of /taste/design/. Load it with <script src="/taste/design.js" defer>.
   It reads #design-data (each app's 3 colors with their 60/30/10 roles and its 2 free fonts),
   lets people start from an app, assign colors from the library to the 3 roles, match the other
   2 from the main color, pick 2 fonts and the corners, then shows a preview and writes the prompt.
   Copy buttons use tasu.js (data-copy-target). No dependencies. */
(function () {
  'use strict';
  var d = document;
  var root = d.querySelector('[data-builder]');
  var src = d.getElementById('design-data');
  if (!root || !src) return;
  var apps;
  try { apps = JSON.parse(src.textContent); } catch (e) { return; }
  if (!apps.length) return;

  /* ---- colors: WCAG contrast, RGB, saturation ---- */
  function rgb(hex) {
    var h = hex.replace('#', '');
    return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
  }
  function lum(hex) {
    var c = rgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function sat(hex) {
    var c = rgb(hex), mx = Math.max.apply(null, c), mn = Math.min.apply(null, c);
    return mx === 0 ? 0 : (mx - mn) / mx;
  }
  function ink(hex) { return contrast(hex, '#1C1B19') >= contrast(hex, '#FFFFFF') ? '#1C1B19' : '#FFFFFF'; }
  function ratio(n) { return (Math.round(n * 10) / 10).toFixed(1) + ':1'; }

  // The library: every app color once per app, with the app it comes from.
  var library = [];
  apps.forEach(function (a) {
    a.colors.forEach(function (c) { library.push({ hex: c.hex, name: c.name, app: a.name, slug: a.slug }); });
  });
  // The fonts: each app's headline and body free fonts, one entry per family and weight.
  function fontList(role) {
    var seen = {}, out = [];
    apps.forEach(function (a) {
      var f = a[role];
      if (!f) return;
      var k = f.family + '|' + f.weight;
      if (seen[k]) { seen[k].apps.push(a.name); seen[k].real[a.name] = f.real; return; }
      seen[k] = { family: f.family, weight: f.weight, real: {}, apps: [a.name] };
      seen[k].real[a.name] = f.real;
      out.push(seen[k]);
    });
    return out;
  }
  var fonts = { headline: fontList('headline'), body: fontList('body') };

  var ROLES = [
    { key: 'main', share: 60, label: 'Main', job: 'Backgrounds and large surfaces' },
    { key: 'second', share: 30, label: 'Second', job: 'Text, icons and cards' },
    { key: 'accent', share: 10, label: 'Accent', job: 'The main button, the selected state, 1 key number' }
  ];
  var state = { main: null, second: null, accent: null, headline: 0, body: 0, radius: 16, slot: 'main', from: null };

  function fromApp(a) {
    var by = {};
    a.colors.forEach(function (c) { by[c.role] = { hex: c.hex, name: c.name, app: a.name }; });
    state.main = by['60'];
    state.second = by['30'];
    state.accent = by['10'];
    state.from = a.name;
    if (a.headline) state.headline = Math.max(0, fonts.headline.findIndex(function (f) { return f.family === a.headline.family && f.weight === a.headline.weight; }));
    if (a.body) state.body = Math.max(0, fonts.body.findIndex(function (f) { return f.family === a.body.family && f.weight === a.body.weight; }));
  }

  // Match: keep the main color, take the library color with the best text contrast as Second
  // (neutrals first), and the most saturated color that still reads on the main one as Accent.
  function match() {
    var m = state.main.hex;
    var second = library.filter(function (c) { return contrast(c.hex, m) >= 4.5; })
      .sort(function (x, y) { return (contrast(y.hex, m) - sat(y.hex) * 8) - (contrast(x.hex, m) - sat(x.hex) * 8); })[0];
    var accent = library.filter(function (c) { return contrast(c.hex, m) >= 3 && sat(c.hex) > 0.35 && (!second || c.hex !== second.hex); })
      .sort(function (x, y) { return (sat(y.hex) * 2 + Math.min(contrast(y.hex, m), 7) / 7) - (sat(x.hex) * 2 + Math.min(contrast(x.hex, m), 7) / 7); })[0];
    if (second) state.second = { hex: second.hex, name: second.name, app: second.app };
    if (accent) state.accent = { hex: accent.hex, name: accent.name, app: accent.app };
    state.from = null;
  }

  /* ---- markup ---- */
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var el = function (sel) { return root.querySelector(sel); };

  el('[data-palettes]').innerHTML = apps.map(function (a, i) {
    return '<button class="bd-pal" type="button" data-app="' + i + '" aria-pressed="false">' +
      '<img src="' + esc(a.icon) + '" width="28" height="28" alt="">' +
      '<span class="bd-pal-name">' + esc(a.name) + '</span>' +
      '<span class="bd-pal-dots" aria-hidden="true">' + a.colors.map(function (c) { return '<span style="--c:' + c.hex + '"></span>'; }).join('') + '</span></button>';
  }).join('');

  el('[data-library]').innerHTML = apps.map(function (a) {
    return '<div class="bd-lib-app"><p>' + esc(a.name) + '</p><div>' + a.colors.map(function (c) {
      return '<button class="bd-sw" type="button" style="--c:' + c.hex + '" data-hex="' + c.hex + '" data-name="' + esc(c.name) + '" data-from="' + esc(a.name) +
        '" aria-label="' + esc(c.name + ', ' + c.hex + ', from ' + a.name) + '" title="' + esc(c.name + ' ' + c.hex) + '"></button>';
    }).join('') + '</div></div>';
  }).join('');

  ['headline', 'body'].forEach(function (role) {
    el('[data-font="' + role + '"]').innerHTML = fonts[role].map(function (f, i) {
      var label = f.family + ' ' + f.weight + ', used by ' + f.apps.join(', ');
      return '<option value="' + i + '">' + esc(label) + '</option>';
    }).join('');
  });

  /* ---- render ---- */
  function slotsHTML() {
    return ROLES.map(function (r) {
      var c = state[r.key];
      return '<button class="bd-slot" type="button" data-slot="' + r.key + '" aria-pressed="' + (state.slot === r.key) + '" style="--c:' + c.hex + ';--ink:' + ink(c.hex) + '">' +
        '<span class="bd-slot-role">' + r.label + ', ' + r.share + '%</span>' +
        '<span class="bd-slot-name">' + esc(c.name) + '</span>' +
        '<span class="bd-slot-hex">' + c.hex + '</span></button>';
    }).join('');
  }
  function posterHTML() {
    return ROLES.map(function (r) {
      var c = state[r.key];
      return '<span class="mp mp-' + r.share + '" style="--c:' + c.hex + ';--ink:' + ink(c.hex) + '"><span class="mp-pct">' + r.share + '%</span><span class="mp-hex">' + c.hex + '</span></span>';
    }).join('');
  }
  function promptText() {
    var h = fonts.headline[state.headline], b = fonts.body[state.body];
    var line = function (r) {
      var c = state[r.key], v = rgb(c.hex);
      return '- ' + r.label + ' color, ' + r.share + '%: ' + c.name + ' ' + c.hex + ' (RGB ' + v.join(', ') + '). ' + r.job + '.';
    };
    var t2 = contrast(state.second.hex, state.main.hex), ta = contrast(state.accent.hex, state.main.hex);
    // The real font it stands for, when the palette comes from an app that uses it.
    var fontName = function (f) {
      var real = state.from ? f.real[state.from] : null;
      return f.family + ' ' + f.weight + (real && real !== f.family ? ', close to ' + real + ' (' + state.from + ')' : '');
    };
    return [
      'Build my app\'s style guide, then apply it. Keep my features, data and copy.',
      '',
      'My picks' + (state.from ? ', starting from ' + state.from + '\'s palette:' : ':'),
      ROLES.map(line).join('\n'),
      '- Contrast: second on main ' + ratio(t2) + ', accent on main ' + ratio(ta) + '. Text needs 4.5:1, large text and icons 3:1.',
      '- Headline font: ' + fontName(h) + '. Body font: ' + fontName(b) + '. Backup: the system font.',
      '- Corners: ' + state.radius + ' pt on cards and sheets, full pills on buttons.',
      '',
      'Follow 6 principles:',
      '1. A number in every rule: "2 fonts", "3 colors per screen", "1 main button".',
      '2. A role for every element: each color and font has 1 job, written next to it.',
      '3. A closed set: only these 3 colors, 2 fonts and 1 corner scale, plus neutrals. Repeat them.',
      '4. A don\'t for every rule: write what never happens.',
      '5. A version for every context: light and dark, the icon in color and in 1 color.',
      '6. One sample screen that shows every rule at once.',
      '',
      'Write DESIGN.md with 5 sections, in this order:',
      '1. Colors: role, HEX, RGB, share, the pairs that work and their contrast.',
      '2. Type: the 2 fonts and the backup, then title, subtitle, body and caption with size, weight and line height.',
      '3. Icon: full color, 1 color, on light and on dark, checked at home screen and search result sizes.',
      '4. Components: buttons, cards, inputs and tabs with sizes, corners, spacing and 3 states.',
      '5. Composition: 1 sample screen with 5 rules: 1 hero, 3 colors, 1 main button, equal margins, fixed spots for the title and the tabs.',
      'Under each section, write 3 don\'ts.',
      '',
      'Then apply DESIGN.md to every screen, one screen at a time.',
      '',
      'Check:',
      '- Every color in the code is one of the 3 tokens or a neutral.',
      '- Every text uses one of the 4 type levels.',
      '- A new screen built from DESIGN.md alone is right on the first try.'
    ].join('\n');
  }
  function render() {
    el('[data-slots]').innerHTML = slotsHTML();
    el('[data-poster]').innerHTML = posterHTML();
    var m = state.main.hex, s = state.second.hex, a = state.accent.hex;
    var t2 = contrast(s, m), ta = contrast(a, m);
    el('[data-contrast]').innerHTML =
      '<span class="' + (t2 >= 4.5 ? 'ok' : 'no') + '">Text ' + ratio(t2) + (t2 >= 4.5 ? ', passes' : ', under 4.5:1') + '.</span> ' +
      '<span class="' + (ta >= 3 ? 'ok' : 'no') + '">Accent ' + ratio(ta) + (ta >= 3 ? ', passes' : ', under 3:1') + '.</span>';
    var h = fonts.headline[state.headline], b = fonts.body[state.body];
    var pv = el('[data-preview]');
    pv.style.setProperty('--m', m);
    pv.style.setProperty('--s', s);
    pv.style.setProperty('--a', a);
    pv.style.setProperty('--on-a', ink(a));
    pv.style.setProperty('--hf', '"' + h.family + '"');
    pv.style.setProperty('--hw', h.weight);
    pv.style.setProperty('--bf', '"' + b.family + '"');
    pv.style.setProperty('--bw', b.weight);
    pv.style.setProperty('--rr', state.radius + 'px');
    pv.setAttribute('aria-label', 'Preview: ' + state.main.name + ' background, ' + state.second.name + ' text, ' + state.accent.name + ' button, ' + h.family + ' and ' + b.family);
    el('[data-font="headline"]').value = String(state.headline);
    el('[data-font="body"]').value = String(state.body);
    Array.prototype.forEach.call(root.querySelectorAll('[data-app]'), function (bt) {
      bt.setAttribute('aria-pressed', String(state.from === apps[Number(bt.getAttribute('data-app'))].name));
    });
    Array.prototype.forEach.call(root.querySelectorAll('[name="bd-r"]'), function (r) { r.checked = Number(r.value) === state.radius; });
    el('[data-prompt]').textContent = promptText();
  }

  /* ---- events ---- */
  root.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var pal = t.closest('[data-app]');
    if (pal) { fromApp(apps[Number(pal.getAttribute('data-app'))]); render(); return; }
    var slot = t.closest('[data-slot]');
    if (slot) { state.slot = slot.getAttribute('data-slot'); render(); root.querySelector('[data-slot="' + state.slot + '"]').focus(); return; }
    var sw = t.closest('[data-hex]');
    if (sw) {
      state[state.slot] = { hex: sw.getAttribute('data-hex'), name: sw.getAttribute('data-name'), app: sw.getAttribute('data-from') };
      state.from = null;
      render();
      return;
    }
    if (t.closest('[data-match]')) { match(); render(); }
  });
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('[data-font]')) { state[t.getAttribute('data-font')] = Number(t.value); render(); }
    else if (t.name === 'bd-r') { state.radius = Number(t.value); render(); }
  });

  // Start from the first app with a full palette.
  fromApp(apps.filter(function (a) { return a.colors.length === 3; })[0] || apps[0]);
  render();
})();
