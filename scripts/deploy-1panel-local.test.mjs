import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  const verificationSource = join(root, "verification-source");
  const bin = join(root, "bin");
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(site, "index"), { recursive: true });
  mkdirSync(verificationSource, { recursive: true });
  mkdirSync(bin, { recursive: true });
  for (const file of requiredFiles) write(repo, file, `new:${file}`);
  for (const file of publishedRootFiles) write(repo, file, `new:${file}`);
  for (const file of publishedDirectoryFiles) write(repo, file, `new:${file}`);
  for (const file of unpublishedFiles) write(repo, file, "must not deploy");
  for (const file of verificationFiles) write(repo, file, `repo:${file}`);
  write(join(site, "index"), "marker.txt", "old release");
  for (const file of verificationFiles) {
    write(join(site, "index"), file, `live:${file}`);
    write(verificationSource, file, `host:${file}`);
    chmodSync(join(verificationSource, file), 0o600);
  }
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
    if [[ -d "\${source%/.}" ]]; then
      mkdir -p "$destination"
      cp -a "\${source%/.}/." "$destination/"
      if [[ "\${FAKE_DOCKER_DROP_FEED:-0}" == "1" ]]; then rm -f "$destination/feed.xml"; fi
    else
      mkdir -p "$(dirname "$destination")"
      cp -a "$source" "$destination"
    fi
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
  const fakeRm = join(bin, "rm");
  writeFileSync(fakeRm, `#!/usr/bin/env bash
set -euo pipefail
if [[ -n "\${FAKE_RM_LOG:-}" ]]; then printf '%s\n' "$*" >> "\$FAKE_RM_LOG"; fi
if [[ "\${FAKE_RM_FAIL_FINAL_OLD_CLEANUP:-0}" == "1" && "$#" -eq 2 && "$1" == "-rf" && "$2" == "\${FAKE_RM_FINAL_OLD}" ]]; then
  count=0
  if [[ -f "\${FAKE_RM_STATE}" ]]; then read -r count < "\${FAKE_RM_STATE}"; fi
  count=$((count + 1))
  printf '%s\n' "$count" > "\${FAKE_RM_STATE}"
  if [[ "$count" -eq 2 ]]; then
    printf 'failed:%s\n' "$*" >> "\$FAKE_RM_LOG"
    exit 67
  fi
fi
exec /bin/rm "$@"
`);
  chmodSync(fakeRm, 0o755);
  return { root, repo, site, verificationSource, fakeDocker };
}

function deploy({ repo, site, verificationSource, fakeDocker }, extraEnv = {}, options = {}) {
  return spawnSync("bash", [options.script ?? "scripts/deploy-1panel-local.sh"], {
    cwd: options.cwd ?? repo,
    encoding: "utf8",
    env: {
      ...process.env,
      DOCKER_BIN: fakeDocker,
      OPENRESTY_CONTAINER: "fixture-openresty",
      SITE_BASE: site,
      SITE_OWNER: `${process.getuid()}:${process.getgid()}`,
      VERIFICATION_SOURCE_DIR: verificationSource,
      PATH: `${dirname(fakeDocker)}:${process.env.PATH}`,
      ...extraEnv,
    },
  });
}

test("deploys from SITE_SOURCE_DIR instead of the installed script directory", () => {
  const data = fixture();
  try {
    const installedScript = join(data.root, "installed", "deploy-1panel-local.sh");
    mkdirSync(dirname(installedScript), { recursive: true });
    cpSync(join(data.repo, "scripts/deploy-1panel-local.sh"), installedScript);
    chmodSync(installedScript, 0o755);
    write(data.repo, "index.html", "new:from-site-source-dir");

    const result = deploy(
      data,
      { SITE_SOURCE_DIR: data.repo },
      { script: installedScript, cwd: data.root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(data.site, "index/index.html"), "utf8"), "new:from-site-source-dir");
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("falls back from an empty live verification file to a non-empty host source", () => {
  const data = fixture();
  try {
    const filename = verificationFiles[0];
    writeFileSync(join(data.site, "index", filename), "");

    const result = deploy(data);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(data.site, "index", filename), "utf8"), `host:${filename}`);
    assert.equal(statSync(join(data.site, "index", filename)).mode & 0o777, 0o644);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("fails before switching when both verification sources are empty", () => {
  const data = fixture();
  try {
    const filename = verificationFiles[0];
    writeFileSync(join(data.site, "index", filename), "");
    writeFileSync(join(data.verificationSource, filename), "");

    const result = deploy(data);

    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
    assert.equal(existsSync(join(data.site, ".deploy-in-progress")), false);
    assert.equal(existsSync(join(data.site, ".index-old")), false);
    assert.equal(existsSync(join(data.site, ".index-next")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("keeps the verified target when old release cleanup fails", () => {
  const data = fixture();
  try {
    const rmLog = join(data.root, "rm.log");
    const rmState = join(data.root, "rm-state");
    const old = join(data.site, ".index-old");
    const target = join(data.site, "index");
    const result = deploy(data, {
      FAKE_RM_FAIL_FINAL_OLD_CLEANUP: "1",
      FAKE_RM_FINAL_OLD: old,
      FAKE_RM_LOG: rmLog,
      FAKE_RM_STATE: rmState,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Warning: verified release is active, but old cleanup failed:/);
    assert.equal(result.stderr.includes(old), true);
    assert.equal(readFileSync(join(target, "index.html"), "utf8"), "new:index.html");
    assert.equal(existsSync(join(data.site, ".deploy-in-progress")), false);
    assert.equal(readFileSync(join(old, "marker.txt"), "utf8"), "old release");
    assert.equal(readFileSync(rmState, "utf8"), "2\n");
    const rmCalls = readFileSync(rmLog, "utf8").trimEnd().split("\n");
    assert.equal(rmCalls.filter((call) => call === `-rf ${old}`).length, 2);
    assert.equal(rmCalls.includes(`failed:-rf ${old}`), true);
    assert.equal(rmCalls.includes(`-rf ${target}`), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("deploys only the static payload and lets live verification files win", () => {
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
      assert.equal(readFileSync(join(data.site, "index", file), "utf8"), `live:${file}`);
    }
    assert.equal(existsSync(join(data.site, ".index-next")), false);
    assert.equal(existsSync(join(data.site, ".index-old")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("recovers missing live verification files from the host source", () => {
  const data = fixture();
  try {
    for (const file of verificationFiles) rmSync(join(data.site, "index", file));
    const result = deploy(data);
    assert.equal(result.status, 0, result.stderr);
    for (const file of verificationFiles) {
      assert.equal(readFileSync(join(data.site, "index", file), "utf8"), `host:${file}`);
      assert.equal(statSync(join(data.verificationSource, file)).mode & 0o777, 0o600);
      assert.equal(statSync(join(data.site, "index", file)).mode & 0o777, 0o644);
    }
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("deploys mixed live and host verification sources with live priority and public modes", () => {
  const data = fixture();
  try {
    const [liveFile, hostFile] = verificationFiles;
    rmSync(join(data.site, "index", hostFile));
    chmodSync(join(data.site, "index", liveFile), 0o600);
    const result = deploy(data);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(data.site, "index", liveFile), "utf8"), `live:${liveFile}`);
    assert.equal(readFileSync(join(data.site, "index", hostFile), "utf8"), `host:${hostFile}`);
    for (const file of verificationFiles) {
      assert.equal(statSync(join(data.site, "index", file)).mode & 0o777, 0o644);
    }
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("fails before switching the active index when either verification file has no source", async (t) => {
  for (const missingFile of verificationFiles) {
    await t.test(missingFile, () => {
      const data = fixture();
      try {
        rmSync(join(data.site, "index", missingFile));
        rmSync(join(data.verificationSource, missingFile));
        const result = deploy(data);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`Missing verification file: ${missingFile}`));
        assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
        assert.equal(existsSync(join(data.site, ".deploy-in-progress")), false);
        assert.equal(existsSync(join(data.site, ".index-old")), false);
        assert.equal(existsSync(join(data.site, ".index-next")), false);
      } finally {
        rmSync(data.root, { recursive: true, force: true });
      }
    });
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
