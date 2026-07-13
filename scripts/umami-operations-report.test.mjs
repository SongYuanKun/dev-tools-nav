import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("operations SQL separates hostnames and normalizes GitHub Pages paths", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(sql, /hostname/gi);
  assert.match(sql, /songyuankun\.github\.io/);
  assert.match(sql, /tools\.songyuankun\.top/);
  assert.match(sql, /\/dev-tools-nav/);
  assert.match(sql, /normalized_path/);
  assert.match(sql, /COUNT\(DISTINCT[^)]*session_id/si);
});

test("operations SQL defines effective use and excludes activation tools commercially", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(sql, /工具使用/);
  assert.match(sql, /effective_uses/);
  assert.match(sql, /effective_users/);
  assert.match(sql, /kms/);
  assert.match(sql, /jrebel/);
  assert.match(sql, /KMS 激活/);
  assert.match(sql, /JRebel 激活/);
});
