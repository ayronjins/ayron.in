/**
 * tools.js — client for the /api tools service.
 *
 * Handles form submission, progressive status messages, error states and
 * result rendering for the domain, network and SEO tools, plus the local
 * subnet calculator which runs entirely in the browser.
 *
 * All server-supplied values are escaped before insertion into the DOM;
 * nothing from a response is trusted as markup.
 */

(() => {
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const track = (name) => {
    try {
      window.umami?.track(name);
    } catch {}
  };
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const setStatus = (el, text, type = "") => {
    el.hidden = !text;
    el.textContent = text;
    el.className = "tool-status " + type;
  };
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };
  const copyButtons = (scope) =>
    $$("[data-copy]", scope).forEach((b) =>
      b.addEventListener("click", async () => {
        const ok = await copy(
          b.dataset.copy || b.previousElementSibling?.textContent || "",
        );
        const old = b.textContent;
        b.textContent = ok ? "COPIED" : "SELECT + COPY";
        setTimeout(() => (b.textContent = old), 1400);
      }),
    );
  function list(v) {
    return Array.isArray(v) && v.length
      ? v
          .map((x) =>
            typeof x === "object"
              ? Object.entries(x)
                  .map(([k, val]) => `<b>${esc(k)}</b>: ${esc(val)}`)
                  .join(" · ")
              : esc(x),
          )
          .join("<br>")
      : "—";
  }
  function domainTool() {
    const form = $("#domain-form");
    if (!form) return;
    const input = $("#domain-input"),
      status = $("#domain-status"),
      out = $("#domain-results");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      track("domain_scan");
      setStatus(status, "Resolving DNS…");
      out.hidden = true;
      form.querySelector("button").disabled = true;
      try {
        setStatus(status, "Inspecting TLS…");
        await new Promise((r) => setTimeout(r, 160));
        setStatus(status, "Checking HTTP and security headers…");
        const res = await fetch("/api/tools/domain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domain: value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Diagnostic failed");
        setStatus(status, "Diagnostic complete.", "success");
        out.innerHTML = renderDomain(data);
        out.hidden = false;
        copyButtons(out);
      } catch (err) {
        setStatus(status, err.message || "Diagnostic failed.", "error");
      } finally {
        form.querySelector("button").disabled = false;
      }
    });
  }
  function renderDomain(d) {
    const tls = d.tls || {},
      http = d.http || {};
    const cert = tls.available
      ? tls.valid
        ? "VALID"
        : tls.hostname_match
          ? "EXPIRING / INVALID"
          : "HOSTNAME MISMATCH"
      : "UNAVAILABLE";
    const security = http.security_summary || "REVIEW";
    const cells = [
      ["DNS", d.addresses?.length ? "HEALTHY" : "REVIEW"],
      ["HTTPS", tls.available ? "VALID" : "UNAVAILABLE"],
      [
        "CERTIFICATE",
        tls.days_remaining != null ? `${tls.days_remaining} DAYS` : cert,
      ],
      ["HTTP", http.status || "—"],
      ["SECURITY HEADERS", security],
    ];
    return `<div class="result-grid">${cells.map(([a, b]) => `<div class="result-cell"><small>${a}</small><strong class="${String(b).includes("UNAVAILABLE") ? "bad" : ""}">${esc(b)}</strong></div>`).join("")}</div><div class="flow-path">${d.request_path.map((x, i) => `<div class="flow-step ${i === d.request_path.length - 1 ? "active" : ""}">${esc(x)}</div>`).join("")}</div><div class="detail-grid"><section class="detail-box"><h3>TLS / CERTIFICATE</h3><dl>${Object.entries(
      {
        hostname: tls.hostname,
        issuer: tls.issuer,
        valid_from: tls.valid_from,
        expiry: tls.expiry,
        hostname_match: tls.hostname_match ? "yes" : "no",
        tls_version: tls.tls_version,
        cipher: tls.cipher,
        san: (tls.san || []).join(", "),
      },
    )
      .map(
        ([k, v]) =>
          `<dt>${esc(k.replaceAll("_", " ").toUpperCase())}</dt><dd>${esc(v || "—")}</dd>`,
      )
      .join(
        "",
      )}</dl></section><section class="detail-box"><h3>HTTP / SECURITY</h3><dl>${Object.entries(
      {
        final_url: http.final_url,
        redirects: (http.redirects || []).length,
        latency: `${http.latency_ms} ms`,
        content_type: http.content_type,
        server: http.server,
        ...(http.security_headers || {}),
      },
    )
      .map(
        ([k, v]) =>
          `<dt>${esc(k.replaceAll("_", " ").toUpperCase())}</dt><dd>${esc(typeof v === "object" ? JSON.stringify(v) : v || "—")}</dd>`,
      )
      .join(
        "",
      )}</dl></section></div><section class="detail-box" style="margin-top:12px"><div class="copy-row"><h3>DNS RECORDS</h3><button class="tool-btn small" data-copy="${esc(JSON.stringify(d.dns))}">COPY JSON</button></div>${Object.entries(
      d.dns || {},
    )
      .map(
        ([type, rows]) =>
          `<h3>${type}</h3><div class="tool-table-wrap"><table class="tool-table"><thead><tr><th>VALUE</th><th>TTL / PRIORITY</th></tr></thead><tbody>${rows.length ? rows.map((x) => `<tr><td>${esc(x.value)}</td><td>${esc(x.ttl)}${x.priority != null ? " / " + esc(x.priority) : ""}</td></tr>`).join("") : '<tr><td colspan="2">No record returned</td></tr>'}</tbody></table></div>`,
      )
      .join("")}</section>`;
  }
  function siteTool() {
    const form = $("#site-form");
    if (!form) return;
    const input = $("#site-input"),
      status = $("#site-status"),
      out = $("#site-results");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      track("site_scan");
      setStatus(status, "Resolving public destination…");
      out.hidden = true;
      form.querySelector("button").disabled = true;
      try {
        setStatus(status, "Reading HTTP and metadata…");
        await new Promise((r) => setTimeout(r, 160));
        setStatus(status, "Checking robots.txt and sitemap…");
        const res = await fetch("/api/tools/site", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: input.value.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Inspection failed");
        setStatus(status, "Inspection complete.", "success");
        out.innerHTML = renderSite(data);
        out.hidden = false;
        copyButtons(out);
      } catch (err) {
        setStatus(status, err.message || "Inspection failed.", "error");
      } finally {
        form.querySelector("button").disabled = false;
      }
    });
  }
  function renderSite(d) {
    const p = d.page || {},
      h = d.http || {};
    const index = p.robots?.toLowerCase().includes("noindex")
      ? "NOINDEX"
      : h.status >= 400
        ? "ERROR"
        : "INDEXABLE";
    return `<div class="result-grid">${[
      ["HTTP", h.status || "—"],
      ["INDEXABILITY", index],
      ["TITLE", p.title_length ? `${p.title_length} CHARS` : "MISSING"],
      [
        "SITEMAP",
        d.sitemap
          ? `${d.sitemap.sampled_count}/${d.sitemap.url_count} SAMPLED`
          : "NOT FOUND",
      ],
    ]
      .map(
        ([a, b]) =>
          `<div class="result-cell"><small>${a}</small><strong>${esc(b)}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="detail-grid"><section class="detail-box"><h3>PAGE METADATA</h3><dl>${Object.entries(
      {
        final_url: h.final_url,
        title: p.title,
        description: p.description,
        canonical: p.canonical,
        robots: p.robots,
        language: p.language,
        viewport: p.viewport,
        h1: (p.h1 || []).join(" · "),
        h2: (p.h2 || []).join(" · "),
        response: `${h.latency_ms} ms`,
      },
    )
      .map(
        ([k, v]) => `<dt>${esc(k.toUpperCase())}</dt><dd>${esc(v || "—")}</dd>`,
      )
      .join(
        "",
      )}</dl></section><section class="detail-box"><h3>ROBOTS.TXT</h3><dl><dt>STATUS</dt><dd>${esc(d.robots?.status || "—")}</dd><dt>SITEMAPS</dt><dd>${list(d.robots?.sitemaps)}</dd><dt>GROUPS</dt><dd>${(d.robots?.groups || []).map((g) => esc(g.user_agent) + ": " + esc((g.disallow || []).join(", ") || "allow")).join("<br>") || "—"}</dd></dl></section></div><section class="detail-box" style="margin-top:12px"><div class="copy-row"><h3>FINDINGS</h3><button class="tool-btn small" data-copy="${esc(JSON.stringify(d.findings))}">COPY FINDINGS</button></div>${(d.findings || []).map((f) => `<article class="finding ${f.severity.toLowerCase()}"><strong>${esc(f.severity)} / ${esc(f.title)}</strong><p>${esc(f.detail)}</p></article>`).join("")}</section><section class="detail-box" style="margin-top:12px"><h3>STRUCTURED DATA</h3><p class="tool-help">Detected types: ${esc(
      (p.json_ld || [])
        .map((x) =>
          Array.isArray(x["@type"]) ? x["@type"].join(", ") : x["@type"],
        )
        .filter(Boolean)
        .join(", ") || "none detected",
    )}.</p></section></section>`;
  }
  function ipToInt(v) {
    const a = v.split(".").map(Number);
    if (
      a.length !== 4 ||
      a.some((x) => !Number.isInteger(x) || x < 0 || x > 255)
    )
      throw Error("Enter a valid IPv4 address.");
    return (((a[0] * 256 + a[1]) * 256 + a[2]) * 256 + a[3]) >>> 0;
  }
  function intIp(n) {
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }
  function maskInt(p) {
    return p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
  }
  function classify(ip) {
    const n = ipToInt(ip);
    if (
      n >>> 24 === 10 ||
      (n >>> 20 === 0xac1 && n >>> 16 <= 0x1f) ||
      n >>> 16 === 0xc0a8
    )
      return "PRIVATE";
    if (n >>> 24 === 127) return "LOOPBACK";
    if (n >>> 16 === 0xa9fe) return "LINK LOCAL";
    if (n >>> 28 === 14) return "MULTICAST";
    return "PUBLIC / OTHER";
  }
  function calcCidr(ip, prefix) {
    const n = ipToInt(ip),
      mask = maskInt(prefix),
      network = n & mask,
      broadcast = (network | (~mask >>> 0)) >>> 0,
      total = 2 ** (32 - prefix);
    let first = network,
      last = broadcast,
      usable = total;
    if (prefix === 31) {
      usable = 2;
    } else if (prefix === 32) {
      usable = 1;
    } else if (prefix < 31) {
      first = network + 1;
      last = broadcast - 1;
      usable = Math.max(0, total - 2);
    }
    return {
      ip,
      network: intIp(network),
      broadcast: intIp(broadcast),
      prefix,
      mask: intIp(mask),
      wildcard: intIp(~mask >>> 0),
      first: intIp(first),
      last: intIp(last),
      total,
      usable,
      class: classify(ip),
      bits: ip
        .split(".")
        .map(Number)
        .map((x) => x.toString(2).padStart(8, "0"))
        .join(""),
    };
  }
  function networkTool() {
    const form = $("#network-form");
    if (!form) return;
    const result = $("#network-results"),
      split = $("#split-input"),
      vlsm = $("#vlsm-input");
    function render(c) {
      result.innerHTML = `<div class="result-grid">${[
        ["NETWORK", c.network + "/" + c.prefix],
        ["MASK", c.mask],
        ["HOST RANGE", c.first + " – " + c.last],
        ["USABLE", c.usable],
        ["CLASS", c.class],
      ]
        .map(
          ([a, b]) =>
            `<div class="result-cell"><small>${a}</small><strong>${esc(b)}</strong></div>`,
        )
        .join(
          "",
        )}</div><div class="binary-box"><div class="binary-line"><b>IP     </b> ${c.bits.replace(/(.{8})/g, "$1.")}</div><div class="binary-line"><b>MASK   </b> ${c.mask
        .split(".")
        .map((x) => Number(x).toString(2).padStart(8, "0"))
        .join(
          ".",
        )}</div><div class="binary-line"><b>NETWORK</b> <span class="host">${c.network
        .split(".")
        .map((x) => Number(x).toString(2).padStart(8, "0"))
        .join(".")}</span></div></div>`;
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const raw = $("#cidr-input").value.trim();
        const [ip, p] = raw.includes("/")
          ? raw.split("/")
          : [raw, $("#prefix-input").value];
        const prefix = Number(p);
        if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32)
          throw Error("CIDR must be between 0 and 32.");
        render(calcCidr(ip, prefix));
        track("network_calculation");
      } catch (err) {
        result.innerHTML = `<div class="finding critical"><strong>INPUT ERROR</strong><p>${esc(err.message)}</p></div>`;
      }
    });
    $("#split-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const [ip, p] = split.value.trim().split("/"),
          target = Number($("#split-prefix").value),
          base = calcCidr(ip, Number(p));
        if (target < Number(p) || target > 32)
          throw Error("Target prefix must be larger than the parent prefix.");
        const count = 2 ** (target - Number(p)),
          size = 2 ** (32 - target);
        $("#split-results").innerHTML =
          '<div class="tool-table-wrap"><table class="tool-table"><thead><tr><th>NETWORK</th><th>HOST RANGE</th><th>BROADCAST</th><th>ADDRESSES</th></tr></thead><tbody>' +
          Array.from({ length: Math.min(count, 256) }, (_, i) => {
            const n = ipToInt(base.network) + i * size,
              c = calcCidr(intIp(n), target);
            return `<tr><td>${c.network}/${target}</td><td>${c.first} – ${c.last}</td><td>${c.broadcast}</td><td>${c.total}</td></tr>`;
          }).join("") +
          "</tbody></table></div>";
        track("network_calculation");
      } catch (err) {
        $("#split-results").innerHTML =
          `<div class="finding critical"><strong>INPUT ERROR</strong><p>${esc(err.message)}</p></div>`;
      }
    });
    $("#vlsm-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const [ip, p] = vlsm.value.trim().split("/"),
          parent = calcCidr(ip, Number(p));
        const req = $("#vlsm-requests")
          .value.split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => {
            const [name, hosts] = x.split(",").map((y) => y.trim());
            return { name, hosts: Number(hosts) };
          })
          .sort((a, b) => b.hosts - a.hosts);
        let cursor = ipToInt(parent.network),
          rows = [],
          used = 0;
        for (const r of req) {
          if (!r.name || !Number.isInteger(r.hosts) || r.hosts < 1)
            throw Error("Use one name,hosts entry per line.");
          let need = 2;
          while (need - 2 < r.hosts && need < 2 ** 32) need *= 2;
          const bits = 32 - Math.log2(need),
            start = (cursor + need - 1) & ~(need - 1);
          if (start + need - 1 > ipToInt(parent.broadcast))
            throw Error("Requirements do not fit in the parent network.");
          const c = calcCidr(intIp(start), bits);
          rows.push({ ...r, ...c });
          cursor = start + need;
          used += need;
        }
        const free = parent.total - used;
        $("#vlsm-results").innerHTML =
          `<div class="result-grid"><div class="result-cell"><small>USED ADDRESSES</small><strong>${used}</strong></div><div class="result-cell"><small>FREE ADDRESSES</small><strong>${free}</strong></div><div class="result-cell"><small>UTILISATION</small><strong>${((used / parent.total) * 100).toFixed(1)}%</strong></div><div class="result-cell"><small>WASTED / RESERVED</small><strong>${rows.reduce((s, x) => s + x.total - x.hosts, 0)}</strong></div></div><div class="tool-table-wrap"><table class="tool-table"><thead><tr><th>NAME</th><th>NETWORK</th><th>USABLE</th><th>RANGE</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.network}/${r.prefix}</td><td>${r.usable}</td><td>${r.first} – ${r.last}</td></tr>`).join("")}</tbody></table></div><div class="map-tree">${esc(parent.network + "/" + parent.prefix + "\n" + rows.map((r, i) => `${i === rows.length - 1 ? "└" : "├"}── ${r.name} ${r.network}/${r.prefix}`).join("\n") + (free ? "\n└── FREE " + intIp(cursor) + " – " + parent.broadcast : ""))}</div><div class="export-row"><button class="tool-btn small" id="vlsm-copy">COPY TEXT</button><button class="tool-btn small" id="vlsm-json">DOWNLOAD JSON</button><button class="tool-btn small" id="vlsm-csv">DOWNLOAD CSV</button></div>`;
        const json = JSON.stringify(rows, null, 2);
        $("#vlsm-copy").onclick = () => copy(json);
        $("#vlsm-json").onclick = () =>
          download("vlsm.json", json, "application/json");
        $("#vlsm-csv").onclick = () =>
          download(
            "vlsm.csv",
            "name,network,prefix,usable\n" +
              rows
                .map((r) => `${r.name},${r.network},${r.prefix},${r.usable}`)
                .join("\n"),
            "text/csv",
          );
        track("vlsm_calculation");
      } catch (err) {
        $("#vlsm-results").innerHTML =
          `<div class="finding critical"><strong>INPUT ERROR</strong><p>${esc(err.message)}</p></div>`;
      }
    });
  }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  domainTool();
  siteTool();
  networkTool();
})();
