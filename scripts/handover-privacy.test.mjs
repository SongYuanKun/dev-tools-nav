import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const privatePaths = [
  "docs/example-jetbrains-renewal/PROGRESS-TRACKER.md",
  "docs/example-jetbrains-renewal/emails/request.eml",
  "docs/example-jetbrains-renewal/submission-pack/application.txt",
  "docs/example-jetbrains-renewal/audit/report.log",
];

const publicTemplates = [
  "docs/example-jetbrains-renewal/README.md",
  "docs/example-jetbrains-renewal/SUBMISSION-CHECKLIST.md",
  "docs/example-jetbrains-renewal/APPLICATION-OPERATIONS-GUIDE.md",
  "docs/example-jetbrains-renewal/ARCHIVE-INDEX.md",
];

function isIgnored(path) {
  return spawnSync("git", ["check-ignore", "--no-index", "-q", path], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).status === 0;
}

test("JetBrains application secrets stay ignored across dated directories", () => {
  for (const path of privatePaths) {
    assert.equal(isIgnored(path), true, `${path} must be ignored`);
  }
});

test("JetBrains public operating templates remain eligible for version control", () => {
  for (const path of publicTemplates) {
    assert.equal(isIgnored(path), false, `${path} must remain public`);
  }
});

test("Git never tracks files inside protected JetBrains application paths", () => {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);

  const trackedPrivatePaths = result.stdout
    .split("\0")
    .filter(Boolean)
    .filter((path) => /docs\/[^/]*jetbrains[^/]*\/(?:PROGRESS-TRACKER\.md|emails\/|submission-pack\/|audit\/)/i.test(path));

  assert.deepEqual(trackedPrivatePaths, []);
});

// 公开仓库的文档与运维文件不得记录主机 home 路径或真实 IP（回环地址除外）
test("public docs and ops files never record host home paths or IP addresses", () => {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);

  const textFiles = result.stdout
    .split("\0")
    .filter((path) => /\.(?:md|sh|ya?ml|service|timer)$/i.test(path));
  const homePath = /\/home\/[a-z_][\w-]*\//i;
  const ipv4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
  const leaks = [];
  for (const path of textFiles) {
    const lines = readFileSync(path, "utf8").split("\n");
    lines.forEach((line, index) => {
      const ips = (line.match(ipv4) || []).filter((ip) => !ip.startsWith("127.") && ip !== "0.0.0.0");
      if (homePath.test(line) || ips.length) leaks.push(`${path}:${index + 1}`);
    });
  }

  assert.deepEqual(leaks, []);
});
