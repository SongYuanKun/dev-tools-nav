#!/usr/bin/env python3
"""
从 GitHub Trending Weekly 同步 AI 开源项目雷达数据到 data/open-source-radar.json。

策略：
- 抓取 Trending 页面获取本周 star 涨幅与仓库列表
- 关键词筛选 AI/ML/Agent 相关项目
- 已有人工维护的中文解读优先保留，仅更新 star / weekStars / trending / rank
- 新增 Trending 项目生成基础中文卡片（可后续人工润色）
- 抓取失败时保留现有 JSON
"""

from __future__ import annotations

import html as html_lib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_PATH = os.environ.get(
    "RADAR_OUT_PATH",
    os.path.join(_REPO_ROOT, "data", "open-source-radar.json"),
)
TRENDING_URL = os.environ.get(
    "GITHUB_TRENDING_URL",
    "https://github.com/trending?since=weekly",
)
UA = "Mozilla/5.0 (compatible; dev-tools-nav/1.0; +https://github.com/SongYuanKun/dev-tools-nav)"

MAX_TRENDING = 7
MAX_EVERGREEN = 5

AI_KEYWORDS = (
    "ai",
    "llm",
    "agent",
    "gpt",
    "claude",
    "gemini",
    "copilot",
    "skill",
    "rag",
    "embedding",
    "transformer",
    "openai",
    "anthropic",
    "mcp",
    "notebook",
    "multimodal",
    "vlm",
    "machine learning",
    "deep learning",
    "neural",
    "codex",
    "browser-use",
    "chatbot",
    "langchain",
    "huggingface",
)

TOPIC_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("skills", ("skill", "skills", "mcp", "superpowers")),
    ("memory", ("memory", "harness", "persistent", "hermes")),
    ("research", ("research", "notebook", "browser", "scrap", "reddit", "youtube", "reach")),
    ("coding", ("code", "coding", "cli", "cursor", "graph", "developer")),
    ("multimodal", ("voice", "live2d", "video", "image", "multimodal", "vtuber")),
]

THEMES = [
    {"id": "all", "label": "全部"},
    {"id": "skills", "label": "Agent Skills"},
    {"id": "memory", "label": "记忆 / Harness"},
    {"id": "research", "label": "调研 / 知识"},
    {"id": "coding", "label": "编程 Agent"},
    {"id": "multimodal", "label": "多模态"},
]

TOPIC_LABELS = {
    "skills": "Agent Skills",
    "memory": "记忆 / Harness",
    "research": "调研 / 知识",
    "coding": "编程 Agent",
    "multimodal": "多模态",
}


def strip_tags(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw or "")
    return html_lib.unescape(re.sub(r"\s+", " ", text).strip())


def parse_star_count(raw: str) -> int:
    digits = re.sub(r"[^\d]", "", raw or "")
    return int(digits) if digits else 0


def fetch_text(url: str, headers: dict[str, str] | None = None) -> str | None:
    req_headers = {"User-Agent": UA}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, OSError) as exc:
        print(f"WARN: fetch failed {url}: {exc}", file=sys.stderr)
        return None


def parse_trending_html(page_html: str) -> list[dict[str, Any]]:
    articles = re.findall(r'<article class="Box-row">(.*?)</article>', page_html, re.S)
    items: list[dict[str, Any]] = []

    for block in articles:
        repo_match = re.search(
            r'explore\.click.*?href="/([^/"]+/[^/"]+)"',
            block,
            re.S,
        )
        if not repo_match:
            repo_match = re.search(r'<h2[^>]*>.*?href="/([^/"]+/[^/"]+)"', block, re.S)
        if not repo_match:
            continue

        repo = repo_match.group(1).strip()
        desc_match = re.search(r'<p class="col-9[^"]*"[^>]*>(.*?)</p>', block, re.S)
        description = strip_tags(desc_match.group(1)) if desc_match else ""

        week_match = re.search(r"([\d,]+)\s+stars?\s+this\s+week", block, re.I)
        week_stars = parse_star_count(week_match.group(1)) if week_match else 0

        lang_match = re.search(r'itemprop="programmingLanguage"[^>]*>([^<]+)<', block)
        language = lang_match.group(1).strip() if lang_match else ""

        items.append(
            {
                "repo": repo,
                "description": description,
                "weekStars": week_stars,
                "language": language,
            }
        )

    return items


def is_ai_related(repo: str, description: str) -> bool:
    haystack = f"{repo} {description}".lower()
    return any(keyword in haystack for keyword in AI_KEYWORDS)


def guess_topic(repo: str, description: str) -> str:
    haystack = f"{repo} {description}".lower()
    for topic, keywords in TOPIC_RULES:
        if any(keyword in haystack for keyword in keywords):
            return topic
    return "research"


def fetch_repo_meta(repo: str, token: str | None) -> dict[str, Any]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": UA}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"https://api.github.com/repos/{repo}"
    raw = fetch_text(url, headers=headers)
    if not raw:
        return {}

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    if not isinstance(data, dict):
        return {}

    return {
        "stars": int(data.get("stargazers_count") or 0),
        "language": data.get("language") or "",
        "description": (data.get("description") or "").strip(),
    }


def make_auto_summary(repo: str, description: str) -> str:
    short_name = repo.split("/")[-1]
    if description:
        return f"本周 GitHub Trending：{short_name} — {description}"
    return f"本周 GitHub Trending 热门项目 {repo}。"


def make_auto_features(description: str) -> list[str]:
    if description:
        return [
            description,
            "本周入选 GitHub Trending，社区关注度上升。",
            "建议阅读 README 与 License，评估是否适合你的场景。",
        ]
    return [
        "本周入选 GitHub Trending。",
        "建议阅读 README 与近期 Release。",
        "上线前自行评估许可证与安全风险。",
    ]


def make_auto_tags(repo: str, topic: str, description: str) -> list[str]:
    tags = [TOPIC_LABELS.get(topic, "AI 开源")]
    name = repo.split("/")[-1].replace("-", " ")
    if name and name.lower() not in {t.lower() for t in tags}:
        tags.append(name[:24])
    if "skill" in description.lower() and "Skill" not in tags:
        tags.append("Agent Skill")
    return tags[:3]


def week_label(now: datetime) -> str:
    start = (now - timedelta(days=7)).date()
    end = now.date()
    return f"{start} ~ {end}"


def make_week_summary(trending_projects: list[dict[str, Any]]) -> str:
    if not trending_projects:
        return "本周暂未筛到符合条件的 AI Trending 项目，保留历史热门项目供参考。"

    topic_count: dict[str, int] = {}
    for project in trending_projects:
        topic = project.get("topic") or "research"
        topic_count[topic] = topic_count.get(topic, 0) + 1

    top_topics = sorted(topic_count.items(), key=lambda item: (-item[1], item[0]))
    labels = [TOPIC_LABELS.get(topic, topic) for topic, _ in top_topics[:3]]
    names = [p["repo"].split("/")[-1] for p in trending_projects[:3]]
    joined = "、".join(labels)
    sample = "、".join(names)
    return (
        f"本周 GitHub Trending 的 AI 热点集中在 {joined} 等方向。"
        f"代表项目包括 {sample}。"
        "自动同步已更新 star 数据，中文解读可继续人工润色。"
    )


def load_existing() -> dict[str, Any]:
    try:
        with open(OUT_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

    return data if isinstance(data, dict) else {}


def index_existing_projects(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    projects = data.get("projects") if isinstance(data.get("projects"), list) else []
    return {
        project["repo"]: project
        for project in projects
        if isinstance(project, dict) and isinstance(project.get("repo"), str)
    }


def build_project(
    *,
    rank: int,
    repo: str,
    trending_item: dict[str, Any],
    existing: dict[str, Any] | None,
    api_meta: dict[str, Any],
    trending: bool,
) -> dict[str, Any]:
    raw_desc = trending_item.get("description") or api_meta.get("description") or ""
    topic = (existing or {}).get("topic") or guess_topic(repo, raw_desc)

    project: dict[str, Any] = {
        "rank": rank,
        "repo": repo,
        "language": (
            (existing or {}).get("language")
            or trending_item.get("language")
            or api_meta.get("language")
            or "—"
        ),
        "stars": int(
            api_meta.get("stars")
            or (existing or {}).get("stars")
            or 0
        ),
        "weekStars": int(trending_item.get("weekStars") or 0),
        "trending": trending,
        "topic": topic,
        "summary": (existing or {}).get("summary") or make_auto_summary(repo, raw_desc),
        "features": (existing or {}).get("features") or make_auto_features(raw_desc),
        "tags": (existing or {}).get("tags") or make_auto_tags(repo, topic, raw_desc),
    }
    return project


def merge_payload(
    trending_items: list[dict[str, Any]],
    existing_data: dict[str, Any],
    token: str | None,
) -> dict[str, Any]:
    existing_map = index_existing_projects(existing_data)
    ai_trending = [item for item in trending_items if is_ai_related(item["repo"], item["description"])]
    ai_trending.sort(key=lambda item: item.get("weekStars", 0), reverse=True)
    ai_trending = ai_trending[:MAX_TRENDING]

    projects: list[dict[str, Any]] = []
    used_repos: set[str] = set()

    for index, item in enumerate(ai_trending, start=1):
        repo = item["repo"]
        used_repos.add(repo)
        api_meta = fetch_repo_meta(repo, token)
        if token:
            time.sleep(0.2)
        projects.append(
            build_project(
                rank=index,
                repo=repo,
                trending_item=item,
                existing=existing_map.get(repo),
                api_meta=api_meta,
                trending=True,
            )
        )

    evergreen_candidates = [
        project
        for project in (existing_data.get("projects") or [])
        if isinstance(project, dict)
        and project.get("repo") not in used_repos
    ]
    evergreen_candidates.sort(key=lambda item: int(item.get("stars") or 0), reverse=True)

    rank = len(projects)
    for project in evergreen_candidates[:MAX_EVERGREEN]:
        rank += 1
        repo = project["repo"]
        used_repos.add(repo)
        api_meta = fetch_repo_meta(repo, token)
        if token:
            time.sleep(0.2)
        projects.append(
            build_project(
                rank=rank,
                repo=repo,
                trending_item={
                    "description": project.get("summary", ""),
                    "weekStars": 0,
                    "language": project.get("language", ""),
                },
                existing=project,
                api_meta=api_meta,
                trending=False,
            )
        )

    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    trending_projects = [project for project in projects if project.get("trending")]
    if trending_projects:
        summary = make_week_summary(trending_projects)
    else:
        summary = existing_data.get("summary") or make_week_summary([])

    return {
        "updatedAt": now.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "weekLabel": week_label(now),
        "summary": summary,
        "themes": THEMES,
        "projects": projects,
    }


def write_payload(payload: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def main() -> int:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    existing = load_existing()

    page_html = fetch_text(TRENDING_URL)
    if page_html is None:
        if existing:
            print(f"Keep existing radar data (fetch failed): {OUT_PATH}")
            return 0
        print("ERROR: trending fetch failed and no existing radar file", file=sys.stderr)
        return 1

    trending_items = parse_trending_html(page_html)
    if not trending_items:
        if existing:
            print(f"Keep existing radar data (no trending items parsed): {OUT_PATH}")
            return 0
        print("ERROR: no trending items parsed", file=sys.stderr)
        return 1

    payload = merge_payload(trending_items, existing, token)
    write_payload(payload)

    trending_count = sum(1 for project in payload["projects"] if project.get("trending"))
    print(
        f"Wrote {len(payload['projects'])} projects "
        f"({trending_count} trending) -> {OUT_PATH}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
