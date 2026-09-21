from __future__ import annotations

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

ALLOWED_SCHEMES = {"http", "https"}
MAX_HOST_LEN = 253

@dataclass(frozen=True)
class ResolvedTarget:
    url: str
    hostname: str
    port: int
    scheme: str
    addresses: tuple[str, ...]


def validate_public_ip(address: ipaddress._BaseAddress) -> bool:
    if not address.is_global or address.is_loopback or address.is_private or address.is_link_local or address.is_multicast or address.is_unspecified or address.is_reserved:
        raise ValueError(f"destination is not a public global address: {address}")
    return True


def normalize_target(value: str, *, allow_path: bool = True):
    raw = (value or "").strip()
    if not raw:
        raise ValueError("a hostname or URL is required")
    candidate = raw if "://" in raw else "https://" + raw
    parsed = urlparse(candidate)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise ValueError("only http and https URLs are allowed")
    if parsed.username or parsed.password:
        raise ValueError("embedded credentials are not allowed")
    hostname = parsed.hostname
    if not hostname or len(hostname) > MAX_HOST_LEN or any(ch.isspace() for ch in hostname):
        raise ValueError("invalid hostname")
    try:
        hostname = hostname.encode("idna").decode("ascii").lower().rstrip(".")
    except UnicodeError as exc:
        raise ValueError("invalid hostname") from exc
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith((".localhost", ".internal", ".local", ".docker", ".test")):
        raise ValueError("internal hostname is not allowed")
    try:
        literal_ip = ipaddress.ip_address(hostname)
    except ValueError:
        try:
            literal_ip = ipaddress.ip_address(socket.inet_aton(hostname))
        except (ValueError, OSError):
            literal_ip = None
    if literal_ip is not None:
        validate_public_ip(literal_ip)
    try:
        port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    except ValueError as exc:
        raise ValueError("invalid port") from exc
    if port not in {80, 443}:
        raise ValueError("only ports 80 and 443 are allowed")
    path = parsed.path or "/"
    if not allow_path and path != "/":
        path = "/"
    return parsed._replace(scheme=parsed.scheme.lower(), netloc=hostname + (f":{port}" if parsed.port else ""), path=path, fragment="")


def validate_redirect_target(value: str, base: str = ""):
    return normalize_target(urljoin(base, value))


import dns.resolver


def _resolve_sync(hostname: str, port: int) -> tuple[str, ...]:
    resolver = dns.resolver.Resolver(configure=False)
    resolver.nameservers = ["1.1.1.1", "8.8.8.8"]
    resolver.lifetime = 3.0
    addresses = []
    for record_type in ("A", "AAAA"):
        try:
            answer = resolver.resolve(hostname, record_type)
            addresses.extend(str(item) for item in answer)
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers, dns.exception.Timeout):
            continue
    addresses = tuple(dict.fromkeys(addresses))
    if not addresses:
        raise ValueError("hostname has no public DNS addresses")
    for value in addresses:
        validate_public_ip(ipaddress.ip_address(value))
    return addresses

async def resolve_public_target(parsed) -> ResolvedTarget:
    addresses = await asyncio.to_thread(_resolve_sync, parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    return ResolvedTarget(parsed.geturl(), parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), parsed.scheme, addresses)
