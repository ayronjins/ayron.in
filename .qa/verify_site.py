#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "index.html": ("Home", "/"),
    "homelab/index.html": ("Home Lab", "/homelab/"),
    "networking/index.html": ("Networking", "/networking/"),
    "ai/index.html": ("AI & Development", "/ai/"),
    "projects/index.html": ("Projects", "/projects/"),
    "about/index.html": ("About", "/about/"),
}
NAV_TARGETS = {route for _, route in PAGES.values()}

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.current, self.mains = [], [], [], 0
        self.title_depth, self.title = 0, ""
        self.meta_description = False
        self.canonical = False
        self.skip_link = False
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if "id" in data: self.ids.append(data["id"])
        if tag == "main": self.mains += 1
        if tag == "title": self.title_depth += 1
        if tag == "a" and "href" in data:
            href = data["href"]; self.links.append(href)
            if data.get("aria-current") == "page": self.current.append(href)
            if "skip-link" in data.get("class", ""): self.skip_link = True
        if tag == "meta" and data.get("name") == "description" and data.get("content", "").strip(): self.meta_description = True
        if tag == "link" and data.get("rel") == "canonical" and data.get("href", "").startswith("https://ayron.in/"): self.canonical = True
    def handle_endtag(self, tag):
        if tag == "title" and self.title_depth: self.title_depth -= 1
    def handle_data(self, data):
        if self.title_depth: self.title += data

def local_target(href):
    route = href.split("#", 1)[0]
    if not route or route.startswith(("http://", "https://", "mailto:", "tel:")): return None
    if route.startswith("/"):
        route = route.lstrip("/")
        return ROOT / route / "index.html" if route.endswith("/") or not Path(route).suffix else ROOT / route
    return ROOT / route

def check():
    errors = []
    for asset in ("assets/site.css", "assets/site.js"):
        if not (ROOT / asset).is_file(): errors.append(f"missing shared asset: {asset}")
    for filename, (label, route) in PAGES.items():
        path = ROOT / filename
        if not path.is_file(): errors.append(f"missing page: {filename}"); continue
        source = path.read_text(encoding="utf-8"); parser = PageParser(); parser.feed(source)
        if parser.mains != 1: errors.append(f"{filename}: expected one main, got {parser.mains}")
        if len(re.findall(r"<h1\b", source, re.I)) != 1: errors.append(f"{filename}: expected exactly one h1")
        if len(parser.ids) != len(set(parser.ids)): errors.append(f"{filename}: duplicate ids")
        if not parser.skip_link: errors.append(f"{filename}: missing skip link")
        if not parser.meta_description: errors.append(f"{filename}: missing description")
        if not parser.canonical: errors.append(f"{filename}: missing canonical")
        expected_title = "Ayron Jins" if filename == "index.html" else label
        if expected_title not in parser.title: errors.append(f"{filename}: title does not identify {expected_title}")
        linked_pages = {x.split("#",1)[0] for x in parser.links if x.split("#",1)[0] in NAV_TARGETS}
        if linked_pages != NAV_TARGETS: errors.append(f"{filename}: incomplete primary navigation")
        if parser.current != [route]: errors.append(f"{filename}: expected aria-current on {route}, got {parser.current}")
        if "<style" in source or "<script>" in source: errors.append(f"{filename}: contains inline style/script block")
        if ' style="' in source: errors.append(f"{filename}: contains inline style attribute")
        if filename == "index.html":
            required_home = [
                'class="home-topology',
                'data-home-node="internet"', 'data-home-node="network"',
                'data-home-node="lab"', 'data-home-node="ai"',
                'data-home-node="services"', 'data-home-node="data"',
                'href="https://pc.ayron.in"', 'href="https://news.ayron.in"',
                'id="home-topology-toggle"', 'id="home-topology-route"',
                'class="proof-meta"', 'AYRON JINS / STUDENT SYSTEMS BUILDER',
            ]
            for token in required_home:
                if token not in source: errors.append(f"{filename}: missing homepage feature {token}")
            if 'class="featured-grid"' in source:
                errors.append(f"{filename}: retains repetitive featured-grid section")
            if 'class="landing-meta"' in source:
                errors.append(f"{filename}: retains redundant hero metadata chips")
        for href in parser.links:
            target = local_target(href)
            if target is not None and not target.exists(): errors.append(f"{filename}: broken local link {href}")
    return errors

if __name__ == "__main__":
    failures = check()
    if failures:
        print("SITE CONTRACT FAILED")
        print("\n".join(f"- {x}" for x in failures))
        sys.exit(1)
    print(f"SITE CONTRACT PASSED: {len(PAGES)} pages, clean routes, shared assets, navigation, metadata, and semantics")
