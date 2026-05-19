#!/usr/bin/env python3
"""
从 jpy.wang 页面同步 JRebel License Server 地址到 data/servers.json。

抓取失败、页面改版或解析不到有效 URL 时保留现有数据，避免自动同步把
仍可用的激活地址覆盖为空。
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

URL_RE = re.compile(r"https?://[\w.-]+:\d+/[\w-]+")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")


def fetch_page(url: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except (urllib.error.URLError, OSError) as e:
        print(f"WARN: fetch JRebel page failed: {e}", file=sys.stderr)
        return None


def read_existing(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def keep_existing(path: str, reason: str) -> int:
    if os.path.isfile(path):
        print(f"Keep existing servers.json ({reason}).")
        return 0
    print(f"ERROR: no existing servers.json to keep ({reason}).", file=sys.stderr)
    return 1


def main() -> int:
    source_url = os.environ.get("JREBEL_SOURCE_URL", DEFAULT_SOURCE_URL)
    out_path = os.environ.get("JREBEL_OUT_PATH", DEFAULT_OUT_PATH)

    content = fetch_page(source_url)
    if content is None:
        return keep_existing(out_path, "fetch failed")

    url_match = URL_RE.search(content)
    if not url_match:
        return keep_existing(out_path, "no valid license server URL")

    email_match = EMAIL_RE.search(content)
    data = read_existing(out_path)
    current_jrebel = data.get("jrebel") if isinstance(data.get("jrebel"), dict) else {}

    data["jrebel"] = {
        "url": url_match.group(0),
        "email": email_match.group(0) if email_match else current_jrebel.get("email", ""),
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": source_url,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote JRebel server to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
