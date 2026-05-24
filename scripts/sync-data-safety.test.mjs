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
