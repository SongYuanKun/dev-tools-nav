import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dev-tools-nav-sync-"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runPython(script, env) {
  return spawnSync("python3", [path.join(ROOT, "scripts", script)], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("JRebel sync preserves existing server when source has no valid URL", () => {
  const dir = tempDir();
  const sourcePath = path.join(dir, "jrebel.html");
  const outPath = path.join(dir, "servers.json");
  const existing = {
    jrebel: {
      url: "http://10.0.0.1:8080/existing-token",
      email: "old@example.com",
      updatedAt: "2026-01-01T00:00:00Z",
      source: "https://example.com/old",
    },
  };

  fs.writeFileSync(sourcePath, "<html>temporarily unavailable</html>", "utf8");
  writeJson(outPath, existing);

  const result = runPython("sync-jrebel-server.py", {
    JREBEL_SOURCE_URL: pathToFileURL(sourcePath).href,
    JREBEL_OUT_PATH: outPath,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(outPath, "utf8")), existing);
});

test("JRebel sync writes parsed URL and preserves existing email when missing", () => {
  const dir = tempDir();
  const sourcePath = path.join(dir, "jrebel.html");
  const outPath = path.join(dir, "servers.json");

  fs.writeFileSync(sourcePath, "License Server: http://10.0.0.2:8080/new-token", "utf8");
  writeJson(outPath, { jrebel: { email: "old@example.com" } });

  const result = runPython("sync-jrebel-server.py", {
    JREBEL_SOURCE_URL: pathToFileURL(sourcePath).href,
    JREBEL_OUT_PATH: outPath,
  });

  assert.equal(result.status, 0, result.stderr);
  const updated = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(updated.jrebel.url, "http://10.0.0.2:8080/new-token");
  assert.equal(updated.jrebel.email, "old@example.com");
  assert.equal(updated.jrebel.source, pathToFileURL(sourcePath).href);
});

test("CSDN RSS sync preserves existing articles on malformed XML", () => {
  const dir = tempDir();
  const sourcePath = path.join(dir, "rss.xml");
  const outPath = path.join(dir, "csdn-articles.json");
  const existing = {
    updatedAt: "2026-01-01T00:00:00Z",
    source: "https://example.com/rss",
    items: [{ title: "Keep me", url: "https://example.com/post", tags: [] }],
  };

  fs.writeFileSync(sourcePath, "<rss><channel><item></rss>", "utf8");
  writeJson(outPath, existing);

  const result = runPython("sync-csdn-rss.py", {
    CSDN_RSS_URL: pathToFileURL(sourcePath).href,
    CSDN_OUT_PATH: outPath,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(outPath, "utf8")), existing);
});

test("CSDN RSS sync preserves existing articles when feed has no usable items", () => {
  const dir = tempDir();
  const sourcePath = path.join(dir, "rss.xml");
  const outPath = path.join(dir, "csdn-articles.json");
  const existing = {
    updatedAt: "2026-01-01T00:00:00Z",
    source: "https://example.com/rss",
    items: [{ title: "Keep me", url: "https://example.com/post", tags: [] }],
  };

  fs.writeFileSync(sourcePath, "<rss><channel><title>Empty</title></channel></rss>", "utf8");
  writeJson(outPath, existing);

  const result = runPython("sync-csdn-rss.py", {
    CSDN_RSS_URL: pathToFileURL(sourcePath).href,
    CSDN_OUT_PATH: outPath,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(outPath, "utf8")), existing);
});
