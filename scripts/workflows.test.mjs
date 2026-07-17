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
  assert.match(onePanel, /concurrency:\s*\n\s+group: deploy-1panel\s*\n\s+cancel-in-progress: false/);
  assertExactDeployJob(onePanelWorkflow.jobs.deploy);
  assertNoSecretReferences(onePanelWorkflow);
  assert.doesNotMatch(onePanel, /pull_request:/);
});

test("deploy job exact contract rejects SSH command, extra step, and reusable workflow mutants", () => {
  const currentJob = parse(readFileSync(".github/workflows/deploy-1panel.yml", "utf-8")).jobs.deploy;
  assert.doesNotThrow(() => assertExactDeployJob(currentJob));

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
  assert.doesNotThrow(() => assertNoSecretReferences(parse("jobs:\n  deploy:\n    steps: []\n# secrets.DEPLOY_TOKEN")));
});

test("screenshot workflow builds generated assets before serving the site", () => {
  const workflow = readFileSync(".github/workflows/update-screenshots.yml", "utf-8");
  assertStepsInOrder(workflow, ["run: npm ci", "run: npm run build", "name: Capture screenshots"]);
});
