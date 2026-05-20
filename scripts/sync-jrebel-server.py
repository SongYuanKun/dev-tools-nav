#!/usr/bin/env python3
"""
从 jpy.wang 页面同步 JRebel 激活地址到 data/servers.json。

如果抓取失败或页面中没有可用激活地址，保留已有数据，避免定时任务把
历史可用地址覆盖为空值。
"""
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
OUT_PATH = os.environ.get("JREBEL_OUT_PATH", os.path.join(_REPO_ROOT, "data", "servers.json"))
UA = "Mozilla/5.0 (compatible; dev-tools-nav/1.0; +https://github.com/SongYuanKun/dev-tools-nav)"

URL_RE = re.compile(r"https?://(?:\d{1,3}\.){3}\d{1,3}:\d+/[A-Za-z0-9_-]+")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")


def fetch_page(url: str) -> str | None:
    html_path = os.environ.get("JREBEL_HTML_PATH")
    if html_path:
        try:
            with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except OSError as e:
            print(f"WARN: read JRebel HTML failed: {e}", file=sys.stderr)
            return None

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


def keep_existing(reason: str, path: str) -> bool:
    if os.path.isfile(path):
        print(f"Keep existing servers.json ({reason}).")
        return True
    return False


def write_json(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> int:
    source_url = os.environ.get("JREBEL_SOURCE_URL", DEFAULT_SOURCE)
    data = read_existing(OUT_PATH)
    content = fetch_page(source_url)

    if content is None:
        return 0 if keep_existing("fetch failed", OUT_PATH) else 1

    url_match = URL_RE.search(content)
    if not url_match:
        return 0 if keep_existing("no valid activation URL", OUT_PATH) else 1

    email_match = EMAIL_RE.search(content)
    existing_jrebel = data.get("jrebel") if isinstance(data.get("jrebel"), dict) else {}
    email = email_match.group(0) if email_match else existing_jrebel.get("email", "")

    data["jrebel"] = {
        "url": url_match.group(0),
        "email": email,
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": source_url,
    }

    write_json(OUT_PATH, data)
    print(f"Wrote JRebel server to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
