# GTR Self-Hosted Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreachable GitHub-hosted SSH deployment with a repository-scoped GTR runner that builds and atomically deploys the site into the 1Panel OpenResty container.

**Architecture:** GitHub Actions keeps Test and Pages on hosted runners, while the 1Panel job targets a GTR self-hosted runner labelled `gtr`. A tested shell script assembles a filtered static payload, preserves fixed verification files, and performs a sibling-directory switch with rollback inside the OpenResty container. The runner is registered only to this repository and kept alive by a user-level systemd service.

**Tech Stack:** GitHub Actions YAML, Bash, Node.js 24 `node:test`, Docker CLI, GitHub Actions Runner v2.335.1, user-level systemd

## Global Constraints

- Runner install directory: `/home/kun/.local/share/github-actions-runner/dev-tools-nav`.
- Runner name: `gtr-dev-tools-nav`; required labels: `self-hosted`, `linux`, `x64`, `gtr`.
- Runner scope: repository `SongYuanKun/dev-tools-nav` only.
- Runner service: `~/.config/systemd/user/github-actions-dev-tools-nav.service`, executed as `kun` without sudo.
- Production container: `1Panel-openresty-rRvM`; site base: `/www/sites/tools.songyuankun.top`.
- Preserve, but never commit the contents of, `baidu_verify_codeva-TByQYpVHM2.html` and `googleb710668c9aa28d4e.html`.
- The self-hosted job must never run for `pull_request`.
- Test and Pages workflows remain on GitHub-hosted runners.
- No new inbound port, SSH key, persistent registration token, or `ONEPANEL_*` secret.
- Keep `concurrency.group: deploy-1panel` and `cancel-in-progress: false`.

---

### Task 1: Tested atomic local deployment

**Files:**
- Create: `scripts/deploy-1panel-local.test.mjs`
- Create: `scripts/deploy-1panel-local.sh`

**Interfaces:**
- Consumes: repository root after `npm run build` and `npm run check:generated`; environment variables `DOCKER_BIN`, `OPENRESTY_CONTAINER`, `SITE_BASE`, and `SITE_OWNER` (default `ubuntu:ubuntu`).
- Produces: executable `scripts/deploy-1panel-local.sh`; exit code `0` only after a verified switch; restored `index` on a failed post-switch verification.

- [ ] **Step 1: Write the failing deployment contract tests**

Create `scripts/deploy-1panel-local.test.mjs`. The fixture copies the production script into a temporary repository, supplies every required artifact, and places a fake `docker` executable first in the deployment interface. The fake maps `docker exec` to a local shell and `docker cp` to `cp -a`; `FAKE_DOCKER_DROP_FEED=1` removes `feed.xml` after copying to force the real rollback path.

```js
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
```

- [ ] **Step 2: Run the new tests and verify the expected failure**

Run: `node --test scripts/deploy-1panel-local.test.mjs`

Expected: FAIL because `scripts/deploy-1panel-local.sh` does not exist.

- [ ] **Step 3: Implement the deployment script**

Create `scripts/deploy-1panel-local.sh` and make it executable. The inner container shell receives paths as positional arguments, which avoids interpolating repository-controlled text into a shell program.

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_BIN="${DOCKER_BIN:-docker}"
OPENRESTY_CONTAINER="${OPENRESTY_CONTAINER:-1Panel-openresty-rRvM}"
SITE_BASE="${SITE_BASE:-/www/sites/tools.songyuankun.top}"
SITE_OWNER="${SITE_OWNER:-ubuntu:ubuntu}"
TARGET="$SITE_BASE/index"
NEXT="$SITE_BASE/.index-next"
OLD="$SITE_BASE/.index-old"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

required=(
  index.html sitemap.xml feed.xml favicon.svg
  tools/json/index.html
  pages/blog/java-source-mybatis.html
)
preserved=(
  baidu_verify_codeva-TByQYpVHM2.html
  googleb710668c9aa28d4e.html
)

for relative in "${required[@]}"; do
  [[ -f "$ROOT_DIR/$relative" ]] || { echo "Missing build artifact: $relative" >&2; exit 1; }
done

rsync -a --delete \
  --exclude='.git' --exclude='.github' --exclude='README.md' --exclude='.gitignore' \
  --exclude='docs' --exclude='content' --exclude='package.json' --exclude='package-lock.json' \
  --exclude='node_modules' --exclude='scripts' --exclude='deploy.sh' --exclude='logs' \
  --exclude='*.bak' --exclude='.DS_Store' \
  --exclude='baidu_verify_codeva-TByQYpVHM2.html' \
  --exclude='googleb710668c9aa28d4e.html' \
  "$ROOT_DIR/" "$STAGE/"

[[ ! -e "$STAGE/content" ]] || { echo "Source content leaked into deployment payload" >&2; exit 1; }

"$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
  target=$1; next=$2; old=$3
  if [ ! -d "$target" ] && [ -d "$old" ]; then mv "$old" "$target"; fi
  rm -rf "$next"
  mkdir -p "$next"
' _ "$TARGET" "$NEXT" "$OLD"

"$DOCKER_BIN" cp "$STAGE/." "$OPENRESTY_CONTAINER:$NEXT/"

for filename in "${preserved[@]}"; do
  "$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
    target=$1; next=$2; filename=$3
    if [ -f "$target/$filename" ]; then cp "$target/$filename" "$next/$filename"; fi
  ' _ "$TARGET" "$NEXT" "$filename"
done

required_lines="$(printf '%s\n' "${required[@]}")"
"$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
  target=$1; next=$2; old=$3; required=$4; owner=$5
  chown -R "$owner" "$next"
  rm -rf "$old"
  if [ -d "$target" ]; then mv "$target" "$old"; fi
  if ! mv "$next" "$target"; then
    [ ! -d "$old" ] || mv "$old" "$target"
    exit 1
  fi
  failed=0
  while IFS= read -r relative; do
    [ -z "$relative" ] || [ -f "$target/$relative" ] || failed=1
  done <<EOF
$required
EOF
  if [ "$failed" -ne 0 ] || [ -e "$target/content" ]; then
    rm -rf "$target"
    [ ! -d "$old" ] || mv "$old" "$target"
    exit 1
  fi
  rm -rf "$old"
' _ "$TARGET" "$NEXT" "$OLD" "$required_lines" "$SITE_OWNER"

echo "Deployed to $OPENRESTY_CONTAINER:$TARGET"
```

Run: `chmod +x scripts/deploy-1panel-local.sh`

- [ ] **Step 4: Run focused and full tests**

Run: `node --test scripts/deploy-1panel-local.test.mjs`

Expected: 3 tests pass.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit the tested deployment script**

```bash
git add scripts/deploy-1panel-local.sh scripts/deploy-1panel-local.test.mjs
git commit -m "feat: add atomic local 1Panel deployment"
```

### Task 2: Migrate the GitHub Actions workflow from SSH to GTR

**Files:**
- Rename: `.github/workflows/deploy-1panel-ssh.yml` → `.github/workflows/deploy-1panel.yml`
- Modify: `scripts/workflows.test.mjs`
- Modify: `scripts/generate-sitemap.test.mjs`

**Interfaces:**
- Consumes: executable `scripts/deploy-1panel-local.sh` from Task 1 and runner labels from the global constraints.
- Produces: a deploy job scheduled only on `[self-hosted, linux, x64, gtr]`, with the build gate before local deployment and no SSH/secrets path.

- [ ] **Step 1: Change workflow tests first**

In `scripts/workflows.test.mjs`, replace the existing 1Panel assertions inside `deploy workflows install dependencies and build before publishing` with:

```js
  const onePanel = readFileSync(".github/workflows/deploy-1panel.yml", "utf-8");
  assert.match(onePanel, /name: ["']?Deploy to 1Panel \(GTR self-hosted\)["']?/);
  assert.match(onePanel, /node-version: ["']24["']/);
  assert.match(onePanel, /runs-on:\s*\[self-hosted, linux, x64, gtr\]/);
  assert.match(onePanel, /concurrency:\s*\n\s+group: deploy-1panel\s*\n\s+cancel-in-progress: false/);
  assertStepsInOrder(onePanel, [
    "run: npm ci",
    "name: Generate AI topic changelog",
    "name: Refresh CSDN articles from RSS",
    "run: npm run build",
    "run: npm run check:generated",
    "run: ./scripts/deploy-1panel-local.sh",
  ]);
  assert.doesNotMatch(onePanel, /ubuntu-latest|ssh-keyscan|ssh-agent|rsync|ONEPANEL_/);
  assert.doesNotMatch(onePanel, /pull_request:/);
```

In `scripts/generate-sitemap.test.mjs`, change the workflow path and deployment marker:

```js
  const onePanel = readFileSync(".github/workflows/deploy-1panel.yml", "utf8");
  // existing package/build assertions stay unchanged
  assert.ok(onePanel.indexOf(command) < onePanel.indexOf("./scripts/deploy-1panel-local.sh"));
```

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run: `node --test scripts/workflows.test.mjs scripts/generate-sitemap.test.mjs`

Expected: FAIL because `.github/workflows/deploy-1panel.yml` does not exist.

- [ ] **Step 3: Replace the SSH workflow**

Run: `git mv .github/workflows/deploy-1panel-ssh.yml .github/workflows/deploy-1panel.yml`

Replace the renamed workflow with:

```yaml
name: "Deploy to 1Panel (GTR self-hosted)"

"on":
  push:
    branches: [main]
  workflow_dispatch:
  workflow_run:
    workflows: ["Sync CSDN articles"]
    types: [completed]

permissions:
  contents: read

concurrency:
  group: deploy-1panel
  cancel-in-progress: false

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  deploy:
    if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'
    runs-on: [self-hosted, linux, x64, gtr]
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm

      - run: npm ci

      - name: Generate AI topic changelog
        run: node scripts/generate-ai-changelog.mjs

      - name: Refresh CSDN articles from RSS
        env:
          CSDN_RSS_URL: https://blog.csdn.net/syk123839070/rss/list
        run: python3 scripts/sync-csdn-rss.py

      - run: npm run build

      - run: npm run check:generated

      - run: ./scripts/deploy-1panel-local.sh
```

- [ ] **Step 4: Run focused and full verification**

Run: `node --test scripts/workflows.test.mjs scripts/generate-sitemap.test.mjs`

Expected: all focused tests pass.

Run: `npm test && npm run build && npm run check:generated`

Expected: all commands exit `0`; `git diff --check` reports nothing.

- [ ] **Step 5: Commit the workflow migration**

```bash
git add .github/workflows/deploy-1panel.yml .github/workflows/deploy-1panel-ssh.yml scripts/workflows.test.mjs scripts/generate-sitemap.test.mjs
git commit -m "ci: deploy 1Panel from GTR runner"
```

### Task 3: Replace stale deployment documentation with the self-hosted runbook

**Files:**
- Modify: `docs/deploy-1panel.md`
- Modify: `docs/README.md`
- Modify: `README.md`
- Modify: `manual.md`

**Interfaces:**
- Consumes: workflow/script paths and operational defaults from Tasks 1–2.
- Produces: one canonical install, upgrade, recovery, and manual-deploy runbook; top-level documents link to it without duplicating commands.

- [ ] **Step 1: Add documentation assertions to the workflow contract test**

Append to `scripts/workflows.test.mjs`:

```js
test("deployment documentation describes the GTR runner without stale SSH setup", () => {
  const deployDoc = readFileSync("docs/deploy-1panel.md", "utf-8");
  const readme = readFileSync("README.md", "utf-8");
  assert.match(deployDoc, /gtr-dev-tools-nav/);
  assert.match(deployDoc, /github-actions-dev-tools-nav\.service/);
  assert.match(deployDoc, /scripts\/deploy-1panel-local\.sh/);
  assert.match(deployDoc, /actions-runner-linux-x64-2\.335\.1\.tar\.gz/);
  assert.match(deployDoc, /4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf/);
  assert.doesNotMatch(deployDoc, /ONEPANEL_SSH_KEY|ssh-keyscan/);
  assert.match(readme, /deploy-1panel\.yml/);
  assert.doesNotMatch(readme, /deploy-1panel-ssh\.yml|1Panel SSH/);
});
```

- [ ] **Step 2: Run the documentation test and verify it fails**

Run: `node --test scripts/workflows.test.mjs`

Expected: FAIL because the documents still describe SSH deployment.

- [ ] **Step 3: Rewrite the canonical runbook**

Rewrite `docs/deploy-1panel.md` with these complete sections:

````markdown
# 1Panel 自动部署与 GTR Runner 运维

`tools.songyuankun.top` 由 `.github/workflows/deploy-1panel.yml` 自动发布。Test 与 GitHub Pages 使用 GitHub 托管 Runner；1Panel 发布使用仓库专属的 `gtr-dev-tools-nav` Runner，在 GTR 本机构建后调用 `scripts/deploy-1panel-local.sh`，再通过 Docker 原子切换 OpenResty 站点目录。

## 固定配置

- 仓库：`SongYuanKun/dev-tools-nav`
- Runner：`gtr-dev-tools-nav`，标签 `self-hosted,linux,x64,gtr`
- 安装目录：`/home/kun/.local/share/github-actions-runner/dev-tools-nav`
- 服务：`~/.config/systemd/user/github-actions-dev-tools-nav.service`
- 容器：`1Panel-openresty-rRvM`
- 容器站点：`/www/sites/tools.songyuankun.top/index`

## 安装 Runner

以下版本与校验值来自 GitHub Actions Runner v2.335.1 官方发布页：

```bash
RUNNER_VERSION=2.335.1
RUNNER_SHA256=4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf
RUNNER_HOME=/home/kun/.local/share/github-actions-runner/dev-tools-nav
ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
mkdir -p "$RUNNER_HOME"
curl -fL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${ARCHIVE}" -o "/tmp/${ARCHIVE}"
echo "${RUNNER_SHA256}  /tmp/${ARCHIVE}" | sha256sum --check
tar -xzf "/tmp/${ARCHIVE}" -C "$RUNNER_HOME"
TOKEN="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/registration-token --jq .token)"
"$RUNNER_HOME/config.sh" --unattended --url https://github.com/SongYuanKun/dev-tools-nav --token "$TOKEN" --name gtr-dev-tools-nav --labels gtr --work _work --replace
unset TOKEN
rm -f "/tmp/${ARCHIVE}"
```

创建 `~/.config/systemd/user/github-actions-dev-tools-nav.service`：

```ini
[Unit]
Description=GitHub Actions Runner for SongYuanKun/dev-tools-nav
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/kun/.local/share/github-actions-runner/dev-tools-nav
ExecStart=/home/kun/.local/share/github-actions-runner/dev-tools-nav/run.sh
Restart=always
RestartSec=10
KillSignal=SIGINT
TimeoutStopSec=300

[Install]
WantedBy=default.target
```

启用并检查：

```bash
systemctl --user daemon-reload
systemctl --user enable --now github-actions-dev-tools-nav.service
systemctl --user is-enabled github-actions-dev-tools-nav.service
systemctl --user is-active github-actions-dev-tools-nav.service
gh api repos/SongYuanKun/dev-tools-nav/actions/runners --jq '.runners[] | {name,status,busy,labels:[.labels[].name]}'
```

## 发布与验证

推送 `main` 后，依次检查 Test、Deploy GitHub Pages 和 Deploy to 1Panel。1Panel 工作流必须先通过 `npm ci`、内容刷新、构建和生成物校验，之后才执行本地部署脚本。

```bash
gh run list --repo SongYuanKun/dev-tools-nav --limit 10
curl -fsS https://tools.songyuankun.top/ >/dev/null
curl -fsS https://tools.songyuankun.top/tools/json/ >/dev/null
curl -fsS https://tools.songyuankun.top/feed.xml >/dev/null
curl -fsS https://tools.songyuankun.top/sitemap.xml >/dev/null
curl -fsS https://tools.songyuankun.top/pages/blog/java-source-mybatis.html >/dev/null
curl -fsS https://tools.songyuankun.top/favicon.svg >/dev/null
```

`content/` 必须返回 404。两个搜索引擎验证文件由部署脚本从当前线上版本复制到新版本，不进入 Git。

## 手动发布与故障恢复

正常发布前先执行 `npm ci && npm run build && npm run check:generated`，再执行 `./scripts/deploy-1panel-local.sh`。脚本使用 `.index-next` 和 `.index-old` 切换；切换后校验失败时自动恢复上一版本。

查看服务日志：`journalctl --user -u github-actions-dev-tools-nav.service -n 200 --no-pager`。若 Runner 离线，先执行 `systemctl --user restart github-actions-dev-tools-nav.service`，再检查网络、磁盘、Docker 访问和日志。

注销前先停止服务，然后获取短期删除令牌并运行 `config.sh remove`：

```bash
systemctl --user disable --now github-actions-dev-tools-nav.service
TOKEN="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/remove-token --jq .token)"
/home/kun/.local/share/github-actions-runner/dev-tools-nav/config.sh remove --token "$TOKEN"
unset TOKEN
```

升级 Runner 时，从 GitHub 官方发布页重新取得版本和 SHA-256，停止服务、替换程序、启动服务，然后执行一次完整发布验收。不要复用旧注册令牌，也不要开放入站端口。
````

- [ ] **Step 4: Update cross-references without duplicating the runbook**

Apply these exact terminology changes:

- In `README.md`, change the workflow tree entry to `deploy-1panel.yml  # GTR 自托管 Runner 自动发布到 1Panel`; replace “Pages、本地 deploy.sh 与 1Panel SSH” with “Pages 与 GTR 自托管 1Panel”; make the 1Panel section say that pushes to `main` automatically deploy and link to `docs/deploy-1panel.md`.
- In `manual.md`, replace the “1Panel 本机” row with `1Panel 自动发布 | 推送 main → Actions Deploy to 1Panel；见 docs/deploy-1panel.md`.
- In `docs/README.md`, change the deployment document description to `GTR 自托管 Runner、原子部署、回滚与运维说明`.

- [ ] **Step 5: Verify and commit documentation**

Run: `node --test scripts/workflows.test.mjs && rg -n 'deploy-1panel-ssh|1Panel SSH|ONEPANEL_' README.md manual.md docs .github scripts --glob '!docs/superpowers/**'`

Expected: tests pass; `rg` has no stale production references.

```bash
git add docs/deploy-1panel.md docs/README.md README.md manual.md scripts/workflows.test.mjs
git commit -m "docs: add GTR runner deployment runbook"
```

### Task 4: Install and register the repository-scoped Runner on GTR

**Files:**
- Create outside repository: `/home/kun/.config/systemd/user/github-actions-dev-tools-nav.service`
- Create outside repository: `/home/kun/.local/share/github-actions-runner/dev-tools-nav/**`

**Interfaces:**
- Consumes: GitHub CLI authentication with repository administration permission, official runner v2.335.1 package, Docker access, outbound HTTPS, and the exact service/runbook from Task 3.
- Produces: online idle runner `gtr-dev-tools-nav` with label `gtr`, persistent user service, no stored registration token.

- [ ] **Step 1: Run host preflight checks**

Run:

```bash
uname -m
loginctl show-user kun -p Linger -p State
docker info >/dev/null
command -v curl gh rsync python3 node npm systemctl sha256sum
gh auth status
gh api repos/SongYuanKun/dev-tools-nav/actions/runners
```

Expected: `x86_64`, `Linger=yes`, Docker succeeds, every command is found, GitHub authentication is valid, and no conflicting `gtr-dev-tools-nav` runner is online.

- [ ] **Step 2: Download, verify, extract, and register**

Run:

```bash
RUNNER_VERSION=2.335.1
RUNNER_SHA256=4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf
RUNNER_HOME=/home/kun/.local/share/github-actions-runner/dev-tools-nav
ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
mkdir -p "$RUNNER_HOME"
curl -fL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${ARCHIVE}" -o "/tmp/${ARCHIVE}"
echo "${RUNNER_SHA256}  /tmp/${ARCHIVE}" | sha256sum --check
tar -xzf "/tmp/${ARCHIVE}" -C "$RUNNER_HOME"
TOKEN="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/registration-token --jq .token)"
"$RUNNER_HOME/config.sh" --unattended --url https://github.com/SongYuanKun/dev-tools-nav --token "$TOKEN" --name gtr-dev-tools-nav --labels gtr --work _work --replace
unset TOKEN
rm -f "/tmp/${ARCHIVE}"
```

Expected: SHA-256 check prints `OK`; `config.sh` reports successful authentication, runner addition, and settings save. Confirm no token remains with `env | rg '^TOKEN='` returning no output.

- [ ] **Step 3: Install the user service**

Create `/home/kun/.config/systemd/user/github-actions-dev-tools-nav.service` with `apply_patch` and this content:

```ini
[Unit]
Description=GitHub Actions Runner for SongYuanKun/dev-tools-nav
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/kun/.local/share/github-actions-runner/dev-tools-nav
ExecStart=/home/kun/.local/share/github-actions-runner/dev-tools-nav/run.sh
Restart=always
RestartSec=10
KillSignal=SIGINT
TimeoutStopSec=300

[Install]
WantedBy=default.target
```

Then run:

```bash
systemctl --user daemon-reload
systemctl --user enable --now github-actions-dev-tools-nav.service
systemctl --user is-enabled github-actions-dev-tools-nav.service
systemctl --user is-active github-actions-dev-tools-nav.service
```

Expected: the final two commands print `enabled` and `active`.

- [ ] **Step 4: Verify GitHub labels and service logs**

Run:

```bash
gh api repos/SongYuanKun/dev-tools-nav/actions/runners --jq '.runners[] | select(.name == "gtr-dev-tools-nav") | {name,status,busy,labels:[.labels[].name]}'
journalctl --user -u github-actions-dev-tools-nav.service -n 50 --no-pager
```

Expected: status `online`, busy `false`, labels include `self-hosted`, `Linux`, `X64`, and `gtr`; logs show the runner listening for jobs.

### Task 5: Push main and prove the end-to-end deployment

**Files:**
- No new files expected; generated files may be refreshed by the build and must match committed sources.

**Interfaces:**
- Consumes: Tasks 1–4 and the previously approved direct-to-main delivery policy.
- Produces: synchronized `main`/`origin/main`, successful Test/Pages/1Panel runs, and verified production URLs.

- [ ] **Step 1: Run final local verification before push**

Run:

```bash
npm test
npm run build
npm run check:generated
git diff --check
git status --short --branch
```

Expected: all checks pass; only intentional generated changes, if any, are present. Commit intentional generated changes separately before proceeding; do not include ignored verification files.

- [ ] **Step 2: Push main**

Run: `git push origin main`

Expected: push succeeds and the remote main SHA equals local `git rev-parse HEAD`.

- [ ] **Step 3: Watch all Actions to terminal state**

Run:

```bash
SHA="$(git rev-parse HEAD)"
gh run list --repo SongYuanKun/dev-tools-nav --commit "$SHA" --limit 10
```

Identify Test, Deploy GitHub Pages, and Deploy to 1Panel run IDs, then run `gh run watch RUN_ID --exit-status` for each.

Expected: all three workflows conclude `success`; the 1Panel job reports runner `gtr-dev-tools-nav` and executes `./scripts/deploy-1panel-local.sh` after the build gate.

- [ ] **Step 4: Verify production and preserved files**

Run:

```bash
for url in \
  https://tools.songyuankun.top/ \
  https://tools.songyuankun.top/tools/json/ \
  https://tools.songyuankun.top/feed.xml \
  https://tools.songyuankun.top/sitemap.xml \
  https://tools.songyuankun.top/pages/blog/java-source-mybatis.html \
  https://tools.songyuankun.top/favicon.svg \
  https://tools.songyuankun.top/baidu_verify_codeva-TByQYpVHM2.html \
  https://tools.songyuankun.top/googleb710668c9aa28d4e.html; do
  curl -fsS "$url" >/dev/null || exit 1
done
test "$(curl -sS -o /dev/null -w '%{http_code}' https://tools.songyuankun.top/content/)" = 404
docker exec 1Panel-openresty-rRvM test ! -e /www/sites/tools.songyuankun.top/.index-next
docker exec 1Panel-openresty-rRvM test ! -e /www/sites/tools.songyuankun.top/.index-old
```

Expected: all public artifacts and both verification files return success, `/content/` returns `404`, and no staging/rollback directory remains.

- [ ] **Step 5: Record final state**

Run:

```bash
git status --short --branch
systemctl --user is-active github-actions-dev-tools-nav.service
gh api repos/SongYuanKun/dev-tools-nav/actions/runners --jq '.runners[] | select(.name == "gtr-dev-tools-nav") | {name,status,busy}'
```

Expected: clean `main` synchronized with `origin/main`, service `active`, runner `online` and idle.
