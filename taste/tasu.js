/* tasu.js: progressive enhancement for tasu.ai. Load it with <script src="/taste/tasu.js" defer>.
   Every page is complete HTML without it. It adds the theme toggle, "/" to search, the row/grid
   toggle, strip arrows, hero parallax, reveal on scroll, instant filtering, the mascot loops'
   pause rule, copy buttons (hex values, the style prompt) and the paywall captures' arrows.
   Markup contract: _tools/template-notes.md. No dependencies. */
(function () {
  'use strict';

  var d = document;
  var root = d.documentElement;
  var THEME_KEY = 'tasu-theme';
  var VIEW_KEY = 'tasu-view';
  var BG = { light: '#F3EFE7', dark: '#1C1B19' };
  var EASE = 'cubic-bezier(.22, 1, .36, 1)';

  function mq(q) {
    return window.matchMedia ? window.matchMedia(q) : { matches: false };
  }
  function onChange(m, fn) {
    if (m.addEventListener) m.addEventListener('change', fn);
    else if (m.addListener) m.addListener(fn);
  }
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var osDark = mq('(prefers-color-scheme: dark)');
  var finePointer = mq('(hover: hover) and (pointer: fine)');

  var store = {
    get: function (k) {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, v); } catch (e) { /* private mode: the choice lasts for this page */ }
    }
  };

  function all(sel, scope) {
    return Array.prototype.slice.call((scope || d).querySelectorAll(sel));
  }
  function closest(el, sel) {
    return el && el.closest ? el.closest(sel) : null;
  }

  root.classList.add('js');

  /* 1. Theme: follows the OS until the toggle is used, then remembers the choice. ----------- */
  function theme() {
    return root.getAttribute('data-theme') || (osDark.matches ? 'dark' : 'light');
  }
  function syncThemeUI() {
    var dark = theme() === 'dark';
    all('[data-theme-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', String(dark)); });
  }
  function setTheme(t) {
    function apply() {
      root.setAttribute('data-theme', t);
      all('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', BG[t]); });
      syncThemeUI();
    }
    if (d.startViewTransition) {
      d.startViewTransition(apply);
    } else {
      root.classList.add('theme-fade');
      apply();
      setTimeout(function () { root.classList.remove('theme-fade'); }, 260);
    }
    store.set(THEME_KEY, t);
  }
  d.addEventListener('click', function (e) {
    if (closest(e.target, '[data-theme-toggle]')) setTheme(theme() === 'dark' ? 'light' : 'dark');
  });
  onChange(osDark, function () {
    if (!root.hasAttribute('data-theme')) syncThemeUI();
  });
  syncThemeUI();

  /* 2. Keyboard: "/" focuses the search field in view, Escape clears it. ---------------- */
  var SEARCH = '[data-filter-search], [data-site-search]';
  function isTyping(el) {
    return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }
  function visible(el) {
    return el.getClientRects().length > 0;
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  d.addEventListener('keydown', function (e) {
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.defaultPrevented && !isTyping(e.target)) {
      var fields = all(SEARCH).filter(visible);
      if (!fields.length) return;
      var main = d.querySelector('[data-filter-main] [data-filter-search]');
      var field = fields.filter(inView)[0] || (main && visible(main) ? main : fields[0]);
      e.preventDefault();
      field.focus();
      field.select();
    } else if (e.key === 'Escape' && e.target.matches && e.target.matches(SEARCH)) {
      var f = e.target;
      e.preventDefault();
      if (f.value) {
        f.value = '';
        f.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        f.blur();
      }
    }
  });

  /* 3. Row or grid view, remembered. The head snippet sets data-view before paint. --------- */
  function setView(v) {
    root.setAttribute('data-view', v);
    all('[data-view-set]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view-set') === v));
    });
  }
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-view-set]');
    if (!b) return;
    var v = b.getAttribute('data-view-set') === 'grid' ? 'grid' : 'row';
    if (v === root.getAttribute('data-view')) return;
    var before = b.getBoundingClientRect().top;
    function apply() {
      setView(v);
      window.scrollBy(0, b.getBoundingClientRect().top - before); // keep the toggle under the pointer
    }
    if (d.startViewTransition) d.startViewTransition(apply);
    else apply();
    store.set(VIEW_KEY, v);
  });
  setView(root.getAttribute('data-view') === 'grid' ? 'grid' : 'row');

  /* 4. Strips: arrow buttons page through whole screens, scroll snap does the rest. -------- */
  all('[data-strip]').forEach(function (strip) {
    var track = strip.querySelector('.strip-track');
    if (!track) return;
    var prev = strip.querySelector('[data-strip-prev]');
    var next = strip.querySelector('[data-strip-next]');
    var queued = false;
    function update() {
      queued = false;
      var max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 1;
      if (next) next.disabled = track.scrollLeft >= max - 1;
    }
    function queue() {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }
    function page(dir) {
      var shot = track.querySelector('.screen');
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var w = shot ? shot.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      var n = Math.max(1, Math.floor((track.clientWidth + gap) / w) - 1); // keep one screen for context
      track.scrollBy({ left: dir * n * w, behavior: reduce.matches ? 'auto' : 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { page(-1); });
    if (next) next.addEventListener('click', function () { page(1); });
    track.addEventListener('scroll', queue, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(queue).observe(track);
    update();
  });

  /* 5. Hero parallax: pointer and scroll, mouse only, off for reduced motion. ------------- */
  var scene = d.querySelector('[data-parallax]');
  if (scene && finePointer.matches && !reduce.matches) {
    var tx = 0, ty = 0, px = 0, py = 0, sy = window.scrollY || 0, raf = 0, live = true;
    var frame = function () {
      raf = 0;
      px += (tx - px) * 0.1;
      py += (ty - py) * 0.1;
      if (Math.abs(tx - px) < 0.001) px = tx;
      if (Math.abs(ty - py) < 0.001) py = ty;
      scene.style.setProperty('--px', px.toFixed(4));
      scene.style.setProperty('--py', py.toFixed(4));
      scene.style.setProperty('--sy', sy.toFixed(1));
      if (px !== tx || py !== ty) raf = requestAnimationFrame(frame); // stops once it settles
    };
    var kick = function () {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    window.addEventListener('pointermove', function (e) {
      if (!live || e.pointerType !== 'mouse') return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
    }, { passive: true });
    window.addEventListener('scroll', function () {
      if (!live) return;
      sy = window.scrollY;
      kick();
    }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { live = es[0].isIntersecting; }).observe(scene);
    }
    onChange(reduce, function () {
      if (!reduce.matches) return;
      live = false;
      ['--px', '--py', '--sy'].forEach(function (p) { scene.style.removeProperty(p); });
    });
  }

  /* 6. Reveal on scroll. Only blocks that start below the fold are hidden, and only here, so
        nothing stays hidden when this file fails to load. Rows stagger by 30ms. ------------ */
  if ('IntersectionObserver' in window) {
    var pending = all('[data-reveal]').filter(function (el) {
      return el.getBoundingClientRect().top > window.innerHeight;
    });
    if (pending.length) {
      var io = new IntersectionObserver(function (entries) {
        var i = 0;
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          io.unobserve(el);
          el.style.transitionDelay = Math.min(i++, 10) * 30 + 'ms';
          el.classList.remove('reveal-pending');
          setTimeout(function () { el.style.transitionDelay = ''; }, 600);
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      pending.forEach(function (el) {
        el.classList.add('reveal-pending');
        io.observe(el);
      });
      window.addEventListener('beforeprint', function () {
        pending.forEach(function (el) { el.classList.remove('reveal-pending'); });
      });
    }
  }

  /* 7. Filter and search engine. ---------------------------------------------------------
     <section data-filter [data-filter-main] [data-filter-url] data-noun-one="app" data-noun-many="apps">
       <input type="search" data-filter-search>
       <button class="chip" data-filter-chip="all" aria-pressed="true">All <span class="chip-count">12</span></button>
       <p data-filter-status aria-live="polite">12 apps</p>
       <li data-filter-item data-tags="health-fitness" data-text="cal ai calorie tracker">
       <div data-filter-empty hidden> ... <button data-filter-reset>Show all apps</button></div>
     Every word typed must start a word of data-text (or of the item's text). Chip counts follow the
     search. data-filter-url keeps ?q= and ?tag= in the address bar, and reads them on load.
     data-filter-main receives what is typed in the header search. */
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ').replace(/[^a-z0-9$#.%]+/g, ' ').trim();
  }
  function initFilter(scope) {
    var input = scope.querySelector('[data-filter-search]');
    var chips = all('[data-filter-chip]', scope);
    var status = scope.querySelector('[data-filter-status]');
    var empty = scope.querySelector('[data-filter-empty]');
    var one = scope.getAttribute('data-noun-one') || 'item';
    var many = scope.getAttribute('data-noun-many') || one + 's';
    var items = all('[data-filter-item]', scope).map(function (el) {
      return {
        el: el,
        tags: (el.getAttribute('data-tags') || '').split(/\s+/).filter(Boolean),
        text: ' ' + norm(el.getAttribute('data-text') || el.textContent)
      };
    });
    var total = items.length;
    var tag = 'all';
    var query = '';
    var useURL = scope.hasAttribute('data-filter-url');

    function render(animate) {
      var words = norm(query).split(' ').filter(Boolean);
      var counts = { all: 0 };
      var shown = 0;
      var k = 0;
      items.forEach(function (it) {
        var hit = words.every(function (w) { return it.text.indexOf(' ' + w) !== -1; });
        if (hit) {
          counts.all++;
          it.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
        }
        var show = hit && (tag === 'all' || it.tags.indexOf(tag) !== -1);
        if (show) shown++;
        if (it.el.hidden === show) {
          it.el.hidden = !show;
          if (show && animate && it.el.animate) {
            it.el.animate(
              reduce.matches
                ? [{ opacity: 0 }, { opacity: 1 }]
                : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
              { duration: 200, delay: Math.min(k++, 10) * 30, easing: EASE, fill: 'backwards' }
            );
          }
        }
      });
      chips.forEach(function (c) {
        var key = c.getAttribute('data-filter-chip');
        c.setAttribute('aria-pressed', String(key === tag));
        var n = c.querySelector('.chip-count');
        if (n) n.textContent = String(counts[key] || 0);
      });
      var noun = total === 1 ? one : many;
      if (status) status.textContent = shown === total ? total + ' ' + noun : shown + ' of ' + total + ' ' + noun;
      if (empty) empty.hidden = shown !== 0;
    }
    function syncURL() {
      if (!useURL || !window.history || !history.replaceState) return;
      var u = new URL(window.location.href);
      if (query) u.searchParams.set('q', query); else u.searchParams.delete('q');
      if (tag !== 'all') u.searchParams.set('tag', tag); else u.searchParams.delete('tag');
      history.replaceState(history.state, '', u);
    }
    function update() {
      render(true);
      syncURL();
    }

    if (input) input.addEventListener('input', function () { query = input.value; update(); });
    chips.forEach(function (c, i) {
      c.addEventListener('click', function () { tag = c.getAttribute('data-filter-chip'); update(); });
      c.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        chips[(i + dir + chips.length) % chips.length].focus();
      });
    });
    all('[data-filter-reset]', scope).forEach(function (b) {
      b.addEventListener('click', function () {
        tag = 'all';
        query = '';
        if (input) { input.value = ''; input.focus(); }
        update();
      });
    });
    if (useURL) {
      var p = new URLSearchParams(window.location.search);
      if (p.get('q')) { query = p.get('q'); if (input) input.value = query; }
      var t = p.get('tag');
      if (t && chips.some(function (c) { return c.getAttribute('data-filter-chip') === t; })) tag = t;
    }
    render(false);

    return {
      scope: scope,
      input: input,
      setQuery: function (q) {
        query = q;
        if (input) input.value = q;
        update();
      }
    };
  }

  var filters = all('[data-filter]').map(initFilter);
  var main = filters.filter(function (f) { return f.scope.hasAttribute('data-filter-main'); })[0];

  /* The header search filters the main list in place. Without one, the form goes to /taste/?q=. */
  if (main) {
    all('[data-site-search]').forEach(function (field) {
      field.addEventListener('input', function () { main.setQuery(field.value); });
      if (field.form) {
        field.form.addEventListener('submit', function (e) {
          e.preventDefault();
          main.setQuery(field.value);
          main.scope.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
          if (main.input) main.input.focus({ preventScroll: true });
        });
      }
    });
  }

  /* 8. Mascot loops: each loop pauses while it is off screen, and all of them while the tab is
        hidden. .is-paused keeps the frame, so a loop resumes where it stopped. ------------ */
  var loops = all('.tasu-loop');
  if (loops.length) {
    var onScreen = typeof WeakMap === 'function' ? new WeakMap() : null;
    var syncLoop = function (el) {
      var seen = onScreen ? onScreen.get(el) !== false : true;
      el.classList.toggle('is-paused', d.hidden || !seen);
    };
    if ('IntersectionObserver' in window && onScreen) {
      var loopIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          onScreen.set(en.target, en.isIntersecting);
          syncLoop(en.target);
        });
      });
      loops.forEach(function (el) { loopIO.observe(el); });
    }
    d.addEventListener('visibilitychange', function () { loops.forEach(syncLoop); });
    loops.forEach(syncLoop);
  }

  /* 9. Copy buttons. data-copy="text" copies that text; data-copy-target="#id" copies the text
        of that element. The label reads "Copied" for 1.6s, and a live region says it. ------ */
  var live = d.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  d.body.appendChild(live);
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      var t = d.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      d.body.appendChild(t);
      t.select();
      try { if (d.execCommand('copy')) ok(); else fail(); } catch (err) { fail(err); }
      d.body.removeChild(t);
    });
  }
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-copy], [data-copy-target]');
    if (!b) return;
    var src = b.getAttribute('data-copy-target');
    var node = src ? d.querySelector(src) : null;
    var text = node ? node.textContent.replace(/\s+/g, ' ').trim() : b.getAttribute('data-copy');
    if (!text) return;
    var label = b.querySelector('[data-copy-label]') || b;
    copyText(text).then(function () {
      if (!b.hasAttribute('data-label')) b.setAttribute('data-label', label.textContent);
      label.textContent = 'Copied';
      b.classList.add('is-copied');
      live.textContent = src ? 'Prompt copied' : text + ' copied';
      clearTimeout(b._copyTimer);
      b._copyTimer = setTimeout(function () {
        label.textContent = b.getAttribute('data-label');
        b.classList.remove('is-copied');
      }, 1600);
    }, function () {
      live.textContent = 'Copy failed. Select the text to copy it.';
    });
  });

  /* 10. Paywall captures inside the phone frame: arrows and a "1 of 5" count. ------------ */
  all('[data-phone]').forEach(function (track) {
    var fig = closest(track, 'figure') || track.parentNode;
    var nav = fig.querySelector('[data-phone-nav]');
    if (!nav) return;
    var prev = nav.querySelector('[data-phone-prev]');
    var next = nav.querySelector('[data-phone-next]');
    var count = nav.querySelector('[data-phone-count]');
    var n = track.children.length;
    var queued = false;
    function index() {
      return Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    }
    function update() {
      queued = false;
      var i = Math.min(n - 1, Math.max(0, index()));
      if (count) count.textContent = (i + 1) + ' of ' + n;
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= n - 1;
    }
    function go(dir) {
      var i = Math.min(n - 1, Math.max(0, index() + dir));
      track.scrollTo({ left: i * track.clientWidth, behavior: reduce.matches ? 'auto' : 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        go(e.key === 'ArrowRight' ? 1 : -1);
      }
    });
    track.addEventListener('scroll', function () {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  });

  window.tasu = { theme: theme, setTheme: setTheme, setView: setView, filters: filters };
})();
