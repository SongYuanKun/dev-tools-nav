import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("test workflow gates pushes and pull requests with npm ci and npm test", () => {
  const workflow = readFileSync(".github/workflows/test.yml", "utf-8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /node-version: ["']24["']/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
});
