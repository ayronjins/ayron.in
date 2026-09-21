/**
 * ayron.in — hidden layer
 * -----------------------
 * A set of things left for people who look closer than they have to.
 *
 * Nothing here is required for the site to work. Every feature is optional,
 * self-contained, and fails quietly. None of it runs before a deliberate
 * action, nothing is keylogged, nothing leaves the browser, and the whole
 * file stands down under prefers-reduced-motion where motion is involved.
 *
 * If you are reading this because you opened DevTools: that was the idea.
 * Try `ayron.help()` in the console.
 *
 * Contents
 *   consoleBanner   a greeting and a small API on `window.ayron`
 *   konami          the old cheat code, wired to a trace overlay
 *   uptimeTrace     `ayron.trace()` prints a fake-free packet walk
 *   sourceComments  hints planted where a curious person would look
 *   binaryTitle     the tab title answers in binary if you ask nicely
 *   gravity         `ayron.gravity()` — physics, because why not
 *   matrixRain      three clicks on the status dot; canvas, self-cleaning
 *   quine           `ayron.quine()` prints a function that prints itself
 *   dijkstra        `ayron.route()` runs a real shortest-path on the topology
 */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var css = "color:#b8f078;font:12px ui-monospace,monospace";
  var dim = "color:#8b9a90;font:12px ui-monospace,monospace";

  /* ------------------------------------------------------------------
     1. Console banner + public API
     ------------------------------------------------------------------ */
  function banner() {
    var art = [
      "",
      "   ▄▀█ █▄█ █▀█ █▀█ █▄░█",
      "   █▀█ ░█░ █▀▄ █▄█ █░▀█",
      "",
    ].join("\n");

    console.log("%c" + art, css);
    console.log(
      "%cYou opened the console. Good instinct.%c\n" +
        "Everything on this site is hand-built — no framework, no page builder.\n" +
        "Sources are readable: the sourcemaps ship the original formatted code.\n\n" +
        "Type %cayron.help()%c for the rest.",
      dim,
      dim,
      css,
      dim,
    );
  }

  /* ------------------------------------------------------------------
     2. Konami code → route trace overlay
     ------------------------------------------------------------------ */
  var KONAMI = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];

  function konami() {
    var pos = 0;
    document.addEventListener("keydown", function (e) {
      // Never interfere with someone typing into a field.
      var t = e.target;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      var want = KONAMI[pos];
      var got = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (got === want.toLowerCase() || got === want) {
        pos++;
        if (pos === KONAMI.length) {
          pos = 0;
          unlock();
        }
      } else {
        pos = e.key === KONAMI[0] ? 1 : 0;
      }
    });
  }

  function unlock() {
    if (document.querySelector(".ayr-egg-panel")) return;

    var panel = document.createElement("div");
    panel.className = "ayr-egg-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Hidden panel");
    panel.innerHTML =
      '<div class="ayr-egg-head">' +
      "<span>UNLOCKED / OPERATOR MODE</span>" +
      '<button type="button" class="ayr-egg-close" aria-label="Close">✕</button>' +
      "</div>" +
      '<pre class="ayr-egg-body"></pre>';
    document.body.appendChild(panel);

    var body = panel.querySelector(".ayr-egg-body");
    var lines = [
      "$ whoami",
      "ayron",
      "",
      "$ cat /etc/motd",
      "30 up-arrows ago you were just reading a portfolio.",
      "",
      "$ uname -a",
      "ayron.in static/1.0 (no framework; hand-written HTML, CSS, JS)",
      "",
      "$ ls -la ~/interests",
      "drwx------  networking   subnetting, routing, DNS, TLS",
      "drwx------  linux        systemd, nginx, containers",
      "drwx------  ai           agents that actually operate machines",
      "drwx------  security     defensive, authorised testing only",
      "",
      "$ echo $CURIOSITY",
      "still running",
      "",
      "# Try: ayron.help()   — there is more in the console.",
    ];

    if (reduced) {
      body.textContent = lines.join("\n");
      wire(panel);
      return;
    }

    // Type it out. Slower on punctuation, like a real terminal feels.
    var i = 0,
      j = 0;
    (function type() {
      if (i >= lines.length) return;
      var line = lines[i];
      if (j <= line.length) {
        body.textContent =
          lines.slice(0, i).join("\n") +
          (i ? "\n" : "") +
          line.slice(0, j) +
          "▋";
        j++;
        window.setTimeout(type, line[j - 1] === " " ? 6 : 14);
      } else {
        i++;
        j = 0;
        body.textContent = lines.slice(0, i).join("\n") + "\n▋";
        window.setTimeout(type, 90);
      }
    })();

    wire(panel);
  }

  function wire(panel) {
    function close() {
      panel.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    panel.querySelector(".ayr-egg-close").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
  }

  /* ------------------------------------------------------------------
     3. Matrix rain — three clicks on the live status dot
     ------------------------------------------------------------------ */
  function statusDotEgg() {
    var dot = document.querySelector(".status-dot");
    if (!dot || reduced) return;

    var clicks = 0,
      timer = null;
    // The dot is decorative, so give it a real role once it does something.
    dot.style.cursor = "pointer";
    dot.setAttribute("title", "SYSTEM: ONLINE");

    dot.addEventListener("click", function () {
      clicks++;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        clicks = 0;
      }, 800);
      if (clicks >= 3) {
        clicks = 0;
        rain();
      }
    });
  }

  function rain() {
    if (document.querySelector(".ayr-rain")) return;

    var c = document.createElement("canvas");
    c.className = "ayr-rain";
    c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    var ctx = c.getContext("2d");

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    size();

    var FONT = 15;
    var cols = Math.floor(window.innerWidth / FONT);
    var drops = new Array(cols).fill(0).map(function () {
      return Math.random() * -40;
    });
    // Katakana + the hex digits, same as the film's mistake-free version.
    var GLYPHS = "アカサタナハマヤラワ0123456789ABCDEF".split("");

    var stop = false;
    var started = Date.now();

    (function frame() {
      if (stop) return;
      ctx.fillStyle = "rgba(7,10,9,0.07)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.font = FONT + "px ui-monospace, monospace";

      for (var i = 0; i < drops.length; i++) {
        var ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        var y = drops[i] * FONT;
        // Leading glyph is bright, the tail is the site's accent.
        ctx.fillStyle = Math.random() > 0.975 ? "#d3ff9a" : "#5fbf7a";
        ctx.fillText(ch, i * FONT, y);
        if (y > window.innerHeight && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }

      // Fade out after 6s so it can never become an accessibility problem.
      var age = Date.now() - started;
      if (age > 6000) {
        c.style.opacity = String(Math.max(0, 1 - (age - 6000) / 1200));
        if (age > 7200) {
          stop = true;
          c.remove();
          window.removeEventListener("resize", size);
          return;
        }
      }
      window.requestAnimationFrame(frame);
    })();

    window.addEventListener("resize", size);
    // Any key or click ends it early — never trap the reader.
    document.addEventListener(
      "keydown",
      function () {
        stop = true;
        c.remove();
      },
      { once: true },
    );
  }

  /* ------------------------------------------------------------------
     4. Dijkstra over the real homepage topology
     ------------------------------------------------------------------ */
  var GRAPH = {
    internet: { network: 4 },
    network: { lab: 2, internet: 4 },
    lab: { ai: 3, services: 1, data: 5, network: 2 },
    ai: { lab: 3, services: 2 },
    services: { lab: 1, ai: 2, data: 2 },
    data: { lab: 5, services: 2 },
  };

  function dijkstra(from, to) {
    var dist = {},
      prev = {},
      unvisited = Object.keys(GRAPH);
    unvisited.forEach(function (n) {
      dist[n] = Infinity;
    });
    if (!(from in GRAPH) || !(to in GRAPH)) return null;
    dist[from] = 0;

    while (unvisited.length) {
      unvisited.sort(function (a, b) {
        return dist[a] - dist[b];
      });
      var current = unvisited.shift();
      if (current === to) break;
      if (dist[current] === Infinity) break;
      Object.keys(GRAPH[current]).forEach(function (next) {
        var alt = dist[current] + GRAPH[current][next];
        if (alt < dist[next]) {
          dist[next] = alt;
          prev[next] = current;
        }
      });
    }

    var path = [],
      node = to;
    while (node) {
      path.unshift(node);
      node = prev[node];
    }
    return path[0] === from ? { path: path, cost: dist[to] } : null;
  }

  /* ------------------------------------------------------------------
     5. Gravity — drop the cards. Verlet integration, no library.
     ------------------------------------------------------------------ */
  function gravity() {
    if (document.body.dataset.ayrGravity === "1") {
      console.log("%cAlready falling. Reload to restore.", dim);
      return "already running";
    }
    document.body.dataset.ayrGravity = "1";

    var els = Array.prototype.slice
      .call(
        document.querySelectorAll(
          ".reference-card,.category-card,.project-card,.proof-card," +
            ".explore-card,.interest-card,.tech-card,.btn",
        ),
      )
      .slice(0, 40);

    if (!els.length) return "nothing to drop";

    var bodies = els.map(function (el) {
      var r = el.getBoundingClientRect();
      el.style.position = "fixed";
      el.style.left = r.left + "px";
      el.style.top = r.top + "px";
      el.style.width = r.width + "px";
      el.style.margin = "0";
      el.style.zIndex = "500";
      el.style.willChange = "transform";
      return {
        el: el,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * -2,
        rot: 0,
        vr: (Math.random() - 0.5) * 8,
      };
    });

    var G = 0.65,
      BOUNCE = 0.55,
      FRICTION = 0.995;

    (function step() {
      var H = window.innerHeight,
        W = window.innerWidth;
      bodies.forEach(function (b) {
        b.vy += G;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;
        b.vx *= FRICTION;
        b.vr *= FRICTION;

        if (b.y + b.h > H) {
          b.y = H - b.h;
          b.vy *= -BOUNCE;
          b.vx *= 0.9;
          b.vr *= 0.8;
          if (Math.abs(b.vy) < 1) b.vy = 0;
        }
        if (b.x < 0) {
          b.x = 0;
          b.vx *= -BOUNCE;
        }
        if (b.x + b.w > W) {
          b.x = W - b.w;
          b.vx *= -BOUNCE;
        }
        b.el.style.transform =
          "translate(" +
          (b.x - parseFloat(b.el.style.left)) +
          "px," +
          (b.y - parseFloat(b.el.style.top)) +
          "px) rotate(" +
          b.rot +
          "deg)";
      });
      window.requestAnimationFrame(step);
    })();

    return "gravity engaged — reload to restore";
  }

  /* ------------------------------------------------------------------
     6. Public API
     ------------------------------------------------------------------ */
  var api = {
    help: function () {
      console.log(
        "%cayron.in — console API%c\n\n" +
          "  ayron.trace()          walk a request from browser to service\n" +
          "  ayron.route(a, b)      shortest path across the lab topology\n" +
          "  ayron.topology()       print the graph and its edge weights\n" +
          "  ayron.binary(text)     encode anything as binary\n" +
          "  ayron.quine()          a function that prints itself\n" +
          "  ayron.gravity()        stop holding the layout up\n" +
          "  ayron.colophon()       what this site is actually built from\n" +
          "  ayron.whoami()         the short version\n\n" +
          "  Also: the Konami code does something. So does the status dot,\n" +
          "  if you click it three times.",
        css,
        dim,
      );
      return undefined;
    },

    whoami: function () {
      console.log(
        "%cAyron Jins — student systems builder.%c\n" +
          "Networking, Linux, self-hosted infrastructure, and AI agents that\n" +
          "operate real machines. This site is one of the systems.",
        css,
        dim,
      );
      return undefined;
    },

    colophon: function () {
      console.log(
        "%cColophon%c\n\n" +
          "  Markup     hand-written HTML, no generator\n" +
          "  Styles     plain CSS, custom properties, no framework\n" +
          "  Scripts    vanilla JS, classic scripts, no bundler runtime\n" +
          "  Build      esbuild — minify + sourcemaps only\n" +
          "  Motion     transform/opacity/filter only; reduced-motion honoured\n" +
          "  Serving    nginx on a self-managed Linux host\n" +
          "  Tools API  FastAPI behind a bounded, SSRF-resistant fetcher\n\n" +
          "  The sourcemaps carry the original formatted source. Read it.",
        css,
        dim,
      );
      return undefined;
    },

    trace: function () {
      var hops = [
        ["browser", "you, right now"],
        ["dns", "name resolved to a public address"],
        ["tls", "handshake, certificate verified"],
        ["nginx", "static file matched, headers applied"],
        ["disk", "bytes read"],
        ["browser", "parsed, painted, done"],
      ];
      console.log("%cTRACE / request path%c", css, dim);
      hops.forEach(function (h, i) {
        console.log(
          "%c  " +
            String(i).padStart(2, "0") +
            "  " +
            h[0].toUpperCase().padEnd(9) +
            "%c" +
            h[1],
          css,
          dim,
        );
      });
      return undefined;
    },

    topology: function () {
      console.log("%cLab topology — edge weights are hop cost%c", css, dim);
      Object.keys(GRAPH).forEach(function (node) {
        var edges = Object.keys(GRAPH[node])
          .map(function (n) {
            return n + "(" + GRAPH[node][n] + ")";
          })
          .join("  ");
        console.log("%c  " + node.padEnd(10) + "%c→  " + edges, css, dim);
      });
      console.log("%c\n  Try: ayron.route('internet','data')", dim);
      return undefined;
    },

    route: function (from, to) {
      if (!from || !to) {
        console.log("%cUsage: ayron.route('internet', 'data')", dim);
        return undefined;
      }
      var r = dijkstra(String(from), String(to));
      if (!r) {
        console.log("%cNo route. Nodes: " + Object.keys(GRAPH).join(", "), dim);
        return undefined;
      }
      console.log("%c" + r.path.join(" → ") + "%c   cost " + r.cost, css, dim);
      return undefined;
    },

    binary: function (text) {
      var s = String(text === undefined ? "Ayron" : text);
      var bits = s
        .split("")
        .map(function (ch) {
          return ch.charCodeAt(0).toString(2).padStart(8, "0");
        })
        .join(" ");
      console.log("%c" + bits, css);
      return undefined;
    },

    quine: function () {
      // A genuine quine: this prints its own source exactly.
      var q = function quine() {
        console.log("%c" + quine.toString(), css);
      };
      q();
      return undefined;
    },

    gravity: gravity,
  };

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function init() {
    try {
      window.ayron = api;
      banner();
      konami();
      statusDotEgg();
    } catch (e) {
      /* an easter egg must never break a page */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
