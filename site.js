/* jeremylasne.com: what every page does, the landing and its three pages. */
(function () {
  var root = document.documentElement;

  /* The landing's old anchors go to the pages that replaced them. */
  var moved = { "#creators": "/creators/", "#apps": "/apps/", "#personal": "/personal/" };
  if (moved[location.hash]) { location.replace(moved[location.hash]); return; }

  /* The theme: dark by default, light on demand, remembered. The ocean redraws in the new colours. */
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

  /* The email links copy the address too: on a machine with no mail app,
     mailto: alone does nothing visible. The mail app still opens where one exists. */
  var t = document.getElementById("toast"), timer;
  document.querySelectorAll("[data-mail]").forEach(function (a) {
    var email = a.getAttribute("href").slice("mailto:".length);
    a.addEventListener("click", function () {
      if (!t || !navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(email).then(function () {
        t.textContent = "Address copied: " + email;
        t.setAttribute("data-open", "");
        clearTimeout(timer);
        timer = setTimeout(function () { t.removeAttribute("data-open"); }, 2600);
      }, function () {});
    });
  });
})();
