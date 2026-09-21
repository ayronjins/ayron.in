from __future__ import annotations

import asyncio
import ssl
import time
from dataclasses import dataclass
from urllib.parse import urlunparse

import httpx

from .security import normalize_target, resolve_public_target, validate_redirect_target

MAX_BODY = 1024 * 1024
MAX_REDIRECTS = 5
TIMEOUT = httpx.Timeout(connect=3.0, read=5.0, write=3.0, pool=3.0)

@dataclass
class SafeResponse:
    status_code: int
    headers: dict[str, str]
    body: bytes
    final_url: str
    redirects: list[dict]
    elapsed_ms: float

async def _request_pinned(target, *, user_agent: str) -> tuple[int, dict[str, str], bytes]:
    ip = target.addresses[0]
    url = target.url
    headers = {"Host": target.hostname, "User-Agent": user_agent, "Accept": "text/html,application/xml,text/plain;q=0.9,*/*;q=0.1", "Connection": "close"}
    if target.scheme == "https":
        context = ssl.create_default_context()
        reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, target.port, ssl=context, server_hostname=target.hostname), 3)
    else:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, target.port), 3)
    try:
        request_target = target.url.split(target.scheme + "://", 1)[1].split("/", 1)
        path = "/" + request_target[1] if len(request_target) == 2 else "/"
        writer.write((f"GET {path} HTTP/1.1\r\n" + "\r\n".join(f"{k}: {v}" for k,v in headers.items()) + "\r\n\r\n").encode())
        await writer.drain()
        raw = bytearray()
        while len(raw) < MAX_BODY + 65536:
            chunk = await asyncio.wait_for(reader.read(16384), 5)
            if not chunk: break
            raw.extend(chunk)
            if b"\r\n\r\n" in raw and len(raw) > MAX_BODY + raw.find(b"\r\n\r\n") + 4: break
        header_end = raw.find(b"\r\n\r\n")
        if header_end < 0: raise ValueError("invalid HTTP response")
        head = raw[:header_end].decode("iso-8859-1")
        body = bytes(raw[header_end + 4:])
        lines = head.split("\r\n")
        status = int(lines[0].split()[1])
        response_headers = {}
        for line in lines[1:]:
            key, _, value = line.partition(":")
            if key: response_headers[key.lower()] = value.strip()
        if len(body) > MAX_BODY: raise ValueError("response exceeds 1 MiB limit")
        return status, response_headers, body
    finally:
        writer.close()
        await writer.wait_closed()

async def safe_fetch(value: str, *, user_agent: str = "AyronTools/1.0", max_redirects: int = MAX_REDIRECTS) -> SafeResponse:
    parsed = normalize_target(value)
    redirects = []
    started = time.perf_counter()
    for _ in range(max_redirects + 1):
        target = await resolve_public_target(parsed)
        status, headers, body = await _request_pinned(target, user_agent=user_agent)
        if status not in {301, 302, 303, 307, 308} or "location" not in headers:
            return SafeResponse(status, headers, body, parsed.geturl(), redirects, round((time.perf_counter() - started) * 1000, 1))
        nxt = validate_redirect_target(headers["location"], parsed.geturl())
        redirects.append({"from": parsed.geturl(), "status": status, "to": nxt.geturl()})
        parsed = nxt
    raise ValueError("redirect limit exceeded")
