import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COHORTS,
  EFFECTIVE_TOOL_LABELS,
  FIXTURES,
  classifyCohort,
  countryAloneIsNotAutomation,
  entryClassLabel,
  eventBelongsToCohort,
  isEffectiveUse,
  isRedirectAliasPath,
  isSelftestEvent,
  isTemplateOnlyPath,
  isThinAutomatedCheck,
  matchesSuspectedAutomationFingerprint,
  normalizeRoutePath,
  parseEntryClass,
  resolveIdentityKey,
  resolveVisitKey,
} from "./umami-traffic-quality.mjs";

test("compound fingerprint matches CN and SG bots, not country-or-screen-alone humans", () => {
  assert.equal(classifyCohort({}, FIXTURES.botCn.session), "suspected_automation");
  assert.equal(classifyCohort({}, FIXTURES.botSg.session), "suspected_automation");
  assert.equal(classifyCohort({}, FIXTURES.humanSameScreenCn.session), "filtered_external");
  assert.equal(classifyCohort({}, FIXTURES.humanSameCountryOnly.session), "filtered_external");
  assert.equal(matchesSuspectedAutomationFingerprint({ country: "CN", screen: "1280x1200" }), false);
  assert.equal(countryAloneIsNotAutomation({ country: "SG" }), true);
});

test("selftest explicit tag beats fingerprint and is reversible semantics", () => {
  assert.equal(
    classifyCohort(FIXTURES.selftestOwner.event, FIXTURES.selftestOwner.session),
    "selftest",
  );
  assert.equal(isSelftestEvent({ 标记: "自测" }, {}), true);
  assert.equal(isSelftestEvent({}, { 自测: "是" }), true);
  assert.equal(isSelftestEvent({}, FIXTURES.botCn.session), false);
});

test("label coverage includes hash/QR and excludes sample/activation", () => {
  assert.equal(EFFECTIVE_TOOL_LABELS.includes("哈希生成器"), true);
  assert.equal(EFFECTIVE_TOOL_LABELS.includes("二维码生成器"), true);
  assert.equal(EFFECTIVE_TOOL_LABELS.includes("URL 编解码"), true);
  assert.equal(isEffectiveUse(FIXTURES.labelHash.tool, FIXTURES.labelHash.action), true);
  assert.equal(isEffectiveUse(FIXTURES.labelQr.tool, FIXTURES.labelQr.action), true);
  assert.equal(
    isEffectiveUse(FIXTURES.labelSampleExcluded.tool, FIXTURES.labelSampleExcluded.action),
    false,
  );
  assert.equal(
    isEffectiveUse(FIXTURES.labelUnknownExcluded.tool, FIXTURES.labelUnknownExcluded.action),
    false,
  );
  assert.equal(EFFECTIVE_TOOL_LABELS.length >= 13, true);
});

test("route normalization dedupes GH Pages prefix and legacy aliases without path uniques", () => {
  const { events } = FIXTURES.dedupeHosts;
  const paths = events.map((e) => normalizeRoutePath(e.hostname, e.url_path));
  assert.deepEqual(paths, ["/tools/json/", "/tools/json/", "/tools/json/"]);
  assert.equal(isRedirectAliasPath("/pages/tools/json.html"), true);
  assert.equal(isTemplateOnlyPath("/pages/template.html"), true);
  assert.equal(resolveVisitKey(events[0]), "v1");
  assert.equal(resolveIdentityKey({}, { distinct_id: "d1" }), "d1");
});

test("cohort filters preserve raw while separating automation and selftest", () => {
  assert.deepEqual(COHORTS, ["raw", "suspected_automation", "selftest", "filtered_external"]);
  assert.equal(eventBelongsToCohort("raw", {}, FIXTURES.botCn.session), true);
  assert.equal(eventBelongsToCohort("suspected_automation", {}, FIXTURES.botCn.session), true);
  assert.equal(eventBelongsToCohort("filtered_external", {}, FIXTURES.botCn.session), false);
  assert.equal(
    eventBelongsToCohort("selftest", FIXTURES.selftestOwner.event, FIXTURES.selftestOwner.session),
    true,
  );
});

test("thin near-zero multi-page automation checks are detectable without claiming identity", () => {
  assert.equal(
    isThinAutomatedCheck([
      { event_type: 1, event_name: null, normalized_path: "/pages/open-source-radar.html" },
    ]),
    true,
  );
  assert.equal(
    isThinAutomatedCheck([
      { event_type: 1, event_name: null, normalized_path: "/tools/json/" },
      {
        event_type: 2,
        event_name: "工具使用",
        工具: "JSON 格式化",
        操作: "格式化",
        normalized_path: "/tools/json/",
      },
    ]),
    false,
  );
});

test("entry class mapping stays low-cardinality and privacy-safe", () => {
  assert.equal(parseEntryClass("home"), "home");
  assert.equal(entryClassLabel("handbook"), "手册");
  assert.equal(entryClassLabel(""), "直达");
  assert.equal(entryClassLabel("weird-campaign-id"), "未知");
});

test("operations SQL encodes cohorts, compound fingerprint, visit_key, and expanded whitelist", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(sql, /cohort/);
  assert.match(sql, /suspected_automation/);
  assert.match(sql, /filtered_external/);
  assert.match(sql, /1280x1200/);
  assert.match(sql, /windows 10%/i);
  assert.match(sql, /en-us%/i);
  assert.doesNotMatch(sql, /country\s*=\s*'CN'/i);
  assert.match(sql, /visit_id/);
  assert.match(sql, /visit_key/);
  assert.match(sql, /哈希生成器/);
  assert.match(sql, /二维码生成器/);
  assert.match(sql, /URL 编解码/);
  assert.match(sql, /effective_action_whitelist/);
  assert.match(sql, /pages\/tools/);
  assert.doesNotMatch(sql, /^\s*(DELETE|UPDATE|TRUNCATE)\b/im);
  assert.doesNotMatch(sql, /\b(DELETE|UPDATE|TRUNCATE)\s+(FROM|website_event|session)\b/i);
  const whitelist = sql.match(/effective_tool_whitelist\s*\(tool\)\s+AS\s*\(\s*VALUES([\s\S]*?)\n\)/i)?.[1] ?? "";
  const tools = [...whitelist.matchAll(/\('([^']+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(tools, [...EFFECTIVE_TOOL_LABELS]);
});
