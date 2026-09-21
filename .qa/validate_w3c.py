#!/usr/bin/python3
from pathlib import Path
import json
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
pages = [
    "index.html", "homelab/index.html", "networking/index.html", "ai/index.html",
    "projects/index.html", "about/index.html", "privacy/index.html",
    "site-info/index.html", "404.html",
]
failed = False
for relative in pages:
    body = (ROOT / relative).read_bytes()
    request = urllib.request.Request(
        "https://validator.w3.org/nu/?out=json",
        data=body,
        headers={"Content-Type": "text/html; charset=utf-8", "User-Agent": "KHS-AI-Portfolio-QA/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        messages = json.load(response).get("messages", [])
    errors = [message for message in messages if message.get("type") == "error"]
    print(f"{relative}: errors={len(errors)} messages={len(messages)}")
    for message in errors:
        print(f"  line {message.get('lastLine')}: {message.get('message')}")
    failed = failed or bool(errors)
    time.sleep(0.2)
raise SystemExit(1 if failed else 0)
