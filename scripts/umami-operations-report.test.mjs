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
    /COUNT\(DISTINCT\s+e\.identity_key\)\s+AS\s+visitors/si,
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
  assert.match(sql, /effective_tool_whitelist\s*\(tool\)\s+AS/si);
  const whitelist = sql.match(/effective_tool_whitelist\s*\(tool\)\s+AS\s*\(\s*VALUES([\s\S]*?)\n\)/i)?.[1] ?? "";
  const persistedTools = [...whitelist.matchAll(/\('([^']+)'\)/g)].map((match) => match[1]);
  assert.deepEqual(
    persistedTools,
    [
      "JSON 格式化", "时间戳转换", "Base64", "正则表达式", "Cron 表达式",
      "JWT 解码", "SQL 格式化", "diff", "uuid",
    ],
  );
  for (const excluded of [undefined, "", "未知工具", "KMS 激活", "JRebel 激活"]) {
    assert.equal(persistedTools.includes(excluded), false, String(excluded));
  }
  assert.doesNotMatch(whitelist, /color|颜色|kms|jrebel|激活/i);
  assert.doesNotMatch(sql, /NOT\s+IN/si);
  assert.doesNotMatch(sql, /COALESCE\(\s*d\.string_value/si);
  assert.match(
    sql,
    /EXISTS\s*\([\s\S]*?event_data[\s\S]*?data_key\s*=\s*'工具'[\s\S]*?effective_tool_whitelist/si,
  );
});

test("effective users use distinct visitor identity with session fallback", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(
    sql,
    /COALESCE\(\s*s\.distinct_id,\s*e\.session_id::text\s*\)\s+AS\s+identity_key/si,
  );
  assert.match(sql, /COUNT\(DISTINCT\s+e\.identity_key\)\s+AS\s+effective_users/si);
  assert.doesNotMatch(
    sql,
    /COUNT\(DISTINCT\s+e\.session_id\)\s+(?:FILTER\s*\([\s\S]*?\)\s*)?AS\s+effective_users/si,
  );
});

test("report emits detail and raw-recomputed hostname and all-host summaries", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(sql, /report_level/gi);
  assert.match(sql, /'detail'/);
  assert.match(sql, /'hostname_summary'/);
  assert.match(sql, /'all_hosts_summary'/);
  assert.match(
    sql,
    /FROM\s+pageview_events\s+e[\s\S]*?CROSS\s+JOIN\s+LATERAL\s*\(\s*VALUES[\s\S]*?'detail'[\s\S]*?'hostname_summary'[\s\S]*?'all_hosts_summary'/si,
  );
  assert.match(
    sql,
    /FROM\s+valid_effective_events\s+e[\s\S]*?CROSS\s+JOIN\s+LATERAL\s*\(\s*VALUES[\s\S]*?'detail'[\s\S]*?'hostname_summary'[\s\S]*?'all_hosts_summary'/si,
  );
  assert.match(sql, /normalized_path\s+IS\s+NOT\s+DISTINCT\s+FROM/si);
});

test("analytics docs use summary effective users and disclose cross-host identity limits", () => {
  const insights = readFileSync("docs/analytics-insights.md", "utf-8");
  const spec = readFileSync("docs/umami-integration-spec.md", "utf-8");
  const roadmap = readFileSync("docs/roadmap.md", "utf-8");

  assert.match(insights, /hostname_summary/);
  assert.match(insights, /all_hosts_summary/);
  assert.match(insights, /跨 hostname[^\n]*浏览器存储隔离/);
  assert.match(spec, /fail-closed/);
  assert.match(spec, /缺失[^\n]*未知[^\n]*激活[^\n]*0/);
  assert.match(roadmap, /商业阈值[^\n]*汇总[^\n]*独立有效工具用户/);
});

test("operations SQL preserves effective-use keys without pageviews", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(sql, /unified_keys\s+AS/si);
  assert.match(
    sql,
    /SELECT\s+report_level,\s*period,\s*hostname,\s*normalized_path\s+FROM\s+pageviews\s+UNION\s+SELECT\s+report_level,\s*period,\s*hostname,\s*normalized_path\s+FROM\s+effective_use/si,
  );
  assert.match(sql, /FROM\s+unified_keys\s+keys/si);
  assert.match(sql, /LEFT\s+JOIN\s+pageviews/si);
  assert.match(sql, /LEFT\s+JOIN\s+effective_use/si);
});
