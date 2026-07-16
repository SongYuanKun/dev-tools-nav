import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  collectStaticUrls,
  generateSitemap,
  resolveGitLastmod,
  xmlEscape,
} from "./generate-sitemap.mjs";

test("xmlEscape escapes unsafe xml chars", () => {
  assert.equal(
    xmlEscape("a&b<c>d\"e'f"),
    "a&amp;b&lt;c&gt;d&quot;e&apos;f",
  );
});

test("collectStaticUrls excludes templates and returns sorted unique locations", () => {
  const urls = collectStaticUrls(process.cwd(), { resolveLastmod: () => undefined });
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

test("collectStaticUrls keeps template URLs at monthly priority 0.5", () => {
  const templates = collectStaticUrls(process.cwd())
    .filter(({ loc }) => loc.includes("/pages/template.html?id="));

  assert.ok(templates.length > 0);
  for (const template of templates) {
    assert.equal(template.changefreq, "monthly", template.loc);
    assert.equal(template.priority, 0.5, template.loc);
  }
});

test("collectStaticUrls resolves lastmod from each URL's content source", () => {
  const resolved = new Map();
  const urls = collectStaticUrls(process.cwd(), {
    resolveLastmod(sourcePath) {
      resolved.set(sourcePath, "2025-01-02");
      return "2025-01-02";
    },
  });

  assert.equal(urls.find((url) => url.loc.endsWith("/"))?.lastmod, "2025-01-02");
  assert.ok(resolved.has("index.html"));
  assert.ok(resolved.has("tools/json/index.html"));
  assert.ok(resolved.has("pages/ai/index.html"));
  assert.ok(resolved.has("data/tools.js"));
});

test("generateSitemap omits missing and invalid lastmod values", () => {
  const missing = generateSitemap(process.cwd(), { resolveLastmod: () => undefined });
  const invalid = generateSitemap(process.cwd(), { resolveLastmod: () => "today" });

  assert.doesNotMatch(missing, /<lastmod>/);
  assert.doesNotMatch(invalid, /<lastmod>/);
  assert.match(missing, /<loc>https:\/\/tools\.songyuankun\.top\/<\/loc>/);
});

test("resolveGitLastmod returns the content source commit date", () => {
  const root = mkdtempSync(join(tmpdir(), "sitemap-git-"));
  try {
    writeFileSync(join(root, "index.html"), "<h1>fixture</h1>");
    execFileSync("git", ["init", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Sitemap Test"], { cwd: root });
    execFileSync("git", ["config", "user.email", "sitemap@example.test"], { cwd: root });
    execFileSync("git", ["add", "index.html"], { cwd: root });
    execFileSync("git", ["commit", "-m", "fixture"], {
      cwd: root,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2024-03-04T12:00:00Z",
        GIT_COMMITTER_DATE: "2024-03-04T12:00:00Z",
      },
    });

    assert.equal(resolveGitLastmod(root, "index.html"), "2024-03-04");
    assert.equal(resolveGitLastmod(root, "missing.html"), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generateSitemap XML-escapes query URLs", () => {
  const xml = generateSitemap(process.cwd(), { resolveLastmod: () => undefined });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>$/);
  assert.match(xml, /template\.html\?id=/);
  assert.doesNotMatch(xml, /<loc>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)[^<]*<\/loc>/);
});

test("generateSitemap is deterministic for the same Git commit", () => {
  const first = generateSitemap(process.cwd());
  const second = generateSitemap(process.cwd());
  assert.equal(second, first);
});

test("both deployment workflows generate sitemap before publishing", () => {
  const pages = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
  const onePanel = readFileSync(".github/workflows/deploy-1panel-ssh.yml", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const command = "npm run build";

  assert.match(packageJson.scripts.build, /npm run generate-sitemap/);
  assert.ok(pages.includes(command));
  assert.ok(onePanel.includes(command));
  assert.ok(pages.indexOf(command) < pages.indexOf("Assemble site"));
  assert.ok(onePanel.indexOf(command) < onePanel.indexOf("Sync site to temp dir"));
});

test("module can be imported when argv has no script path", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", 'import("./scripts/generate-sitemap.mjs")'],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
});
