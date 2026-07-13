import test from "node:test";
import assert from "node:assert/strict";

import { prepareJsonSample } from "./capture-screenshots.mjs";

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
