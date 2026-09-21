from __future__ import annotations

from urllib.parse import urlparse, urlunparse

from .parsers import parse_html_metadata, parse_robots, parse_sitemap_xml
from .safe_fetch import safe_fetch

async def inspect_site(value: str) -> dict:
    page = await safe_fetch(value, user_agent="AyronToolsSiteInspector/1.0")
    page_data = parse_html_metadata(page.body, page.final_url) if "html" in page.headers.get("content-type", "") else {}
    parsed_page = urlparse(page.final_url)
    origin = urlunparse((parsed_page.scheme, parsed_page.netloc, "", "", "", ""))
    robots_url = origin + "/robots.txt"
    robots_response = await safe_fetch(robots_url, user_agent="AyronToolsSiteInspector/1.0")
    robots_text = robots_response.body.decode("utf-8", "replace")
    robots_data = parse_robots(robots_text) if robots_response.status_code == 200 else {"sitemaps": [], "groups": []}
    sitemap_candidates = list(robots_data.get("sitemaps", [])) + [origin + "/sitemap.xml"]
    sitemap = None
    for candidate in dict.fromkeys(sitemap_candidates):
        try:
            response = await safe_fetch(candidate, user_agent="AyronToolsSiteInspector/1.0")
            if response.status_code == 200 and ("xml" in response.headers.get("content-type", "") or response.body.lstrip().startswith(b"<?xml") or b"<urlset" in response.body[:500]):
                sitemap = parse_sitemap_xml(response.body, response.final_url)
                break
        except ValueError:
            continue
    robots_restricted = "disallow: /" in robots_text.lower()
    noindex = "noindex" in page_data.get("robots", "").lower()
    canonical = page_data.get("canonical", "")
    findings = []
    def add(severity, title, detail): findings.append({"severity": severity, "title": title, "detail": detail})
    if page.status_code >= 500: add("CRITICAL", "Server error", f"The page returned HTTP {page.status_code}.")
    elif page.status_code >= 400: add("CRITICAL", "HTTP error", f"The page returned HTTP {page.status_code}.")
    else: add("PASSED", "HTTPS response", f"HTTP {page.status_code} received over {page.final_url.split(':',1)[0].upper()}.")
    if noindex: add("CRITICAL", "Noindex directive", "The page declares noindex in its robots metadata.")
    else: add("PASSED", "Indexability signal", "No noindex directive was found in the page robots metadata.")
    if canonical and canonical.rstrip("/") != page.final_url.rstrip("/"): add("IMPORTANT", "Canonical differs", f"Canonical is {canonical}.")
    elif canonical: add("PASSED", "Canonical present", "The page declares a canonical URL matching the final URL.")
    else: add("IMPORTANT", "Canonical missing", "No canonical link was found.")
    if page_data.get("title"): add("PASSED", "Title present", f"Title length: {page_data['title_length']} characters.")
    else: add("IMPORTANT", "Title missing", "No document title was found.")
    if page_data.get("description"): add("PASSED", "Description present", f"Description length: {page_data['description_length']} characters.")
    else: add("IMPORTANT", "Description missing", "No meta description was found.")
    if sitemap: add("PASSED", "Sitemap discovered", f"{sitemap['sampled_count']} of {sitemap['url_count']} URLs sampled.")
    else: add("IMPORTANT", "Sitemap unavailable", "No parseable sitemap was discovered from robots.txt or /sitemap.xml.")
    if robots_restricted: add("IMPORTANT", "Robots policy", "robots.txt contains a broad Disallow rule; review it in context.")
    else: add("PASSED", "Robots policy", "No broad site-wide disallow rule was detected.")
    return {"http": {"status": page.status_code, "final_url": page.final_url, "redirects": page.redirects, "latency_ms": page.elapsed_ms, "content_type": page.headers.get("content-type", ""), "server": page.headers.get("server", "")}, "page": page_data, "robots": {"status": robots_response.status_code, **robots_data}, "sitemap": sitemap, "findings": findings}
