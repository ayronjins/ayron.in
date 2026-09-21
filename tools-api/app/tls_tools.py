from __future__ import annotations

import asyncio
import socket
import ssl
from datetime import datetime, timezone

async def inspect_tls(hostname: str, address: str | None = None, port: int = 443) -> dict:
    context = ssl.create_default_context()
    started = asyncio.get_running_loop().time()
    connect_host = address or hostname
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(connect_host, port, ssl=context, server_hostname=hostname), 4)
        info = writer.get_extra_info("ssl_object")
        cert = info.getpeercert() if info else {}
        cipher = info.cipher() if info else None
        san = [value for kind, value in cert.get("subjectAltName", ()) if kind == "DNS"]
        not_before = cert.get("notBefore", "")
        not_after = cert.get("notAfter", "")
        expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc) if not_after else None
        days = (expiry - datetime.now(timezone.utc)).days if expiry else None
        valid_hostname = any(hostname == name or (name.startswith("*.") and hostname.endswith(name[1:])) for name in san)
        writer.close(); await writer.wait_closed()
        return {"available": True, "valid": bool(valid_hostname and days is not None and days >= 0), "hostname": hostname, "hostname_match": valid_hostname, "issuer": ", ".join("=".join(x) for part in cert.get("issuer", ()) for x in part), "valid_from": not_before, "expiry": not_after, "days_remaining": days, "san": san, "tls_version": info.version() if info else "", "cipher": cipher[0] if cipher else "", "latency_ms": round((asyncio.get_running_loop().time() - started) * 1000, 1)}
    except Exception as exc:
        return {"available": False, "valid": False, "hostname": hostname, "error": str(exc)}
