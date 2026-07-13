import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { prepareJsonSample } from "./capture-screenshots.mjs";

test("capture script can be imported when argv has no script path", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "import('./scripts/capture-screenshots.mjs')"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
});

test("prepareJsonSample opens the hidden menu before clicking the sample", async () => {
  const calls = [];
  const page = {
    locator(selector) {
      return {
        async click() { calls.push(["click", selector]); },
        async waitFor(options) { calls.push(["waitFor", selector, options.state]); },
      };
    },
    async waitForFunction(_fn, expected) { calls.push(["content", expected]); },
  };

  await prepareJsonSample(page);

  assert.deepEqual(calls, [
    ["click", ".json-more > summary"],
    ["waitFor", "#btnSample", "visible"],
    ["click", "#btnSample"],
    ["content", "Koen Tools"],
  ]);
});
