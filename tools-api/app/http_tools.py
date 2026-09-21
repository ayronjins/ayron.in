from __future__ import annotations

SECURITY_HEADERS = ("strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options")


def summarize_http(response) -> dict:
    headers = {key.lower(): value for key, value in response.headers.items()}
    return {"status": response.status_code, "final_url": response.final_url, "redirects": response.redirects, "latency_ms": response.elapsed_ms, "content_type": headers.get("content-type", ""), "server": headers.get("server", ""), "http_version": headers.get("x-http-version", "HTTP/1.x"), "security_headers": {key: headers.get(key, "") for key in SECURITY_HEADERS}, "body_bytes": len(response.body)}
