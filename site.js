/* jeremylasne.com, every page: the theme, the nav, the Kaught reel (/apps), the newsletter (/apps and each lesson), the hand-drawn schemas of the lessons and the email links. */
(function () {
  var root = document.documentElement;

  /* The theme: light by default, dark on demand, remembered. The ocean redraws in the new colours. */
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
})();
