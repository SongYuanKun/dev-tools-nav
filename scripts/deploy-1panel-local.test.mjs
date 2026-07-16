import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "index.html",
  "sitemap.xml",
  "feed.xml",
  "favicon.svg",
  "tools/json/index.html",
  "pages/blog/java-source-mybatis.html",
];
const verificationFiles = [
  "baidu_verify_codeva-TByQYpVHM2.html",
  "googleb710668c9aa28d4e.html",
];

function write(root, relative, content = relative) {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "deploy-1panel-"));
  const repo = join(root, "repo");
  const site = join(root, "site");
  const bin = join(root, "bin");
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(site, "index"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  for (const file of requiredFiles) write(repo, file, `new:${file}`);
  write(repo, "content/blog/private.md", "must not deploy");
  write(repo, "docs/private.md", "must not deploy");
  write(repo, "node_modules/pkg/index.js", "must not deploy");
  write(join(site, "index"), "marker.txt", "old release");
  for (const file of verificationFiles) write(join(site, "index"), file, `verify:${file}`);
  cpSync("scripts/deploy-1panel-local.sh", join(repo, "scripts/deploy-1panel-local.sh"));
  chmodSync(join(repo, "scripts/deploy-1panel-local.sh"), 0o755);
  const fakeDocker = join(bin, "docker");
  writeFileSync(fakeDocker, `#!/usr/bin/env bash
set -euo pipefail
command="$1"
shift
case "$command" in
  exec)
    container="$1"; shift
    "$@"
    ;;
  cp)
    source="$1"
    destination="\${2#*:}"
    mkdir -p "$destination"
    cp -a "\${source%/.}/." "$destination/"
    if [[ "\${FAKE_DOCKER_DROP_FEED:-0}" == "1" ]]; then rm -f "$destination/feed.xml"; fi
    ;;
  *)
    echo "unexpected docker command: $command" >&2
    exit 64
    ;;
esac
`);
  chmodSync(fakeDocker, 0o755);
  return { root, repo, site, fakeDocker };
}

function deploy({ repo, site, fakeDocker }, extraEnv = {}) {
  return spawnSync("bash", ["scripts/deploy-1panel-local.sh"], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      DOCKER_BIN: fakeDocker,
      OPENRESTY_CONTAINER: "fixture-openresty",
      SITE_BASE: site,
      SITE_OWNER: `${process.getuid()}:${process.getgid()}`,
      ...extraEnv,
    },
  });
}

test("deploys only the static payload and preserves verification files", () => {
  const data = fixture();
  try {
    const result = deploy(data);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(data.site, "index/index.html"), "utf8"), "new:index.html");
    assert.equal(existsSync(join(data.site, "index/content")), false);
    assert.equal(existsSync(join(data.site, "index/docs")), false);
    assert.equal(existsSync(join(data.site, "index/node_modules")), false);
    for (const file of verificationFiles) {
      assert.equal(readFileSync(join(data.site, "index", file), "utf8"), `verify:${file}`);
    }
    assert.equal(existsSync(join(data.site, ".index-next")), false);
    assert.equal(existsSync(join(data.site, ".index-old")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("restores the previous release when post-copy verification fails", () => {
  const data = fixture();
  try {
    const result = deploy(data, { FAKE_DOCKER_DROP_FEED: "1" });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
    assert.equal(existsSync(join(data.site, ".index-next")), false);
    assert.equal(existsSync(join(data.site, ".index-old")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("recovers an interrupted old release before deploying", () => {
  const data = fixture();
  try {
    renameSync(join(data.site, "index"), join(data.site, ".index-old"));
    const result = deploy(data);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(data.site, "index/index.html"), "utf8"), "new:index.html");
    assert.equal(existsSync(join(data.site, ".index-old")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});
