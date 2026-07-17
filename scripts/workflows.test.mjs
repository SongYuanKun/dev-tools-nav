import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const deployCondition = "github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'";
const sshCommand = /(?:^|\n|;|&&|\|\|)\s*(?:(?:command|sudo|exec)\s+)*(?:\/usr\/bin\/)?ssh(?:\s|$)/i;

function assertDeployCondition(workflow) {
  assert.equal(workflow.jobs?.deploy?.if, deployCondition, "jobs.deploy must require a successful workflow_run");
}

function assertNoRemoteSsh(workflow) {
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    if (typeof job?.uses === "string") {
      assert.doesNotMatch(job.uses, /ssh/i, `${jobName} must not call an SSH reusable workflow`);
    }
    for (const [index, step] of (job?.steps ?? []).entries()) {
      if (typeof step?.uses === "string") {
        assert.doesNotMatch(step.uses, /ssh/i, `${jobName} step ${index + 1} must not use an SSH action`);
      }
      if (typeof step?.run === "string") {
        assert.doesNotMatch(step.run, sshCommand, `${jobName} step ${index + 1} must not execute ssh`);
      }
    }
  }
}

function assertNoSecretReferences(value, path = "workflow") {
  if (typeof value === "string") {
    assert.doesNotMatch(value, /\bsecrets\./i, `${path} must not reference GitHub secrets`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assertNoSecretReferences(child, `${path}.${key}`);
  }
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

test("deploy workflows install dependencies and build before publishing", () => {
  const pages = readFileSync(".github/workflows/deploy-pages.yml", "utf-8");
  assert.match(pages, /node-version: ["']24["']/);
  assertStepsInOrder(pages, ["run: npm ci", "name: Refresh CSDN articles from RSS", "run: npm run build", "run: npm run check:generated", "name: Assemble site"]);
  assert.match(pages, /name: Assemble site[\s\S]*?--exclude='node_modules'[\s\S]*?\.\/ _site\//);

  const onePanel = readFileSync(".github/workflows/deploy-1panel.yml", "utf-8");
  const onePanelWorkflow = parse(onePanel);
  assert.match(onePanel, /name: ["']?Deploy to 1Panel \(GTR self-hosted\)["']?/);
  assert.match(onePanel, /node-version: ["']24["']/);
  assert.match(onePanel, /runs-on:\s*\[self-hosted, linux, x64, gtr\]/);
  assert.match(onePanel, /concurrency:\s*\n\s+group: deploy-1panel\s*\n\s+cancel-in-progress: false/);
  assertDeployCondition(onePanelWorkflow);
  assertStepsInOrder(onePanel, [
    "run: npm ci",
    "name: Generate AI topic changelog",
    "name: Refresh CSDN articles from RSS",
    "run: npm run build",
    "run: npm run check:generated",
    "run: ./scripts/deploy-1panel-local.sh",
  ]);
  assert.doesNotMatch(onePanel, /ubuntu-latest|ssh-keyscan|ssh-agent|rsync|ONEPANEL_/);
  assertNoRemoteSsh(onePanelWorkflow);
  assertNoSecretReferences(onePanelWorkflow);
  assert.doesNotMatch(onePanel, /pull_request:/);
});

test("remote SSH deployment syntax is rejected", () => {
  for (const run of [
    "ssh host command",
    "command ssh host command",
    "sudo ssh host command",
    "exec ssh host command",
    "/usr/bin/ssh host command",
    "echo ready; ssh host command",
    "echo ready && ssh host command",
    "echo ready\nssh host command",
  ]) {
    assert.throws(() => assertNoRemoteSsh({ jobs: { deploy: { steps: [{ run }] } } }), /must not execute ssh/);
  }

  assert.throws(
    () => assertNoRemoteSsh({ jobs: { deploy: { steps: [{ uses: "vendor/ssh-action@v1" }] } } }),
    /must not use an SSH action/,
  );
  assert.throws(
    () => assertNoRemoteSsh({ jobs: { deploy: { uses: "vendor/ssh-workflow.yml@v1" } } }),
    /must not call an SSH reusable workflow/,
  );

  const safe = parse(`jobs:\n  deploy:\n    steps:\n      - run: echo "SSH is unavailable"\n# ssh host command\n# secrets.DEPLOY_KEY`);
  assert.doesNotThrow(() => assertNoRemoteSsh(safe));
  assert.doesNotThrow(() => assertNoSecretReferences(safe));
});

test("deployment guard and secret checks use parsed workflow values", () => {
  assert.throws(
    () => assertDeployCondition(parse(`jobs:\n  test:\n    if: ${deployCondition}\n  deploy:\n    if: always()`)),
    /jobs.deploy/,
  );
  assert.throws(
    () => assertNoSecretReferences(parse(`jobs:\n  deploy:\n    env:\n      TOKEN: \${{ secrets.DEPLOY_TOKEN }}`)),
    /must not reference GitHub secrets/,
  );
  assert.doesNotThrow(() => assertNoSecretReferences(parse("jobs:\n  deploy:\n    steps: []\n# secrets.DEPLOY_TOKEN")));
});

test("screenshot workflow builds generated assets before serving the site", () => {
  const workflow = readFileSync(".github/workflows/update-screenshots.yml", "utf-8");
  assertStepsInOrder(workflow, ["run: npm ci", "run: npm run build", "name: Capture screenshots"]);
});
