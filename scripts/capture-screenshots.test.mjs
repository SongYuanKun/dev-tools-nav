import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { prepareJsonSample, TARGETS } from "./capture-screenshots.mjs";

test("capture script can be imported when argv has no script path", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "import('./scripts/capture-screenshots.mjs')"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
});

test("JSON screenshot targets the canonical page and rejects legacy editor selectors", () => {
  const target = TARGETS.find(({ file }) => file === "screenshot-json-tool.png");
  assert.ok(target);
  assert.equal(target.path, "/tools/json/");
  assert.doesNotMatch(prepareJsonSample.toString(), /jsonInput|textarea|json-more|btnSample/);
});

test("prepareJsonSample clicks the new sample action and waits for CodeMirror content", async () => {
  const calls = [];
  const page = {
    locator(selector) {
      return {
        async click() { calls.push(["click", selector]); },
      };
    },
    async waitForFunction(_fn, expected) { calls.push(["content", expected]); },
  };

  await prepareJsonSample(page);

  assert.deepEqual(calls, [
    ["click", "[data-json-action=\"sample\"]"],
    ["content", "JSON 工作台"],
  ]);
});
