import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { collectStaticUrls, generateSitemap, xmlEscape } from "./generate-sitemap.mjs";

test("xmlEscape escapes unsafe xml chars", () => {
  assert.equal(
    xmlEscape("a&b<c>d\"e'f"),
    "a&amp;b&lt;c&gt;d&quot;e&apos;f",
  );
});

test("collectStaticUrls excludes templates and returns sorted unique locations", () => {
  const urls = collectStaticUrls(process.cwd(), new Date("2026-07-13T00:00:00Z"));
  const locations = urls.map((item) => item.loc);

  assert.ok(!locations.some((loc) => loc.endsWith("/pages/blog/post.html")));
  assert.ok(!locations.some((loc) => loc.endsWith("/pages/template.html")));
  assert.equal(new Set(locations).size, locations.length);
  assert.deepEqual(locations, [...locations].sort());
});

test("collectStaticUrls includes all ten canonical self-built tools", () => {
  const locations = collectStaticUrls(process.cwd()).map((item) => item.loc);
  const expected = [
    "base64", "color", "cron", "diff", "json",
    "jwt", "regex", "sql-formatter", "timestamp", "uuid",
  ].map((slug) => `https://tools.songyuankun.top/tools/${slug}/`);

  for (const location of expected) assert.ok(locations.includes(location), location);
});

test("collectStaticUrls creates template URLs only for catalog tools", () => {
  const locations = collectStaticUrls(process.cwd()).map((item) => item.loc);
  const leakedCategoryIds = [
    "activate", "ai", "all", "design", "dev",
    "hosting", "online-tools", "ops", "security",
  ];

  for (const id of leakedCategoryIds) {
    assert.ok(
      !locations.includes(`https://tools.songyuankun.top/pages/template.html?id=${id}`),
      `category ID leaked into sitemap: ${id}`,
    );
  }
});

test("generateSitemap XML-escapes query URLs", () => {
  const xml = generateSitemap(process.cwd(), new Date("2026-07-13T00:00:00Z"));
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>$/);
  assert.match(xml, /template\.html\?id=/);
  assert.doesNotMatch(xml, /<loc>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)[^<]*<\/loc>/);
});

test("module can be imported when argv has no script path", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", 'import("./scripts/generate-sitemap.mjs")'],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
});
