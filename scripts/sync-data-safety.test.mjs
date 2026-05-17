import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();

function tmpFile(name) {
  return join(mkdtempSync(join(tmpdir(), "dev-tools-nav-")), name);
}

function runPython(args, env = {}) {
  return spawnSync("python3", args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

test("JRebel sync preserves existing server when source has no valid URL", () => {
  const serversPath = tmpFile("servers.json");
  const sourcePath = tmpFile("jrebel.html");
  const existing = {
    jrebel: {
      url: "http://1.2.3.4:8088/existing-token",
      email: "old@example.com",
      updatedAt: "2026-05-17T00:00:00Z",
      source: "https://www.jpy.wang/page/jrebel.html",
    },
  };
  writeFileSync(serversPath, `${JSON.stringify(existing, null, 2)}\n`);
  writeFileSync(sourcePath, "<html><body>temporarily unavailable</body></html>");

  const result = runPython(["scripts/sync-jrebel-server.py", sourcePath], {
    JREBEL_SERVERS_PATH: serversPath,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Keep existing servers\.json/);
  assert.deepEqual(readJson(serversPath), existing);
});

test("JRebel sync writes a valid server from the source page", () => {
  const serversPath = tmpFile("servers.json");
  const sourcePath = tmpFile("jrebel.html");
  writeFileSync(serversPath, "{}\n");
  writeFileSync(
    sourcePath,
    "server: https://license.example.com:8888/new-token\nemail: fresh@example.com",
  );

  const result = runPython(["scripts/sync-jrebel-server.py", sourcePath], {
    JREBEL_SERVERS_PATH: serversPath,
  });

  assert.equal(result.status, 0, result.stderr);
  const data = readJson(serversPath);
  assert.equal(data.jrebel.url, "https://license.example.com:8888/new-token");
  assert.equal(data.jrebel.email, "fresh@example.com");
  assert.equal(data.jrebel.source, "https://www.jpy.wang/page/jrebel.html");
  assert.match(data.jrebel.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});

function runCsdnWithPayload(articlesPath, payloadExpression) {
  const code = `
import importlib.util
spec = importlib.util.spec_from_file_location("sync_csdn_rss", "scripts/sync-csdn-rss.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
mod.fetch_rss = lambda url: ${payloadExpression}
raise SystemExit(mod.main())
`;
  return runPython(["-c", code], {
    CSDN_ARTICLES_PATH: articlesPath,
    CSDN_RSS_URL: "https://example.test/rss",
  });
}

test("CSDN sync preserves existing articles when RSS is malformed", () => {
  const articlesPath = tmpFile("csdn-articles.json");
  const existing = {
    updatedAt: "2026-05-17T00:00:00Z",
    source: "https://example.test/rss",
    items: [{ title: "keep me", url: "https://example.test/a" }],
  };
  writeFileSync(articlesPath, `${JSON.stringify(existing, null, 2)}\n`);

  const result = runCsdnWithPayload(articlesPath, 'b"<html>not rss"');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Keep existing csdn-articles\.json/);
  assert.deepEqual(readJson(articlesPath), existing);
});

test("CSDN sync preserves existing articles when RSS has no usable items", () => {
  const articlesPath = tmpFile("csdn-articles.json");
  const existing = {
    updatedAt: "2026-05-17T00:00:00Z",
    source: "https://example.test/rss",
    items: [{ title: "keep me", url: "https://example.test/a" }],
  };
  writeFileSync(articlesPath, `${JSON.stringify(existing, null, 2)}\n`);

  const result = runCsdnWithPayload(articlesPath, 'b"<rss><channel></channel></rss>"');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Keep existing csdn-articles\.json/);
  assert.deepEqual(readJson(articlesPath), existing);
});
