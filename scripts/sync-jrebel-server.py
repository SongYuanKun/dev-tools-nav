#!/usr/bin/env python3
"""Sync the JRebel license server from the upstream page into servers.json."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

DEFAULT_SOURCE = "https://www.jpy.wang/page/jrebel.html"
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_PATH = os.environ.get(
    "JREBEL_SERVERS_OUT_PATH",
    os.path.join(_REPO_ROOT, "data", "servers.json"),
)
UA = "Mozilla/5.0 (compatible; dev-tools-nav/1.0; +https://github.com/SongYuanKun/dev-tools-nav)"


def read_source(source_url: str) -> str | None:
    source_file = os.environ.get("JREBEL_SOURCE_FILE")
    if source_file:
        try:
            with open(source_file, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except OSError as e:
            print(f"WARN: read JRebel source file failed: {e}", file=sys.stderr)
            return None

    req = urllib.request.Request(source_url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except (urllib.error.URLError, OSError) as e:
        print(f"WARN: fetch JRebel page failed: {e}", file=sys.stderr)
        return None


def extract_server(content: str) -> tuple[str, str]:
    url_match = re.search(r"https?://[\d.]+:\d+/[\w-]+", content)
    email_match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", content)
    return (
        url_match.group(0) if url_match else "",
        email_match.group(0) if email_match else "",
    )


def load_existing() -> dict:
    try:
        with open(OUT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def main() -> int:
    source_url = os.environ.get("JREBEL_SOURCE_URL", DEFAULT_SOURCE)
    content = read_source(source_url)
    if content is None:
        if os.path.isfile(OUT_PATH):
            print("Keep existing servers.json (fetch failed).")
            return 0
        content = ""

    url, email = extract_server(content)
    if not url and os.path.isfile(OUT_PATH):
        print("Keep existing servers.json (no valid JRebel server URL parsed).")
        return 0

    data = load_existing()
    previous = data.get("jrebel") if isinstance(data.get("jrebel"), dict) else {}
    data["jrebel"] = {
        "url": url,
        "email": email or previous.get("email", ""),
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": source_url,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote JRebel server to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
