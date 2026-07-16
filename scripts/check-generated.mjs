#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(MODULE_DIR, "..");

export const GENERATED_PATHS = [
  "js/json-workbench.bundle.js",
  "pages/blog",
  "data/blog-posts.js",
  "data/blog-manifest.json",
  "feed.xml",
  "sitemap.xml",
];

export const REQUIRED_GENERATED_FILES = [
  "pages/blog/index.html",
  "data/blog-posts.js",
  "data/blog-manifest.json",
  "feed.xml",
  "sitemap.xml",
];

export function findMissingGeneratedFiles(root = DEFAULT_ROOT, files = REQUIRED_GENERATED_FILES) {
  return files.filter((path) => !existsSync(join(root, path))).sort();
}

function gitLines(root, args, paths) {
  const output = execFileSync("git", [...args, "--", ...paths], {
    cwd: root,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
}

export function findGeneratedDrift(root = DEFAULT_ROOT, paths = GENERATED_PATHS) {
  return {
    modified: gitLines(root, ["diff", "--name-only", "-z", "HEAD"], paths),
    untracked: gitLines(root, ["ls-files", "--others", "--exclude-standard", "-z"], paths),
  };
}

function reportDrift({ modified, untracked }, missing = []) {
  if (modified.length === 0 && untracked.length === 0 && missing.length === 0) {
    console.log("Generated artifacts match the committed sources.");
    return 0;
  }
  if (modified.length > 0) {
    console.error(`Modified generated artifacts:\n${modified.map((path) => `  ${path}`).join("\n")}`);
  }
  if (untracked.length > 0) {
    console.error(`Untracked generated artifacts:\n${untracked.map((path) => `  ${path}`).join("\n")}`);
  }
  if (missing.length > 0) {
    console.error(`Missing generated artifacts:\n${missing.map((path) => `  ${path}`).join("\n")}`);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = reportDrift(findGeneratedDrift(), findMissingGeneratedFiles());
}
