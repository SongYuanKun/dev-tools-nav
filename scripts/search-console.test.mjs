import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseDocument } from "yaml";

import { DEMO_DATA_PATH, loadQueries, renderHtml } from "./build-search-console.mjs";

test("search console demo output identifies simulated data", () => {
  const html = renderHtml({
    meta: { generatedAt: "2026-10-21", total: 1, noMatch: 0, dataKind: "demo" },
    queries: [{ query: "JSON 格式化", clicks: 1, impressions: 10, ctr: 0.1, position: 2, hasMatchingTool: true, page: "/tools/json/", tags: ["json"] }],
  });
  assert.match(html, /搜索意图演示看板/);
  assert.match(html, /模拟样本/);
  assert.match(html, /不代表真实 Search Console 指标/);
  assert.doesNotMatch(html, /logs\/search-queries\.json/);
});

test("versioned demo fixture drives reproducible HTML and valid issue-template YAML", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "search-console-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const htmlPath = join(temp, "search-console.html");
  const yamlPath = join(temp, "search-gap.yml");
  const result = spawnSync(process.execPath, ["scripts/build-search-console.mjs", "--input", DEMO_DATA_PATH, "--output", htmlPath, "--issue-template", yamlPath], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const [html, yaml] = await Promise.all([readFile(htmlPath, "utf8"), readFile(yamlPath, "utf8")]);
  assert.match(html, /模拟样本/);
  assert.match(html, /data\/search-console-demo\.json/);
  assert.match(yaml, /不代表真实 Search Console 数据/);
  const document = parseDocument(yaml);
  assert.deepEqual(document.errors, []);
  assert.equal(document.get("body", true).items.length > 0, true);
  assert.equal(loadQueries().queries.length, 20);
});
