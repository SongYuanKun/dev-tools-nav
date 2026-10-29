import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("CommandPalette.search ranks online tools and matches tags", async () => {
  const source = await readFile(new URL("../js/command-palette.js", import.meta.url), "utf8");
  const document = {
    documentElement: { classList: { add() {}, remove() {} } },
    body: {
      appendChild() {},
    },
    createElement(tag) {
      return {
        tagName: tag,
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {},
        getAttribute() { return null; },
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        appendChild() {},
        focus() {},
        scrollIntoView() {},
      };
    },
    querySelector() { return null; },
    addEventListener() {},
  };
  const context = {
    window: { location: { pathname: "/", href: "https://tools.songyuankun.top/" } },
    document,
    TOOLS_DATA: [
      {
        id: "online-json",
        slug: "json",
        name: "JSON 格式化",
        description: "格式化与校验",
        category: "online-tools",
        tags: ["JSON", "格式化"],
        url: "tools/json/",
        icon: "📋",
        featured: true,
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        description: "AI 对话",
        category: "ai",
        tags: ["AI对话"],
        url: "https://chat.deepseek.com/",
        icon: "🤖",
      },
    ],
  };
  context.window.TOOLS_DATA = context.TOOLS_DATA;
  vm.runInNewContext(source, context);
  const hits = context.window.CommandPalette.search("json");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].slug, "json");
  const tagHits = context.window.CommandPalette.search("格式化");
  assert.ok(tagHits.some((tool) => tool.slug === "json"));
  const empty = context.window.CommandPalette.search("");
  assert.equal(empty[0].slug, "json");
  assert.ok(empty.some((tool) => tool.category === "ai"));
  assert.ok(empty.findIndex((tool) => tool.slug === "json") < empty.findIndex((tool) => tool.category === "ai"));
});
