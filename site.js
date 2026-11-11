/* jeremylasne.com, every page: the theme, the nav, the Kaught reel (home), the newsletter (each lesson), the hand-drawn schemas of the lessons, the email links, and on the home the typed subheadline, the numbers, the name that becomes the mark, the deck of app cards and the cursor. */
(function () {
  var root = document.documentElement;

  /* The theme: light by day, dark from 7 pm to 7 am (set in each page head), or the one a visitor picked, remembered. The ocean redraws in the new colours. */
  function paint() {
    var light = root.getAttribute("data-theme") === "light";
    document.querySelectorAll(".theme").forEach(function (b) { b.setAttribute("aria-label", light ? "Switch to the dark theme" : "Switch to the light theme"); });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#eef3f7" : "#050b16");
  }
  function flip() {
    var light = root.getAttribute("data-theme") !== "light";
    root.setAttribute("data-theme", light ? "light" : "dark");
    try { localStorage.setItem("theme", light ? "light" : "dark"); } catch (e) {}
    paint();
    window.dispatchEvent(new Event("themechange"));
  }
  document.querySelectorAll(".theme").forEach(function (b) { b.addEventListener("click", flip); });
  paint();

  /* The nav: a shade under it once the page scrolls (on a phone, the top bar turns frosted). */
  var nav = document.getElementById("nav");
  if (nav) {
    var shade = function () { nav.classList.toggle("scrolled", scrollY > 8); };
    addEventListener("scroll", shade, { passive: true });
    shade();
  }

  /* The videos (each phone's page, the Kaught reel) play muted and looping while they are on
     screen, and rest once they leave; each loads only when first seen. The still shows until the
     first frame. A visitor who asks for less motion keeps the stills. A browser that refuses
     autoplay (low-power mode, data saver) gets one more try at the first touch, key or scroll. */
  var vids = Array.prototype.slice.call(document.querySelectorAll("video[data-src]"));
  if (vids.length && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var gestures = ["pointerdown", "touchstart", "keydown", "wheel", "scroll"], waiting = false, seen = new Set();
    var start = function (v) {
      if (!v.getAttribute("src")) v.src = v.dataset.src;
      var p = v.play();
      if (p && p.catch) p.catch(function () {
        if (waiting) return;
        waiting = true;
        gestures.forEach(function (g) { addEventListener(g, retry, { once: true, passive: true }); });
      });
    };
    var retry = function () {
      waiting = false;
      gestures.forEach(function (g) { removeEventListener(g, retry); });
      seen.forEach(function (v) { if (v.paused) start(v); });
    };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { seen.add(v); start(v); }
        else { seen.delete(v); if (!v.paused) v.pause(); }
      });
    }, { threshold: .35 });
    vids.forEach(function (v) {
      v.muted = v.defaultMuted = true;
      v.addEventListener("playing", function () { v.classList.add("ready"); });
      io.observe(v);
    });
  }

  /* The newsletter. With data-endpoint set (the mailcheap.ai sign-up URL), the email is posted
     there as a form field "email". Until then, the button opens a mail to hey@jeremylasne.com
     with the address in it, so no sign-up is lost. */
  var form = document.getElementById("join"), note = document.getElementById("join-note");
  if (form) {
    var input = form.querySelector("input"), button = form.querySelector("button"), first = note.textContent;
    var say = function (text, ok) { note.textContent = text; note.classList.toggle("ok", !!ok); };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Type a valid email, like you@mail.com."); input.focus(); return; }
      var url = form.getAttribute("data-endpoint");
      if (!url) {
        location.href = "mailto:hey@jeremylasne.com?subject=" + encodeURIComponent("Newsletter") +
          "&body=" + encodeURIComponent("Add me to the newsletter: " + email);
        say("Send the mail that just opened, and you're in.", true);
        return;
      }
      button.disabled = true;
      var body = new FormData(); body.append("email", email);
      fetch(url, { method: "POST", body: body }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        say("You're in. The next issue lands Wednesday or Sunday.", true);
      }).catch(function () {
        say("That didn't go through. Try again, or write to hey@jeremylasne.com.");
      }).then(function () { button.disabled = false; });
    });
    input.addEventListener("input", function () { if (note.textContent !== first && !note.classList.contains("ok")) say(first); });
  }

  /* A hand-drawn schema in a lesson: its arrows draw themselves, one after the other, the first
     time it comes on screen. Without the observer, or with less motion, it shows drawn. */
  var sketches = document.querySelectorAll(".sketch");
  if (sketches.length && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var draw = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-drawing"); e.target.classList.remove("is-waiting"); draw.unobserve(e.target); } });
    }, { threshold: .4 });
    sketches.forEach(function (s) { s.classList.add("is-waiting"); draw.observe(s); });
  }

  /* The email links: a tap copies the address and opens a popup with it and "Copied". "Write an email" opens the mail app. A browser that
     cannot copy still shows the address, ready to select. Esc, the cross or a tap outside closes it. */
  var pop = null, opener = null;
  function closePop() {
    if (!pop || !pop.hasAttribute("data-open")) return;
    pop.removeAttribute("data-open");
    if (opener) opener.focus();
  }
  function openPop(email, copied) {
    if (!pop) {
      pop = document.createElement("div");
      pop.className = "mailpop";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-modal", "true");
      pop.setAttribute("aria-label", "My email");
      pop.innerHTML =
        '<div class="mailpop-card">' +
          '<div class="mailpop-top"><span class="mailpop-state" aria-live="polite"></span>' +
          '<button class="mailpop-x" type="button" aria-label="Close">&times;</button></div>' +
          '<span class="mailpop-email"></span>' +
          '<a class="mailpop-write" href="#">Write an email <span aria-hidden="true">&rarr;</span></a>' +
        '</div>';
      document.body.appendChild(pop);
      pop.addEventListener("click", function (e) { if (e.target === pop) closePop(); });
      pop.querySelector(".mailpop-x").addEventListener("click", closePop);
      addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
    }
    var state = pop.querySelector(".mailpop-state");
    state.classList.toggle("is-plain", !copied);
    state.innerHTML = copied ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Copied' : "My email";
    pop.querySelector(".mailpop-email").textContent = email;
    pop.querySelector(".mailpop-write").setAttribute("href", "mailto:" + email);
    pop.offsetWidth;
    pop.setAttribute("data-open", "");
    pop.querySelector(".mailpop-x").focus();
  }
  document.querySelectorAll("[data-mail]").forEach(function (a) {
    var email = a.getAttribute("href").slice("mailto:".length);
    a.addEventListener("click", function (e) {
      e.preventDefault();
      opener = a;
      var done = function (ok) { openPop(email, ok); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(email).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  });
  /* The home. A visitor who asks for less motion gets the words and the numbers as they are. */
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The numbers: the lessons are counted from the list, then each counts up from 0 in 1.2 s. */
  var counts = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  var lessons = document.querySelectorAll("ol.lessons > li").length;
  counts.forEach(function (b) { if (b.hasAttribute("data-lessons") && lessons) b.setAttribute("data-count", lessons); });
  var show = function (b, n) { b.textContent = n.toLocaleString("en-US") + (b.getAttribute("data-suffix") || ""); };
  function countUp() {
    var t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / 1200), e = 1 - Math.pow(1 - k, 3);
      counts.forEach(function (b) { show(b, Math.round(+b.getAttribute("data-count") * e)); });
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  if (counts.length) {
    if (calm) counts.forEach(function (b) { show(b, +b.getAttribute("data-count")); });
    /* each number keeps the width of its final value, so the row stays still while it counts */
    else counts.forEach(function (b) { show(b, +b.getAttribute("data-count")); b.style.minWidth = b.offsetWidth + "px"; show(b, 0); });
  }

  /* The subheadline types itself, 32 ms a letter and a breath after each full stop; the caret leads.
     The numbers start counting once the last letter is down. */
  var typed = document.querySelector("[data-type]");
  if (typed && !calm) {
    var caret = typed.querySelector(".caret"), chars = [];
    (function split(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split("").forEach(function (ch) {
            var c = document.createElement("span"); c.className = "tc"; c.textContent = ch; frag.appendChild(c); chars.push(c);
          });
          node.replaceChild(frag, n);
        } else if (n !== caret) split(n);
      });
    })(typed);
    typed.classList.add("typing");
    var i = 0;
    var next = function () {
      if (i >= chars.length) { typed.classList.remove("typing"); typed.appendChild(caret); countUp(); return; }
      var c = chars[i++], m = c.parentNode;
      c.classList.add("on");
      if (m.tagName === "MARK") m.classList.add("on");
      if (caret) c.parentNode.insertBefore(caret, c.nextSibling);
      setTimeout(next, c.textContent === "." ? 380 : 32);
    };
    setTimeout(next, 650);
  } else if (counts.length && !calm) setTimeout(countUp, 400);

  /* The app cards lean toward the cursor, up to 4 degrees, and a light follows it. */
  if (matchMedia("(hover: hover) and (pointer: fine)").matches && !calm) {
    document.querySelectorAll(".tilt").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", ((x - .5) * 8).toFixed(2) + "deg");
        el.style.setProperty("--rx", ((.5 - y) * 6).toFixed(2) + "deg");
        el.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
        el.classList.add("on");
      });
      el.addEventListener("pointerleave", function () { el.classList.remove("on"); });
    });
  }
  /* The name slides and shrinks into the mark at the top right as the page scrolls, then hands over to it. */
  var big = document.querySelector(".h-name"), mark = document.querySelector(".home .mark");
  if (big && mark && !calm) {
    var from, to, run;
    var place = function () {
      big.style.transform = "";
      var r = big.getBoundingClientRect(), range = document.createRange();
      range.selectNodeContents(mark);
      var m = range.getBoundingClientRect();
      from = { x: r.left, y: r.top + scrollY, w: r.width, h: r.height };
      to = { x: m.left, y: m.top, w: m.width, h: m.height };
      run = Math.max(220, Math.min(innerHeight * .55, 460));
      morph();
    };
    var morph = function () {
      if (!from) return;
      /* it shrinks faster than it travels, so it stays on screen on the way */
      var p = Math.min(1, Math.max(0, scrollY / run)), e = p * p * (3 - 2 * p), q = 1 - Math.pow(1 - p, 3);
      var k = 1 + (to.w / from.w - 1) * q;
      var x = (to.x - from.x) * e, y = (to.y + to.h / 2 - from.h * k / 2 - (from.y - scrollY)) * e;
      big.style.transform = p ? "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + k.toFixed(4) + ")" : "";
      var hand = Math.min(1, Math.max(0, (p - .78) / .22));
      big.style.opacity = 1 - hand;
      big.style.visibility = hand === 1 ? "hidden" : "";
      mark.style.opacity = hand;
    };
    var ticking = false;
    addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; morph(); });
    }, { passive: true });
    addEventListener("resize", place);
    place();
    setTimeout(place, 800);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  }

  /* The deck: the sheet under the one sliding over it shrinks to 92% and dims, as the next covers it. */
  var deals = Array.prototype.slice.call(document.querySelectorAll(".deal"));
  if (deals.length > 1 && !calm) {
    var stack = function () {
      for (var k = 0; k < deals.length - 1; k++) {
        var a = deals[k].getBoundingClientRect(), b = deals[k + 1].getBoundingClientRect();
        var cover = Math.min(1, Math.max(0, (a.bottom - b.top) / a.height));
        deals[k].style.transform = cover ? "scale(" + (1 - .08 * cover).toFixed(4) + ")" : "";
        deals[k].style.setProperty("--dim", (cover * .55).toFixed(3));
      }
    };
    var stacking = false;
    addEventListener("scroll", function () {
      if (stacking) return;
      stacking = true;
      requestAnimationFrame(function () { stacking = false; stack(); });
    }, { passive: true });
    addEventListener("resize", stack);
    stack();
  }

  /* The cursor, on the home with a mouse: a ring that trails the pointer, grows on a link,
     and says what a card does. The sharks already follow the pointer (ocean.js). */
  if (document.body.classList.contains("home") && matchMedia("(hover: hover) and (pointer: fine)").matches && !calm) {
    var ring = document.createElement("div"), label = document.createElement("span");
    ring.className = "cursor off"; ring.setAttribute("aria-hidden", "true"); ring.appendChild(label);
    document.body.appendChild(ring);
    root.classList.add("ring");
    var mx = -100, my = -100, rx = -100, ry = -100, moving = false;
    var follow = function () {
      rx += (mx - rx) * .28; ry += (my - ry) * .28;
      ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
      if (Math.abs(mx - rx) + Math.abs(my - ry) > .3) requestAnimationFrame(follow); else moving = false;
    };
    addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
      if (ring.classList.contains("off")) { rx = mx; ry = my; ring.classList.remove("off"); }
      var card = e.target.closest("[data-cursor]"), link = !card && e.target.closest("a, button");
      ring.classList.toggle("card", !!card);
      ring.classList.toggle("link", !!link);
      label.textContent = card ? card.getAttribute("data-cursor") : "";
      if (!moving) { moving = true; requestAnimationFrame(follow); }
    }, { passive: true });
    document.addEventListener("pointerleave", function () { ring.classList.add("off"); });
    addEventListener("blur", function () { ring.classList.add("off"); });
  }
})();
