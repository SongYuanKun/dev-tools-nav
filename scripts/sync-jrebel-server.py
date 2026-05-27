#!/usr/bin/env python3
"""
从 JRebel 激活地址页面提取可用服务器信息，更新 data/servers.json。

外部页面短暂不可用或结构变化时，保留现有数据，避免定时任务把有效地址覆写为空。
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
OUT_PATH = os.environ.get(
    "JREBEL_SERVERS_OUT_PATH",
    os.path.join(_REPO_ROOT, "data", "servers.json"),
)
SOURCE_URL = os.environ.get("JREBEL_SOURCE_URL", DEFAULT_SOURCE_URL)
SOURCE_FILE = os.environ.get("JREBEL_SOURCE_FILE")
UA = "Mozilla/5.0 (compatible; dev-tools-nav/1.0; +https://github.com/SongYuanKun/dev-tools-nav)"

URL_RE = re.compile(r"http://(?:\d{1,3}\.){3}\d{1,3}:\d+/[\w-]+")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
URL_LABELS = (
    "JRebel 激活地址",
    "Jrebel 激活地址",
    "激活地址",
    "License server",
    "License Server",
    "license server",
)
EMAIL_LABELS = (
    "JRebel 激活邮箱",
    "Jrebel 激活邮箱",
    "激活邮箱",
    "email",
    "Email",
)
LABEL_LOOKAHEAD_CHARS = 500


def read_source() -> str | None:
    if SOURCE_FILE:
        try:
            with open(SOURCE_FILE, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except OSError as e:
            print(f"WARN: read JRebel source file failed: {e}", file=sys.stderr)
            return None

    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except (urllib.error.URLError, OSError) as e:
        print(f"WARN: fetch JRebel source failed: {e}", file=sys.stderr)
        return None


def load_existing() -> dict:
    try:
        with open(OUT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def keep_existing(reason: str) -> bool:
    if os.path.isfile(OUT_PATH):
        print(f"Keep existing servers.json ({reason}).")
        return True
    return False


def unique_matches(pattern: re.Pattern[str], content: str) -> list[str]:
    seen: set[str] = set()
    values: list[str] = []
    for match in pattern.finditer(content):
        value = match.group(0)
        if value not in seen:
            values.append(value)
            seen.add(value)
    return values


def match_after_label(content: str, labels: tuple[str, ...], pattern: re.Pattern[str]) -> str | None:
    for label in labels:
        label_re = re.compile(re.escape(label), re.IGNORECASE)
        for label_match in label_re.finditer(content):
            window = content[label_match.end() : label_match.end() + LABEL_LOOKAHEAD_CHARS]
            value_match = pattern.search(window)
            if value_match:
                return value_match.group(0)
    return None


def extract_license_url(content: str) -> str | None:
    labeled_url = match_after_label(content, URL_LABELS, URL_RE)
    if labeled_url:
        return labeled_url

    urls = unique_matches(URL_RE, content)
    if len(urls) == 1:
        return urls[0]
    return None


def extract_license_email(content: str, previous_email: str) -> str:
    labeled_email = match_after_label(content, EMAIL_LABELS, EMAIL_RE)
    if labeled_email:
        return labeled_email

    emails = unique_matches(EMAIL_RE, content)
    if len(emails) == 1:
        return emails[0]
    return previous_email


def main() -> int:
    content = read_source()
    if content is None:
        return 0 if keep_existing("fetch failed") else 1

    url = extract_license_url(content)
    if not url:
        return 0 if keep_existing("no license server URL found") else 1

    data = load_existing()
    previous = data.get("jrebel") if isinstance(data.get("jrebel"), dict) else {}
    email = extract_license_email(content, previous.get("email", ""))

    data["jrebel"] = {
        "url": url,
        "email": email,
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE_URL,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote JRebel server to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
