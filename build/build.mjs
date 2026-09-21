/**
 * Build pipeline for ayron.in
 * ---------------------------
 * Source of truth lives in build/src/ as formatted, readable CSS and JS.
 * This script minifies each entry into assets/ and emits an external
 * sourcemap with `sourcesContent` inlined, so anyone inspecting the site in
 * DevTools reads the original formatted source rather than a minified blob.
 *
 * Design constraints:
 *   - Output is byte-for-byte deterministic (no timestamps, no hashing churn).
 *   - No bundling or module rewriting: these are classic scripts loaded
 *     directly by the pages, so each file is transformed in isolation.
 *   - Targets match the browsers the site actually supports; nothing is
 *     transpiled further than necessary, which keeps the shipped JS legible.
 *
 * Usage: npm run build
 */

import { build } from "esbuild";
import { mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "build", "src");
const OUT = join(ROOT, "assets");

/** Browser baseline. Anything older is out of support for this site. */
const TARGET = ["es2020", "chrome100", "firefox100", "safari15", "edge100"];

async function main() {
  await mkdir(OUT, { recursive: true });

  const entries = (await readdir(SRC))
    .filter((name) => name.endsWith(".css") || name.endsWith(".js"))
    .sort()
    .map((name) => join(SRC, name));

  if (entries.length === 0) {
    throw new Error(`No sources found in ${SRC}`);
  }

  const result = await build({
    entryPoints: entries,
    outdir: OUT,
    bundle: false,
    minify: true,
    sourcemap: true,
    sourcesContent: true,
    sourceRoot: "/build/src/",
    legalComments: "none",
    charset: "utf8",
    target: TARGET,
    logLevel: "warning",
    metafile: true,
  });

  const rows = Object.entries(result.metafile.outputs)
    .filter(([file]) => !file.endsWith(".map"))
    .map(([file, meta]) => `  ${String(meta.bytes).padStart(7)} B  ${file}`)
    .sort();

  console.log(`built ${rows.length} asset(s):`);
  console.log(rows.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
