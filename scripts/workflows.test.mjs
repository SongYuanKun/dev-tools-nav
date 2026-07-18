import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

function assertStepsInOrder(workflow, steps) {
  let cursor = -1;
  for (const step of steps) {
    const next = workflow.indexOf(step, cursor + 1);
    assert.notEqual(next, -1, `missing workflow step: ${step}`);
    assert.ok(next > cursor, `${step} must follow the preceding build gate`);
    cursor = next;
  }
}

test("test workflow gates pushes and pull requests with npm ci and npm test", () => {
  const workflow = readFileSync(".github/workflows/test.yml", "utf-8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /node-version: ["']24["']/);
  assert.match(workflow, /actions\/checkout@v6[\s\S]*?fetch-depth:\s*0/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npx playwright install chromium --with-deps/);
  assert.match(workflow, /run: npm test/);
  assertStepsInOrder(workflow, ["run: npm ci", "run: npx playwright install chromium --with-deps", "run: npm test", "run: npm run check:generated"]);
});

test("Pages installs dependencies and builds before publishing", () => {
  const pages = readFileSync(".github/workflows/deploy-pages.yml", "utf-8");
  assert.match(pages, /node-version: ["']24["']/);
  assertStepsInOrder(pages, ["run: npm ci", "name: Refresh CSDN articles from RSS", "run: npm run build", "run: npm run check:generated", "name: Assemble site"]);
  assert.match(pages, /name: Assemble site[\s\S]*?--exclude='node_modules'[\s\S]*?\.\/ _site\//);

});

test("screenshot workflow builds generated assets before serving the site", () => {
  const workflow = readFileSync(".github/workflows/update-screenshots.yml", "utf-8");
  assertStepsInOrder(workflow, ["run: npm ci", "run: npm run build", "name: Capture screenshots"]);
});

test("deployment uses one outbound runbook and no repository Runner workflow", () => {
  assert.equal(existsSync(".github/workflows/deploy-1panel.yml"), false);
  assert.equal(existsSync("ops/github-actions-dev-tools-nav.service"), false);

  const activeWorkflowFiles = readdirSync(".github/workflows")
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => `.github/workflows/${name}`);
  const activeUnitFiles = readdirSync("ops")
    .filter((name) => /\.(?:service|timer)$/.test(name))
    .map((name) => `ops/${name}`);
  const activeWorkflowsUnitsAndSummaries = [
    ...activeWorkflowFiles.map((path) => readFileSync(path, "utf8")),
    ...activeUnitFiles.map((path) => readFileSync(path, "utf8")),
    readFileSync("README.md", "utf8"),
    readFileSync("manual.md", "utf8"),
    readFileSync("docs/README.md", "utf8"),
  ].join("\n");
  assert.doesNotMatch(activeWorkflowsUnitsAndSummaries, /self-hosted|gtr-dev-tools-nav|github-actions-dev-tools-nav|deploy-1panel\.yml/);

  const runbook = readFileSync("docs/deploy-1panel.md", "utf8");
  assert.match(runbook, /gtr-dev-tools-nav/);
  assert.match(runbook, /config\.sh["']? remove --token/);
  assert.match(runbook, /actions\/workflows\/test\.yml\/runs\?branch=main&event=push&head_sha=\$remote_sha/);
  assert.match(runbook, /OnCalendar=\*:0\/10/);
  assert.match(runbook, /\.local\/state\/dev-tools-nav-deploy\/last-deployed-sha/);
  assert.match(runbook, /offline/i);
  assert.match(runbook, /systemctl --user start dev-tools-nav-deploy\.service/);
  assert.match(runbook, /^VERIFICATION_SOURCE="\$HOME\/\.local\/share\/dev-tools-nav-verification"$/m);
  assert.doesNotMatch(runbook, /\$\{VERIFICATION_SOURCE_DIR:-|VERIFICATION_SOURCE_DIR=/);
  assertStepsInOrder(runbook, [
    "systemctl --user disable --now dev-tools-nav-deploy.timer",
    'SERVICE_STATE="$(systemctl --user is-active dev-tools-nav-deploy.service)"',
    'if [[ "$SERVICE_STATE" == "failed" ]]',
    "systemctl --user reset-failed dev-tools-nav-deploy.service",
    'SERVICE_STATE="$(systemctl --user is-active dev-tools-nav-deploy.service)"',
    '[[ "$service_status" -eq 3 && "$SERVICE_STATE" == "inactive" ]]',
    "npm ci",
    "npm test",
    "npm run build",
    "npm run check:generated",
    'exec 9>"$HOME/.cache/dev-tools-nav-deploy/deploy.lock"',
    "flock -n 9",
    'SITE_SOURCE_DIR="$PWD" "$HOME/.local/libexec/dev-tools-nav-deploy/deploy-1panel-local.sh"',
    "curl -fsS https://tools.songyuankun.top/ >/dev/null",
    "https://tools.songyuankun.top/content/",
    "systemctl --user enable --now dev-tools-nav-deploy.timer",
  ]);
  assert.match(runbook, /active.*activating|activating.*active/s);
  assert.match(runbook, /reloading.*deactivating|deactivating.*reloading/s);
  assert.match(runbook, /active\|activating\|reloading\|deactivating\)/);
  assert.match(runbook, /等待.*完成.*重试/);
  assert.doesNotMatch(runbook, /systemctl --user (?:stop|kill) dev-tools-nav-deploy\.service/);
  assert.doesNotMatch(runbook, /^\s*(?:\.\/deploy\.sh|\.\/scripts\/deploy-1panel-local\.sh)\s*$/m);
  assertStepsInOrder(runbook, [
    "systemctl --user disable --now github-actions-dev-tools-nav.service",
    'RUNNER_STATUS="$(gh api repos/SongYuanKun/dev-tools-nav/actions/runners',
    '[[ "$RUNNER_STATUS" == "offline" ]] ||',
    "gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/remove-token --jq .token",
    '[[ -n "$REMOVE_TOKEN" ]] ||',
    './config.sh remove --token "$REMOVE_TOKEN"',
    'RUNNER_MATCH="$(gh api repos/SongYuanKun/dev-tools-nav/actions/runners',
    '[[ -z "$RUNNER_MATCH" ]] ||',
    'rm -rf "$HOME/.local/share/github-actions-runner/dev-tools-nav"',
    'rm -f "$HOME/.config/systemd/user/github-actions-dev-tools-nav.service"',
  ]);
  assert.match(runbook, /^curl -fsS https:\/\/tools\.songyuankun\.top\/ >\/dev\/null$/m);
  assert.match(runbook, /curl -sS -o \/dev\/null -w '%\{http_code\}' https:\/\/tools\.songyuankun\.top\/content\//);
  assert.doesNotMatch(runbook, /this-path-must-not-exist/);
  assert.match(runbook, /^curl -fsS https:\/\/tools\.songyuankun\.top\/baidu_verify_codeva-TByQYpVHM2\.html >\/dev\/null$/m);
  assert.match(runbook, /^curl -fsS https:\/\/tools\.songyuankun\.top\/googleb710668c9aa28d4e\.html >\/dev\/null$/m);
});
