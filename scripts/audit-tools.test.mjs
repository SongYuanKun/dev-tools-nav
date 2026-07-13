import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SELF_BUILT_TOOLS,
  auditTools,
  parseToolCatalog,
  readmeUsesCanonicalToolsPath,
} from "./audit-tools.mjs";

test("parser counts only TOOLS_DATA top-level objects", () => {
  const source = `const CATEGORIES = [{ id: "not-a-tool" }];
const TOOLS_DATA = [
  {
    id: "alpha",
    category: "dev",
    url: "https://example.com",
    content: { id: "nested-id" },
  },
];`;

  assert.deepEqual(parseToolCatalog(source), {
    tools: [{ id: "alpha", category: "dev", url: "https://example.com" }],
    invalidTools: [],
  });
});

test("parser reports missing top-level required fields", () => {
  const source = `const TOOLS_DATA = [
  {
    id: "broken",
    category: "dev",
    content: { url: "https://nested.example.com" },
  },
];`;

  assert.deepEqual(parseToolCatalog(source).invalidTools, [
    { index: 0, missingFields: ["url"] },
  ]);
});

test("README canonical policy rejects legacy paths in the public table", () => {
  const paths = SELF_BUILT_TOOLS.map((slug) => `| tool | \`/tools/${slug}/\` | note |`).join("\n");
  const readme = `## 在线工具（\`/tools/\`）\n\n${paths}\n\n公开规范 URL 统一使用。`;

  assert.equal(readmeUsesCanonicalToolsPath(readme), true);
  assert.equal(readmeUsesCanonicalToolsPath(
    readme.replace("\n\n公开规范", "\n| legacy | \`pages/tools/legacy.html\` | note |\n\n公开规范"),
  ), false);
});

test("catalog has the approved counts and unique IDs", () => {
  const result = auditTools(process.cwd());
  assert.equal(result.total, 73);
  assert.equal(result.categoryCounts["online-tools"], 11);
  assert.deepEqual(result.duplicateIds, []);
  assert.deepEqual(result.invalidTools, []);
});

test("all ten self-built tools have canonical shells", () => {
  const result = auditTools(process.cwd());
  assert.deepEqual(result.selfBuilt, [
    "base64", "color", "cron", "diff", "json",
    "jwt", "regex", "sql-formatter", "timestamp", "uuid",
  ]);
  assert.deepEqual(result.missingCanonical, []);
});

test("README states all three catalog counts and canonical URL policy", () => {
  const result = auditTools(process.cwd());
  assert.deepEqual(result.readmeCounts, { total: 73, selfBuilt: 10, onlineTools: 11 });
  assert.equal(result.readmeUsesCanonicalToolsPath, true);
});

test("active docs have one roadmap and archive the ChatDev prompt", () => {
  const manual = readFileSync("manual.md", "utf-8");
  const docsIndex = readFileSync("docs/README.md", "utf-8");
  const roadmap = readFileSync("docs/roadmap.md", "utf-8");
  const chatdev = readFileSync("docs/chatdev-p1p2-prompt.md", "utf-8");

  assert.doesNotMatch(manual, /93% 用户|98\.6%|0 回头客/);
  assert.match(docsIndex, /roadmap\.md/);
  assert.match(roadmap, /北极星指标：有效工具使用次数/);
  assert.match(chatdev, /历史归档/);
  assert.match(chatdev, /不得作为当前实施依据/);
});

test("README names only docs/roadmap.md as the active roadmap source", () => {
  const readme = readFileSync("README.md", "utf-8");

  assert.match(readme, /唯一活跃[^\n]*\[产品路线图\]\(docs\/roadmap\.md\)/);
  assert.doesNotMatch(readme, /产品设计源头|均基于以下战略文档仓库|Astro \+ Tailwind/);
});

test("README keeps AI capabilities without a second roadmap", () => {
  const readme = readFileSync("README.md", "utf-8");

  assert.match(readme, /^## AI 专题（当前能力）$/m);
  assert.doesNotMatch(readme, /^## AI 专题规划|^### 未完成 \/ 待办|^\*\*P[012].*\*\*|^\*\*下一阶段产品 TODO/m);
});

test("README documents separate deployment manifests", () => {
  const readme = readFileSync("README.md", "utf-8");

  assert.doesNotMatch(readme, /与 `deploy\.sh` 排除规则一致/);
  assert.match(readme, /三套部署 manifest 分别维护/);
  assert.match(readme, /docs\/deploy-1panel\.md/);
});

test("content docs describe Markdown single-source as a Phase 2 target", () => {
  const handbook = readFileSync("docs/ai-free-tokens-handbook.md", "utf-8");
  const contentReadme = readFileSync("content/blog/README.md", "utf-8");
  const roadmap = readFileSync("docs/roadmap.md", "utf-8");

  assert.match(handbook, /\[产品路线图\]\(\.\/roadmap\.md\)/);
  assert.match(contentReadme, /\[产品路线图\]\(\.\.\/\.\.\/docs\/roadmap\.md\)/);
  assert.match(contentReadme, /Phase 2 目标/);
  assert.match(contentReadme, /当前仍有手写的 `pages\/blog\/\*\.html` 与人工同步内容/);
  assert.doesNotMatch(contentReadme, /CI 会自动转换为/);
  assert.match(roadmap, /已批准的目标架构[^\n]*Phase 2[^\n]*`planned`/);
  assert.doesNotMatch(roadmap, /原创正文以 `content\/blog\/\*\.md` 为唯一来源；HTML、博客索引、Feed、sitemap 元数据和结构化数据均由构建流程生成/);
});

test("roadmap tables use approved statuses and evidence every done row", () => {
  const roadmap = readFileSync("docs/roadmap.md", "utf-8");
  const allowedStatuses = new Set(["planned", "in_progress", "done", "blocked"]);
  let statusColumn = -1;
  let statusRows = 0;

  for (const line of roadmap.split("\n")) {
    if (!line.startsWith("|")) {
      statusColumn = -1;
      continue;
    }

    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const headerStatusColumn = cells.indexOf("状态");
    if (headerStatusColumn >= 0) {
      statusColumn = headerStatusColumn;
      continue;
    }
    if (statusColumn < 0 || cells.every((cell) => /^:?-+:?$/.test(cell))) continue;

    const status = cells[statusColumn];
    assert.ok(allowedStatuses.has(status), `invalid roadmap status ${status} in: ${line}`);
    if (status === "done") {
      assert.match(line, /\[[^\]]+\]\([^)]+\)/, `done roadmap row lacks evidence link: ${line}`);
    }
    statusRows += 1;
  }

  assert.ok(statusRows > 0, "roadmap contains no status rows");
});
