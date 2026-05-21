import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

function withTempDir(prefix, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function runPython(scriptPath, env) {
  const result = spawnSync("python3", [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

test("CSDN sync keeps existing JSON when RSS is malformed", () => {
  withTempDir("csdn-sync-", (dir) => {
    const outPath = path.join(dir, "csdn-articles.json");
    const sourcePath = path.join(dir, "bad-rss.xml");
    const existing = {
      updatedAt: "2026-01-01T00:00:00Z",
      source: "existing",
      items: [{ title: "Existing", url: "https://example.com/post" }],
    };

    writeJson(outPath, existing);
    writeFileSync(sourcePath, "<html>captcha</html><broken>", "utf8");

    runPython("scripts/sync-csdn-rss.py", {
      CSDN_ARTICLES_OUT_PATH: outPath,
      CSDN_RSS_URL: pathToFileURL(sourcePath).href,
    });

    assert.deepEqual(readJson(outPath), existing);
  });
});

test("CSDN sync keeps existing JSON when RSS has no usable items", () => {
  withTempDir("csdn-sync-", (dir) => {
    const outPath = path.join(dir, "csdn-articles.json");
    const sourcePath = path.join(dir, "empty-rss.xml");
    const existing = {
      updatedAt: "2026-01-01T00:00:00Z",
      source: "existing",
      items: [{ title: "Existing", url: "https://example.com/post" }],
    };

    writeJson(outPath, existing);
    writeFileSync(sourcePath, "<rss><channel><title>Blog</title></channel></rss>", "utf8");

    runPython("scripts/sync-csdn-rss.py", {
      CSDN_ARTICLES_OUT_PATH: outPath,
      CSDN_RSS_URL: pathToFileURL(sourcePath).href,
    });

    assert.deepEqual(readJson(outPath), existing);
  });
});

test("JRebel sync keeps existing server when no URL can be extracted", () => {
  withTempDir("jrebel-sync-", (dir) => {
    const outPath = path.join(dir, "servers.json");
    const sourcePath = path.join(dir, "jrebel.html");
    const existing = {
      jrebel: {
        url: "http://42.194.149.64:8088/ed77b7ec-dbdb-48d8-8d58-5288465a7a3d",
        email: "existing@example.com",
        updatedAt: "2026-01-01T00:00:00Z",
        source: "existing",
      },
    };

    writeJson(outPath, existing);
    writeFileSync(sourcePath, "<html>temporarily unavailable</html>", "utf8");

    runPython("scripts/sync-jrebel-server.py", {
      JREBEL_SERVERS_OUT_PATH: outPath,
      JREBEL_SOURCE_FILE: sourcePath,
    });

    assert.deepEqual(readJson(outPath), existing);
  });
});

test("JRebel sync writes a newly extracted server URL", () => {
  withTempDir("jrebel-sync-", (dir) => {
    const outPath = path.join(dir, "servers.json");
    const sourcePath = path.join(dir, "jrebel.html");

    writeJson(outPath, { other: true });
    writeFileSync(
      sourcePath,
      "server: http://1.2.3.4:8888/abc-def email: user@example.com",
      "utf8",
    );

    runPython("scripts/sync-jrebel-server.py", {
      JREBEL_SERVERS_OUT_PATH: outPath,
      JREBEL_SOURCE_FILE: sourcePath,
      JREBEL_SOURCE_URL: "https://example.com/jrebel.html",
    });

    const updated = readJson(outPath);
    assert.equal(updated.jrebel.url, "http://1.2.3.4:8888/abc-def");
    assert.equal(updated.jrebel.email, "user@example.com");
    assert.equal(updated.jrebel.source, "https://example.com/jrebel.html");
    assert.equal(updated.other, true);
    assert.match(updated.jrebel.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  });
});
