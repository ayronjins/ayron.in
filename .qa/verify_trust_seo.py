#!/usr/bin/env python3
from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
INDEXED = {
    "index.html": "/",
    "homelab/index.html": "/homelab/",
    "networking/index.html": "/networking/",
    "ai/index.html": "/ai/",
    "projects/index.html": "/projects/",
    "about/index.html": "/about/",
    "privacy/index.html": "/privacy/",
    "site-info/index.html": "/site-info/",
    "tools/index.html": "/tools/",
    "tools/domain-observatory/index.html": "/tools/domain-observatory/",
    "tools/network-architect/index.html": "/tools/network-architect/",
    "tools/site-intelligence/index.html": "/tools/site-intelligence/",
    "projects/khs-ai/index.html": "/projects/khs-ai/",
    "projects/homelab-networking/index.html": "/projects/homelab-networking/",
}


class AuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.links: list[str] = []
        self.h1 = 0
        self.main = 0
        self.lang = ""
        self.title = ""
        self._title = False
        self.meta: list[dict[str, str | None]] = []
        self.link_tags: list[dict[str, str | None]] = []
        self.jsonld: list[str] = []
        self._jsonld = False
        self._jsonld_buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        data = dict(attrs)
        if tag == "html": self.lang = data.get("lang", "")
        if "id" in data: self.ids.append(data["id"])
        if tag == "a" and data.get("href"): self.links.append(data["href"])
        if tag == "h1": self.h1 += 1
        if tag == "main": self.main += 1
        if tag == "title": self._title = True
        if tag == "meta": self.meta.append(data)
        if tag == "link": self.link_tags.append(data)
        if tag == "script" and data.get("type") == "application/ld+json":
            self._jsonld = True
            self._jsonld_buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title": self._title = False
        if tag == "script" and self._jsonld:
            self.jsonld.append("".join(self._jsonld_buffer))
            self._jsonld = False

    def handle_data(self, data: str) -> None:
        if self._title: self.title += data
        if self._jsonld: self._jsonld_buffer.append(data)


def meta_value(parser: AuditParser, *, name: str | None = None, prop: str | None = None) -> str:
    for item in parser.meta:
        if name and item.get("name") == name: return item.get("content", "") or ""
        if prop and item.get("property") == prop: return item.get("content", "") or ""
    return ""


def local_target(href: str) -> Path | None:
    clean = href.split("#", 1)[0].split("?", 1)[0]
    if not clean or clean.startswith(("http://", "https://", "mailto:", "tel:")): return None
    if clean.startswith("/"):
        clean = clean.lstrip("/")
        if not clean: return ROOT / "index.html"
        return ROOT / clean / "index.html" if clean.endswith("/") or not Path(clean).suffix else ROOT / clean
    return None


def audit() -> list[str]:
    errors: list[str] = []
    for relative, route in {**INDEXED, "404.html": "/404.html"}.items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing page: {relative}")
            continue
        source = path.read_text(encoding="utf-8")
        parser = AuditParser(); parser.feed(source)
        if parser.lang != "en": errors.append(f"{relative}: html lang must be en")
        if parser.main != 1: errors.append(f"{relative}: expected one main")
        if parser.h1 != 1: errors.append(f"{relative}: expected one h1, got {parser.h1}")
        if len(parser.ids) != len(set(parser.ids)): errors.append(f"{relative}: duplicate ids")
        if "Ayron Jins" not in parser.title: errors.append(f"{relative}: title must identify Ayron Jins")
        if not (25 <= len(parser.title) <= 65): errors.append(f"{relative}: title length {len(parser.title)}")
        description = meta_value(parser, name="description")
        if not (100 <= len(description) <= 170): errors.append(f"{relative}: description length {len(description)}")
        robots = meta_value(parser, name="robots")
        if relative == "404.html":
            if "noindex" not in robots: errors.append("404.html: missing noindex")
        elif "index" not in robots or "follow" not in robots: errors.append(f"{relative}: missing index/follow")
        required_meta = [
            ("author", meta_value(parser, name="author")),
            ("og:title", meta_value(parser, prop="og:title")),
            ("og:description", meta_value(parser, prop="og:description")),
            ("og:image", meta_value(parser, prop="og:image")),
            ("twitter:card", meta_value(parser, name="twitter:card")),
        ]
        for label, value in required_meta:
            if not value: errors.append(f"{relative}: missing {label}")
        canonical = next((x.get("href", "") for x in parser.link_tags if x.get("rel") == "canonical"), "")
        if canonical != "https://ayron.in" + route: errors.append(f"{relative}: bad canonical {canonical}")
        if len(parser.jsonld) != 1: errors.append(f"{relative}: expected one JSON-LD block")
        else:
            try:
                schema = json.loads(parser.jsonld[0])
                types = {node.get("@type") for node in schema.get("@graph", [])}
                if "Person" not in types or "WebSite" not in types: errors.append(f"{relative}: incomplete schema graph")
            except (json.JSONDecodeError, AttributeError) as exc:
                errors.append(f"{relative}: invalid JSON-LD: {exc}")
        if "fonts.googleapis.com" in source or "fonts.gstatic.com" in source:
            errors.append(f"{relative}: third-party font request remains")
        for href in parser.links:
            target = local_target(href)
            if target is not None and not target.exists(): errors.append(f"{relative}: broken local link {href}")

    for required in ["robots.txt", "sitemap.xml", ".well-known/security.txt", "llms.txt", "humans.txt", "site.webmanifest", "assets/favicon.svg", "assets/ayron-jins-portfolio-og.png"]:
        if not (ROOT / required).is_file(): errors.append(f"missing support file: {required}")
    try:
        tree = ET.parse(ROOT / "sitemap.xml")
        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = {node.text for node in tree.findall("s:url/s:loc", namespace)}
        expected = {"https://ayron.in" + route for route in INDEXED.values()}
        if urls != expected: errors.append(f"sitemap URL mismatch: {urls ^ expected}")
    except ET.ParseError as exc:
        errors.append(f"invalid sitemap: {exc}")
    robots = (ROOT / "robots.txt").read_text()
    if "User-agent: *" not in robots or "Sitemap: https://ayron.in/sitemap.xml" not in robots: errors.append("robots.txt incomplete")
    security = (ROOT / ".well-known/security.txt").read_text()
    for token in ["Contact: mailto:", "Expires:", "Canonical: https://ayron.in/.well-known/security.txt"]:
        if token not in security: errors.append(f"security.txt missing {token}")
    llms = (ROOT / "llms.txt").read_text()
    for token in ["Ayron Jins", "KHS AI", "https://ayron.in/projects/", "Accuracy and citation"]:
        if token not in llms: errors.append(f"llms.txt missing {token}")
    css = (ROOT / "assets/site.css").read_text()
    if "Trust, SEO and privacy additions" not in css: errors.append("SEO/trust CSS additions missing")
    for font in ["dm-sans-latin.woff2", "space-grotesk-latin.woff2", "ibm-plex-mono-400-latin.woff2", "ibm-plex-mono-500-latin.woff2", "ibm-plex-mono-600-latin.woff2"]:
        if not (ROOT / "assets/fonts" / font).is_file(): errors.append(f"missing self-hosted font {font}")
    return errors


if __name__ == "__main__":
    failures = audit()
    if failures:
        print("TRUST/SEO CONTRACT FAILED")
        print("\n".join(f"- {failure}" for failure in failures))
        sys.exit(1)
    print(f"TRUST/SEO CONTRACT PASSED: {len(INDEXED)} indexed pages, metadata, schema, discovery files, privacy and trust signals")
