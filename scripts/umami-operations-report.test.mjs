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
  assert.match(
    sql,
    /COUNT\(DISTINCT\s+COALESCE\(\s*s\.distinct_id,\s*e\.session_id::text\s*\)\)/si,
  );
});

test("operations SQL normalizes the exact GitHub Pages prefix to root", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(
    sql,
    /COALESCE\(\s*NULLIF\(\s*regexp_replace\([^)]*'\^\/dev-tools-nav\(\?=\/\|\$\)'[^)]*\),\s*''\s*\),\s*'\/'\s*\)/si,
  );
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

test("operations SQL preserves effective-use keys without pageviews", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(sql, /unified_keys\s+AS/si);
  assert.match(
    sql,
    /SELECT\s+period,\s*hostname,\s*normalized_path\s+FROM\s+pageviews\s+UNION\s+SELECT\s+period,\s*hostname,\s*normalized_path\s+FROM\s+effective_use/si,
  );
  assert.match(sql, /FROM\s+unified_keys\s+keys/si);
  assert.match(sql, /LEFT\s+JOIN\s+pageviews/si);
  assert.match(sql, /LEFT\s+JOIN\s+effective_use/si);
});
