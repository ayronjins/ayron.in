from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from urllib.parse import urlparse
from bs4 import BeautifulSoup

SM_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def parse_html_metadata(body: bytes, final_url: str) -> dict:
    soup = BeautifulSoup(body, "lxml")
    get_meta = lambda name: (soup.find("meta", attrs={"name": name}) or {}).get("content", "")
    get_prop = lambda name: (soup.find("meta", attrs={"property": name}) or {}).get("content", "")
    canonical = soup.find("link", rel=lambda value: value and "canonical" in value)
    json_ld = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            parsed = json.loads(script.string or script.get_text())
            json_ld.extend(parsed if isinstance(parsed, list) else [parsed])
        except (json.JSONDecodeError, TypeError):
            continue
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    robots = get_meta("robots")
    return {
        "title": title, "title_length": len(title), "description": get_meta("description"),
        "description_length": len(get_meta("description")), "canonical": canonical.get("href", "") if canonical else "",
        "robots": robots, "language": soup.html.get("lang", "") if soup.html else "",
        "viewport": get_meta("viewport"), "h1": [x.get_text(" ", strip=True) for x in soup.find_all("h1")],
        "h2": [x.get_text(" ", strip=True) for x in soup.find_all("h2")[:20]],
        "open_graph": {m.get("property"): m.get("content", "") for m in soup.find_all("meta", property=re.compile(r"^og:"))},
        "twitter": {m.get("name"): m.get("content", "") for m in soup.find_all("meta", attrs={"name": re.compile(r"^twitter:")})},
        "favicon": bool(soup.find("link", rel=lambda value: value and "icon" in value)),
        "json_ld": json_ld,
        "final_url": final_url,
    }


def parse_sitemap_xml(body: bytes, source_url: str, sample_limit: int = 100) -> dict:
    root = ET.fromstring(body)
    local = lambda tag: tag.rsplit("}", 1)[-1]
    kind = local(root.tag)
    locs = []
    lastmods = []
    for node in root.iter():
        if local(node.tag) == "loc" and node.text:
            locs.append(node.text.strip())
        if local(node.tag) == "lastmod" and node.text:
            lastmods.append(node.text.strip())
    unique = set(locs)
    return {
        "source": source_url, "type": "index" if kind == "sitemapindex" else "urlset",
        "url_count": len(locs), "unique_count": len(unique), "duplicate_urls": len(locs) - len(unique),
        "sampled_count": min(len(locs), sample_limit), "sample": locs[:sample_limit],
        "non_https_count": sum(1 for x in locs if urlparse(x).scheme != "https"),
        "malformed_count": sum(1 for x in locs if not urlparse(x).netloc),
        "lastmod_count": len(lastmods),
    }


def parse_robots(text: str) -> dict:
    groups, current = [], None
    sitemaps = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        key, _, value = line.partition(":")
        key, value = key.lower().strip(), value.strip()
        if key == "user-agent":
            if current and (current["user_agent"] != value): groups.append(current)
            if not current or current["user_agent"] != value: current = {"user_agent": value, "allow": [], "disallow": []}
        elif key in {"allow", "disallow"} and current is not None:
            current[key].append(value)
        elif key == "sitemap" and value: sitemaps.append(value)
    if current: groups.append(current)
    return {"sitemaps": sitemaps, "groups": groups}
