import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

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
