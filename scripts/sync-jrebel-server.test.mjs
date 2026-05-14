import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "sync-jrebel-server.py");

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-jrebel-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runSync(htmlPath, dataPath) {
  return execFileSync("python3", [SCRIPT_PATH, htmlPath, "--data-path", dataPath], {
    encoding: "utf8",
  });
}

test("sync-jrebel-server writes extracted license server metadata", () => {
  withTempDir((dir) => {
    const htmlPath = path.join(dir, "jrebel.html");
    const dataPath = path.join(dir, "servers.json");
    fs.writeFileSync(
      htmlPath,
      'License server: https://license.example.com:8088/f1c7e79d-6bfb-454c-b060-b82b88ddb4b3 user@example.com',
      "utf8",
    );

    const output = runSync(htmlPath, dataPath);
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    assert.match(output, /Updated servers\.json/);
    assert.equal(data.jrebel.url, "https://license.example.com:8088/f1c7e79d-6bfb-454c-b060-b82b88ddb4b3");
    assert.equal(data.jrebel.email, "user@example.com");
    assert.equal(data.jrebel.source, "https://www.jpy.wang/page/jrebel.html");
    assert.match(data.jrebel.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

test("sync-jrebel-server keeps existing data when extraction fails", () => {
  withTempDir((dir) => {
    const htmlPath = path.join(dir, "jrebel.html");
    const dataPath = path.join(dir, "servers.json");
    const existing = {
      jrebel: {
        url: "http://42.194.149.64:8088/existing-token",
        email: "old@example.com",
        updatedAt: "2026-05-01T00:00:00Z",
        source: "previous",
      },
    };
    fs.writeFileSync(htmlPath, "<html>No usable license server today</html>", "utf8");
    fs.writeFileSync(dataPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");

    const before = fs.readFileSync(dataPath, "utf8");
    const output = runSync(htmlPath, dataPath);
    const after = fs.readFileSync(dataPath, "utf8");

    assert.match(output, /Kept existing servers\.json/);
    assert.equal(after, before);
  });
});
