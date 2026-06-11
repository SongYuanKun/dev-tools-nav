import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const PYTHON = process.env.PYTHON || "python3";

function tempDir() {
  return mkdtempSync(join(tmpdir(), "dev-tools-nav-sync-"));
}

function runPython(script, env) {
  return spawnSync(PYTHON, [script], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf-8",
  });
}

test("CSDN sync preserves existing articles when RSS XML is malformed", () => {
  const dir = tempDir();
  const outPath = join(dir, "csdn-articles.json");
  const rssPath = join(dir, "broken.xml");
  const existing = {
    updatedAt: "2026-01-01T00:00:00Z",
    source: "previous",
    items: [{ title: "keep", url: "https://example.com/post" }],
  };

  writeFileSync(outPath, JSON.stringify(existing, null, 2));
  writeFileSync(rssPath, "<rss><channel><item></channel></rss>");

  const result = runPython("scripts/sync-csdn-rss.py", {
    CSDN_ARTICLES_OUT_PATH: outPath,
    CSDN_RSS_URL: pathToFileURL(rssPath).href,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(outPath, "utf-8")), existing);
});

test("CSDN sync preserves existing articles when RSS has no usable items", () => {
  const dir = tempDir();
  const outPath = join(dir, "csdn-articles.json");
  const rssPath = join(dir, "empty.xml");
  const existing = {
    updatedAt: "2026-01-01T00:00:00Z",
    source: "previous",
    items: [{ title: "keep", url: "https://example.com/post" }],
  };

  writeFileSync(outPath, JSON.stringify(existing, null, 2));
  writeFileSync(rssPath, "<?xml version=\"1.0\"?><rss><channel></channel></rss>");

  const result = runPython("scripts/sync-csdn-rss.py", {
    CSDN_ARTICLES_OUT_PATH: outPath,
    CSDN_RSS_URL: pathToFileURL(rssPath).href,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(outPath, "utf-8")), existing);
});

test("CSDN sync keeps prior articles when RSS returns only a partial feed", () => {
  const dir = tempDir();
  const outPath = join(dir, "csdn-articles.json");
  const rssPath = join(dir, "partial.xml");

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        updatedAt: "2026-01-01T00:00:00Z",
        source: "previous",
        items: [
          { title: "old newest", url: "https://example.com/old-newest" },
          { title: "old second", url: "https://example.com/old-second" },
          { title: "old third", url: "https://example.com/old-third" },
        ],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    rssPath,
    `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>fresh article</title>
    <link>https://example.com/fresh</link>
    <description>fresh desc</description>
    <pubDate>Tue, 26 May 2026 08:00:00 GMT</pubDate>
  </item>
</channel></rss>`,
  );

  const result = runPython("scripts/sync-csdn-rss.py", {
    CSDN_ARTICLES_OUT_PATH: outPath,
    CSDN_RSS_URL: pathToFileURL(rssPath).href,
  });

  assert.equal(result.status, 0, result.stderr);

  const data = JSON.parse(readFileSync(outPath, "utf-8"));
  assert.deepEqual(
    data.items.map((item) => item.url),
    [
      "https://example.com/fresh",
      "https://example.com/old-newest",
      "https://example.com/old-second",
      "https://example.com/old-third",
    ],
  );
});

test("JRebel sync preserves existing server data when no URL is extracted", () => {
  const dir = tempDir();
  const outPath = join(dir, "servers.json");
  const sourcePath = join(dir, "jrebel.html");
  const existing = {
    jrebel: {
      url: "http://42.194.149.64:8088/previous",
      email: "old@example.com",
      updatedAt: "2026-01-01T00:00:00Z",
      source: "previous",
    },
  };

  writeFileSync(outPath, JSON.stringify(existing, null, 2));
  writeFileSync(sourcePath, "<html><body>temporarily unavailable</body></html>");

  const result = runPython("scripts/sync-jrebel-server.py", {
    JREBEL_SERVERS_OUT_PATH: outPath,
    JREBEL_SOURCE_FILE: sourcePath,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(outPath, "utf-8")), existing);
});

test("radar sync preserves existing data when trending HTML is empty", () => {
  const dir = tempDir();
  const outPath = join(dir, "open-source-radar.json");
  const sourcePath = join(dir, "trending.html");
  const existing = {
    updatedAt: "2026-01-01T00:00:00+08:00",
    weekLabel: "2025-12-25 ~ 2026-01-01",
    summary: "人工维护摘要",
    themes: [{ id: "all", label: "全部" }],
    projects: [
      {
        rank: 1,
        repo: "obra/superpowers",
        language: "Shell",
        stars: 100,
        weekStars: 0,
        trending: false,
        topic: "skills",
        summary: "保留中文解读",
        features: ["特性 A"],
        tags: ["Skill"],
      },
    ],
  };

  writeFileSync(outPath, JSON.stringify(existing, null, 2));
  writeFileSync(sourcePath, "<html><body>no articles</body></html>");

  const result = runPython("scripts/sync-open-source-radar.py", {
    RADAR_OUT_PATH: outPath,
    GITHUB_TRENDING_URL: pathToFileURL(sourcePath).href,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(outPath, "utf-8")), existing);
});

test("radar sync keeps curated Chinese copy and refreshes trending stats", () => {
  const dir = tempDir();
  const outPath = join(dir, "open-source-radar.json");
  const sourcePath = join(dir, "trending.html");
  const existing = {
    updatedAt: "2026-01-01T00:00:00+08:00",
    weekLabel: "old",
    summary: "旧摘要",
    themes: [{ id: "all", label: "全部" }],
    projects: [
      {
        rank: 1,
        repo: "mvanhorn/last30days-skill",
        language: "Python",
        stars: 1000,
        weekStars: 1,
        trending: true,
        topic: "research",
        summary: "人工中文摘要",
        features: ["人工特性 1", "人工特性 2", "人工特性 3"],
        tags: ["调研 Skill"],
      },
    ],
  };

  writeFileSync(outPath, JSON.stringify(existing, null, 2));
  writeFileSync(
    sourcePath,
    `<html><body>
      <article class="Box-row">
        <h2 class="h3 lh-condensed">
          <a href="/mvanhorn/last30days-skill" data-hydro-click="{&quot;event_type&quot;:&quot;explore.click&quot;}">repo</a>
        </h2>
        <p class="col-9 color-fg-muted">AI agent skill for research</p>
        <span>2,500 stars this week</span>
        <span itemprop="programmingLanguage">Python</span>
      </article>
    </body></html>`,
  );

  const result = runPython("scripts/sync-open-source-radar.py", {
    RADAR_OUT_PATH: outPath,
    GITHUB_TRENDING_URL: pathToFileURL(sourcePath).href,
    GITHUB_TOKEN: "",
  });

  assert.equal(result.status, 0, result.stderr);

  const data = JSON.parse(readFileSync(outPath, "utf-8"));
  assert.equal(data.projects[0].repo, "mvanhorn/last30days-skill");
  assert.equal(data.projects[0].summary, "人工中文摘要");
  assert.deepEqual(data.projects[0].features, ["人工特性 1", "人工特性 2", "人工特性 3"]);
  assert.equal(data.projects[0].weekStars, 2500);
  assert.equal(data.projects[0].trending, true);
  assert.match(data.updatedAt, /^2026-/);
});

test("JRebel sync updates URL and keeps previous email when source omits email", () => {
  const dir = tempDir();
  const outPath = join(dir, "servers.json");
  const sourcePath = join(dir, "jrebel.html");

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        jrebel: {
          url: "http://42.194.149.64:8088/previous",
          email: "old@example.com",
          updatedAt: "2026-01-01T00:00:00Z",
          source: "previous",
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(sourcePath, "<p>License server: http://42.194.149.64:8088/new-token</p>");

  const result = runPython("scripts/sync-jrebel-server.py", {
    JREBEL_SERVERS_OUT_PATH: outPath,
    JREBEL_SOURCE_FILE: sourcePath,
  });

  assert.equal(result.status, 0, result.stderr);

  const data = JSON.parse(readFileSync(outPath, "utf-8"));
  assert.equal(data.jrebel.url, "http://42.194.149.64:8088/new-token");
  assert.equal(data.jrebel.email, "old@example.com");
  assert.equal(data.jrebel.source, "https://www.jpy.wang/page/jrebel.html");
  assert.match(data.jrebel.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});
