/**
 * Post-build verification for ayron.in
 * ------------------------------------
 * A static site has no test suite to fall back on, so this script asserts the
 * invariants that actually break in production:
 *
 *   1. Every local asset referenced by an HTML page exists on disk.
 *   2. Every internal link resolves to a real page (directory or file).
 *   3. Every built asset ships a sourcemap that embeds its original source.
 *   4. Every page carries the metadata that makes it indexable and shareable.
 *
 * It exits non-zero on the first category of failure, so it is safe to wire
 * into a pre-deploy hook. Usage: npm run verify
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Paths that exist at runtime but not on disk: nginx proxies these upstream
 * (see the site's server block). They are legitimate references, so the
 * dead-link check must not flag them.
 */
const PROXIED_PREFIXES = ["/analytics/", "/api/"];

const REQUIRED_META = [
  { label: "title", test: /<title>[^<]{10,}<\/title>/i },
  { label: "meta description", test: /<meta\s+name=["']description["']/i },
  { label: "canonical", test: /<link\s+rel=["']canonical["']/i },
  { label: "og:title", test: /property=["']og:title["']/i },
  { label: "lang attribute", test: /<html[^>]+lang=/i },
  { label: "viewport", test: /name=["']viewport["']/i },
];

/** Recursively collect files under `dir`, skipping build and VCS directories. */
async function walk(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.name === "build" || entry.name === "tools-api") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, found);
    else found.push(full);
  }
  return found;
}

const exists = (path) =>
  stat(path).then(
    () => true,
    () => false,
  );

/** Resolve an href/src found in `pageFile` to an absolute path on disk. */
function resolveRef(pageFile, ref) {
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean) return null;
  if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(clean)) return null;
  if (PROXIED_PREFIXES.some((prefix) => clean.startsWith(prefix))) return null;
  const base = clean.startsWith("/")
    ? join(ROOT, clean)
    : resolve(dirname(pageFile), clean);
  return normalize(base);
}

async function main() {
  const files = await walk(ROOT);
  const pages = files.filter((file) => file.endsWith(".html"));
  const problems = [];

  if (pages.length === 0) problems.push("no HTML pages found");

  for (const page of pages) {
    const html = await readFile(page, "utf8");
    const rel = page.slice(ROOT.length + 1);

    for (const { label, test } of REQUIRED_META) {
      if (!test.test(html)) problems.push(`${rel}: missing ${label}`);
    }

    const refs = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(
      (match) => match[1],
    );

    for (const ref of refs) {
      const target = resolveRef(page, ref);
      if (!target) continue;
      const ok =
        (await exists(target)) ||
        (await exists(join(target, "index.html"))) ||
        (await exists(`${target}.html`));
      if (!ok) problems.push(`${rel}: dead reference -> ${ref}`);
    }
  }

  const assets = files.filter(
    (file) =>
      file.includes(`${join("", "assets")}`) &&
      (file.endsWith(".css") || file.endsWith(".js")),
  );

  for (const asset of assets) {
    const map = `${asset}.map`;
    if (!(await exists(map))) {
      problems.push(`${asset.slice(ROOT.length + 1)}: missing sourcemap`);
      continue;
    }
    const parsed = JSON.parse(await readFile(map, "utf8"));
    if (!parsed.sourcesContent?.some((entry) => entry && entry.length > 0)) {
      problems.push(
        `${asset.slice(ROOT.length + 1)}: sourcemap has no embedded source`,
      );
    }
  }

  if (problems.length > 0) {
    console.error(`verify: ${problems.length} problem(s)`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `verify: ok — ${pages.length} pages, ${assets.length} assets, all references and sourcemaps resolve`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
