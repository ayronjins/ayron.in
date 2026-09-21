from __future__ import annotations

import asyncio
import socket
from typing import Any
import dns.resolver

RECORD_TYPES = ("A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA")

async def lookup_records(hostname: str) -> dict[str, list[dict[str, Any]]]:
    resolver = dns.resolver.Resolver()
    resolver.lifetime = 3.0
    result: dict[str, list[dict[str, Any]]] = {}
    for record_type in RECORD_TYPES:
        try:
            answer = await asyncio.to_thread(resolver.resolve, hostname, record_type)
            values = []
            for item in answer:
                if record_type == "MX": value = {"value": str(item.exchange).rstrip("."), "priority": item.preference}
                elif record_type == "SOA": value = {"value": str(item), "mname": str(item.mname).rstrip("."), "rname": str(item.rname).rstrip("."), "serial": item.serial}
                elif record_type == "TXT": value = {"value": b"".join(item.strings).decode("utf-8", "replace")}
                else: value = {"value": str(item).rstrip(".")}
                value["ttl"] = answer.rrset.ttl
                values.append(value)
            result[record_type] = values
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers, dns.exception.Timeout):
            result[record_type] = []
    return result
