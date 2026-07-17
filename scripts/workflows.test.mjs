import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const expectedDeployJob = {
  if: "github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'",
  "runs-on": ["self-hosted", "linux", "x64", "gtr"],
  steps: [
    {
      uses: "actions/checkout@v6",
      with: { "fetch-depth": 0 },
    },
    {
      uses: "actions/setup-node@v4",
      with: {
        "node-version": "24",
        cache: "npm",
      },
    },
    { run: "npm ci" },
    {
      name: "Generate AI topic changelog",
      run: "node scripts/generate-ai-changelog.mjs",
    },
    {
      name: "Refresh CSDN articles from RSS",
      env: { CSDN_RSS_URL: "https://blog.csdn.net/syk123839070/rss/list" },
      run: "python3 scripts/sync-csdn-rss.py",
    },
    { run: "npm run build" },
    { run: "npm run check:generated" },
    { run: "./scripts/deploy-1panel-local.sh" },
  ],
};

function assertExactDeployJob(job) {
  assert.deepEqual(job, expectedDeployJob);
}

function assertExactDeployWorkflow(workflow) {
  assert.deepEqual(Object.keys(workflow.jobs), ["deploy"]);
  assertExactDeployJob(workflow.jobs.deploy);
}

function assertNoSecretReferences(value, path = "workflow") {
  if (typeof value === "string") {
    assert.doesNotMatch(
      value,
      /\bsecrets\s*(?:\.\s*[a-z_][a-z0-9_]*|\[\s*(['"])[a-z_][a-z0-9_]*\1\s*\])/i,
      `${path} must not reference GitHub secrets`,
    );
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
  assert.match(onePanel, /concurrency:\s*\n\s+group: deploy-1panel\s*\n\s+cancel-in-progress: false/);
  assertExactDeployWorkflow(onePanelWorkflow);
  assertNoSecretReferences(onePanelWorkflow);
  assert.doesNotMatch(onePanel, /pull_request:/);
});

test("deploy workflow exact contract rejects extra jobs and mutated deploy jobs", () => {
  const currentWorkflow = parse(readFileSync(".github/workflows/deploy-1panel.yml", "utf-8"));
  const currentJob = currentWorkflow.jobs.deploy;
  assert.doesNotThrow(() => assertExactDeployWorkflow(currentWorkflow));
  assert.doesNotThrow(() => assertExactDeployJob(currentJob));

  const extraRemoteJob = structuredClone(currentWorkflow);
  extraRemoteJob.jobs.remote = { steps: [{ run: "ssh host" }] };
  assert.throws(() => assertExactDeployWorkflow(extraRemoteJob));

  const pipedSsh = structuredClone(currentJob);
  pipedSsh.steps[2].run = "echo ready | ssh host";
  assert.throws(() => assertExactDeployJob(pipedSsh));

  const extraSshStep = structuredClone(currentJob);
  extraSshStep.steps.push({ run: "ssh host" });
  assert.throws(() => assertExactDeployJob(extraSshStep));

  const reusableSshJob = { uses: "vendor/ssh-workflow.yml@v1" };
  assert.throws(() => assertExactDeployJob(reusableSshJob));
});

test("secret checks use parsed workflow values", () => {
  assert.throws(
    () => assertNoSecretReferences(parse(`jobs:\n  deploy:\n    env:\n      TOKEN: \${{ secrets.DEPLOY_TOKEN }}`)),
    /must not reference GitHub secrets/,
  );
  assert.throws(
    () => assertNoSecretReferences(parse(`jobs:\n  deploy:\n    env:\n      TOKEN: \${{ secrets['DEPLOY_TOKEN'] }}`)),
    /must not reference GitHub secrets/,
  );
  assert.throws(
    () => assertNoSecretReferences(parse(`jobs:\n  deploy:\n    env:\n      TOKEN: \${{ SeCrEtS [ 'DEPLOY_TOKEN' ] }}`)),
    /must not reference GitHub secrets/,
  );
  assert.doesNotThrow(() => assertNoSecretReferences(parse("description: This workflow uses no secrets for deployment")));
  assert.doesNotThrow(() => assertNoSecretReferences(parse("jobs:\n  deploy:\n    steps: []\n# secrets.DEPLOY_TOKEN")));
});

test("screenshot workflow builds generated assets before serving the site", () => {
  const workflow = readFileSync(".github/workflows/update-screenshots.yml", "utf-8");
  assertStepsInOrder(workflow, ["run: npm ci", "run: npm run build", "name: Capture screenshots"]);
});

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
