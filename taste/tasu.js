/* tasu.js: progressive enhancement for tasu.ai. Load it with <script src="/taste/tasu.js" defer>.
   Every page is complete HTML without it. It adds the theme toggle, "/" to search, the row/grid
   toggle, strip arrows, hero parallax, reveal on scroll, instant filtering, the mascot loops'
   pause rule, copy buttons (hex values, prompts, code), the paywall captures' arrows, the
   wordmark's fold, the prompts' "Show all" and the screenshot downloads (one file, or all of
   them in a ZIP). The Design page's builder lives in design.js.
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
      // On the home, "/" goes to the gallery field (focus scrolls it into view), so results show
      // as you type. Elsewhere it takes the field in view.
      var main = d.querySelector('[data-filter-main] [data-filter-search]');
      var field = main && visible(main) ? main : (fields.filter(inView)[0] || fields[0]);
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
      var atStart = track.scrollLeft <= 1;
      var atEnd = track.scrollLeft >= max - 1;
      // A focused button that turns disabled drops focus to <body>. Hand it to the track first:
      // it is focusable and scrolls with the arrow keys, so keyboard users stay in the strip.
      if ((atEnd && d.activeElement === next) || (atStart && d.activeElement === prev)) track.focus({ preventScroll: true });
      if (prev) prev.disabled = atStart;
      if (next) next.disabled = atEnd;
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
    var tx = 0, ty = 0, px = 0, py = 0, sy = window.scrollY || 0, raf = 0, live = true, off = false;
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
      // Scroll events that land while the scene is off screen are skipped. After a jump back to
      // the top (Home key, a script), read the scroll again, or the cards keep the old offset.
      new IntersectionObserver(function (es) {
        live = !off && es[es.length - 1].isIntersecting; // the newest entry, if several queued up
        if (live) {
          sy = window.scrollY;
          kick();
        }
      }).observe(scene);
    }
    // Reduce Motion turned on mid-visit: the cards go back to rest and stay there.
    onChange(reduce, function () {
      if (!reduce.matches) return;
      off = true;
      live = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
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
      // Chips are toggle buttons: pressing the pressed chip again goes back to All.
      c.addEventListener('click', function () {
        var k = c.getAttribute('data-filter-chip');
        tag = k === tag && k !== 'all' ? 'all' : k;
        update();
      });
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
      if (p.get('q')) {
        query = p.get('q');
        if (input) input.value = query;
        // A search sent from another page's header shows in the header field too.
        if (scope.hasAttribute('data-filter-main')) all('[data-site-search]').forEach(function (f) { f.value = query; });
      }
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

  /* The header search filters the main list in place. Without one, the form goes to
     /taste/?q=…#apps, which opens on the gallery. */
  if (main) {
    all('[data-site-search]').forEach(function (field) {
      field.addEventListener('input', function () {
        main.setQuery(field.value);
        // The gallery sits below the fold: bring it up so the results show, and keep typing in
        // its field (it already holds the same text, with the caret at the end). This waits for
        // the keystroke to finish: the browser's own caret scroll would cut a smooth scroll short.
        if (main.scope.getBoundingClientRect().top > window.innerHeight / 2) {
          setTimeout(function () {
            if (main.input) {
              main.input.focus({ preventScroll: true });
              var end = main.input.value.length;
              try { main.input.setSelectionRange(end, end); } catch (err) { /* not a text field */ }
            }
            main.scope.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
          }, 0);
        }
      });
      // The header field mirrors the gallery field, so both always show the same search.
      var mirror = function () { if (d.activeElement !== field && main.input) field.value = main.input.value; };
      if (main.input) main.input.addEventListener('input', mirror);
      all('[data-filter-reset]', main.scope).forEach(function (b) { b.addEventListener('click', mirror); });
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
  // After a prompt is copied: one line that asks for the follow, for 6 seconds.
  var toast = null, toastTimer = 0;
  function showToast() {
    if (!toast) {
      toast = d.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.innerHTML = '<span>Copied. 2 new prompts a week:</span><a href="https://x.com/jeremylasne">@jeremylasne</a>';
      d.body.appendChild(toast);
    }
    clearTimeout(toastTimer);
    requestAnimationFrame(function () { toast.classList.add('is-on'); });
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 6000);
  }
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-copy], [data-copy-target]');
    if (!b) return;
    var src = b.getAttribute('data-copy-target');
    var node = src ? d.querySelector(src) : null;
    // data-copy-raw keeps the line breaks (prompts and code); no-break spaces become spaces.
    var raw = node ? node.textContent.replace(/\u00a0/g, ' ') : '';
    var text = node
      ? (b.hasAttribute('data-copy-raw') ? raw.replace(/[ \t]+\n/g, '\n').trim() : raw.replace(/\s+/g, ' ').trim())
      : b.getAttribute('data-copy');
    if (!text) return;
    var label = b.querySelector('[data-copy-label]') || b;
    copyText(text).then(function () {
      if (!b.hasAttribute('data-label')) b.setAttribute('data-label', label.textContent);
      label.textContent = 'Copied';
      b.classList.add('is-copied');
      live.textContent = src ? (b.getAttribute('data-copy-what') || 'Prompt') + ' copied' : text + ' copied';
      if (src) showToast();
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
      var first = i <= 0;
      var last = i >= n - 1;
      var label = (i + 1) + ' of ' + n;
      if (count && count.textContent !== label) count.textContent = label; // a live region: speak changes only
      // Keep focus in the widget when the focused arrow turns disabled (see the strips).
      if ((last && d.activeElement === next) || (first && d.activeElement === prev)) track.focus({ preventScroll: true });
      if (prev) prev.disabled = first;
      if (next) next.disabled = last;
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


  /* 11. The wordmark: "tasu.ai" unfolds into "taste using ai". On the first page of a visit it
         shows unfolded, holds 900ms, then folds in 600ms. Hover or keyboard focus on the logo
         unfolds it, leaving folds it. It unfolds only into free space, so nothing else moves.
         Reduced motion: a 200ms fade, no width change in sight. ----------------------------- */
  all('[data-wm]').forEach(function (wm) {
    var link = closest(wm, '[data-wm-link]') || wm;
    var parts = all('.wm-x, .wm-dot', wm);
    var extra = 0;
    function measure() {
      extra = 0;
      parts.forEach(function (el) {
        var prev = el.style.maxWidth;
        el.style.maxWidth = 'none';
        var w = el.scrollWidth;
        el.style.maxWidth = prev;
        el.style.setProperty(el.classList.contains('wm-dot') ? '--wd' : '--wx', w + 'px');
        if (el.classList.contains('wm-x')) extra += w;
      });
    }
    // Room after the logo: up to the next item of the header row, minus 16px of air.
    function fits() {
      var r = link.getBoundingClientRect();
      var right = window.innerWidth;
      all('.site-header .nav, .site-header .header-tools, .site-header .search--header').forEach(function (el) {
        var b = el.getBoundingClientRect();
        if (b.width && b.top < r.bottom && b.bottom > r.top && b.left >= r.right - 1) right = Math.min(right, b.left);
      });
      var open = wm.classList.contains('is-open');
      return right - r.right - 16 >= (open ? 0 : extra);
    }
    function set(open) {
      if (open && !fits()) open = false;
      wm.classList.toggle('is-open', open);
    }
    var ready = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
    ready.then(function () {
      measure();
      var first = true; // the first page of this visit (session storage off: every page)
      try { first = !sessionStorage.getItem('tasu-wm'); sessionStorage.setItem('tasu-wm', '1'); } catch (e) { /* private mode */ }
      if (first && !reduce.matches) {
        set(true); // unfolded at once, before the transitions switch on
        requestAnimationFrame(function () {
          wm.classList.add('is-ready');
          setTimeout(function () { if (!link.matches(':hover') && d.activeElement !== link) set(false); }, 900);
        });
      } else {
        requestAnimationFrame(function () { wm.classList.add('is-ready'); });
      }
      link.addEventListener('mouseenter', function () { set(true); });
      link.addEventListener('mouseleave', function () { if (d.activeElement !== link) set(false); });
      link.addEventListener('focus', function () { set(true); });
      link.addEventListener('blur', function () { set(false); });
      window.addEventListener('resize', function () { if (wm.classList.contains('is-open') && !fits()) set(false); });
    });
  });

  /* 11b. The hero headline: "taste using ai" folds into "tasu.ai" and back every 2 seconds, for
          3 cycles, then rests unfolded. It pauses on hover and focus, while it is off screen and
          while the tab is hidden. Reduced motion: it stays unfolded. ------------------------- */
  all('[data-wm-loop]').forEach(function (wm) {
    if (reduce.matches) return;
    var parts = all('.wm-x, .wm-dot', wm);
    var timer = 0;
    var seen = true;
    var held = false;  // hover or focus on the headline
    var ticks = 0;     // 2 per cycle (fold, unfold)
    function measure() {
      parts.forEach(function (el) {
        var prev = el.style.maxWidth;
        el.style.maxWidth = 'none';
        var w = el.scrollWidth;
        el.style.maxWidth = prev;
        el.style.setProperty(el.classList.contains('wm-dot') ? '--wd' : '--wx', w + 'px');
      });
    }
    function run() {
      clearInterval(timer);
      timer = seen && !held && !d.hidden && ticks < 6 ? setInterval(function () {
        wm.classList.toggle('is-open');
        if (++ticks >= 6) { clearInterval(timer); timer = 0; }
      }, 2000) : 0;
    }
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(function () {
      measure();
      requestAnimationFrame(function () { wm.classList.add('is-ready'); run(); });
      window.addEventListener('resize', measure); // the headline's size follows the screen
      d.addEventListener('visibilitychange', run);
      var h1 = closest(wm, 'h1') || wm;
      ['mouseenter', 'focusin'].forEach(function (ev) { h1.addEventListener(ev, function () { held = true; run(); }); });
      ['mouseleave', 'focusout'].forEach(function (ev) { h1.addEventListener(ev, function () { held = false; run(); }); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; run(); }).observe(wm);
      }
    });
  });

  /* 13. Prompts: "Show all" opens a clamped prompt, "Show less" closes it. ---------------- */
  d.addEventListener('click', function (e) {
    var b = closest(e.target, '[data-clamp-toggle]');
    if (!b) return;
    var card = closest(b, '.pr');
    var box = card && card.querySelector('[data-clamp]');
    if (!box) return;
    var open = !box.classList.contains('is-open');
    box.classList.toggle('is-open', open);
    b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? 'Show less' : 'Show all';
  });
  // A prompt short enough to show whole needs no button.
  all('[data-clamp]').forEach(function (box) {
    var text = box.firstElementChild;
    var b = closest(box, '.pr') && closest(box, '.pr').querySelector('[data-clamp-toggle]');
    if (text && b && text.scrollHeight <= text.clientHeight + 1) b.hidden = true;
  });

  /* 14. Screenshot downloads. One button saves one screenshot, full size from Apple's CDN (it
         sends Access-Control-Allow-Origin: *), else the copy hosted here. "Download all" builds
         one ZIP in the browser: stored files, CRC-32, no library. ---------------------------- */
  function getFile(src, fallback) {
    return fetch(src, { mode: 'cors', credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.blob();
    }).catch(function () {
      if (!fallback) throw new Error('no fallback');
      return fetch(fallback).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      });
    });
  }
  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = d.createElement('a');
    a.href = url;
    a.download = name;
    d.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  var CRC = null;
  function crc32(bytes) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        CRC[n] = c >>> 0;
      }
    }
    var x = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) x = CRC[(x ^ bytes[i]) & 0xFF] ^ (x >>> 8);
    return (x ^ 0xFFFFFFFF) >>> 0;
  }
  // files: [{ name, bytes: Uint8Array }]. A ZIP with stored (uncompressed) entries: JPEGs are
  // already compressed. Fixed date 1 Jan 2026, so the same files give the same ZIP.
  function zip(files) {
    var enc = new TextEncoder();
    var chunks = [];
    var central = [];
    var offset = 0;
    var DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = enc.encode(f.name);
      var crc = crc32(f.bytes);
      var size = f.bytes.length;
      var local = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(DOS_TIME), u16(DOS_DATE), u32(crc), u32(size), u32(size), u16(name.length), u16(0));
      chunks.push(new Uint8Array(local), name, f.bytes);
      central.push({ name: name, crc: crc, size: size, offset: offset });
      offset += local.length + name.length + size;
    });
    var start = offset;
    var cdSize = 0;
    central.forEach(function (c) {
      var rec = [].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(DOS_TIME), u16(DOS_DATE), u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
      chunks.push(new Uint8Array(rec), c.name);
      cdSize += rec.length + c.name.length;
    });
    chunks.push(new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(start), u16(0))));
    return new Blob(chunks, { type: 'application/zip' });
  }
  d.addEventListener('click', function (e) {
    var one = closest(e.target, '[data-download]');
    if (one) {
      if (one.classList.contains('is-busy')) return;
      one.classList.add('is-busy');
      getFile(one.getAttribute('data-download'), one.getAttribute('data-fallback'))
        .then(function (blob) {
          save(blob, one.getAttribute('data-name') || 'screenshot.jpg');
          live.textContent = 'Screenshot downloaded';
        }, function () { live.textContent = 'Download failed. Try again.'; })
        .then(function () { one.classList.remove('is-busy'); });
      return;
    }
    var allBtn = closest(e.target, '[data-download-all]');
    if (!allBtn || allBtn.classList.contains('is-busy')) return;
    var list;
    try { list = JSON.parse(allBtn.getAttribute('data-download-all')); } catch (err) { return; }
    var label = allBtn.querySelector('[data-dl-label]') || allBtn;
    var before = label.textContent;
    var done = 0;
    allBtn.classList.add('is-busy');
    label.textContent = '0 of ' + list.length;
    Promise.all(list.map(function (f) {
      return getFile(f.src, f.fallback).then(function (blob) { return blob.arrayBuffer(); }).then(function (buf) {
        done++;
        label.textContent = done + ' of ' + list.length;
        return { name: f.name, bytes: new Uint8Array(buf) };
      }, function () { return null; });
    })).then(function (files) {
      files = files.filter(Boolean);
      if (!files.length) throw new Error('none');
      save(zip(files), allBtn.getAttribute('data-zip') || 'screenshots.zip');
      live.textContent = files.length + ' screenshots downloaded';
    }).catch(function () {
      live.textContent = 'Download failed. Try again.';
    }).then(function () {
      label.textContent = before;
      allBtn.classList.remove('is-busy');
    });
  });

  window.tasu = { theme: theme, setTheme: setTheme, setView: setView, filters: filters };
})();
