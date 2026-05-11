import test from "node:test";
import assert from "node:assert/strict";

import { collectStaticUrls, xmlEscape } from "./generate-sitemap.mjs";

test("xmlEscape escapes unsafe xml chars", () => {
  assert.equal(
    xmlEscape("a&b<c>d\"e'f"),
    "a&amp;b&lt;c&gt;d&quot;e&apos;f",
  );
});

test("collectStaticUrls excludes blog post template and keeps sorted entries", () => {
  const urls = collectStaticUrls(process.cwd()).map((item) => item.loc);
  assert.ok(!urls.some((loc) => loc.endsWith("/pages/blog/post.html")));

  const aiUrls = urls.filter((loc) => loc.includes("/pages/ai/"));
  const sortedAiUrls = [...aiUrls].sort();
  assert.deepEqual(aiUrls, sortedAiUrls);
});

test("collectStaticUrls includes static online tool pages", () => {
  const urls = collectStaticUrls(process.cwd()).map((item) => item.loc);
  assert.ok(urls.includes("https://tools.songyuankun.top/pages/tools/json.html"));
  assert.ok(urls.includes("https://tools.songyuankun.top/pages/tools/regex.html"));
});
