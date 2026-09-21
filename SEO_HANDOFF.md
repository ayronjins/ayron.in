# KHS AI Portfolio — SEO, Trust and AI Discoverability Handoff

## Mission

Continue improving `https://ayron.in` as the canonical, trustworthy first-party source about Ayron Jins and his engineering work. Preserve the premium dark engineering-lab design. Do not invent credentials, awards, employers, production scale, or completed capabilities.

## Current production state — completed 2026-09-13

- Audited source and live Nginx deployment.
- Backed up the full site to:
  - `/home/ayron/khs-ai-portfolio-backups/portfolio-before-trust-seo-20260913-071748.tar.gz`
  - `/etc/nginx/sites-available/ayron.in.before-trust-seo-20260913-071748`
- Added unique SEO titles/descriptions, canonical URLs, author/robots metadata, Open Graph, Twitter cards, and one valid H1 per page.
- Added Schema.org JSON-LD graphs for `Person`, `WebSite`, `WebPage`/`ProfilePage`/`CollectionPage`, breadcrumbs, and selected projects.
- Added visible first-party identity language about Ayron Jins, site ownership, editorial accuracy, contact, privacy, and security.
- Added:
  - `/privacy/`
  - `/site-info/`
  - `/robots.txt`
  - `/sitemap.xml`
  - `/llms.txt`
  - `/humans.txt`
  - `/.well-known/security.txt`
  - `/site.webmanifest`
  - `/assets/favicon.svg`
  - `/assets/ayron-jins-portfolio-og.png` (1200×630)
- Added a public IndexNow verification key file at the project root. The key is locally served correctly; the IndexNow submission endpoint timed out from this server and remains pending.
- Self-hosted DM Sans, Space Grotesk, and IBM Plex Mono WOFF2 fonts; removed third-party Google Fonts requests.
- Added strict Nginx security headers, HSTS, CSP, privacy headers, gzip, asset caching, hidden-file protection, and real HTTP 404 responses instead of soft-200 fallbacks.
- Preserved `news.ayron.in` and `pc.ayron.in`.

## Source of truth

- Project: `/home/ayron/khs-ai-portfolio`
- Generator: `.qa/build_multipage.py`
- Repeatable SEO layer: `.qa/enhance_seo.py`
- Existing contract test: `.qa/verify_site.py`
- SEO/trust contract: `.qa/verify_trust_seo.py`
- W3C validation: `.qa/validate_w3c.py`
- Nginx source: `.qa/ayron.in.nginx`
- Active Nginx config: `/etc/nginx/sites-available/ayron.in`

`build_multipage.py` automatically runs `enhance_seo.py`, so rebuilds preserve these improvements.

## Verified results

- Six core-page contract: passed.
- Eight indexed-page SEO/trust contract: passed.
- W3C validation: zero messages/errors on all nine HTML documents.
- JavaScript syntax: passed.
- TLS 1.2 and TLS 1.3: passed.
- HTTPS certificate verification: passed.
- HSTS, CSP, Referrer-Policy, nosniff, frame denial, Permissions-Policy, COOP and CORP: present.
- All intended pages/discovery files: HTTP 200.
- Unknown route: real HTTP 404.
- CSS: gzip enabled and 30-day cache.
- Source and served homepage SHA-256: identical.
- `news.ayron.in`: HTTP 200.
- `pc.ayron.in`: HTTP 200.
- Nginx syntax valid and service active.

## Next actions for the next model

1. Re-run the four local QA commands before any edit:
   ```bash
   /usr/bin/python3 /home/ayron/khs-ai-portfolio/.qa/build_multipage.py
   /usr/bin/python3 /home/ayron/khs-ai-portfolio/.qa/verify_site.py
   /usr/bin/python3 /home/ayron/khs-ai-portfolio/.qa/verify_trust_seo.py
   /usr/bin/python3 /home/ayron/khs-ai-portfolio/.qa/validate_w3c.py
   ```
2. Perform a real visual browser audit at desktop, tablet and mobile once Chrome/Chromium is available. The current browser harness could not launch a browser, so pixel-level regression testing remains.
3. Inspect the browser console for CSP violations and interaction errors.
4. Run Lighthouse/PageSpeed when public fetch caches have refreshed; optimize only measured bottlenecks.
5. Help Ayron submit `https://ayron.in/sitemap.xml` to Google Search Console and Bing Webmaster Tools. This needs Ayron’s account login and must not be automated with credentials in chat.
6. Request indexing for `/`, `/about/`, `/projects/`, `/ai/`, `/networking/`, and `/homelab/` after ownership verification.
7. Add legitimate external references/backlinks over time: project repositories or school/public project coverage only when real and approved. Do not fabricate links.
8. Keep WHOIS privacy enabled unless Ayron explicitly chooses otherwise; public home address exposure is not an acceptable trust tactic. The site-level ownership/contact pages provide safer transparency.
9. Recheck ScamAdviser and search snippets after crawlers revisit the site. Trust scores and rankings will not update instantly.
10. Keep the approved LinkedIn identity link consistent across future profile changes. Do not add GitHub until Ayron provides and approves the correct URL.

## Paste-after-model-switch prompt

Continue the Ayron.in trust, SEO and AI-discoverability work from `/home/ayron/khs-ai-portfolio/SEO_HANDOFF.md`. Inspect the current files and live routes first. Preserve all completed design and content, use only grounded claims, do not expose private information, and do not touch `pc.ayron.in` or `news.ayron.in`. Prioritize the remaining visual browser/CSP audit and then prepare the account-bound Google Search Console/Bing submission steps without asking for or handling passwords. Verify every change before reporting completion.
