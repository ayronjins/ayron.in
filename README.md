# ayron.in

Static portfolio for Ayron Jins. No framework, no client-side router, no
runtime dependencies — the pages are hand-written HTML served directly by
nginx, with one CSS and one JS bundle per page type.

The site documents infrastructure and AI work (home lab, networking, agent
architecture) and hosts three self-built network/SEO tools backed by a small
FastAPI service.

## Why it is built this way

A portfolio about infrastructure should be inspectable. The constraints:

- **No build step required to read it.** Every page is plain HTML. View
  Source shows the real document, not a hydration payload.
- **Progressive enhancement.** `site-core.js` adds a `js` class to `<html>`;
  all JS-dependent styling hangs off that class, so the site is fully
  readable and navigable with scripting disabled.
- **Motion is opt-out at the system level.** Every animation is gated behind
  `prefers-reduced-motion`, and the animated topology also exposes a manual
  pause control. Animations stop when the tab is hidden or the element scrolls
  out of view (`IntersectionObserver` + `visibilitychange`), so an idle tab
  costs no frames.
- **Accessibility is structural, not bolted on.** Interactive nodes are real
  `<button>` elements with `aria-pressed`; the mobile nav traps focus, sets
  `inert` on background content, and restores focus on close.
- **Zero third-party requests.** Fonts are self-hosted WOFF2 subsets. The
  Content-Security-Policy is `default-src 'self'` with no `unsafe-inline`.

## Layout

```
.                       served document root
├── index.html          landing page
├── about/ ai/ homelab/ networking/ projects/ tools/   content pages
├── assets/             SHIPPED bundles — minified, generated, do not edit
│   ├── *.css *.js      build output
│   ├── *.map           sourcemaps with original source embedded
│   └── fonts/          self-hosted WOFF2 subsets
├── build/
│   ├── src/            SOURCE OF TRUTH — formatted, readable CSS/JS
│   ├── build.mjs       minify src/ -> assets/ with sourcemaps
│   └── verify.mjs      post-build invariant checks
└── tools-api/          FastAPI service behind /api (SSRF-guarded)
```

**Edit `build/src/`, never `assets/`.** Anything written directly into
`assets/` is overwritten by the next build.

## Working on it

```bash
npm install
npm run format     # prettier over build/src
npm run build      # build/src -> assets (minified + sourcemaps)
npm run verify     # dead links, required meta, sourcemap integrity
npm test           # format check + build + verify
```

`npm run verify` is the closest thing this site has to a test suite. It walks
every HTML page and asserts:

1. every local `href`/`src` resolves to a file on disk (paths nginx proxies
   upstream are declared explicitly in `verify.mjs`, not silently skipped);
2. every page has a title, meta description, canonical URL, Open Graph title,
   `lang`, and viewport;
3. every shipped asset has a sourcemap that actually embeds its source.

It exits non-zero on failure, so it is safe in a pre-deploy hook.

## Sourcemaps are intentional

`assets/*.css` and `assets/*.js` are minified for transfer size, but each
ships a sourcemap with `sourcesContent` inlined. Open DevTools and you read
the formatted original. Minification here is a delivery decision, not an
attempt to obscure the source.

## Deployment

nginx serves this directory directly. The server block terminates TLS,
enforces HSTS and a strict CSP, sets `X-Content-Type-Options`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and the
cross-origin isolation headers, and gzips text assets.

Deploy is `npm test` followed by a file sync — there is no server-side render
step and no cache to invalidate beyond the browser's.

Known operational note: nginx can fail at boot when it binds before
`tailscaled` is up. Recovery is `sudo systemctl restart nginx`.

## tools-api

The `/api` tools (DNS, TLS, HTTP header and SEO inspection) run as a separate
FastAPI service. It refuses private, loopback and link-local targets, caps
response size and redirect depth, and has unit tests under `tools-api/tests/`.
See `tools-api/README.md`.

---

Ayron Jins · <Ayronjins4@gmail.com> · https://ayron.in
