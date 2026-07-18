# GTR Outbound Deployer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public-repository self-hosted Runner with a ten-minute GTR outbound poller that deploys only the current `main` SHA after its GitHub Test push run succeeds.

**Architecture:** A trusted poller and atomic deployment script are installed under the GTR user's home and run from a hardened user-level systemd timer. The poller compares `origin/main` with local state, checks the exact SHA through GitHub's public Actions API, builds a clean checkout, and advances state only after a successful Docker deployment. GitHub retains hosted Test and Pages workflows but no longer has any execution path into GTR.

**Tech Stack:** Bash, Node.js `node:test`, Git, GitHub public REST API, npm/Node.js 24, Docker CLI, user-level systemd

## Global Constraints

- Poll interval: `OnUnitActiveSec=10min`; first activation: `OnBootSec=2min`; timer is persistent.
- Repository: `SongYuanKun/dev-tools-nav`; branch: `refs/heads/main`; Test workflow: `test.yml`; accepted event: `push`.
- No GitHub token, inbound port, SSH, self-hosted workflow, repository Runner, sudo, or system-level service.
- Trusted binaries: `~/.local/libexec/dev-tools-nav-deploy/poll-github-deploy.sh` and `deploy-1panel-local.sh`.
- State: `~/.local/state/dev-tools-nav-deploy/last-deployed-sha`; cache/lock/checkouts: `~/.cache/dev-tools-nav-deploy/`.
- Verification source: `~/.local/share/dev-tools-nav-verification`, directory `0700`, files `0600`; public copies are non-empty and `0644`.
- Production container: `1Panel-openresty-rRvM`; site base: `/www/sites/tools.songyuankun.top`.
- State advances only after the exact SHA passes hosted Test, all local gates pass, and production deployment succeeds.
- The approved design at `docs/superpowers/specs/2026-07-18-gtr-outbound-deployer-design.md` is authoritative.

---

### Task 1: Contain the public Runner while migration work proceeds

**Files:**
- No repository files change.
- External state: `github-actions-dev-tools-nav.service` becomes disabled/inactive; the GitHub Runner registration remains temporarily present and offline.

**Interfaces:**
- Consumes: current idle `gtr-dev-tools-nav` registration and user service.
- Produces: no executable public-PR path into GTR during implementation; production remains on the last successful static release.

- [ ] **Step 1: Verify no job is executing**

Run:

```bash
systemctl --user is-active github-actions-dev-tools-nav.service
gh api repos/SongYuanKun/dev-tools-nav/actions/runners \
  --jq '.runners[] | select(.name == "gtr-dev-tools-nav") | {status,busy}'
```

Expected: service `active`, Runner `online`, `busy=false`. If busy, wait for the current job to finish and repeat; do not stop an active job.

- [ ] **Step 2: Stop and disable the Runner service**

Run:

```bash
systemctl --user disable --now github-actions-dev-tools-nav.service
systemctl --user is-enabled github-actions-dev-tools-nav.service || test "$?" -eq 1
systemctl --user is-active github-actions-dev-tools-nav.service || test "$?" -eq 3
```

Expected: service is disabled and inactive.

- [ ] **Step 3: Verify GitHub reports the Runner offline**

Run:

```bash
for attempt in {1..30}; do
  status="$(gh api repos/SongYuanKun/dev-tools-nav/actions/runners \
    --jq '.runners[] | select(.name == "gtr-dev-tools-nav") | .status')"
  [[ "$status" == "offline" ]] && break
  sleep 2
done
[[ "$status" == "offline" ]]
```

Expected: exit `0`; do not unregister or delete files yet.

### Task 2: Harden the trusted atomic deployment engine

**Files:**
- Modify: `scripts/deploy-1panel-local.sh`
- Modify: `scripts/deploy-1panel-local.test.mjs`

**Interfaces:**
- Consumes: `SITE_SOURCE_DIR` (default repository root), Docker/container settings, and verification-source directory.
- Produces: deployment from an arbitrary clean checkout; non-empty verification-source selection; a verified target that cannot be rolled back because stale-old cleanup fails.

- [ ] **Step 1: Write failing regression tests**

Add four named tests with these exact fixtures and assertions:

- `deploys from SITE_SOURCE_DIR instead of the installed script directory`: copy the trusted script outside the fixture repo, set `SITE_SOURCE_DIR=repo`, and assert the new `index.html` contains the repo fixture value.
- `falls back from an empty live verification file to a non-empty host source`: truncate one live file, retain its non-empty host source, deploy, and assert the public copy equals the host fixture and has mode `0644`.
- `fails before switching when both verification sources are empty`: truncate both copies, assert nonzero exit, old marker content still active, and no marker/old/next residue.
- `keeps the verified target when old release cleanup fails`: inject failure only for the final `rm -rf .index-old`; assert zero exit, new marker content active, transaction marker absent, and no rollback attempt.

Extend the fake command layer with a deterministic final-old-cleanup failure. It must execute the real deployment script.

- [ ] **Step 2: Run RED**

Run: `node --test scripts/deploy-1panel-local.test.mjs`

Expected: the four new tests fail for missing `SITE_SOURCE_DIR`, empty-source acceptance, and rollback remaining armed during old cleanup.

- [ ] **Step 3: Implement the deployment changes**

Use this interface and ordering:

```bash
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${SITE_SOURCE_DIR:-$SCRIPT_ROOT}"
```

All artifact checks and rsync sources use `SOURCE_DIR`. For each verification file, use container `test -s` and host `[[ -s ... ]]`; after copying, require container `test -s "$NEXT/$filename"` and set `0644`.

After target verification, commit in this order:

```bash
rm -f "$marker"
committed=1
trap - EXIT
if ! rm -rf "$old"; then
  echo "Warning: verified release is active, but old cleanup failed: $old" >&2
fi
```

Old cleanup failure is a warning because the new target is already verified and rollback is no longer safe. A later deployment may retry stale-old cleanup.

- [ ] **Step 4: Verify and commit**

Run:

```bash
node --test scripts/deploy-1panel-local.test.mjs
npm test
bash -n scripts/deploy-1panel-local.sh
git diff --check
```

Expected: all commands exit `0`.

```bash
git add scripts/deploy-1panel-local.sh scripts/deploy-1panel-local.test.mjs
git commit -m "fix: harden trusted local deployment"
```

### Task 3: Build the exact-SHA outbound poller

**Files:**
- Create: `scripts/poll-github-deploy.sh`
- Create: `scripts/poll-github-deploy.test.mjs`

**Interfaces:**
- Consumes: `REMOTE_URL`, `API_BASE_URL`, `STATE_DIR`, `CACHE_DIR`, `DEPLOY_BIN`, and injectable command paths `GIT_BIN`, `CURL_BIN`, `PYTHON_BIN`, `NPM_BIN`, `FLOCK_BIN`.
- Produces: exit `0` with no work for unchanged/pending SHA; nonzero for malformed/network/build/deploy failures; atomically updated `last-deployed-sha` only after deployment.

- [ ] **Step 1: Write the poller contract tests**

Create a local bare Git remote with `main`, fake API/curl, npm, and deploy commands. Add these exact cases:

- `unchanged SHA does not query API, run npm, or deploy`: prewrite the remote SHA to state and assert all three logs remain absent.
- `pending, failed, non-push, and mismatched Test runs do not deploy`: use four API fixtures, assert zero exit, no npm/deploy log, and no state file.
- `successful exact-SHA push Test runs all gates in order and records state`: return a matching successful push run, assert the exact command log below, and assert state equals the SHA.
- `malformed API JSON fails without advancing state`: return invalid JSON, assert nonzero exit and no state.
- `checkout, npm, and deploy failures do not advance state`: inject each failure independently and assert nonzero exit plus unchanged state.
- `a held flock makes a concurrent invocation exit without work`: hold the lock with `flock`, run the poller, and assert zero exit with no API/npm/deploy log.
- `a branch race fails when fetched HEAD differs from the observed SHA`: advance the fixture branch after `ls-remote`, assert nonzero exit and unchanged state.

The success log must equal:

```text
npm:ci
npm:test
npm:run build
npm:run check:generated
deploy:<checkout-path>
```

- [ ] **Step 2: Run RED**

Run: `node --test scripts/poll-github-deploy.test.mjs`

Expected: FAIL because `scripts/poll-github-deploy.sh` does not exist.

- [ ] **Step 3: Implement the poller**

The script starts with:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-SongYuanKun/dev-tools-nav}"
REMOTE_URL="${REMOTE_URL:-https://github.com/SongYuanKun/dev-tools-nav.git}"
API_BASE_URL="${API_BASE_URL:-https://api.github.com}"
STATE_DIR="${STATE_DIR:-$HOME/.local/state/dev-tools-nav-deploy}"
CACHE_DIR="${CACHE_DIR:-$HOME/.cache/dev-tools-nav-deploy}"
DEPLOY_BIN="${DEPLOY_BIN:-$HOME/.local/libexec/dev-tools-nav-deploy/deploy-1panel-local.sh}"
GIT_BIN="${GIT_BIN:-git}"
CURL_BIN="${CURL_BIN:-curl}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
NPM_BIN="${NPM_BIN:-npm}"
FLOCK_BIN="${FLOCK_BIN:-flock}"
STATE_FILE="$STATE_DIR/last-deployed-sha"
LOCK_FILE="$CACHE_DIR/deploy.lock"
```

Create state/cache directories as `0700`, acquire non-blocking fd 9 lock, and parse only `refs/heads/main`. Validate SHA with `^[0-9a-f]{40}([0-9a-f]{24})?$`.

The quoted API URL is:

```bash
api_url="$API_BASE_URL/repos/$REPO/actions/workflows/test.yml/runs?branch=main&event=push&head_sha=$remote_sha&per_page=20"
```

Parse JSON with Python. Return `ready` only when a run has the same `head_sha`, `event == "push"`, and `conclusion == "success"`; return `pending` for valid JSON without such a run. Invalid JSON exits nonzero.

Checkout by fetching current `refs/heads/main` into a temporary Git repository, detach at `FETCH_HEAD`, then require `git rev-parse HEAD == remote_sha`. Run gates and deployment exactly in the tested order:

```bash
"$NPM_BIN" ci
"$NPM_BIN" test
"$NPM_BIN" run build
"$NPM_BIN" run check:generated
SITE_SOURCE_DIR="$checkout" "$DEPLOY_BIN"
```

Write state through `mktemp` plus `mv` only after deployment returns zero. Trap removes checkout and temporary state on every exit.

- [ ] **Step 4: Verify and commit**

Run:

```bash
node --test scripts/poll-github-deploy.test.mjs
npm test
bash -n scripts/poll-github-deploy.sh
git diff --check
```

Expected: all pass.

```bash
git add scripts/poll-github-deploy.sh scripts/poll-github-deploy.test.mjs
git commit -m "feat: add exact-SHA outbound deploy poller"
```

### Task 4: Package the hardened user service and installer

**Files:**
- Create: `ops/dev-tools-nav-deploy.service`
- Create: `ops/dev-tools-nav-deploy.timer`
- Create: `scripts/install-outbound-deployer.sh`
- Create: `scripts/outbound-deployer-config.test.mjs`

**Interfaces:**
- Consumes: trusted scripts from Tasks 2–3 and the existing verification-source directory.
- Produces: disabled but installed service/timer and trusted libexec copies; `daemon-reload` completed; no Runner or GitHub mutation.

- [ ] **Step 1: Write failing configuration tests**

Assert the unit templates and installer require:

```js
assert.match(timer, /OnBootSec=2min/);
assert.match(timer, /OnUnitActiveSec=10min/);
assert.match(timer, /Persistent=true/);
assert.match(service, /Type=oneshot/);
assert.match(service, /NoNewPrivileges=true/);
assert.match(service, /PrivateTmp=true/);
assert.match(service, /ProtectSystem=strict/);
assert.match(service, /ProtectHome=read-only/);
assert.match(service, /UMask=0077/);
assert.match(installer, /loginctl show-user "\$USER" -p Linger --value/);
assert.match(installer, /install -m 0755 scripts\/poll-github-deploy\.sh/);
assert.match(installer, /install -m 0755 scripts\/deploy-1panel-local\.sh/);
assert.doesNotMatch(installer, /enable --now|sudo|gh api/);
```

Add a temporary-home installer test with fake `systemctl`, `docker`, and commands. It verifies directory modes, byte-identical installed scripts/units, `daemon-reload`, and a disabled timer.

- [ ] **Step 2: Run RED**

Run: `node --test scripts/outbound-deployer-config.test.mjs`

Expected: FAIL because the three files do not exist.

- [ ] **Step 3: Implement service and timer**

`ops/dev-tools-nav-deploy.service`:

```ini
[Unit]
Description=Deploy dev-tools-nav after the exact GitHub Test succeeds
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=%h/.local/libexec/dev-tools-nav-deploy/poll-github-deploy.sh
Environment=HOME=%h
Environment=NPM_CONFIG_CACHE=%h/.cache/dev-tools-nav-deploy/npm
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=%h/.cache/dev-tools-nav-deploy %h/.local/state/dev-tools-nav-deploy
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
```

`ops/dev-tools-nav-deploy.timer`:

```ini
[Unit]
Description=Check dev-tools-nav main for a deployable SHA every ten minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
Persistent=true
Unit=dev-tools-nav-deploy.service

[Install]
WantedBy=timers.target
```

The installer uses `set -euo pipefail`, checks `Linger=yes` and required commands, creates libexec/cache/state/config directories with `0700`, installs scripts as `0755` and units as `0644`, verifies the two host verification files with `test -s`, runs `systemctl --user daemon-reload`, and asserts the timer is not active. It never enables the timer.

- [ ] **Step 4: Verify and commit**

Run:

```bash
node --test scripts/outbound-deployer-config.test.mjs
npm test
bash -n scripts/install-outbound-deployer.sh
systemd-analyze --user verify ops/dev-tools-nav-deploy.service ops/dev-tools-nav-deploy.timer
git diff --check
```

Expected: all pass.

```bash
git add ops/dev-tools-nav-deploy.service ops/dev-tools-nav-deploy.timer scripts/install-outbound-deployer.sh scripts/outbound-deployer-config.test.mjs
git commit -m "feat: package outbound deploy timer"
```

### Task 5: Remove the self-hosted workflow and rewrite operations documentation

**Files:**
- Delete: `.github/workflows/deploy-1panel.yml`
- Delete: `ops/github-actions-dev-tools-nav.service`
- Modify: `scripts/workflows.test.mjs`
- Modify: `scripts/generate-sitemap.test.mjs`
- Modify: `docs/deploy-1panel.md`
- Modify: `README.md`
- Modify: `manual.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: poller, installer, unit names, paths, and security rules from Tasks 2–4.
- Produces: no repository workflow can target GTR; one canonical outbound-deployment runbook.

- [ ] **Step 1: Change tests first**

Replace self-hosted workflow assertions with:

```js
assert.equal(existsSync(".github/workflows/deploy-1panel.yml"), false);
assert.equal(existsSync("ops/github-actions-dev-tools-nav.service"), false);
const activeWorkflowsAndSummaries = [
  readFileSync(".github/workflows/test.yml", "utf8"),
  readFileSync(".github/workflows/deploy-pages.yml", "utf8"),
  readFileSync("README.md", "utf8"),
  readFileSync("manual.md", "utf8"),
  readFileSync("docs/README.md", "utf8"),
].join("\n");
assert.doesNotMatch(activeWorkflowsAndSummaries, /self-hosted|gtr-dev-tools-nav|github-actions-dev-tools-nav|deploy-1panel\.yml/);
const runbook = readFileSync("docs/deploy-1panel.md", "utf8");
assert.match(runbook, /gtr-dev-tools-nav/); // exact legacy Runner removal target
assert.match(runbook, /config\.sh["']? remove --token/);
```

Require the runbook to contain the exact SHA/Test API, ten-minute timer, state path, offline Runner removal, oneshot trigger, and public endpoint verification. Change sitemap tests to require Pages build before publish and remove references to a second deployment workflow.

- [ ] **Step 2: Run RED**

Run: `node --test scripts/workflows.test.mjs scripts/generate-sitemap.test.mjs`

Expected: FAIL because the self-hosted workflow/service and old documentation still exist.

- [ ] **Step 3: Delete obsolete files and rewrite the runbook**

Use `apply_patch` to remove the workflow and old unit. Rewrite `docs/deploy-1panel.md` around:

- fixed paths and ten-minute timer;
- trusted local scripts versus untrusted checkout;
- install-disabled, initial-state recording, manual oneshot, enable timer;
- exact-SHA public Test API behavior and failure retry;
- user journal, timer/service/state diagnostics;
- verification-source provisioning and manual atomic deployment;
- exact Runner stop, temporary remove token, `config.sh remove`, credential-directory removal;
- production URL/404/container/state acceptance;
- upgrade by reinstalling reviewed local scripts and units, never by remote checkout;
- prohibition on re-registering a Runner while the repository is public.

README, manual, and docs index link to this runbook and describe Test/Pages plus GTR outbound deployment. They do not duplicate operational commands.

- [ ] **Step 4: Verify and commit**

Run:

```bash
node --test scripts/workflows.test.mjs scripts/generate-sitemap.test.mjs
npm test
rg -n 'self-hosted|gtr-dev-tools-nav|github-actions-dev-tools-nav|deploy-1panel\.yml' \
  .github README.md manual.md docs/README.md ops \
  --glob '!ops/dev-tools-nav-deploy.service' --glob '!ops/dev-tools-nav-deploy.timer'
git diff --check
```

Expected: tests pass; production-document `rg` has no matches.

```bash
git add -A .github/workflows ops scripts docs README.md manual.md
git commit -m "docs: migrate deployment to GTR outbound polling"
```

### Task 6: Install locally, unregister the Runner, push, and prove automatic deployment

**Files:**
- External install: `~/.local/libexec/dev-tools-nav-deploy/`, user units, cache/state.
- External removal: old Runner registration, service, unit, and credential directory.
- No new repository file changes expected.

**Interfaces:**
- Consumes: reviewed repository HEAD from Tasks 1–5 and the currently deployed SHA `06ea998b24fed5f278364237202619fb4121a09d`.
- Produces: enabled ten-minute timer, no GitHub Runner, target HEAD deployed and recorded, synchronized clean main.

- [ ] **Step 1: Run a clean-clone gate**

Create a temporary local clone that excludes ignored verification files, then run:

```bash
npm ci
npm test
npm run build
npm run check:generated
git diff --check
```

Expected: all pass and the temporary clone remains clean.

- [ ] **Step 2: Install trusted files with timer disabled**

Run from reviewed repository root:

```bash
./scripts/install-outbound-deployer.sh
systemctl --user is-active dev-tools-nav-deploy.timer && exit 1 || test "$?" -eq 3
cmp -s scripts/poll-github-deploy.sh "$HOME/.local/libexec/dev-tools-nav-deploy/poll-github-deploy.sh"
cmp -s scripts/deploy-1panel-local.sh "$HOME/.local/libexec/dev-tools-nav-deploy/deploy-1panel-local.sh"
```

Seed the current production state atomically:

```bash
state_dir="$HOME/.local/state/dev-tools-nav-deploy"
install -d -m 0700 "$state_dir"
state_tmp="$(mktemp "$state_dir/.last-deployed-sha.XXXXXX")"
printf '%s\n' 06ea998b24fed5f278364237202619fb4121a09d > "$state_tmp"
chmod 0600 "$state_tmp"
mv "$state_tmp" "$state_dir/last-deployed-sha"
```

- [ ] **Step 3: Permanently unregister the old Runner**

Run:

```bash
set -euo pipefail
runner_home="$HOME/.local/share/github-actions-runner/dev-tools-nav"
token=""
cleanup() { unset token; }
trap cleanup EXIT
systemctl --user disable --now github-actions-dev-tools-nav.service || true
for run_id in $(gh run list --repo SongYuanKun/dev-tools-nav --workflow deploy-1panel.yml \
  --status queued --limit 100 --json databaseId --jq '.[].databaseId'); do
  gh run cancel "$run_id" --repo SongYuanKun/dev-tools-nav
done
token="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/remove-token --jq .token)"
[[ -n "$token" ]]
"$runner_home/config.sh" remove --token "$token"
rm -f "$HOME/.config/systemd/user/github-actions-dev-tools-nav.service"
rm -rf "$runner_home"
systemctl --user daemon-reload
```

Verify the repository Runner API has no `gtr-dev-tools-nav`, and the old service is not found.

- [ ] **Step 4: Push without force and wait for hosted workflows**

Fetch and rebase if `origin/main` advanced; stop on conflict. Push normally. Record `HEAD_SHA`, then wait for exact-SHA Test and Pages runs to conclude `success`. Cancel any old queued `deploy-1panel.yml` runs again after the push. There must be no 1Panel workflow run for the new SHA.

- [ ] **Step 5: Trigger the first outbound deployment**

Run:

```bash
systemctl --user start dev-tools-nav-deploy.service
systemctl --user show dev-tools-nav-deploy.service -p Result -p ExecMainStatus
state_sha="$(tr -d '\n' < "$HOME/.local/state/dev-tools-nav-deploy/last-deployed-sha")"
[[ "$state_sha" == "$(git rev-parse HEAD)" ]]
```

Expected: service Result `success`, status `0`, and state equals HEAD.

- [ ] **Step 6: Enable timer and prove the no-op path**

Capture journal cursor/time, enable timer, then manually start the service once more. Verify logs say the SHA is already deployed and contain no npm/deploy invocation. Run:

```bash
systemctl --user enable --now dev-tools-nav-deploy.timer
systemctl --user is-enabled dev-tools-nav-deploy.timer
systemctl --user is-active dev-tools-nav-deploy.timer
systemctl --user list-timers dev-tools-nav-deploy.timer --no-pager
```

- [ ] **Step 7: Complete production acceptance**

Verify core production URLs and both verification URLs return 200/non-empty; `/content/` returns exactly 404; container has active `index` and no next/old/marker; Test and Pages succeeded for exact HEAD; Runner API has no target Runner; old service/home are absent; timer is enabled/active; state equals HEAD; local/remote main match and tracked worktree is clean.

Write the operational evidence to `.superpowers/sdd/outbound-final-report.md` without secrets or verification contents.
