import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import YAML from "yaml";

import {
  applySubmission,
  buildToolEntry,
  parseIssueForm,
  validateHttpsUrl,
  validateToolId,
} from "./tool-submission.mjs";

const SAMPLE_BODY = `### 提报前检查

- [x] 我已搜索现有目录与 Issue，确认尚未收录该工具
- [x] 该工具不是破解、序列号、许可绕过或其它违规内容
- [x] 官网使用 HTTPS，且我确认链接可公开访问

### 工具 ID（英文短横线）

excalidraw-demo

### 工具显示名称

Excalidraw Demo

### 分类

design

### 一句话简介

开源手绘风格白板，适合架构草图与协作讨论。

### 官网 URL

https://excalidraw.com/

### 标签（逗号分隔）

白板,协作,开源

### 图标 URL（可选）

_No response_

### 是否建议精选

否

### 补充说明（可选）

MIT 协议
`;

test("tool submission issue form requires safe catalog fields", () => {
  const form = YAML.parse(readFileSync(".github/ISSUE_TEMPLATE/tool-submission.yml", "utf8"));
  const fields = new Map(form.body.filter((item) => item.id).map((item) => [item.id, item]));
  assert.equal(form.name, "🧰 工具目录投稿");
  assert.deepEqual(form.labels, ["tool-submission", "triage"]);
  for (const id of ["tool_id", "tool_name", "category", "description", "url", "tags", "featured"]) {
    assert.ok(fields.has(id), id);
    assert.equal(fields.get(id)?.validations?.required, true, `${id} required`);
  }
});

test("parseIssueForm reads GitHub issue form headings", () => {
  const fields = parseIssueForm(SAMPLE_BODY);
  assert.equal(fields.tool_id, "excalidraw-demo");
  assert.equal(fields.category, "design");
  assert.equal(fields.icon, "");
  assert.equal(fields.featured, "否");
});

test("validateHttpsUrl rejects non-https and credentials", () => {
  assert.throws(() => validateHttpsUrl("http://example.com"), /https/);
  assert.throws(() => validateHttpsUrl("javascript:alert(1)"), /https|协议/);
  assert.throws(() => validateHttpsUrl("https://user:pass@example.com/"), /用户名或密码/);
  assert.equal(validateHttpsUrl("https://example.com/path"), "https://example.com/path");
});

test("validateToolId rejects unsafe identifiers", () => {
  assert.throws(() => validateToolId("../etc"), /工具 ID/);
  assert.throws(() => validateToolId("online-json"), /online-/);
  assert.equal(validateToolId("Excalidraw-Demo"), "excalidraw-demo");
});

test("buildToolEntry emits JSON-escaped literals without raw HTML", () => {
  const built = buildToolEntry({
    tool_id: "safe-tool",
    tool_name: 'Name<script>alert(1)</script>',
    category: "dev",
    description: "A safe description for catalog use.",
    url: "https://example.com/",
    tags: "a,b",
    icon: "",
    featured: "是",
  });
  assert.match(built.entry, /id: "safe-tool"/);
  assert.doesNotMatch(built.entry, /<script>/);
  assert.match(built.entry, /featured: true/);
  assert.match(built.entry, /icon\.horse/);
});

test("applySubmission inserts before online-tools section and bumps README total", () => {
  const toolsSource = readFileSync("data/tools.js", "utf8");
  const readmeSource = readFileSync("README.md", "utf8");
  const before = Number(readmeSource.match(/<!-- catalog-total: (\d+) -->/)?.[1]);
  const result = applySubmission({ body: SAMPLE_BODY, toolsSource, readmeSource });
  assert.ok(result.toolsSource.includes('id: "excalidraw-demo"'));
  assert.ok(
    result.toolsSource.indexOf('id: "excalidraw-demo"')
      < result.toolsSource.indexOf("在线工具（自研"),
  );
  assert.equal(
    Number(result.readmeSource.match(/<!-- catalog-total: (\d+) -->/)?.[1]),
    before + 1,
  );
  assert.throws(
    () => applySubmission({ body: SAMPLE_BODY, toolsSource: result.toolsSource, readmeSource: result.readmeSource }),
    /已存在/,
  );
});

test("tool submission workflow only runs on approval label and never evals issue body", () => {
  const workflow = readFileSync(".github/workflows/tool-submission.yml", "utf8");
  assert.match(workflow, /tool-submission-approved/);
  assert.match(workflow, /scripts\/tool-submission\.mjs/);
  assert.doesNotMatch(workflow, /eval\(|new Function|Function\(/);
  assert.match(workflow, /未\*\*执行 Issue 正文/);
});
