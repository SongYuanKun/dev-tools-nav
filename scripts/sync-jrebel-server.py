#!/usr/bin/env python3
"""
Sync the JRebel license server data into data/servers.json.

The sync source is a third-party HTML page. If the page is temporarily blocked,
empty, or changes shape, keep the last known-good server instead of committing
blank values that break the public JRebel page.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

DEFAULT_SOURCE_URL = "https://www.jpy.wang/page/jrebel.html"
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_OUT_PATH = os.path.join(_REPO_ROOT, "data", "servers.json")
UA = "Mozilla/5.0 (compatible; dev-tools-nav/1.0; +https://github.com/SongYuanKun/dev-tools-nav)"

URL_RE = re.compile(r"https?://[A-Za-z0-9.-]+:\d+/[\w-]+")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")


def read_existing(out_path: str) -> dict:
    try:
        with open(out_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def read_source(source: str) -> str | None:
    if source.startswith(("http://", "https://")):
        req = urllib.request.Request(source, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except (urllib.error.URLError, OSError) as e:
            print(f"WARN: fetch JRebel source failed: {e}", file=sys.stderr)
            return None

    try:
        with open(source, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except OSError as e:
        print(f"WARN: read JRebel source failed: {e}", file=sys.stderr)
        return None


def parse_server(content: str | None) -> tuple[str, str]:
    if not content:
        return "", ""
    url_match = URL_RE.search(content)
    email_match = EMAIL_RE.search(content)
    return (
        url_match.group(0) if url_match else "",
        email_match.group(0) if email_match else "",
    )


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv
    source = argv[1] if len(argv) > 1 else os.environ.get("JREBEL_SOURCE_URL", DEFAULT_SOURCE_URL)
    out_path = os.environ.get("JREBEL_SERVERS_PATH", DEFAULT_OUT_PATH)

    data = read_existing(out_path)
    existing = data.get("jrebel") if isinstance(data.get("jrebel"), dict) else {}
    url, email = parse_server(read_source(source))

    if not url:
        if existing.get("url"):
            print("Keep existing servers.json (no valid JRebel server found).")
            return 0
        print("ERROR: no valid JRebel server found and no existing value to preserve.", file=sys.stderr)
        return 1

    data["jrebel"] = {
        "url": url,
        "email": email or existing.get("email", ""),
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": DEFAULT_SOURCE_URL,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote JRebel server to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
