import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("base.js installs a queueing umamiTrack stub before labels load", async () => {
  const source = await readFile(new URL("../js/base.js", import.meta.url), "utf8");
  assert.match(source, /pendingTracks/);
  assert.match(source, /flushPendingTracks/);
  assert.match(source, /command-palette\.js/);
});

test("umami labels map color and generate actions for tool_used", async () => {
  const source = await readFile(new URL("../js/umami-labels.js", import.meta.url), "utf8");
  const window = {};
  // eslint-disable-next-line no-new-func
  Function("window", source)(window);
  const props = window.umamiEnrich("tool_used", { tool: "color", action: "pick" });
  assert.equal(props["工具"], "颜色转换");
  assert.equal(props["操作"], "取色");
  assert.match(props["描述"], /颜色转换/);
});

test("command palette exposes searchable Chinese UI helpers", async () => {
  const source = await readFile(new URL("../js/command-palette.js", import.meta.url), "utf8");
  assert.match(source, /快速搜索/);
  assert.match(source, /metaKey \|\| e\.ctrlKey/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /window\.CommandPalette/);
});
