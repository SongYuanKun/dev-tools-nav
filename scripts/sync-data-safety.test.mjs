import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const csdnScript = join(repoRoot, "scripts", "sync-csdn-rss.py");
const jrebelScript = join(repoRoot, "scripts", "sync-jrebel-server.py");

function tempDir() {
  return mkdtempSync(join(tmpdir(), "dev-tools-nav-"));
}

function runPython(args, env = {}) {
  return spawnSync("python3", args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("CSDN sync keeps existing JSON when RSS is malformed", () => {
  const dir = tempDir();
  const outPath = join(dir, "csdn-articles.json");
  const rssPath = join(dir, "broken.xml");
  const original = JSON.stringify({ updatedAt: "old", items: [{ title: "keep" }] }, null, 2) + "\n";

  writeFileSync(outPath, original);
  writeFileSync(rssPath, "<rss><channel>");

  const result = runPython([csdnScript], {
    CSDN_ARTICLES_OUT_PATH: outPath,
    CSDN_RSS_URL: pathToFileURL(rssPath).href,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(outPath, "utf8"), original);
});

test("CSDN sync keeps existing JSON when RSS has no usable items", () => {
  const dir = tempDir();
  const outPath = join(dir, "csdn-articles.json");
  const rssPath = join(dir, "empty.xml");
  const original = JSON.stringify({ updatedAt: "old", items: [{ title: "keep" }] }, null, 2) + "\n";

  writeFileSync(outPath, original);
  writeFileSync(rssPath, "<rss><channel></channel></rss>");

  const result = runPython([csdnScript], {
    CSDN_ARTICLES_OUT_PATH: outPath,
    CSDN_RSS_URL: pathToFileURL(rssPath).href,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(outPath, "utf8"), original);
});

test("CSDN sync fails instead of creating empty JSON when no data exists", () => {
  const dir = tempDir();
  const outPath = join(dir, "missing-csdn-articles.json");
  const rssPath = join(dir, "empty.xml");

  writeFileSync(rssPath, "<rss><channel></channel></rss>");

  const result = runPython([csdnScript], {
    CSDN_ARTICLES_OUT_PATH: outPath,
    CSDN_RSS_URL: pathToFileURL(rssPath).href,
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.equal(existsSync(outPath), false);
});

test("JRebel sync keeps existing JSON when fetched page has no server URL", () => {
  const dir = tempDir();
  const outPath = join(dir, "servers.json");
  const htmlPath = join(dir, "jrebel.html");
  const original = JSON.stringify({
    jrebel: {
      url: "http://42.194.149.64:8088/8ca8f59d-88c1-49d2-ab6e-1439d02ff5e6",
      email: "752285732@qq.com",
      updatedAt: "old",
      source: "https://www.jpy.wang/page/jrebel.html",
    },
  }, null, 2) + "\n";

  writeFileSync(outPath, original);
  writeFileSync(htmlPath, "<html><body>temporarily unavailable</body></html>");

  const result = runPython([jrebelScript, htmlPath], {
    JREBEL_SERVERS_OUT_PATH: outPath,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(outPath, "utf8"), original);
});

test("JRebel sync updates JSON when fetched page has a valid server URL", () => {
  const dir = tempDir();
  const outPath = join(dir, "servers.json");
  const htmlPath = join(dir, "jrebel.html");

  writeFileSync(outPath, "{}\n");
  writeFileSync(
    htmlPath,
    "<p>http://127.0.0.1:8080/license-token</p><p>user@example.com</p>",
  );

  const result = runPython([jrebelScript, htmlPath], {
    JREBEL_SERVERS_OUT_PATH: outPath,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const data = JSON.parse(readFileSync(outPath, "utf8"));
  assert.equal(data.jrebel.url, "http://127.0.0.1:8080/license-token");
  assert.equal(data.jrebel.email, "user@example.com");
});
