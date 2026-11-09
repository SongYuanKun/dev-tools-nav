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

test("color tool_used maps to Chinese whitelist labels", () => {
  assert.deepEqual(
    { ...enrich({ tool: "color", action: "contrast" }) },
    {
      描述: "工具使用：颜色转换 · 对比度",
      工具: "颜色转换",
      操作: "对比度",
    },
  );
});

test("hash and qrcode tool labels map for whitelist coverage", () => {
  assert.deepEqual(
    { ...enrich({ tool: "hash", action: "digest" }) },
    {
      描述: "工具使用：哈希生成器 · 摘要",
      工具: "哈希生成器",
      操作: "摘要",
    },
  );
  assert.deepEqual(
    { ...enrich({ tool: "qrcode", action: "generate" }) },
    {
      描述: "工具使用：二维码生成器 · 生成",
      工具: "二维码生成器",
      操作: "生成",
    },
  );
});

test("tool_used and tool_open carry low-cardinality entry class", () => {
  const window = {};
  vm.runInNewContext(source, { window });
  assert.deepEqual(
    { ...window.umamiEnrich("tool_used", { tool: "json", action: "format", entry: "home" }) },
    {
      描述: "工具使用：JSON 格式化 · 格式化（首页）",
      工具: "JSON 格式化",
      操作: "格式化",
      入口: "首页",
    },
  );
  assert.deepEqual(
    { ...window.umamiEnrich("tool_open", { tool: "json", entry: "handbook" }) },
    {
      描述: "工具打开：JSON 格式化 · 手册",
      工具: "JSON 格式化",
      入口: "手册",
    },
  );
});
