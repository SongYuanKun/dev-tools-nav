import test from "node:test";
import assert from "node:assert/strict";

import { auditTools } from "./audit-tools.mjs";

test("catalog has the approved counts and unique IDs", () => {
  const result = auditTools(process.cwd());
  assert.equal(result.total, 73);
  assert.equal(result.categoryCounts["online-tools"], 11);
  assert.deepEqual(result.duplicateIds, []);
});

test("all ten self-built tools have canonical shells", () => {
  const result = auditTools(process.cwd());
  assert.deepEqual(result.selfBuilt, [
    "base64", "color", "cron", "diff", "json",
    "jwt", "regex", "sql-formatter", "timestamp", "uuid",
  ]);
  assert.deepEqual(result.missingCanonical, []);
});

test("README states all three catalog counts and canonical URL policy", () => {
  const result = auditTools(process.cwd());
  assert.deepEqual(result.readmeCounts, { total: 73, selfBuilt: 10, onlineTools: 11 });
  assert.equal(result.readmeUsesCanonicalToolsPath, true);
});
