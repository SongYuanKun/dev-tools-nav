import assert from "node:assert/strict";
import test from "node:test";

import { renderHtml } from "./build-search-console.mjs";

test("search console demo output identifies simulated data", () => {
  const html = renderHtml({
    meta: { generatedAt: "2026-10-21", total: 1, noMatch: 0, dataKind: "demo" },
    queries: [{ query: "JSON 格式化", clicks: 1, impressions: 10, ctr: 0.1, position: 2, hasMatchingTool: true, page: "/tools/json/", tags: ["json"] }],
  });
  assert.match(html, /搜索意图演示看板/);
  assert.match(html, /模拟样本/);
  assert.match(html, /不代表真实 Search Console 指标/);
});
