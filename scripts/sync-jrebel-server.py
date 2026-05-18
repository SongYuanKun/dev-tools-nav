#!/usr/bin/env python3
"""
Update data/servers.json from the fetched JRebel helper page.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone

SOURCE_URL = "https://www.jpy.wang/page/jrebel.html"
DEFAULT_HTML_PATH = "/tmp/jrebel.html"
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_PATH = os.environ.get(
    "JREBEL_SERVERS_OUT_PATH",
    os.path.join(_REPO_ROOT, "data", "servers.json"),
)


def load_existing() -> dict:
    try:
        with open(OUT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        print(f"ERROR: failed to parse existing servers.json: {e}", file=sys.stderr)
        return {}


def has_existing_jrebel_url(data: dict) -> bool:
    jrebel = data.get("jrebel")
    return isinstance(jrebel, dict) and bool(jrebel.get("url"))


def extract_server(content: str) -> tuple[str, str]:
    url_match = re.search(r"https?://[\d.]+:\d+/[\w-]+", content)
    email_match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", content)
    return (url_match.group(0) if url_match else "", email_match.group(0) if email_match else "")


def main() -> int:
    html_path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("JREBEL_HTML_PATH", DEFAULT_HTML_PATH)
    existing = load_existing()

    try:
        with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except OSError as e:
        if has_existing_jrebel_url(existing):
            print(f"Keep existing servers.json (failed to read fetched page: {e}).")
            return 0
        print(f"ERROR: failed to read fetched page and no existing JRebel URL found: {e}", file=sys.stderr)
        return 1

    url, email = extract_server(content)
    if not url:
        if has_existing_jrebel_url(existing):
            print("Keep existing servers.json (no valid JRebel URL found in fetched page).")
            return 0
        print("ERROR: no valid JRebel URL found and no existing JRebel URL to keep.", file=sys.stderr)
        return 1

    existing_jrebel = existing.get("jrebel") if isinstance(existing.get("jrebel"), dict) else {}
    existing["jrebel"] = {
        "url": url,
        "email": email or existing_jrebel.get("email", ""),
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE_URL,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote JRebel server to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
