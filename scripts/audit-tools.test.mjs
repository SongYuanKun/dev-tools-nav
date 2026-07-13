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
