# Ayron Tools API

Local-only FastAPI service for the public Tools Lab diagnostics.

## Runtime

- Python virtual environment: `/home/ayron/.venvs/ayron-tools`
- Listener: `127.0.0.1:3100`
- Service: `ayron-tools-api.service`
- Public routes: `/api/tools/domain` and `/api/tools/site`

## Safety model

The fetcher accepts only HTTP/HTTPS on ports 80/443, resolves through independent public DNS resolvers, rejects every non-global address, pins the connection to a validated address, validates every redirect, limits redirects to five, limits response bodies to 1 MiB, and applies short timeouts. Scan results are held in a five-minute in-memory cache and are not persisted.

`Network Architect` is entirely browser-local and has no API dependency.

## Tests

```bash
/home/ayron/.venvs/ayron-tools/bin/python -m pytest -q tools-api/tests
```

The test suite covers URL/scheme validation, short-form IPv4 literals, private and special-use ranges, redirect validation, HTML metadata, robots parsing, sitemap sampling and duplicate detection.
