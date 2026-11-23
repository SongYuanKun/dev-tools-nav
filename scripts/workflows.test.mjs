import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

function readWorkflow(name) {
  return parse(readFileSync(`.github/workflows/${name}.yml`, "utf8"));
}

function assertStepsInOrder(workflow, steps) {
  let cursor = -1;
  for (const step of steps) {
    const next = workflow.indexOf(step, cursor + 1);
    assert.notEqual(next, -1, `missing workflow step: ${step}`);
    assert.ok(next > cursor, `${step} must follow the preceding build gate`);
    cursor = next;
  }
}

test("Test gates main pushes and dispatches with the complete unit suite", () => {
  const workflow = readFileSync(".github/workflows/test.yml", "utf-8");
  const config = parse(workflow);
  assert.deepEqual(config.on.push.branches, ["main"]);
  assert.ok(Object.hasOwn(config.on, "pull_request"));
  assert.equal(config.on.workflow_dispatch.inputs.expected_sha.required, true);
  assert.equal(config.jobs["changed-files"].if, "github.event_name == 'pull_request'");
  assert.match(config.jobs.unit.if, /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/);
  const checkout = config.jobs.unit.steps.find((step) => step.uses?.startsWith("actions/checkout@"));
  assert.equal(checkout.with.ref, "${{ github.sha }}");
  assert.match(workflow, /node-version: ["']24["']/);
  assert.match(workflow, /actions\/checkout@v6[\s\S]*?fetch-depth:\s*0/);
  assertStepsInOrder(workflow, ["name: Verify checkout SHA", "run: npm ci", "run: npx playwright install chromium --with-deps", "run: npm test", "run: npm run check:asset-versions", "run: npm run check:generated", "run: node scripts/a11y-performance-gate.mjs"]);
});

test("a stale or non-main Test dispatch is rejected before checkout", () => {
  const [gate, checkout] = readWorkflow("test").jobs.unit.steps;
  assert.equal(gate.if, "github.event_name == 'workflow_dispatch'");
  assert.match(checkout.uses, /^actions\/checkout@/);
  const sha = "a".repeat(40);
  const run = (ref, expected) => spawnSync("bash", ["-e", "-c", gate.run], {
    env: { ...process.env, GITHUB_REF: ref, GITHUB_SHA: sha, EXPECTED_SHA: expected },
  }).status;
  assert.equal(run("refs/heads/main", sha), 0);
  assert.equal(run("refs/heads/main", "b".repeat(40)), 1);
  assert.equal(run("refs/heads/topic", sha), 1);
});

test("both data sync workflows publish through the shared exact-SHA dispatch script", () => {
  for (const [workflow, file] of [["sync-csdn-rss", "csdn-articles.json"], ["sync-open-source-radar", "open-source-radar.json"]]) {
    const sync = readWorkflow(workflow).jobs.sync;
    assert.match(sync.if, /github\.ref == 'refs\/heads\/main'/);
    assert.deepEqual(sync.permissions, { contents: "write", actions: "write" });
    assert.equal(sync.steps[0].with.ref, "${{ github.sha }}");
    const publish = sync.steps.at(-1);
    assert.equal(publish.env.GH_TOKEN, "${{ github.token }}");
    assert.ok(publish.run.startsWith(`bash scripts/publish-sync-update.sh data/${file} `));
  }
});

test("Pages stages the verified commit and checks main again before deployment", () => {
  const config = readWorkflow("deploy-pages");
  assert.deepEqual(config.on, {
    workflow_dispatch: null,
    workflow_run: { workflows: ["Test"], types: ["completed"], branches: ["main"] },
  });
  assert.deepEqual(config.jobs.build.permissions, { actions: "read", contents: "read" });
  const steps = config.jobs.build.steps;
  const verify = steps.findIndex((step) => step.run === "node scripts/verify-pages-test.mjs");
  const assemble = steps.findIndex((step) => step.id === "assemble");
  assert.ok(verify >= 0 && assemble > verify);
  assert.equal(steps[assemble].if, "steps.verify.outputs.sha != ''");
  assert.equal(steps[assemble].env.ASSET_VERSION, "${{ steps.verify.outputs.sha }}");
  assert.match(steps[assemble].run, /git archive "\$CANDIDATE_SHA"/);
  assert.match(steps[assemble].run, /stamp-asset-version\.mjs/);
  assert.doesNotMatch(steps.map((step) => step.run).join("\n"), /npm run build|sync-csdn|generate-ai-changelog/);
  assert.equal(config.jobs.deploy.needs, "build");
  assert.equal(config.jobs.deploy.if, "needs.build.outputs.sha != ''");
  assert.equal(config.jobs.deploy.steps.at(-2).id, "current");
  assert.equal(config.jobs.deploy.steps.at(-1).if, "steps.current.outputs.ready == 'true'");
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
  assert.ok(activeWorkflowFiles.includes(".github/workflows/tool-submission.yml"));
  assert.doesNotMatch(activeWorkflowsUnitsAndSummaries, /self-hosted|gtr-dev-tools-nav|github-actions-dev-tools-nav|deploy-1panel\.yml/);

  const runbook = readFileSync("docs/deploy-1panel.md", "utf8");
  assert.match(runbook, /gtr-dev-tools-nav/);
  assert.match(runbook, /config\.sh["']? remove --token/);
  assert.match(runbook, /actions\/workflows\/test\.yml\/runs\?branch=main&head_sha=\$remote_sha/);
  assert.match(runbook, /OnCalendar=\*:0\/10/);
  assert.match(runbook, /\.local\/state\/dev-tools-nav-deploy\/last-deployed-sha/);
  assert.match(runbook, /offline/i);
  assert.match(runbook, /systemctl --user start dev-tools-nav-deploy\.service/);
  assert.match(runbook, /^VERIFICATION_SOURCE="\$HOME\/\.local\/share\/dev-tools-nav-verification"$/m);
  assert.doesNotMatch(runbook, /\$\{VERIFICATION_SOURCE_DIR:-|VERIFICATION_SOURCE_DIR=/);
  const manual = runbook.split("## 手动运行发布检查\n")[1]?.split("\n## ")[0];
  assert.match(manual, /systemctl --user start dev-tools-nav-deploy\.service/);
  assert.doesNotMatch(manual, /SITE_SOURCE_DIR=|deploy-1panel-local\.sh/);
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
  assert.match(runbook, /grep -F '__ASSET_VERSION__'/);
  assert.match(runbook, /stamp-asset-version\.mjs/);
  assert.match(runbook, /原子替换 5 个目标/);
  assert.match(runbook, /curl -sS -o \/dev\/null -w '%\{http_code\}' https:\/\/tools\.songyuankun\.top\/content\//);
  assert.doesNotMatch(runbook, /this-path-must-not-exist/);
  assert.match(runbook, /^curl -fsS https:\/\/tools\.songyuankun\.top\/baidu_verify_codeva-TByQYpVHM2\.html >\/dev\/null$/m);
  assert.match(runbook, /^curl -fsS https:\/\/tools\.songyuankun\.top\/googleb710668c9aa28d4e\.html >\/dev\/null$/m);
});
