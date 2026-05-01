#!/usr/bin/env node

/**
 * generate-ai-changelog.mjs
 *
 * 从 git log 自动生成 AI_TOPIC_CHANGELOG，写入 data/ai-compare.js。
 * 供 CI 部署前或本地手动运行。
 *
 * 用法：
 *   node scripts/generate-ai-changelog.mjs          # 默认写入 data/ai-compare.js
 *   node scripts/generate-ai-changelog.mjs --dry-run # 仅输出，不写文件
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_FILE = resolve(ROOT, "data/ai-compare.js");

// ─── 配置 ───────────────────────────────────────────
const AI_PATHS = [
  "pages/ai",
  "data/ai-compare.js",
  "css/ai-topic.css",
  "js/ai-related-reads.js",
];

const MAX_ENTRIES = 20;

// ─── 参数解析 ───────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

// ─── 1. 获取 git log ───────────────────────────────
function getGitLog() {
  const raw = execFileSync(
    "git",
    ["log", "--format=%H|%ai|%s", "--", ...AI_PATHS],
    { cwd: ROOT, encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 }
  );

  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [hash, date, ...rest] = line.split("|");
      return {
        hash: hash?.trim(),
        date: date?.trim()?.split(" ")[0] || "",
        subject: rest.join("|").trim(),
      };
    })
    .filter((c) => c.date);
}

// ─── 2. 解析 commit message ────────────────────────
function parseCommitMessage(subject) {
  const ccMatch = subject.match(
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(?:\(([^)]*)\))?:\s*(.+)/i
  );
  if (ccMatch) {
    return {
      type: ccMatch[1].toLowerCase(),
      scope: ccMatch[2] || "",
      desc: ccMatch[3].trim(),
    };
  }
  return { type: "other", scope: "", desc: subject };
}

// ─── 3. 智能摘要：简化冗长描述 ─────────────────────
function summarize(descs) {
  if (descs.length === 0) return "更新";
  if (descs.length === 1) return descs[0];

  // 提取每条描述的核心关键词
  const keywords = descs.map((d) => {
    return d
      .replace(/^(新增|更新|添加|优化|调整|完善|补充)\s*/, "")
      .trim();
  });

  const joined = keywords.join("；");
  // 标题超过 50 字时压缩
  if (joined.length > 50) {
    const first = keywords[0];
    // 尝试截取第一个分号前的部分
    const short = first.length > 30 ? first.slice(0, 27) + "…" : first;
    const extra = keywords.length - 1;
    return `${short}等 ${extra} 项`;
  }
  return joined;
}

// ─── 4. 按日期分组，生成 changelog 条目 ────────────
function generateChangelogEntries(commits) {
  // 按日期分组
  const dateMap = new Map();
  for (const commit of commits) {
    if (!dateMap.has(commit.date)) {
      dateMap.set(commit.date, []);
    }
    dateMap.get(commit.date).push(parseCommitMessage(commit.subject));
  }

  const entries = [];
  for (const [date, parsed] of dateMap) {
    if (entries.length >= MAX_ENTRIES) break;

    const featItems = parsed.filter(
      (p) => p.type === "feat" || p.type === "docs"
    );
    const fixItems = parsed.filter((p) => p.type === "fix");
    const otherItems = parsed.filter(
      (p) =>
        p.type !== "feat" &&
        p.type !== "docs" &&
        p.type !== "fix" &&
        p.type !== "chore" &&
        p.type !== "ci"
    );

    // ── 标题：简洁概括 ──
    let title;
    if (featItems.length > 0 && fixItems.length > 0) {
      title = `${summarize(featItems.map((f) => f.desc))}；修复 ${fixItems.length} 项`;
    } else if (featItems.length > 0) {
      title = summarize(featItems.map((f) => f.desc));
    } else if (fixItems.length > 0) {
      title = `修复：${summarize(fixItems.map((f) => f.desc))}`;
    } else {
      title = summarize(otherItems.map((o) => o.desc));
    }

    // ── 详情：展开说明 ──
    const detailParts = [];
    featItems.forEach((f) => detailParts.push(f.desc));
    fixItems.forEach((f) => detailParts.push(`修复 ${f.desc}`));
    otherItems.forEach((o) => detailParts.push(o.desc));

    let detail = detailParts.join("；");
    if (detail.length > 150) {
      detail = detail.slice(0, 147) + "…";
    }

    entries.push({ date, title, detail });
  }

  return entries;
}

// ─── 5. 写入 data/ai-compare.js ─────────────────────
function writeChangelog(entries) {
  const content = readFileSync(DATA_FILE, "utf-8");

  const arrayCode = `const AI_TOPIC_CHANGELOG = [
${entries
  .map(
    (e) =>
      `  {\n    date: "${e.date}",\n    title: "${escape(e.title)}",\n    detail: "${escape(e.detail)}",\n  }`
  )
  .join(",\n")}
];`;

  const pattern = /const AI_TOPIC_CHANGELOG\s*=\s*\[[\s\S]*?\];\s*\n(?=\/\/|const |$)/;

  if (!pattern.test(content)) {
    console.error(
      "❌ 未找到 AI_TOPIC_CHANGELOG 定义，请检查 data/ai-compare.js"
    );
    process.exit(1);
  }

  const newContent = content.replace(pattern, arrayCode + "\n\n");
  writeFileSync(DATA_FILE, newContent, "utf-8");
  console.log(`✅ 已写入 ${entries.length} 条 changelog → ${DATA_FILE}`);
}

function escape(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ─── 主流程 ─────────────────────────────────────────
function main() {
  console.log("📋 从 git log 生成 AI_TOPIC_CHANGELOG...\n");

  const commits = getGitLog();
  console.log(`  找到 ${commits.length} 个 AI 专题相关 commit`);

  const entries = generateChangelogEntries(commits);
  console.log(`  生成 ${entries.length} 条 changelog 条目\n`);

  for (const entry of entries) {
    console.log(`  [${entry.date}] ${entry.title}`);
    console.log(`    → ${entry.detail}\n`);
  }

  if (dryRun) {
    console.log("🔄 --dry-run 模式，未写入文件");
    return;
  }

  writeChangelog(entries);
}

main();
