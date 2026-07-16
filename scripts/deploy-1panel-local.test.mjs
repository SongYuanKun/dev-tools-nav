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
const publishedRootFiles = [
  "index.html",
  "favicon.ico",
  "favicon.svg",
  "feed.xml",
  "robots.txt",
  "sitemap.xml",
];
const publishedDirectoryFiles = [
  "assets/app.txt",
  "css/app.css",
  "data/app.json",
  "js/app.js",
  "pages/blog/java-source-mybatis.html",
  "tools/json/index.html",
];
const unpublishedFiles = [
  ".env.production",
  "manual.md",
  "rollup.config.mjs",
  ".superpowers/private.md",
  "content/blog/private.md",
  "docs/private.md",
  "node_modules/pkg/index.js",
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
  for (const file of publishedRootFiles) write(repo, file, `new:${file}`);
  for (const file of publishedDirectoryFiles) write(repo, file, `new:${file}`);
  for (const file of unpublishedFiles) write(repo, file, "must not deploy");
  for (const file of verificationFiles) write(repo, file, `repo:${file}`);
  write(join(site, "index"), "marker.txt", "old release");
  for (const file of verificationFiles) write(join(site, "index"), file, `verify:${file}`);
  cpSync("scripts/deploy-1panel-local.sh", join(repo, "scripts/deploy-1panel-local.sh"));
  chmodSync(join(repo, "scripts/deploy-1panel-local.sh"), 0o755);
  const fakeDocker = join(bin, "docker");
  writeFileSync(fakeDocker, `#!/usr/bin/env bash
set -euo pipefail
command="$1"
shift
if [[ -n "\${FAKE_DOCKER_LOG:-}" ]]; then printf '%s\n' "$command" >> "\$FAKE_DOCKER_LOG"; fi
case "$command" in
  exec)
    container="$1"; shift
    "$@"
    ;;
  cp)
    source="$1"
    destination="\${2#*:}"
    if [[ "\${FAKE_DOCKER_FAIL_CP:-0}" == "1" ]]; then exit 65; fi
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
  const fakeMv = join(bin, "mv");
  writeFileSync(fakeMv, `#!/usr/bin/env bash
set -euo pipefail
if [[ -n "\${FAKE_MV_FAIL_ON_CALL:-}" ]]; then
  count=0
  if [[ -f "\${FAKE_MV_STATE}" ]]; then read -r count < "\${FAKE_MV_STATE}"; fi
  count=$((count + 1))
  printf '%s\n' "$count" > "\${FAKE_MV_STATE}"
  if [[ "$count" == "\${FAKE_MV_FAIL_ON_CALL}" ]]; then exit 66; fi
fi
exec /bin/mv "$@"
`);
  chmodSync(fakeMv, 0o755);
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
      PATH: `${dirname(fakeDocker)}:${process.env.PATH}`,
      ...extraEnv,
    },
  });
}

test("deploys only the static payload and preserves verification files", () => {
  const data = fixture();
  try {
    const result = deploy(data);
    assert.equal(result.status, 0, result.stderr);
    for (const file of [...publishedRootFiles, ...publishedDirectoryFiles]) {
      assert.equal(readFileSync(join(data.site, "index", file), "utf8"), `new:${file}`);
    }
    for (const file of unpublishedFiles) {
      assert.equal(existsSync(join(data.site, "index", file)), false, `${file} must not deploy`);
    }
    for (const file of verificationFiles) {
      assert.equal(readFileSync(join(data.site, "index", file), "utf8"), `verify:${file}`);
    }
    assert.equal(existsSync(join(data.site, ".index-next")), false);
    assert.equal(existsSync(join(data.site, ".index-old")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("does not call Docker when a required local artifact is missing", () => {
  const data = fixture();
  try {
    rmSync(join(data.repo, "feed.xml"));
    const dockerLog = join(data.root, "docker.log");
    const result = deploy(data, { FAKE_DOCKER_LOG: dockerLog });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing build artifact: feed\.xml/);
    assert.equal(existsSync(dockerLog), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("clears a stale marker without deleting an index when no old release exists", () => {
  const data = fixture();
  try {
    write(data.site, ".deploy-in-progress", "");
    const result = deploy(data, { FAKE_DOCKER_FAIL_CP: "1" });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
    assert.equal(existsSync(join(data.site, ".deploy-in-progress")), false);
    assert.equal(existsSync(join(data.site, ".index-next")), false);
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

test("restores the previous release when the new release move fails", () => {
  const data = fixture();
  try {
    const result = deploy(data, {
      FAKE_MV_FAIL_ON_CALL: "2",
      FAKE_MV_STATE: join(data.root, "mv-state"),
    });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
    assert.equal(existsSync(join(data.site, ".deploy-in-progress")), false);
    assert.equal(existsSync(join(data.site, ".index-old")), false);
    assert.equal(existsSync(join(data.site, ".index-next")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("restores the marked old release before a deployment that later fails", () => {
  const data = fixture();
  try {
    renameSync(join(data.site, "index"), join(data.site, ".index-old"));
    write(join(data.site, "index"), "marker.txt", "unverified release");
    write(data.site, ".deploy-in-progress", "");
    const result = deploy(data, { FAKE_DOCKER_DROP_FEED: "1" });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
    assert.equal(existsSync(join(data.site, ".deploy-in-progress")), false);
    assert.equal(existsSync(join(data.site, ".index-next")), false);
    assert.equal(existsSync(join(data.site, ".index-old")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});
