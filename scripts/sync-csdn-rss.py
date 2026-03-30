#!/usr/bin/env python3
"""
从 CSDN 博客 RSS 生成 data/csdn-articles.json，供静态站 fetch 展示「最新动态」。
RSS 地址默认：https://blog.csdn.net/<用户名>/rss/list（会 301 到 rss.csdn.net）
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo

DEFAULT_RSS = "https://blog.csdn.net/syk123839070/rss/list"
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_PATH = os.path.join(_REPO_ROOT, "data", "csdn-articles.json")
MAX_ITEMS = 40
DESC_MAX = 200
UA = "Mozilla/5.0 (compatible; dev-tools-nav/1.0; +https://github.com/SongYuanKun/dev-tools-nav)"


def strip_html(text: str) -> str:
    if not text:
        return ""
    t = re.sub(r"<[^>]+>", " ", text)
    t = html.unescape(t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def truncate(s: str, n: int) -> str:
    s = s.strip()
    if len(s) <= n:
        return s
    return s[: n - 1] + "…"


def parse_pub_date(raw: str | None) -> str:
    if not raw:
        return ""
    try:
        dt = parsedate_to_datetime(raw.strip())
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        # 按中国时区展示日期，避免夜间发文在 UTC 下跨日
        return dt.astimezone(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OverflowError):
        return ""


def fetch_rss(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read()
    except (urllib.error.URLError, OSError) as e:
        print(f"WARN: fetch RSS failed: {e}", file=sys.stderr)
        return None


def parse_rss(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    if channel is None:
        return []

    items: list[dict] = []
    for el in channel.findall("item"):
        title = (el.findtext("title") or "").strip()
        link = (el.findtext("link") or "").strip()
        desc_raw = el.findtext("description") or ""
        pub = el.findtext("pubDate")
        cat_el = el.find("category")
        category = (cat_el.text or "").strip() if cat_el is not None and cat_el.text else ""

        desc = truncate(strip_html(desc_raw), DESC_MAX)
        date_str = parse_pub_date(pub)

        tags: list[str] = []
        if category:
            tags = [category]

        if title and link:
            items.append(
                {
                    "title": title,
                    "description": desc,
                    "url": link,
                    "date": date_str,
                    "platform": "CSDN",
                    "tags": tags,
                }
            )
        if len(items) >= MAX_ITEMS:
            break

    return items


def main() -> int:
    rss_url = os.environ.get("CSDN_RSS_URL", DEFAULT_RSS)
    raw = fetch_rss(rss_url)
    if raw is None:
        if os.path.isfile(OUT_PATH):
            print("Keep existing csdn-articles.json (fetch failed).")
            return 0
        items = []
    else:
        try:
            items = parse_rss(raw)
        except ET.ParseError as e:
            print(f"WARN: RSS parse error: {e}", file=sys.stderr)
            items = []

    payload = {
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": rss_url,
        "items": items,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote {len(items)} articles to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
