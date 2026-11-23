import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "index.html",
  "search-console.html",
  "sitemap.xml",
  "feed.xml",
  "favicon.svg",
  "manifest.webmanifest",
  "sw.js",
  "offline.html",
  "tools/json/index.html",
  "pages/blog/java-source-mybatis.html",
];
const verificationFiles = [
  "baidu_verify_codeva-TByQYpVHM2.html",
  "googleb710668c9aa28d4e.html",
];
const releaseSha = 'c6e6e79c79830000000000000000000000000000';
const publishedRootFiles = [
  "index.html",
  "search-console.html",
  "favicon.ico",
  "favicon.svg",
  "feed.xml",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "sw.js",
  "offline.html",
  "LICENSE",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "manual.md",
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
  "rollup.config.mjs",
  ".superpowers/private.md",
  "content/blog/private.md",
  "docs/private.md",
  "node_modules/pkg/index.js",
  "tasks/private.md",
  "scripts/private.sh",
  "ops/private.service",
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
  const cache = join(root, "cache");
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(site, "index"), { recursive: true });
  mkdirSync(verificationSource, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(cache, { recursive: true });
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
  cpSync("scripts/stamp-asset-version.mjs", join(repo, "scripts/stamp-asset-version.mjs"));
  chmodSync(join(repo, "scripts/deploy-1panel-local.sh"), 0o755);
  // The poller tests exercise the real Git and GitHub API gates. These tests
  // isolate the staging and Docker transaction with a simulated verifier.
  const verifier = join(repo, "scripts/poll-github-deploy.sh");
  writeFileSync(verifier, `#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  --verify-release)
    [[ "$2" == "$SITE_SOURCE_DIR" && "$3" == "$RELEASE_SHA" && "$#" -gt 4 ]]
    if [[ "\${UNVERIFIED_RELEASE:-0}" == 1 ]]; then echo 'unverified release' >&2; exit 1; fi
    ;;
  --assert-current-main)
    [[ "$2" == "$RELEASE_SHA" ]]
    if [[ "\${ADVANCED_MAIN:-0}" == 1 ]]; then echo 'main has advanced' >&2; exit 1; fi
    ;;
  *) exit 2 ;;
esac
`);
  chmodSync(verifier, 0o755);
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
  return { root, repo, site, cache, verificationSource, fakeDocker };
}

function installDeployer(data, copyStamp = true) {
  const installedDir = join(data.root, "installed");
  mkdirSync(installedDir);
  const scripts = ["deploy-1panel-local.sh", "poll-github-deploy.sh"];
  if (copyStamp) scripts.push("stamp-asset-version.mjs");
  for (const script of scripts) cpSync(join(data.repo, "scripts", script), join(installedDir, script));
  return join(installedDir, "deploy-1panel-local.sh");
}

function deploy({ repo, site, cache, verificationSource, fakeDocker }, extraEnv = {}, options = {}) {
  const script = options.script ?? "scripts/deploy-1panel-local.sh";
  const args = options.lock === false
    ? [script]
    : ["-ec", 'exec 9>"$CACHE_DIR/deploy.lock"; flock -n 9; exec bash "$1"', "test-deployer", script];
  return spawnSync("bash", args, {
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
      CACHE_DIR: cache,
      SITE_SOURCE_DIR: repo,
      RELEASE_SHA: releaseSha,
      ...extraEnv,
    },
  });
}

test("deploys from SITE_SOURCE_DIR instead of the installed script directory", () => {
  const data = fixture();
  try {
    const installedScript = installDeployer(data);
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

test("deploy stamp replaces __ASSET_VERSION__ before publishing", () => {
  const data = fixture();
  try {
    write(
      data.repo,
      "index.html",
      `<link rel="stylesheet" href="css/style.css?v=__ASSET_VERSION__" />\n<script src="js/base.js?v=__ASSET_VERSION__"></script>\n`,
    );
    write(
      data.repo,
      "sw.js",
      `const VERSION = "pwa-__ASSET_VERSION__";\nconst PRECACHE_URLS = ["./css/style.css?v=__ASSET_VERSION__"];\n`,
    );
    write(
      data.repo,
      "offline.html",
      `<link rel="stylesheet" href="css/style.css?v=__ASSET_VERSION__" />\n`,
    );

    const result = deploy(data, { ASSET_VERSION: "cannot-override-release-sha" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Stamped asset version c6e6e79c7983/);

    const html = readFileSync(join(data.site, "index/index.html"), "utf8");
    const sw = readFileSync(join(data.site, "index/sw.js"), "utf8");
    const offline = readFileSync(join(data.site, "index/offline.html"), "utf8");
    assert.match(html, /style\.css\?v=c6e6e79c7983/);
    assert.match(html, /base\.js\?v=c6e6e79c7983/);
    assert.doesNotMatch(html, /__ASSET_VERSION__/);
    assert.match(sw, /VERSION = "pwa-c6e6e79c7983"/);
    assert.doesNotMatch(sw, /__ASSET_VERSION__/);
    assert.doesNotMatch(offline, /__ASSET_VERSION__/);
    // Source checkout keeps placeholders for the next publish path.
    assert.match(readFileSync(join(data.repo, "index.html"), "utf8"), /__ASSET_VERSION__/);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("deploy fails closed when stamp-asset-version.mjs is missing", () => {
  const data = fixture();
  try {
    const installedScript = installDeployer(data, false);
    rmSync(join(data.repo, "scripts/stamp-asset-version.mjs"));

    const result = deploy(
      data,
      { SITE_SOURCE_DIR: data.repo },
      { script: installedScript, cwd: data.root },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stamp-asset-version\.mjs not found/);
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
    assert.equal(existsSync(join(data.site, ".index-next")), false);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("libexec companion stamp-asset-version.mjs works when checkout scripts/ lacks it", () => {
  const data = fixture();
  try {
    const installedScript = installDeployer(data);
    rmSync(join(data.repo, "scripts/stamp-asset-version.mjs"));
    write(
      data.repo,
      "index.html",
      `<link rel="stylesheet" href="css/style.css?v=__ASSET_VERSION__" />\n`,
    );

    const result = deploy(
      data,
      { SITE_SOURCE_DIR: data.repo },
      { script: installedScript, cwd: data.root },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(readFileSync(join(data.site, "index/index.html"), "utf8"), /style\.css\?v=c6e6e79c7983/);
    assert.doesNotMatch(readFileSync(join(data.site, "index/index.html"), "utf8"), /__ASSET_VERSION__/);
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("direct calls without a candidate or inherited lock cannot deploy", () => {
  const data = fixture();
  try {
    const missingSha = deploy(data, { RELEASE_SHA: "" });
    const missingLock = deploy(data, {}, { lock: false });
    for (const result of [missingSha, missingLock]) {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /requires a candidate SHA and the deploy lock/);
    }
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("missing or failed release verification cannot call Docker", () => {
  const data = fixture();
  try {
    const dockerLog = join(data.root, "docker.log");
    const unverified = deploy(data, { UNVERIFIED_RELEASE: "1", FAKE_DOCKER_LOG: dockerLog });
    assert.notEqual(unverified.status, 0);
    assert.match(unverified.stderr, /unverified release/);

    rmSync(join(data.repo, "scripts/poll-github-deploy.sh"));
    const missing = deploy(data, { FAKE_DOCKER_LOG: dockerLog });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /release verifier is unavailable/);
    assert.equal(existsSync(dockerLog), false);
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
  } finally {
    rmSync(data.root, { recursive: true, force: true });
  }
});

test("main advancing after the Docker copy prevents the atomic switch", () => {
  const data = fixture();
  try {
    const dockerLog = join(data.root, "docker.log");
    const result = deploy(data, { ADVANCED_MAIN: "1", FAKE_DOCKER_LOG: dockerLog });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /main has advanced/);
    assert.match(readFileSync(dockerLog, "utf8"), /^cp$/m);
    assert.equal(readFileSync(join(data.site, "index/marker.txt"), "utf8"), "old release");
    assert.equal(existsSync(join(data.site, ".index-next")), false);
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
