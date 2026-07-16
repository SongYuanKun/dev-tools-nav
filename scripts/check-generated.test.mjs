import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { findGeneratedDrift, findMissingGeneratedFiles } from "./check-generated.mjs";

function git(root, ...args) {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}

function makeRepository() {
  const root = mkdtempSync(join(tmpdir(), "generated-drift-"));
  mkdirSync(join(root, "js"));
  writeFileSync(join(root, "js", "json-workbench.bundle.js"), "tracked\n");
  git(root, "init");
  git(root, "config", "user.name", "Generated Test");
  git(root, "config", "user.email", "generated@example.test");
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture");
  return root;
}

test("generated drift reports tracked modifications", () => {
  const root = makeRepository();
  try {
    writeFileSync(join(root, "js", "json-workbench.bundle.js"), "changed\n");
    assert.deepEqual(
      findGeneratedDrift(root, ["js/json-workbench.bundle.js"]),
      { modified: ["js/json-workbench.bundle.js"], untracked: [] },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generated drift reports untracked target files", () => {
  const root = makeRepository();
  try {
    writeFileSync(join(root, "feed.xml"), "untracked\n");
    assert.deepEqual(
      findGeneratedDrift(root, ["js/json-workbench.bundle.js", "feed.xml"]),
      { modified: [], untracked: ["feed.xml"] },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generated gate reports required artifacts that do not exist", () => {
  const root = makeRepository();
  try {
    writeFileSync(join(root, "feed.xml"), "feed\n");
    assert.deepEqual(
      findMissingGeneratedFiles(root, ["feed.xml", "data/blog-manifest.json"]),
      ["data/blog-manifest.json"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
