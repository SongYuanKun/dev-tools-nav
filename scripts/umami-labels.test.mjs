import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../js/umami-labels.js", import.meta.url), "utf8");

function enrich(data) {
  const window = {};
  vm.runInNewContext(source, { window });
  return window.umamiEnrich("tool_used", data);
}

test("diff action labels depend on the tool context", () => {
  assert.deepEqual(
    { ...enrich({ tool: "json", action: "diff" }) },
    {
      描述: "工具使用：JSON 格式化 · 结构对比",
      工具: "JSON 格式化",
      操作: "结构对比",
    },
  );
  assert.deepEqual(
    { ...enrich({ tool: "timestamp", action: "diff" }) },
    {
      描述: "工具使用：时间戳转换 · 时间差计算",
      工具: "时间戳转换",
      操作: "时间差计算",
    },
  );
});
