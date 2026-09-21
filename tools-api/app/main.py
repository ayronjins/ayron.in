from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from .dns_tools import lookup_records
from .http_tools import summarize_http
from .safe_fetch import safe_fetch
from .security import normalize_target, resolve_public_target
from .seo_tools import inspect_site
from .tls_tools import inspect_tls

app = FastAPI(title="Ayron Tools API", version="1.0.0", docs_url=None, redoc_url=None)
_cache: dict[tuple[str, str], tuple[float, object]] = {}
_hits: defaultdict[str, deque[float]] = defaultdict(deque)
WINDOW = 600.0
LIMIT = 6

class TargetRequest(BaseModel):
    domain: str = Field(min_length=1, max_length=253)

class SiteRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def rate_limit(request: Request) -> None:
    now = time.monotonic(); key = client_key(request); bucket = _hits[key]
    while bucket and now - bucket[0] > WINDOW: bucket.popleft()
    if len(bucket) >= LIMIT: raise HTTPException(429, "scan rate limit exceeded; try again later")
    bucket.append(now)

async def cached(kind: str, value: str, factory):
    key = (kind, value); now = time.monotonic(); item = _cache.get(key)
    if item and now - item[0] < 300: return item[1]
    result = await factory(); _cache[key] = (now, result); return result

@app.get("/healthz")
async def healthz():
    return {"status": "ok", "service": "ayron-tools-api"}

@app.post("/api/tools/domain")
async def domain_scan(payload: TargetRequest, request: Request):
    rate_limit(request)
    try:
        parsed = normalize_target(payload.domain, allow_path=False)
        target = await resolve_public_target(parsed)
        records = await cached("dns", target.hostname, lambda: lookup_records(target.hostname))
        http_response = await safe_fetch(parsed.geturl(), user_agent="AyronToolsDomainObservatory/1.0")
        tls = await inspect_tls(target.hostname, target.addresses[0], target.port)
        http = summarize_http(http_response)
        header_values = http["security_headers"]
        present = sum(bool(value) for value in header_values.values())
        http["security_summary"] = "GOOD" if present >= 4 else "REVIEW"
        return {"domain": target.hostname, "addresses": list(target.addresses), "dns": records, "tls": tls, "http": http, "request_path": ["DOMAIN", "DNS", "IP", "TLS", "HTTPS", "WEB SERVER"]}
    except asyncio.TimeoutError as exc:
        raise HTTPException(504, "target connection timed out") from exc
    except (ValueError, OSError) as exc:
        raise HTTPException(400, str(exc) or "invalid target") from exc

@app.post("/api/tools/site")
async def site_scan(payload: SiteRequest, request: Request):
    rate_limit(request)
    try:
        parsed = normalize_target(payload.url)
        return await cached("site", parsed.geturl(), lambda: inspect_site(parsed.geturl()))
    except asyncio.TimeoutError as exc:
        raise HTTPException(504, "target connection timed out") from exc
    except (ValueError, OSError) as exc:
        raise HTTPException(400, str(exc) or "invalid target") from exc
