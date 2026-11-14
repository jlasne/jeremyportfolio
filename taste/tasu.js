/* tasu.ai shared behaviour: nav sheet, active link, copy, reveal on scroll, toast.
   Exposes window.tasu = { copy, toast }. No dependencies, works offline. */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Toast ---------- */
  var region = null;
  function getRegion() {
    if (region) return region;
    region = doc.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    doc.body.appendChild(region);
    return region;
  }
  var CHECK = '<svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  function toast(message, opts) {
    opts = opts || {};
    var r = getRegion();
    var el = doc.createElement("div");
    el.className = "toast";
    el.innerHTML = (opts.icon === false ? "" : CHECK) + "<span></span>";
    el.querySelector("span").textContent = String(message);
    // Keep at most 2 toasts on screen
    while (r.children.length >= 2) r.removeChild(r.firstChild);
    r.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add("is-in"); });
    });
    var ms = typeof opts.duration === "number" ? opts.duration : 2400;
    setTimeout(function () {
      el.classList.add("is-out");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }, ms);
    return el;
  }

  /* ---------- Copy ---------- */
  function fallbackCopy(text) {
    var ta = doc.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    doc.body.appendChild(ta);
    var active = doc.activeElement;
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = doc.execCommand("copy"); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    if (active && active.focus) active.focus({ preventScroll: true });
    return ok;
  }

  function selectElement(el) {
    if (!el) return;
    try {
      if (el.select) { el.focus(); el.select(); return; }
      var range = doc.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* nothing to select */ }
  }

  // copy(text, button?, sourceEl?) -> Promise<boolean>
  function copy(text, btn, sourceEl) {
    text = text == null ? "" : String(text);
    function done(ok) {
      if (btn) markCopied(btn, ok);
      if (!ok) {
        selectElement(sourceEl);
        toast(sourceEl ? "Selected. Press Ctrl+C or Cmd+C to copy" : "Copy failed. Select the text and copy it", { icon: false });
      }
      return ok;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(
          function () { return done(true); },
          function () { return done(fallbackCopy(text)); }
        );
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(done(fallbackCopy(text)));
  }

  function markCopied(btn, ok) {
    if (!ok) return;
    var label = btn.querySelector("[data-copy-label]");
    var hasStates = btn.querySelector(".copy-done");
    btn.classList.add("is-copied", "copy-btn");
    if (!hasStates) {
      var target = label || btn;
      if (!btn.__tasuLabel) btn.__tasuLabel = target.innerHTML;
      // Keep any icon, swap the text
      if (label) label.textContent = "Copied";
      else target.innerHTML = CHECK.replace('class="icon icon-sm"', 'class="icon icon-sm icon-check"') + "<span>Copied</span>";
    }
    clearTimeout(btn.__tasuTimer);
    btn.__tasuTimer = setTimeout(function () {
      btn.classList.remove("is-copied");
      if (!hasStates && btn.__tasuLabel != null) {
        (label || btn).innerHTML = btn.__tasuLabel;
        btn.__tasuLabel = null;
      }
    }, 1600);
    var live = getRegion();
    var sr = doc.createElement("span");
    sr.className = "sr-only";
    sr.textContent = "Copied";
    live.appendChild(sr);
    setTimeout(function () { if (sr.parentNode) sr.parentNode.removeChild(sr); }, 1600);
  }

  // [data-copy="text"] copies the attribute; [data-copy-target="#id"] copies that element's value or text.
  doc.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-copy], [data-copy-target]");
    if (!btn) return;
    e.preventDefault();
    var text, source = null;
    if (btn.hasAttribute("data-copy-target")) {
      source = doc.querySelector(btn.getAttribute("data-copy-target"));
      if (!source) return;
      text = "value" in source && source.tagName !== "BUTTON" ? source.value : source.innerText;
    } else {
      text = btn.getAttribute("data-copy");
    }
    copy(text, btn, source);
  });

  /* ---------- Active nav link ---------- */
  function normalize(path) {
    path = (path || "/").replace(/index\.html$/, "");
    if (path.charAt(path.length - 1) !== "/") path += "/";
    return path;
  }
  var here = normalize(location.pathname);
  doc.querySelectorAll(".nav a, .sheet a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) !== "/") return;
    var p = normalize(href.split("#")[0].split("?")[0]);
    if (p !== "/taste/" && here.indexOf(p) === 0) a.setAttribute("aria-current", "page");
  });

  /* ---------- Header shadow on scroll ---------- */
  var header = doc.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Phone nav sheet: grows from its button, exits back to it ---------- */
  var menuBtn = doc.querySelector(".menu-btn");
  var sheet = menuBtn && doc.getElementById(menuBtn.getAttribute("aria-controls"));
  var scrim = doc.querySelector(".sheet-scrim");
  if (menuBtn && sheet) {
    var isOpen = false;

    function setOrigin() {
      var b = menuBtn.getBoundingClientRect();
      var s = sheet.getBoundingClientRect();
      var x = b.left + b.width / 2 - s.left;
      var y = b.top + b.height / 2 - s.top;
      sheet.style.transformOrigin = Math.round(x) + "px " + Math.round(y) + "px";
    }
    function focusables() {
      return Array.prototype.slice.call(sheet.querySelectorAll('a[href], button:not([disabled])'));
    }
    function open() {
      if (isOpen) return;
      isOpen = true;
      setOrigin();
      sheet.setAttribute("data-open", "true");
      sheet.removeAttribute("inert");
      if (scrim) scrim.setAttribute("data-open", "true");
      menuBtn.setAttribute("aria-expanded", "true");
      menuBtn.setAttribute("aria-label", "Close menu");
      var first = sheet.querySelector('[aria-current="page"]') || focusables()[0];
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, reduceMotion ? 0 : 60);
      doc.addEventListener("keydown", onKey);
    }
    function close(returnFocus) {
      if (!isOpen) return;
      isOpen = false;
      setOrigin();
      sheet.setAttribute("data-open", "false");
      sheet.setAttribute("inert", "");
      if (scrim) scrim.setAttribute("data-open", "false");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Open menu");
      doc.removeEventListener("keydown", onKey);
      if (returnFocus !== false) menuBtn.focus({ preventScroll: true });
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Tab") {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); menuBtn.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); menuBtn.focus(); }
        else if (!e.shiftKey && doc.activeElement === menuBtn) { e.preventDefault(); first.focus(); }
      }
    }
    sheet.setAttribute("inert", "");
    menuBtn.addEventListener("click", function () { isOpen ? close() : open(); });
    if (scrim) scrim.addEventListener("click", function () { close(false); });
    sheet.addEventListener("click", function (e) {
      if (e.target.closest("a")) close(false);
    });
    window.addEventListener("resize", function () {
      if (isOpen && window.innerWidth >= 960) close(false);
    });
  }

  /* ---------- Reveal on scroll (ease-out 200 ms, 30 ms stagger via --i) ---------- */
  function reveal(scope) {
    var els = (scope || doc).querySelectorAll(".reveal:not(.is-in)");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  }
  // Auto-index children of [data-stagger] so rows enter 30 ms apart
  function stagger(scope) {
    (scope || doc).querySelectorAll("[data-stagger]").forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (child, i) {
        child.classList.add("reveal");
        if (!child.style.getPropertyValue("--i")) child.style.setProperty("--i", Math.min(i, 12));
      });
    });
  }
  stagger();
  reveal();

  window.tasu = {
    copy: copy,
    toast: toast,
    reveal: function (scope) { stagger(scope); reveal(scope); }
  };
})();
