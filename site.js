/* jeremylasne.com, every page: the theme, the nav, the hand-drawn schemas of the lessons, the email
   links, and on the home the line that types itself and the 3 apps that open the way a phone does. */
(function () {
  var root = document.documentElement;
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* An old link to the lessons on the home (/#archive) goes to /lessons. */
  if (location.pathname === "/" && location.hash === "#archive") { location.replace("/lessons/"); return; }

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
  /* The line on the home types itself, 28 ms a letter and a breath after each full stop; the caret
     leads, then blinks twice and leaves. The letters hold their place from the start: nothing moves. */
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
    var i = 0;
    var next = function () {
      if (i >= chars.length) { if (caret) { typed.appendChild(caret); caret.classList.add("done"); } return; }
      var c = chars[i++];
      c.classList.add("on");
      if (caret) c.parentNode.insertBefore(caret, c.nextSibling);
      setTimeout(next, c.textContent === "." ? 260 : 28);
    };
    setTimeout(next, 420);
  } else if (typed) {
    var still = typed.querySelector(".caret");
    if (still) still.remove();
  }

  /* The 3 apps: a tap opens an app the way a phone does. A sheet in the app's colour grows out of
     the icon to fill the screen in 320 ms, then the page goes to the app. A click with a modifier
     key, or less motion, stays a plain link. Back finds the page clean. */
  document.querySelectorAll("a.app").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (calm || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var ic = a.querySelector(".app-ic"), sheet = document.createElement("div");
      if (!ic || !sheet.animate) return;
      e.preventDefault();
      var r = ic.getBoundingClientRect(), img = ic.querySelector("img");
      sheet.className = "app-open";
      sheet.style.background = a.getAttribute("data-splash") || "#0b1626";
      if (img) sheet.appendChild(img.cloneNode());
      document.body.appendChild(sheet);
      var rad = getComputedStyle(ic).borderTopLeftRadius;
      var from = "inset(" + r.top + "px " + (innerWidth - r.right) + "px " + (innerHeight - r.bottom) + "px " + r.left + "px round " + rad + ")";
      sheet.animate([{ clipPath: from }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
      setTimeout(function () { location.href = a.href; }, 340);
    });
  });
  addEventListener("pageshow", function () { document.querySelectorAll(".app-open").forEach(function (s) { s.remove(); }); });
})();
