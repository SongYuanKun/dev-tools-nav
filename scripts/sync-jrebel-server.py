#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any


SOURCE_URL = "https://www.jpy.wang/page/jrebel.html"
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_DATA_PATH = os.path.join(_REPO_ROOT, "data", "servers.json")

LICENSE_URL_RE = re.compile(r"https?://[A-Za-z0-9.-]+:\d+/[A-Za-z0-9][A-Za-z0-9_-]+")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")


def load_data(path: str) -> dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"Expected object JSON in {path}")
    return data


def extract_server(content: str) -> tuple[str, str]:
    url_match = LICENSE_URL_RE.search(content)
    email_match = EMAIL_RE.search(content)
    return (
        url_match.group(0) if url_match else "",
        email_match.group(0) if email_match else "",
    )


def sync_server(content: str, data_path: str, source_url: str = SOURCE_URL) -> bool:
    data = load_data(data_path)
    current = data.get("jrebel") if isinstance(data.get("jrebel"), dict) else {}
    url, email = extract_server(content)

    if not url:
        if current.get("url"):
            print("WARN: no JRebel license URL found; keeping existing servers.json.", file=sys.stderr)
            return False
        raise ValueError("No JRebel license URL found and no existing value to keep.")

    data["jrebel"] = {
        "url": url,
        "email": email or str(current.get("email") or ""),
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": source_url,
    }

    os.makedirs(os.path.dirname(data_path), exist_ok=True)
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return True


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync JRebel license server metadata.")
    parser.add_argument("html_path", help="Fetched source HTML file")
    parser.add_argument("--data-path", default=DEFAULT_DATA_PATH, help="servers.json path")
    parser.add_argument("--source-url", default=SOURCE_URL, help="Source page URL")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    with open(args.html_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    changed = sync_server(content, args.data_path, args.source_url)
    print("Updated servers.json." if changed else "Kept existing servers.json.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
