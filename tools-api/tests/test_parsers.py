from app.parsers import parse_html_metadata, parse_sitemap_xml, parse_robots

def test_html_metadata_parser_extracts_core_fields():
    html = b'''<html lang="en"><head><title>Example</title><meta name="description" content="A page"><link rel="canonical" href="https://example.com/"><meta name="robots" content="index,follow"><meta property="og:title" content="Example"><script type="application/ld+json">{"@type":"WebSite"}</script></head><body><h1>Hi</h1><h2>One</h2></body></html>'''
    data = parse_html_metadata(html, "https://example.com/")
    assert data["title"] == "Example"
    assert data["canonical"] == "https://example.com/"
    assert data["h1"] == ["Hi"]
    assert data["json_ld"][0]["@type"] == "WebSite"

def test_sitemap_parser_limits_sample_and_deduplicates():
    xml = b'''<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/a</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://example.com/a</loc></url><url><loc>http://example.com/b</loc></url></urlset>'''
    data = parse_sitemap_xml(xml, "https://example.com/sitemap.xml", sample_limit=1)
    assert data["url_count"] == 3
    assert data["duplicate_urls"] == 1
    assert data["sampled_count"] == 1
    assert data["non_https_count"] == 1

def test_robots_parser_extracts_sitemap_and_rules():
    data = parse_robots("User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml\n")
    assert data["sitemaps"] == ["https://example.com/sitemap.xml"]
    assert data["groups"][0]["disallow"] == ["/private"]
