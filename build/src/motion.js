/**
 * ayron.in — Motion engine
 * ------------------------
 * Loaded after site.js on every page. Additive only: it never removes or
 * rebinds existing behaviour, so the reveal logic, nav and tools in site.js
 * keep working. This layer adds the motion the site was missing.
 *
 * Design rules enforced here:
 *   1. Every animation is CAUSAL — driven by scroll, pointer or state.
 *      Nothing loops idly for decoration.
 *   2. Only transform / opacity / filter are animated. No layout thrash.
 *   3. All pointer work is rAF-batched and passive-listened.
 *   4. prefers-reduced-motion disables everything and restores static state.
 *   5. Every feature is independently guarded — one failure cannot break
 *      the page or the other features.
 *
 * Modules:
 *   scrollProgress   scroll position rail
 *   headerState      header condenses once scrolled
 *   staggerReveal    sequence index for grouped reveals
 *   headingReveal    per-line masked wipe on display headings
 *   cardSpotlight    pointer-tracked highlight on card surfaces
 *   magnetic         buttons ease toward the cursor
 *   navActive        current section marked in the nav
 *   counters         numeric readouts count up when seen
 *   signalFlow       packets travel real SVG diagram paths
 */

(function () {
  "use strict";

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  /**
   * Pointer capability, detected from real events rather than a media query.
   *
   * `(hover: hover)` is unreliable: hybrid laptops and tablets with a mouse
   * attached report `hover: none`, and headless browsers report it too. So
   * instead we wait for an actual mouse-type pointer event and activate the
   * pointer-driven effects at that moment. Touch users never fire one, so
   * they never pay the cost — which is the behaviour the media query was
   * only approximating.
   */
  var mouseReady = (function () {
    var fns = [];
    var fired = false;
    function onMove(e) {
      if (fired || (e.pointerType && e.pointerType !== "mouse")) return;
      fired = true;
      // Flag the document so CSS can distinguish a genuine mouse from the
      // media query's guess (hybrid devices report `hover: none` but do have
      // a pointer). The skip link uses this to revert to focus-only.
      document.documentElement.classList.add("ayr-mouse");
      document.removeEventListener("pointermove", onMove);
      fns.forEach(function (f) {
        try {
          f();
        } catch (err) {
          /* isolated per feature */
        }
      });
      fns.length = 0;
    }
    document.addEventListener("pointermove", onMove, { passive: true });
    return function (fn) {
      if (fired) fn();
      else fns.push(fn);
    };
  })();

  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /** Run a module in isolation: a throw in one never stops the others. */
  function guard(name, fn) {
    try {
      fn();
    } catch (err) {
      if (window.console && console.debug) {
        console.debug("[motion] " + name + " skipped:", err && err.message);
      }
    }
  }

  /** rAF-throttle: collapses a burst of events into one frame of work. */
  function raf(fn) {
    var queued = false;
    var lastArgs;
    return function () {
      lastArgs = arguments;
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        fn.apply(null, lastArgs);
      });
    };
  }

  /* ----------------------------------------------------------
     Scroll progress rail
     ---------------------------------------------------------- */
  function scrollProgress() {
    var rail = document.createElement("div");
    rail.className = "ayr-progress";
    rail.setAttribute("aria-hidden", "true");
    document.body.appendChild(rail);

    var update = raf(function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      rail.style.setProperty("--p", p.toFixed(4));
    });

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ----------------------------------------------------------
     Header condenses after the first scroll step
     ---------------------------------------------------------- */
  function headerState() {
    var header = document.querySelector(".site-header");
    if (!header) return;

    var on = false;
    var update = raf(function () {
      var next = window.scrollY > 12;
      if (next !== on) {
        on = next;
        header.classList.toggle("is-scrolled", on);
      }
    });

    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ----------------------------------------------------------
     Skip link: make the target genuinely focusable when used, so the
     keyboard and screen readers land inside the content rather than
     merely scrolling the page to it.
     ---------------------------------------------------------- */
  function skipLink() {
    var link = document.querySelector(".skip-link");
    if (!link) return;

    link.addEventListener("click", function () {
      var target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      if (!target.hasAttribute("tabindex"))
        target.setAttribute("tabindex", "-1");
      window.setTimeout(function () {
        target.focus({ preventScroll: true });
      }, 60);
    });
  }

  /* ----------------------------------------------------------
     Stagger index for grouped reveals.
     site.js toggles .visible; CSS reads --i for the delay. Siblings
     inside one container animate in sequence instead of all at once.
     ---------------------------------------------------------- */
  function staggerReveal() {
    var groups = new Map();

    $$(".reveal").forEach(function (el) {
      var parent = el.parentElement || document.body;
      if (!groups.has(parent)) groups.set(parent, 0);
      var i = groups.get(parent);
      // Cap at 8 so a long list never ends in a multi-second wait.
      el.style.setProperty("--i", Math.min(i, 8));
      groups.set(parent, i + 1);

      // Drop will-change once the transition has settled.
      el.addEventListener(
        "transitionend",
        function () {
          el.classList.add("ayr-settled");
        },
        { once: true },
      );
    });
  }

  /* ----------------------------------------------------------
     Heading line reveal: split a display heading into lines and
     wipe each up from a clipping mask.

     Splitting is done on measured line boxes via Range rects, so it
     respects the real wrap points rather than guessing at word counts.
     Falls back silently if the browser can't measure.
     ---------------------------------------------------------- */
  function headingReveal() {
    if (window.innerWidth < 720) return; // skip the cost on small screens

    var targets = $$(
      "h1, .section-title, .landing-section-head h2, .section-head h2, section > .wrap > h2",
    ).slice(0, 14);

    targets.forEach(function (el) {
      if (el.dataset.ayrSplit === "1") return;
      // Only split headings that are pure text. Headings containing markup
      // (accent spans, links, icons) carry styling we must not destroy, and
      // textContent would silently drop the word boundaries between elements.
      if (el.children.length > 0) return;

      var text = el.textContent.replace(/\s+/g, " ").trim();
      if (!text || text.length > 180) return;

      var words = text.split(" ");
      // Measure: wrap each word so we can read its vertical offset.
      var probe = document.createElement("span");
      probe.style.cssText = "display:inline";
      words.forEach(function (w, i) {
        var s = document.createElement("span");
        s.textContent = w + (i < words.length - 1 ? " " : "");
        s.setAttribute("data-w", "1");
        probe.appendChild(s);
      });

      var original = el.innerHTML;
      el.innerHTML = "";
      el.appendChild(probe);

      var lines = [];
      var currentTop = null;
      $$("[data-w]", probe).forEach(function (s) {
        var top = Math.round(s.getBoundingClientRect().top);
        if (currentTop === null || Math.abs(top - currentTop) > 4) {
          currentTop = top;
          lines.push([]);
        }
        lines[lines.length - 1].push(s.textContent);
      });

      if (!lines.length || lines.length > 8) {
        el.innerHTML = original;
        return;
      }

      el.innerHTML = "";
      lines.forEach(function (words, i) {
        var line = document.createElement("span");
        line.className = "ayr-line";
        line.style.setProperty("--i", i);
        var inner = document.createElement("span");
        inner.textContent = words.join("").trim();
        line.appendChild(inner);
        el.appendChild(line);
      });

      el.dataset.ayrSplit = "1";

      // Trigger when the heading enters view.
      if (!("IntersectionObserver" in window)) {
        el.classList.add("ayr-in");
        return;
      }
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("ayr-in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
      );
      io.observe(el);
    });
  }

  /* ----------------------------------------------------------
     Card spotlight: a radial highlight tracks the pointer across
     card surfaces. One delegated listener for the whole page.
     ---------------------------------------------------------- */
  function cardSpotlight() {
    var SEL = [
      ".reference-card",
      ".category-card",
      ".project-card",
      ".ai-card",
      ".net-card",
      ".layer-card",
      ".service-card",
      ".proof-card",
      ".interest-card",
      ".principle-card",
      ".explore-card",
      ".case-study-card",
      ".tech-card",
    ].join(",");

    var active = null;

    var move = raf(function (x, y) {
      if (!active) return;
      var r = active.getBoundingClientRect();
      active.style.setProperty(
        "--mx",
        (((x - r.left) / r.width) * 100).toFixed(2) + "%",
      );
      active.style.setProperty(
        "--my",
        (((y - r.top) / r.height) * 100).toFixed(2) + "%",
      );
    });

    document.addEventListener(
      "pointermove",
      function (e) {
        var card = e.target.closest ? e.target.closest(SEL) : null;
        if (card !== active) {
          if (active) active.style.setProperty("--spot", "0");
          active = card;
          if (active) active.style.setProperty("--spot", "1");
        }
        if (active) move(e.clientX, e.clientY);
      },
      { passive: true },
    );

    document.addEventListener(
      "pointerleave",
      function () {
        if (active) active.style.setProperty("--spot", "0");
        active = null;
      },
      { passive: true },
    );
  }

  /* ----------------------------------------------------------
     Magnetic buttons: ease toward the cursor within a radius,
     spring back on leave. Small displacement — felt, not seen.
     ---------------------------------------------------------- */
  function magnetic() {
    var MAX = 6; // px of travel — restraint is the point
    var RADIUS = 90;

    $$(".btn, .btn-primary, .tool-btn")
      .slice(0, 40)
      .forEach(function (el) {
        el.classList.add("ayr-magnetic");

        var apply = raf(function (dx, dy) {
          el.style.setProperty("--tx", dx.toFixed(2) + "px");
          el.style.setProperty("--ty", dy.toFixed(2) + "px");
        });

        el.addEventListener(
          "pointermove",
          function (e) {
            var r = el.getBoundingClientRect();
            var cx = r.left + r.width / 2;
            var cy = r.top + r.height / 2;
            var dx = e.clientX - cx;
            var dy = e.clientY - cy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var strength = Math.max(0, 1 - dist / RADIUS);
            el.classList.add("ayr-tracking");
            apply(dx * strength * (MAX / 30), dy * strength * (MAX / 30));
          },
          { passive: true },
        );

        el.addEventListener(
          "pointerleave",
          function () {
            el.classList.remove("ayr-tracking");
            el.style.setProperty("--tx", "0px");
            el.style.setProperty("--ty", "0px");
          },
          { passive: true },
        );
      });
  }

  /* ----------------------------------------------------------
     Nav active section: marks which section the reader is in.
     Instrumentation, consistent with the site's subject.
     ---------------------------------------------------------- */
  function navActive() {
    if (!("IntersectionObserver" in window)) return;

    var sections = $$("section[aria-labelledby], section[id]").filter(
      function (s) {
        return s.id || s.getAttribute("aria-labelledby");
      },
    );
    if (sections.length < 2) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-ayr-active", "1");
          } else {
            entry.target.removeAttribute("data-ayr-active");
          }
        });
      },
      { threshold: 0.4 },
    );

    sections.forEach(function (s) {
      io.observe(s);
    });
  }

  /* ----------------------------------------------------------
     Counters: any element whose text is purely numeric inside a
     readout counts up once when scrolled into view.
     ---------------------------------------------------------- */
  function counters() {
    if (!("IntersectionObserver" in window)) return;

    var candidates = $$(
      ".proof-meta, .readout-row, .case-number, .category-no, .layer-no",
    )
      .filter(function (el) {
        return /^\s*\d+([.,]\d+)?\s*$/.test(el.textContent);
      })
      .slice(0, 24);

    if (!candidates.length) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el);

          var target = parseFloat(el.textContent.replace(/,/g, ""));
          if (!isFinite(target)) return;
          var decimals = (el.textContent.split(".")[1] || "").trim().length;
          var pad = /^0\d/.test(el.textContent.trim());
          var width = el.textContent.trim().length;

          el.classList.add("ayr-counting");
          var start = performance.now();
          var DUR = 900;

          function tick(now) {
            var t = Math.min(1, (now - start) / DUR);
            // easeOutExpo — fast then settles, reads as a readout landing
            var e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
            var v = (target * e).toFixed(decimals);
            el.textContent = pad ? String(v).padStart(width, "0") : v;
            if (t < 1) window.requestAnimationFrame(tick);
          }
          window.requestAnimationFrame(tick);
        });
      },
      { threshold: 0.6 },
    );

    candidates.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ----------------------------------------------------------
     Signal flow: send packets along real SVG paths in the
     architecture/topology diagrams. The diagram demonstrates the
     system it describes rather than sitting static.

     Uses SMIL animateMotion — declarative, compositor-friendly,
     and it stops automatically when the diagram leaves the viewport.
     ---------------------------------------------------------- */
  function signalFlow() {
    // Match every diagram SVG on the site, not a hand-listed few: anything
    // with drawable paths inside a topology/flow/architecture container.
    var svgs = $$("svg").filter(function (s) {
      var cls =
        (s.getAttribute("class") || "") +
        " " +
        ((s.parentElement && s.parentElement.className) || "").toString();
      return /topolog|flow|lines|diagram|architect|network|skill|canvas/i.test(
        cls,
      );
    });
    if (!svgs.length) return;

    var NS = "http://www.w3.org/2000/svg";

    svgs.slice(0, 6).forEach(function (svg) {
      if (svg.dataset.ayrFlow === "1") return;
      var paths = $$("path, line, polyline", svg).filter(function (p) {
        var len = 0;
        try {
          len = p.getTotalLength ? p.getTotalLength() : 0;
        } catch (e) {
          return false;
        }
        if (!(len > 18 && len < 6000)) return false;
        // Reject concatenated paths: more than one "M" means disconnected
        // subpaths, and a packet following them visibly teleports across gaps.
        var d = p.getAttribute("d") || "";
        if ((d.match(/M/gi) || []).length > 1) return false;
        return true;
      });
      if (!paths.length) return;
      svg.dataset.ayrFlow = "1";

      paths.slice(0, 10).forEach(function (path, i) {
        // Give the path an id so animateMotion can reference it.
        var id =
          path.id ||
          "ayr-p-" + i + "-" + Math.random().toString(36).slice(2, 7);
        path.id = id;

        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("r", "2.6");
        dot.setAttribute("class", "ayr-packet");
        dot.setAttribute("opacity", "0");

        var motion = document.createElementNS(NS, "animateMotion");
        motion.setAttribute("dur", (2.6 + (i % 4) * 0.55).toFixed(2) + "s");
        motion.setAttribute("repeatCount", "indefinite");
        motion.setAttribute("begin", (i * 0.42).toFixed(2) + "s");
        motion.setAttribute("rotate", "auto");

        var mpath = document.createElementNS(NS, "mpath");
        mpath.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#" + id);
        mpath.setAttribute("href", "#" + id);
        motion.appendChild(mpath);

        // Fade in and out so packets emerge and arrive, not pop.
        var fade = document.createElementNS(NS, "animate");
        fade.setAttribute("attributeName", "opacity");
        fade.setAttribute("values", "0;0.95;0.95;0");
        fade.setAttribute("keyTimes", "0;0.12;0.82;1");
        fade.setAttribute("dur", motion.getAttribute("dur"));
        fade.setAttribute("repeatCount", "indefinite");
        fade.setAttribute("begin", motion.getAttribute("begin"));

        dot.appendChild(motion);
        dot.appendChild(fade);
        svg.appendChild(dot);
      });

      // Pause the whole SVG's animations when it's off-screen.
      if ("IntersectionObserver" in window && svg.pauseAnimations) {
        var io = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              try {
                if (entry.isIntersecting) svg.unpauseAnimations();
                else svg.pauseAnimations();
              } catch (e) {
                /* not supported — harmless */
              }
            });
          },
          { threshold: 0.05 },
        );
        io.observe(svg);
      }
    });
  }

  /* ----------------------------------------------------------
     Boot
     ---------------------------------------------------------- */
  function init() {
    // Always safe, motion-independent:
    guard("headerState", headerState);
    guard("skipLink", skipLink);
    guard("navActive", navActive);

    if (motionQuery.matches) return; // reduced motion: stop here

    guard("scrollProgress", scrollProgress);
    guard("staggerReveal", staggerReveal);
    guard("headingReveal", headingReveal);
    // Pointer-driven effects activate on the first real mouse movement.
    mouseReady(function () {
      guard("cardSpotlight", cardSpotlight);
      guard("magnetic", magnetic);
    });
    guard("counters", counters);
    // The topology/architecture SVGs are drawn by site.js after load, so the
    // paths may not exist yet when this runs. Retry on a short schedule and
    // stop as soon as packets are attached (or we give up quietly).
    (function attachFlow(attempt) {
      guard("signalFlow", signalFlow);
      if (document.querySelector(".ayr-packet")) return;
      if (attempt >= 8) return;
      window.setTimeout(function () {
        attachFlow(attempt + 1);
      }, 350);
    })(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
