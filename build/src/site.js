/**
 * site.js — interactive behaviour for the landing and topic pages.
 *
 * Begins with the same core (nav, reveals, motion handling) as site-core.js,
 * then adds the page-specific widgets. Each widget is guarded by a presence
 * check on its root element, so one script serves every page and silently
 * does nothing where a widget is absent.
 *
 * Widgets:
 *   - Home topology: SVG paths are measured from live element geometry rather
 *     than hard-coded, so the diagram survives font loading, resize and
 *     reflow. Recomputed via ResizeObserver + `document.fonts.ready`.
 *     The trace loop is paused when offscreen or when the tab is hidden.
 *   - Detail topologies (home lab / networking / AI): breadth-first search
 *     over the edge list finds the route from the root node to the selection,
 *     so the highlighted path is derived, not authored per node.
 *   - Inspectors, service explorer, concept browser, request trace stepper,
 *     agent loop, error loop, command centre, project filter, stack panel.
 *
 * Accessibility: every clickable node is a real button, and a single
 * delegated listener keeps `aria-pressed` in sync with the visual
 * active/selected state across all widget families.
 */

const root = document.documentElement;
root.classList.add("js");
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [
  ...scope.querySelectorAll(selector),
];
const menu = $("#menu"),
  nav = $("#primary-nav"),
  mobileNav = window.matchMedia("(max-width:980px)");
function setBackgroundInert(value) {
  $$("main,.site-footer").forEach((element) => {
    element.inert = value;
  });
}
function closeNav(returnFocus = false) {
  if (!nav || !menu) return;
  nav.classList.remove("open");
  document.body.classList.remove("nav-open");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Open navigation");
  menu.textContent = "☰";
  setBackgroundInert(false);
  if (returnFocus) menu.focus();
}
if (menu && nav) {
  menu.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    if (!open) {
      closeNav();
      return;
    }
    nav.classList.add("open");
    document.body.classList.add("nav-open");
    menu.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-label", "Close navigation");
    menu.textContent = "×";
    setBackgroundInert(true);
    requestAnimationFrame(() => nav.querySelector("a")?.focus());
  });
  nav
    .querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", () => closeNav()));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("open")) {
      closeNav(true);
      return;
    }
    if (event.key === "Tab" && nav.classList.contains("open")) {
      const items = [...nav.querySelectorAll("a"), menu],
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  const resetNav = (event) => {
    if (!event.matches) closeNav();
  };
  if (mobileNav.addEventListener)
    mobileNav.addEventListener("change", resetNav);
  else mobileNav.addListener(resetNav);
}
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduced = motionQuery.matches;
const revealAll = () =>
  $$(".reveal").forEach((element) => element.classList.add("visible"));
$$(".reveal").forEach((element, index) =>
  element.style.setProperty("--delay", `${Math.min(index % 5, 4) * 65}ms`),
);
if (!reduced && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.1 },
  );
  $$(".reveal").forEach((element) => observer.observe(element));
} else revealAll();
const handleMotionChange = (event) => {
  reduced = event.matches;
  if (reduced) revealAll();
};
if (motionQuery.addEventListener)
  motionQuery.addEventListener("change", handleMotionChange);
else motionQuery.addListener(handleMotionChange);
const year = $("#current-year");
if (year) year.textContent = String(new Date().getFullYear());
const homeTopology = $(".home-topology");
if (homeTopology) {
  const canvas = $(".home-topology-canvas", homeTopology),
    svg = $(".home-topology-lines", homeTopology),
    base = $(".home-topology-base", homeTopology),
    active = $(".home-topology-active", homeTopology),
    motion = $("#home-topology-motion", homeTopology),
    toggle = $("#home-topology-toggle", homeTopology),
    routeLabel = $("#home-topology-route", homeTopology),
    nodes = Object.fromEntries(
      $$("[data-home-node]", homeTopology).map((node) => [
        node.dataset.homeNode,
        node,
      ]),
    );
  let routes = [],
    routeIndex = 0,
    routeTimer = null,
    routeVisible = false,
    frame = null,
    paused = false;
  const anchor = (node, edge) => {
    const canvasRect = canvas.getBoundingClientRect(),
      rect = node.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - canvasRect.left,
      y: (edge === "top" ? rect.top : rect.bottom) - canvasRect.top,
    };
  };
  const direct = (from, to) => {
    const a = anchor(from, "bottom"),
      b = anchor(to, "top"),
      mid = a.y + (b.y - a.y) / 2;
    return `M ${a.x} ${a.y} V ${mid} H ${b.x} V ${b.y}`;
  };
  const branch = (to) => {
    const a = anchor(nodes.lab, "bottom"),
      b = anchor(to, "top"),
      junction = a.y + (b.y - a.y) * 0.42;
    return `M ${a.x} ${a.y} V ${junction} H ${b.x} V ${b.y}`;
  };
  function layoutHomeTopology() {
    const rect = canvas.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    routes = [
      {
        from: "internet",
        to: "network",
        path: direct(nodes.internet, nodes.network),
      },
      { from: "network", to: "lab", path: direct(nodes.network, nodes.lab) },
      { from: "lab", to: "ai", path: branch(nodes.ai) },
      { from: "lab", to: "services", path: branch(nodes.services) },
      { from: "lab", to: "data", path: branch(nodes.data) },
    ];
    base.setAttribute("d", routes.map((route) => route.path).join(" "));
    if (!reduced) activateHomeRoute(routeIndex % routes.length);
  }
  function scheduleHomeTopology() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      layoutHomeTopology();
    });
  }
  function activateHomeRoute(index) {
    if (reduced || !routes.length) return;
    const route = routes[index % routes.length];
    active.setAttribute("d", route.path);
    routeLabel.textContent =
      "TRACE / " + route.from.toUpperCase() + " → " + route.to.toUpperCase();
    $$("[data-home-node]", homeTopology).forEach((node) =>
      node.classList.toggle(
        "route-active",
        node === nodes[route.from] || node === nodes[route.to],
      ),
    );
    motion.setAttribute("path", route.path);
    if (typeof motion.beginElement === "function") motion.beginElement();
    routeIndex = index + 1;
  }
  function stopHomeTopology() {
    if (routeTimer) {
      clearInterval(routeTimer);
      routeTimer = null;
    }
  }
  function startHomeTopology() {
    if (reduced || paused || document.hidden || !routeVisible || routeTimer)
      return;
    activateHomeRoute(routeIndex);
    routeTimer = setInterval(() => activateHomeRoute(routeIndex), 2200);
  }
  scheduleHomeTopology();
  window.addEventListener("resize", scheduleHomeTopology, { passive: true });
  if ("ResizeObserver" in window)
    new ResizeObserver(scheduleHomeTopology).observe(canvas);
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(scheduleHomeTopology);
  if ("IntersectionObserver" in window)
    new IntersectionObserver(
      (entries) => {
        routeVisible = entries[0].isIntersecting;
        if (routeVisible) startHomeTopology();
        else stopHomeTopology();
      },
      { threshold: 0.08 },
    ).observe(homeTopology);
  else {
    routeVisible = true;
    startHomeTopology();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopHomeTopology();
    else startHomeTopology();
  });
  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.textContent = paused ? "Resume animation" : "Pause animation";
    if (paused) {
      stopHomeTopology();
      if (typeof svg.pauseAnimations === "function") svg.pauseAnimations();
    } else {
      if (typeof svg.unpauseAnimations === "function") svg.unpauseAnimations();
      startHomeTopology();
    }
  });
  const updateHomeMotion = () => {
    toggle.disabled = reduced;
    toggle.textContent = reduced
      ? "Motion reduced"
      : paused
        ? "Resume animation"
        : "Pause animation";
    if (reduced) {
      stopHomeTopology();
      active.setAttribute("d", "");
      $$("[data-home-node]", homeTopology).forEach((node) =>
        node.classList.remove("route-active"),
      );
    } else startHomeTopology();
  };
  updateHomeMotion();
  if (motionQuery.addEventListener)
    motionQuery.addEventListener("change", updateHomeMotion);
  else motionQuery.addListener(updateHomeMotion);
}

$$("[data-detail-topology]").forEach((map) => {
  const canvas = $(".detail-topology-canvas", map),
    svg = $(".detail-topology-lines", map),
    base = $(".detail-topology-base", map),
    active = $(".detail-topology-active", map),
    motion = $("animateMotion", map),
    routeLabel = $(".detail-route-label", map),
    nodes = Object.fromEntries(
      $$("[data-detail-node]", map).map((node) => [
        node.dataset.detailNode,
        node,
      ]),
    ),
    edges = (map.dataset.edges || "").split(",").map((edge) => edge.split(">")),
    rootId = map.dataset.root;
  let selected = map.dataset.selected,
    frame = null;
  const point = (node) => {
    const c = canvas.getBoundingClientRect(),
      r = node.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - c.left,
      top: r.top - c.top,
      bottom: r.bottom - c.top,
      cy: r.top + r.height / 2 - c.top,
      left: r.left - c.left,
      right: r.right - c.left,
    };
  };
  const segment = (from, to) => {
    const a = point(nodes[from]),
      b = point(nodes[to]);
    if (Math.abs(a.cy - b.cy) < 18) {
      const forward = a.x <= b.x;
      return `M ${forward ? a.right : a.left} ${a.cy} H ${forward ? b.left : b.right}`;
    }
    const down = a.cy < b.cy,
      startY = down ? a.bottom : a.top,
      endY = down ? b.top : b.bottom,
      mid = startY + (endY - startY) / 2;
    return `M ${a.x} ${startY} V ${mid} H ${b.x} V ${endY}`;
  };
  const routeTo = (target) => {
    if (target === rootId) return [rootId];
    const queue = [[rootId]],
      seen = new Set([rootId]);
    while (queue.length) {
      const path = queue.shift(),
        last = path[path.length - 1];
      for (const [a, b] of edges) {
        const next = a === last ? b : b === last ? a : null;
        if (!next || seen.has(next)) continue;
        const candidate = [...path, next];
        if (next === target) return candidate;
        seen.add(next);
        queue.push(candidate);
      }
    }
    return [rootId, target];
  };
  function draw() {
    const rect = canvas.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    base.setAttribute("d", edges.map(([a, b]) => segment(a, b)).join(" "));
    const route = routeTo(selected),
      path = route
        .slice(0, -1)
        .map((id, index) => segment(id, route[index + 1]))
        .join(" ");
    active.setAttribute("d", path);
    motion.setAttribute("path", path || "M0 0L0 0");
    routeLabel.textContent = route
      .map((id) => nodes[id].dataset.label || id)
      .join(" → ")
      .toUpperCase();
    $$("[data-detail-node]", map).forEach((node) => {
      const isSelected = node.dataset.detailNode === selected,
        isRoute = route.includes(node.dataset.detailNode);
      node.classList.toggle("is-selected", isSelected);
      node.classList.toggle("is-route", isRoute);
      node.setAttribute("aria-pressed", String(isSelected));
    });
    if (!reduced && path && typeof motion.beginElement === "function")
      motion.beginElement();
  }
  function select(id) {
    if (!nodes[id]) return;
    selected = id;
    map.dataset.selected = id;
    draw();
    if (map.dataset.detailTopology === "ai") {
      const node = nodes[id],
        inspector = map.parentElement.querySelector(".detail-inspector-ai");
      $("h4", inspector).textContent = node.dataset.label;
      $("p", inspector).textContent = node.dataset.summary;
    }
  }
  $$("[data-detail-node]", map).forEach((node) =>
    node.addEventListener("click", () => select(node.dataset.detailNode)),
  );
  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  new ResizeObserver(schedule).observe(canvas);
  draw();
});

if ($("#home-lab")) {
  const nodeData = {
    internet: [
      "Internet / Edge",
      "Entry boundary",
      "The conceptual starting point for a request. It is shown as a layer, not a claim about one fixed route.",
      "STATUS / CONCEPT",
    ],
    network: [
      "Network / Router",
      "Connectivity layer",
      "Routing and policy determine which paths are possible before a service sees traffic.",
      "STATUS / MANAGED",
    ],
    dns: [
      "DNS / Traffic",
      "Name and traffic layer",
      "Resolution and traffic decisions connect clients, domains and the services behind them.",
      "STATUS / CONCEPT",
    ],
    adguard: [
      "AdGuard Home",
      "DNS and filtering",
      "Network-level DNS filtering and DNS management in the lab.",
      "STATUS / ACTIVE",
    ],
    nginx: [
      "Nginx",
      "Reverse proxy / web",
      "A web-serving and reverse-proxy layer for routing appropriate web requests to applications.",
      "STATUS / ACTIVE",
    ],
    proxmox: [
      "Proxmox VE",
      "Virtualization platform",
      "The virtualization foundation: workloads can be isolated and managed through virtual machines and virtualized environments.",
      "STATUS / ACTIVE",
    ],
    ubuntu: [
      "Ubuntu Server / Linux",
      "Operating system layer",
      "Linux provides the administration, service, package, log, permission and networking surface around workloads.",
      "STATUS / ACTIVE",
    ],
    docker: [
      "Docker",
      "Container runtime",
      "Containerization helps deploy and isolate self-hosted applications and services.",
      "STATUS / ACTIVE",
    ],
  };
  function inspectNode(id) {
    const d = nodeData[id];
    if (!d) return;
    document.querySelector("#inspector-id").textContent =
      "NODE / " +
      String(Object.keys(nodeData).indexOf(id) + 1).padStart(2, "0");
    document.querySelector("#inspector-title").textContent = d[0];
    document.querySelector("#inspector-copy").textContent =
      "Selected layer in the conceptual Home Lab architecture.";
    document.querySelector("#inspector-role").textContent = d[1];
    document.querySelector("#inspector-purpose").textContent = d[2];
    document.querySelector("#inspector-status").textContent = d[3];
    document.querySelectorAll("[data-node]").forEach((n) => {
      const selected = n.dataset.node === id;
      n.classList.toggle("selected", selected);
      n.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll(".map-wire").forEach((w) => {
      const route = w.dataset.route || "";
      const active = route.split(" ").includes(id);
      w.classList.toggle("active", active);
      w.classList.toggle("dim", !active);
    });
  }
  document.querySelectorAll("[data-node]").forEach((node) => {
    node.addEventListener("click", () => inspectNode(node.dataset.node));
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        inspectNode(node.dataset.node);
      }
    });
  });
  inspectNode("proxmox");
  const serviceData = {
    nginx: [
      "Nginx",
      "A web server and reverse-proxy layer. WHY I RUN IT / To route appropriate web requests and keep the edge understandable. CONNECTS TO / Public domains and backend applications.",
    ],
    portainer: [
      "Portainer",
      "A management interface for Docker workloads. WHY I RUN IT / To keep container deployment and visibility organized. CONNECTS TO / Docker host and containerized services.",
    ],
    adguard: [
      "AdGuard Home",
      "Network-level DNS filtering and DNS management. WHY I RUN IT / To make name resolution and filtering part of the infrastructure. CONNECTS TO / Clients, DNS requests and the network.",
    ],
    immich: [
      "Immich",
      "A self-hosted photo and video platform. WHY I RUN IT / To explore media services and their storage needs. CONNECTS TO / Media data, storage and application services.",
    ],
    nextcloud: [
      "Nextcloud",
      "A private/self-hosted cloud and file service. WHY I RUN IT / To understand a useful application beyond the infrastructure layer. CONNECTS TO / Storage, clients and web access.",
    ],
    ollama: [
      "Ollama",
      "A local model runtime. WHY I RUN IT / To experiment with locally hosted language models. CONNECTS TO / Local compute and AI interfaces.",
    ],
    openwebui: [
      "Open WebUI",
      "A web interface for locally hosted AI models and services. WHY I RUN IT / To make model interaction a usable application layer. CONNECTS TO / Ollama and authorized users.",
    ],
    papermc: [
      "PaperMC",
      "A Minecraft server platform. WHY I RUN IT / To operate a stateful self-hosted server workload. CONNECTS TO / Server resources, network access and game data.",
    ],
    web: [
      "Web / news service",
      "A self-hosted web/news application path. WHY I RUN IT / To operate a public-facing service through a deliberate edge. CONNECTS TO / Nginx, application processes and cached content.",
    ],
  };
  function selectService(id) {
    const d = serviceData[id];
    if (!d) return;
    document.querySelector("#service-title").textContent = d[0];
    document.querySelector("#service-copy").textContent = d[1];
    document
      .querySelectorAll(".service-card")
      .forEach((c) => c.classList.toggle("selected", c.dataset.service === id));
  }
  document
    .querySelectorAll(".service-card")
    .forEach((c) =>
      c.addEventListener("click", () => selectService(c.dataset.service)),
    );
  document.querySelectorAll("[data-filter]").forEach((filter) =>
    filter.addEventListener("click", () => {
      const value = filter.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((x) => x.classList.toggle("active", x === filter));
      const cards = [...document.querySelectorAll(".service-card")];
      cards.forEach((card) => {
        card.hidden = value !== "all" && card.dataset.category !== value;
      });
      const selected = cards.find(
        (card) => card.classList.contains("selected") && !card.hidden,
      );
      if (!selected) {
        const first = cards.find((card) => !card.hidden);
        if (first) selectService(first.dataset.service);
      }
    }),
  );
  const terminalResponses = {
    help: "<b>$ help</b>\nservices  list service roles\nnetwork   show the conceptual network path\nai        show the local AI path\nstorage   show the storage relationship",
    services:
      "<b>$ services</b>\nadguard-home · immich · nextcloud · ollama · openwebui · nginx · portainer · papermc",
    network:
      "<b>$ network</b>\nclient → DNS request → AdGuard Home → network → reverse proxy / service",
    ai: "<b>$ ai</b>\nlocal compute → Ollama → local model → Open WebUI",
    storage:
      "<b>$ storage</b>\nservice data → storage layer → authorized application access",
  };
  document.querySelectorAll("[data-command]").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelector("#terminal-screen").innerHTML =
        terminalResponses[button.dataset.command] || terminalResponses.help;
    }),
  );
  const trace = document.querySelector("#trace-request"),
    traceBar = trace.closest(".trace-bar"),
    traceCopy = traceBar.querySelector("p");
  let traceTimer = null;
  function resetHomeTrace() {
    if (traceTimer) {
      clearTimeout(traceTimer);
      traceTimer = null;
    }
    traceBar.classList.remove("is-tracing");
    trace.setAttribute("aria-pressed", "false");
    trace.firstChild.textContent = "Start trace ";
    traceCopy.textContent =
      "Educational path only—the exact route depends on the service.";
  }
  trace.addEventListener("click", () => {
    if (traceBar.classList.contains("is-tracing")) {
      resetHomeTrace();
      return;
    }
    resetHomeTrace();
    traceBar.classList.add("is-tracing");
    trace.setAttribute("aria-pressed", "true");
    trace.firstChild.textContent = "Trace active ";
    traceCopy.textContent =
      "USER → NETWORK → DNS → ADGUARD → SERVER → REVERSE PROXY → SERVICE";
    if (reduced) return;
    traceTimer = setTimeout(resetHomeTrace, 4200);
  });
}
if ($("#networking")) {
  const networkNodeData = {
    internet: [
      "Public internet",
      "Edge context",
      "The conceptual source of a request entering an exposed service path.",
      "Public boundary, router and DNS.",
      "STATUS / CONCEPTUAL",
    ],
    public: [
      "Public address",
      "Reachable boundary",
      "A name may resolve toward a reachable public address without exposing the internal topology.",
      "DNS, router and NAT.",
      "STATUS / CONCEPTUAL",
    ],
    router: [
      "Router / edge path",
      "Connectivity boundary",
      "Routes traffic between networks and provides the edge where forwarding decisions matter.",
      "Public path, firewall, NAT and local network.",
      "STATUS / CONCEPTUAL",
    ],
    firewall: [
      "Firewall",
      "Traffic rules",
      "Evaluates source, destination, protocol and port against rules.",
      "Router, ports and service exposure.",
      "STATUS / PRINCIPLE",
    ],
    nat: [
      "NAT / port forwarding",
      "Translation layer",
      "Maps traffic between public and private contexts; forwarding directs selected inbound traffic toward an internal destination.",
      "Router, internal server, firewall and proxy.",
      "STATUS / CONCEPTUAL",
    ],
    nginx: [
      "Nginx",
      "Reverse proxy",
      "Receives appropriate web requests and routes them toward an internal application.",
      "Hostnames, ports and self-hosted services.",
      "STATUS / ACTIVE",
    ],
    services: [
      "Internal services",
      "Application layer",
      "The destination application responds after the path and routing layers succeed.",
      "Nginx, Docker, Linux and service ports.",
      "STATUS / CONCEPTUAL",
    ],
    client: [
      "Client device",
      "Request origin",
      "A browser or device starts the request and depends on local network and DNS behavior.",
      "Local network, DNS and the requested service.",
      "STATUS / CONCEPTUAL",
    ],
    adguard: [
      "AdGuard Home",
      "DNS / filtering",
      "Handles network-level DNS filtering and resolution within the lab.",
      "Clients, DNS queries and upstream resolution.",
      "STATUS / ACTIVE",
    ],
  };
  function inspectNetworkNode(id) {
    const d = networkNodeData[id];
    if (!d) return;
    document.querySelector("#net-inspector-id").textContent =
      "NODE / " +
      String(Object.keys(networkNodeData).indexOf(id) + 1).padStart(2, "0");
    document.querySelector("#net-inspector-title").textContent = d[0];
    document.querySelector("#net-inspector-copy").textContent =
      "Selected node in the conceptual request path.";
    document.querySelector("#net-role").textContent = d[1];
    document.querySelector("#net-purpose").textContent = d[2];
    document.querySelector("#net-connected").textContent = d[3];
    document.querySelector("#net-status").textContent = d[4];
    document
      .querySelectorAll("[data-net-node]")
      .forEach((n) => n.classList.toggle("selected", n.dataset.netNode === id));
    document.querySelectorAll(".net-wire").forEach((w) => {
      const active = (w.dataset.netRoute || "").split(" ").includes(id);
      w.classList.toggle("hot", active);
      w.classList.toggle("dim", !active);
    });
  }
  document.querySelectorAll("[data-net-node]").forEach((n) => {
    n.addEventListener("click", () => inspectNetworkNode(n.dataset.netNode));
    n.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        inspectNetworkNode(n.dataset.netNode);
      }
    });
  });
  inspectNetworkNode("router");
  const conceptData = {
    dns: [
      "DNS / NAME RESOLUTION",
      "Maps human-readable domain names to IP addresses.",
      "Without DNS, users would need to remember raw addresses.",
      "IN MY ENVIRONMENT / DNS is also used for network-level filtering and local service resolution.",
      "CONNECTED TO / AdGuard Home, local clients, domains and exposed services.",
    ],
    nat: [
      "NAT / TRANSLATION",
      "Translates traffic between private network context and public internet context.",
      "It makes the boundary explicit and gives forwarding rules a place to operate.",
      "IN MY ENVIRONMENT / Treat NAT as a path to trace, not a guarantee of reachability.",
      "CONNECTED TO / Router, private addresses, public addresses and port forwarding.",
    ],
    portforward: [
      "PORT FORWARDING / SELECTIVE PATH",
      "Directs selected inbound traffic toward an internal destination.",
      "The rule is only one part of exposure; listeners, firewall and proxy must also agree.",
      "IN MY ENVIRONMENT / Understand the internal address, listening port and complete request path.",
      "CONNECTED TO / Router, firewall, internal server and Nginx.",
    ],
    proxy: [
      "REVERSE PROXY / ROUTING",
      "Receives a request and chooses an internal service destination.",
      "A front door reduces the need to expose each application independently.",
      "IN MY ENVIRONMENT / Nginx provides a web-serving and routing layer for appropriate services.",
      "CONNECTED TO / Hostnames, HTTPS, internal ports and applications.",
    ],
    firewall: [
      "FIREWALL / RULES",
      "Evaluates traffic using source, destination, protocol and port.",
      "Open only what needs to be reachable and keep management surfaces private where possible.",
      "IN MY ENVIRONMENT / Firewall thinking is part of diagnosing exposure and reachability.",
      "CONNECTED TO / Router, ports, protocols and service boundaries.",
    ],
    routing: [
      "ROUTING / PATHS",
      "Chooses where traffic should go between connected networks.",
      "A service can be healthy while the path toward it is wrong.",
      "IN MY ENVIRONMENT / Trace the next hop and boundary before changing application settings.",
      "CONNECTED TO / Gateways, local networks, NAT and services.",
    ],
    local: [
      "LOCAL NETWORK / LAN",
      "Connects devices and services inside the local environment.",
      "Local reachability helps separate application problems from public exposure problems.",
      "IN MY ENVIRONMENT / Test locally before assuming the internet path is broken.",
      "CONNECTED TO / Clients, gateway, DNS and private services.",
    ],
    public: [
      "PUBLIC INTERNET / EDGE",
      "The wider network context from which an intentionally exposed service may be reached.",
      "Public reachability adds DNS, NAT, firewall, proxy and upstream dependencies.",
      "IN MY ENVIRONMENT / Public access should be deliberate and understood.",
      "CONNECTED TO / Domains, public address, router and reverse proxy.",
    ],
  };
  function selectConcept(id) {
    const d = conceptData[id];
    if (!d) return;
    [
      "concept-title",
      "concept-what",
      "concept-why",
      "concept-use",
      "concept-connected",
    ].forEach((x, i) => (document.querySelector("#" + x).textContent = d[i]));
    document
      .querySelectorAll("[data-concept]")
      .forEach((b) => b.classList.toggle("active", b.dataset.concept === id));
  }
  document
    .querySelectorAll("[data-concept]")
    .forEach((b) =>
      b.addEventListener("click", () => selectConcept(b.dataset.concept)),
    );
  const traceData = [
    [
      "01 — BROWSER",
      "The browser requests a hostname instead of an IP address.",
    ],
    ["02 — DOMAIN", "The hostname identifies the intended public service."],
    ["03 — DNS", "A resolver maps the domain to an address."],
    ["04 — PUBLIC IP", "The request reaches the public network boundary."],
    ["05 — ROUTER", "The edge device receives the incoming traffic."],
    [
      "06 — NAT / PORT FORWARD",
      "Selected traffic is mapped toward an internal destination.",
    ],
    [
      "07 — NGINX",
      "The reverse proxy routes the request to the correct application.",
    ],
    ["08 — APPLICATION", "The self-hosted service processes the request."],
    ["09 — RESPONSE", "The result travels back through the request path."],
  ];
  function showTrace(i) {
    const d = traceData[i];
    document.querySelector("#trace-detail").innerHTML =
      "<b>" + d[0] + "</b><br>" + d[1];
    document.querySelectorAll("[data-trace]").forEach((x) => {
      const n = Number(x.dataset.trace);
      x.classList.toggle("active", n === i);
      x.classList.toggle("completed", n < i);
      x.setAttribute("aria-pressed", String(n === i));
      if (n === i) x.setAttribute("aria-current", "step");
      else x.removeAttribute("aria-current");
    });
  }
  document
    .querySelectorAll("[data-trace]")
    .forEach((x) =>
      x.addEventListener("click", () => showTrace(Number(x.dataset.trace))),
    );
  const netTrace = document.querySelector("#network-trace");
  let netTraceTimer = null;
  function finishNetTrace() {
    if (netTraceTimer) {
      clearInterval(netTraceTimer);
      netTraceTimer = null;
    }
    netTrace.firstChild.textContent = "Start trace ";
    netTrace.setAttribute("aria-pressed", "false");
    netTrace.removeAttribute("aria-busy");
  }
  netTrace.addEventListener("click", () => {
    if (netTraceTimer) {
      finishNetTrace();
      return;
    }
    if (reduced) {
      showTrace(traceData.length - 1);
      return;
    }
    let i = 0;
    netTrace.firstChild.textContent = "Stop trace ";
    netTrace.setAttribute("aria-pressed", "true");
    netTrace.setAttribute("aria-busy", "true");
    showTrace(i++);
    netTraceTimer = setInterval(() => {
      showTrace(i++);
      if (i >= traceData.length) finishNetTrace();
    }, 700);
  });
  const netCommands = {
    "ip addr": "Inspect interfaces and assigned addresses.",
    "ip route": "Inspect routes and the gateway path.",
    "ping host": "Test basic reachability to a host.",
    "curl service": "Test HTTP behavior directly.",
    "ss -tulpn": "Show listening sockets and owning processes.",
    "dig domain": "Query DNS records and resolution details.",
    "traceroute host": "Observe hops toward a destination.",
  };
  document.querySelectorAll("[data-net-command]").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll("[data-net-command]")
        .forEach((x) => x.classList.toggle("active", x === b));
      document.querySelector("#network-command-output").innerHTML =
        "<b>$ " +
        b.dataset.netCommand +
        "</b><br>" +
        netCommands[b.dataset.netCommand];
    }),
  );
}
if ($("#ai-development")) {
  const loopData = {
    observe: [
      "OBSERVE",
      "The system receives information about the current task or environment.",
    ],
    understand: [
      "UNDERSTAND",
      "The model interprets the goal and current context.",
    ],
    plan: ["PLAN", "The agent determines the next useful action."],
    act: [
      "ACT",
      "The controller calls an available tool or interacts with the computer.",
    ],
    verify: [
      "VERIFY",
      "The result returns to the model so it can decide whether the action worked.",
    ],
  };
  const loopOrder = Object.keys(loopData),
    loopLayout = window.matchMedia("(max-width:760px)"),
    agentLoop = $(".agent-loop"),
    loopDetail = $("#loop-detail");
  function placeLoopDetail(active) {
    if (loopLayout.matches) {
      active.insertAdjacentElement("afterend", loopDetail);
      loopDetail.classList.add("loop-inline");
    } else {
      agentLoop.insertAdjacentElement("afterend", loopDetail);
      loopDetail.classList.remove("loop-inline");
    }
  }
  function selectLoop(id) {
    const d = loopData[id],
      current = loopOrder.indexOf(id),
      selected = $(`[data-loop="${id}"]`);
    loopDetail.innerHTML = "<b>" + d[0] + "</b><br>" + d[1];
    document.querySelectorAll("[data-loop]").forEach((x) => {
      const n = loopOrder.indexOf(x.dataset.loop);
      x.classList.toggle("active", n === current);
      x.classList.toggle("completed", n < current);
      x.classList.toggle("inactive", n > current);
    });
    placeLoopDetail(selected);
  }
  document
    .querySelectorAll("[data-loop]")
    .forEach((x) =>
      x.addEventListener("click", () => selectLoop(x.dataset.loop)),
    );
  const syncLoopLayout = () => placeLoopDetail($(".loop-step.active"));
  if (loopLayout.addEventListener)
    loopLayout.addEventListener("change", syncLoopLayout);
  else loopLayout.addListener(syncLoopLayout);
  selectLoop("observe");
  const errorData = {
    action: "An agent starts with an explicit action request.",
    result: "Inspect the returned state before assuming success.",
    analyze:
      "Classify the failure and determine whether the original goal is still valid.",
    retry: "Choose a new action, ask the user for input or stop safely.",
  };
  document.querySelectorAll("[data-error-step]").forEach((x) =>
    x.addEventListener("click", () => {
      document.querySelector("#error-output").textContent =
        errorData[x.dataset.errorStep];
      document
        .querySelectorAll("[data-error-step]")
        .forEach((y) => y.classList.toggle("active", y === x));
    }),
  );
  const centerData = {
    files: [
      "Source structure",
      "FILES · DOM",
      "files.inspect",
      "index.html",
      "structure mapped",
      '<b>[01]</b> Source opened<br><b>[02]</b> Sections indexed<br><b>[03]</b> CSS rules mapped<br><b>[04]</b> Interaction handlers mapped<br><b>[05]</b> Sensitive-data scan passed<br><b>[06]</b> Structure verified<br><span class="done"><b>[07]</b> Complete</span>',
    ],
    documents: [
      "QA report",
      "DOCUMENTS · FILES",
      "documents.create",
      "responsive-audit.md",
      "report generated",
      '<b>[01]</b> Findings grouped<br><b>[02]</b> Duplicates removed<br><b>[03]</b> Severity assigned<br><b>[04]</b> Evidence linked<br><b>[05]</b> Summary generated<br><b>[06]</b> Output reviewed<br><span class="done"><b>[07]</b> Complete</span>',
    ],
    web: [
      "Viewport verification",
      "BROWSER · DOM",
      "browser.viewport_audit",
      "320–2560 px",
      "141 widths checked",
      '<b>[01]</b> Browser launched<br><b>[02]</b> Viewports generated<br><b>[03]</b> Overflow measured<br><b>[04]</b> Touch targets checked<br><b>[05]</b> Interactions exercised<br><b>[06]</b> Layout verified<br><span class="done"><b>[07]</b> Complete</span>',
    ],
    commands: [
      "Deployment validation",
      "SHELL · NGINX",
      "nginx.test",
      "site configuration",
      "syntax valid",
      '<b>[01]</b> Configuration loaded<br><b>[02]</b> Syntax checked<br><b>[03]</b> Virtual host resolved<br><b>[04]</b> Portfolio requested<br><b>[05]</b> Related sites checked<br><b>[06]</b> Source hash compared<br><span class="done"><b>[07]</b> Complete</span>',
    ],
  };
  document.querySelectorAll("[data-center-tool]").forEach((b) =>
    b.addEventListener("click", () => {
      const d = centerData[b.dataset.centerTool];
      document.querySelector("#center-step").textContent = d[0];
      document.querySelector("#center-tools").textContent = d[1];
      document.querySelector("#tool-call").innerHTML =
        "<b>TOOL</b> " +
        d[2] +
        "<br><b>INPUT</b> " +
        d[3] +
        "<br><b>RESULT</b> " +
        d[4];
      document.querySelector("#event-stream").innerHTML = d[5];
      document
        .querySelectorAll("[data-center-tool]")
        .forEach((x) => x.classList.toggle("active", x === b));
    }),
  );
}
if ($(".project-card")) {
  const projectData = {
    agent: {
      status: "AI / EXPERIMENTAL",
      title: "AI Computer Agent",
      summary:
        "A tool-enabled model architecture for controlled computer interaction and multi-step digital work.",
      problem: "Move AI beyond text generation into a controlled action loop.",
      architecture: "LLM → controller → tools → computer → observation.",
      learned:
        "Permissions, state, verification, failure handling and feedback loops matter.",
    },
    lab: {
      status: "INFRASTRUCTURE / ACTIVE",
      title: "Self-hosted Home Lab",
      summary:
        "A connected environment for virtualization, Linux, containers, services and troubleshooting.",
      problem:
        "Learn how real applications fit together across infrastructure layers.",
      architecture: "Proxmox → Linux → Docker → Portainer → services.",
      learned:
        "Boundaries make hosts, guests, containers and services easier to reason about.",
    },
    network: {
      status: "NETWORKING / ACTIVE",
      title: "Self-hosted Network Infrastructure",
      summary:
        "A practical path for DNS, reverse proxies, NAT, port forwarding and connectivity diagnosis.",
      problem:
        "Make services reachable without losing sight of the layers involved.",
      architecture: "Domain → DNS → router → NAT → proxy → service.",
      learned: "Local success and public reachability are different tests.",
    },
    "local-ai": {
      status: "AI / ONGOING",
      title: "Local AI Lab",
      summary:
        "An environment for local model runtimes, interfaces, retrieval and agent experiments.",
      problem:
        "Understand AI deployment and experimentation below the hosted API layer.",
      architecture: "Local compute → Ollama → model → OpenWebUI → experiments.",
      learned:
        "Model choice, infrastructure and interface design shape the experience.",
    },
    dashboard: {
      status: "DEVELOPMENT / EXPERIMENTAL",
      title: "Infrastructure Dashboard",
      summary:
        "A read-only observability interface for making system state easier to inspect.",
      problem: "Turn infrastructure signals into a useful, bounded view.",
      architecture: "Linux state → API → dashboard → human decision.",
      learned:
        "Observability should explain attention, not just display numbers.",
    },
  };
  const projectGrid = document.querySelector(".project-grid"),
    projectDetail = document.querySelector("#project-detail"),
    projectDetailQuery = window.matchMedia("(max-width:540px)");
  function placeProjectDetail() {
    const selected = projectGrid.querySelector(".project-card.selected");
    if (projectDetailQuery.matches && selected)
      selected.insertAdjacentElement("afterend", projectDetail);
    else projectGrid.insertAdjacentElement("afterend", projectDetail);
  }
  const projectDetailResize = () => placeProjectDetail();
  if (projectDetailQuery.addEventListener)
    projectDetailQuery.addEventListener("change", projectDetailResize);
  else projectDetailQuery.addListener(projectDetailResize);
  function selectProject(id) {
    const d = projectData[id];
    if (!d) return;
    document.querySelector("#detail-status").textContent = d.status;
    document.querySelector("#detail-title").textContent = d.title;
    document.querySelector("#detail-summary").textContent = d.summary;
    document.querySelector("#detail-problem").textContent = d.problem;
    document.querySelector("#detail-architecture").textContent = d.architecture;
    document.querySelector("#detail-learned").textContent = d.learned;
    document
      .querySelectorAll(".project-card")
      .forEach((x) => x.classList.toggle("selected", x.dataset.project === id));
    placeProjectDetail();
  }
  document
    .querySelectorAll(".project-card")
    .forEach((x) =>
      x.addEventListener("click", () => selectProject(x.dataset.project)),
    );
  document.querySelectorAll("[data-project-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      const v = b.dataset.projectFilter;
      document
        .querySelectorAll("[data-project-filter]")
        .forEach((x) => x.classList.toggle("active", x === b));
      const cards = [...document.querySelectorAll(".project-card")];
      cards.forEach((c) => {
        c.hidden = v !== "all" && !c.dataset.category.split(" ").includes(v);
      });
      const selected = cards.find(
        (c) => c.classList.contains("selected") && !c.hidden,
      );
      if (!selected) {
        const first = cards.find((c) => !c.hidden);
        if (first) selectProject(first.dataset.project);
      }
    }),
  );
  placeProjectDetail();
}
if ($("[data-stack]")) {
  const stackData = {
    docker: [
      "DOCKER / CONTAINERIZATION",
      "USED FOR / Containerized services.<br>CONNECTED TO / Portainer, Linux and self-hosted applications.<br>RELATED KNOWLEDGE / Ports, volumes, networks and environment variables.",
    ],
    nginx: [
      "NGINX / REVERSE PROXY",
      "USED FOR / Web serving and reverse proxying.<br>CONNECTED TO / HTTP, domains, ports, DNS and applications.<br>RELATED KNOWLEDGE / Hostnames, request routing and internal destinations.",
    ],
    ollama: [
      "OLLAMA / LOCAL AI",
      "USED FOR / Local AI model runtime.<br>CONNECTED TO / Local compute, models, OpenWebUI and experiments.<br>RELATED KNOWLEDGE / Inference, model selection and AI infrastructure.",
    ],
  };
  document.querySelectorAll("[data-stack]").forEach((b) =>
    b.addEventListener("click", () => {
      const d = stackData[b.dataset.stack];
      document.querySelector("#stack-title").innerHTML = d[0];
      document.querySelector("#stack-copy").innerHTML = d[1];
      document
        .querySelectorAll("[data-stack]")
        .forEach((x) => x.classList.toggle("active", x === b));
    }),
  );
}

const selectable =
  "[data-filter],[data-concept],[data-trace],[data-net-command],[data-loop],[data-error-step],[data-center-tool],[data-project-filter],[data-stack],[data-node],[data-net-node],.service-card,.project-card";
function syncSelectionStates() {
  document
    .querySelectorAll(selectable)
    .forEach((element) =>
      element.setAttribute(
        "aria-pressed",
        String(
          element.classList.contains("active") ||
            element.classList.contains("selected"),
        ),
      ),
    );
}
document.addEventListener("click", (event) => {
  if (event.target.closest(selectable)) queueMicrotask(syncSelectionStates);
});
syncSelectionStates();
