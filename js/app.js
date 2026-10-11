(function () {
  "use strict";

  // Navigation drawer
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  var overlay = document.getElementById("navOverlay");
  var closeBtn = document.getElementById("navClose");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open && closeBtn) closeBtn.focus(); else toggle.focus({ preventScroll: true });
  }
  if (toggle && links) {
    toggle.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    if (overlay) overlay.addEventListener("click", function () { setMenu(false); });
    if (closeBtn) closeBtn.addEventListener("click", function () { setMenu(false); });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) { document.body.classList.remove("menu-open"); toggle.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) setMenu(false);
    });
  }

  // Highlight the menu link of the section being viewed
  var navA = [].slice.call(document.querySelectorAll(".nav-links a[href^='#']"));
  var secs = navA.map(function (a) { return document.querySelector(a.getAttribute("href")); }).filter(Boolean);
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) navA.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    secs.forEach(function (s) { spy.observe(s); });
  }

  // Scroll progress + back to top
  var bar = document.getElementById("progress");
  var topBtn = document.getElementById("toTop");
  var ticking = false;
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (h > 0 ? Math.min(100, window.scrollY / h * 100) : 0) + "%";
    if (topBtn) topBtn.classList.toggle("show", window.scrollY > 600);
    ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  if (topBtn) topBtn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  onScroll();

  // Reveal animation
  var items = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.08 });
    items.forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
  }
})();
