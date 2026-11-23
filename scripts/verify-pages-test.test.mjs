import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { verifyPagesCandidate } from "./verify-pages-test.mjs";

const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const ref = "refs/heads/main";
const testPath = ".github/workflows/test.yml";
const jobPath = "/actions/runs/101/attempts/2/jobs?per_page=100";
const manualPath = `/actions/workflows/23/runs?branch=main&head_sha=${sha}&status=success&per_page=100`;
const success = { status: "completed", conclusion: "success" };
const trusted = {
  ...success,
  id: 101,
  run_attempt: 2,
  workflow_id: 23,
  path: `${testPath}@main`,
  repository: { id: 42 },
  head_repository: { id: 42 },
  head_branch: "main",
  head_sha: sha,
  event: "push",
};
const unit = {
  ...success,
  name: "unit",
  run_id: trusted.id,
  head_sha: sha,
  head_branch: "main",
  steps: [
    "Verify checkout SHA",
    "Run npm test",
    "Run npm run check:asset-versions",
    "Run npm run check:generated",
    "Check accessibility and performance baseline",
  ].map((name) => ({ name, ...success })),
};

function verify({
  eventName = "workflow_run",
  eventRun = trusted,
  apiRun = eventRun,
  jobs = [unit],
  manualRuns = [apiRun],
  mainSha = sha,
  eventSha = sha,
  eventRef = ref,
} = {}) {
  const responses = {
    "/git/ref/heads/main": { ref, object: { sha: mainSha } },
    "/actions/workflows/test.yml": { id: 23, path: testPath },
    "/actions/runs/101": apiRun,
    [jobPath]: { jobs },
    [manualPath]: { workflow_runs: manualRuns },
  };
  return verifyPagesCandidate({
    eventName,
    ref: eventRef,
    sha: eventSha,
    repositoryId: 42,
    event: { workflow_run: eventRun },
  }, async (path) => {
    assert.ok(Object.hasOwn(responses, path), `unexpected GitHub API request: ${path}`);
    return responses[path];
  });
}

test("Pages accepts full trusted Test attempts from main pushes and sync dispatches", async () => {
  assert.equal(await verify(), sha);
  assert.equal(await verify({
    eventRun: { ...trusted, event: "workflow_dispatch", path: testPath },
  }), sha);
});

test("Pages rejects workflow candidates from other workflows, repos, branches, or attempts", async () => {
  const fakeRuns = [
    { workflow_id: 24 },
    { path: ".github/workflows/lookalike.yml@main" },
    { repository: { id: 43 } },
    { head_repository: { id: 43 } },
    { head_branch: "untrusted" },
    { event: "pull_request" },
    { status: "in_progress" },
    { conclusion: "failure" },
  ];
  for (const fake of fakeRuns) {
    assert.equal(await verify({ eventRun: { ...trusted, ...fake } }), null);
    assert.equal(await verify({ apiRun: { ...trusted, ...fake } }), null);
  }
  assert.equal(await verify({ apiRun: { ...trusted, run_attempt: 3 } }), null);
});

test("workflow success does not release Pages without the actual unit and every required step", async () => {
  assert.equal(await verify({ jobs: [] }), null);
  assert.equal(await verify({ jobs: [{ ...unit, conclusion: "skipped" }] }), null);
  assert.equal(await verify({ jobs: [{ ...unit, run_id: 102 }] }), null);
  assert.equal(await verify({ jobs: [{ ...unit, head_sha: otherSha }] }), null);
  assert.equal(await verify({ jobs: [{ ...unit, steps: unit.steps.slice(1) }] }), null);
  assert.equal(await verify({ jobs: [{ ...unit, steps: unit.steps.slice(0, -1) }] }), null);
  const skipped = unit.steps.map((step, i) => i === 2 ? { ...step, conclusion: "skipped" } : step);
  assert.equal(await verify({ jobs: [{ ...unit, steps: skipped }] }), null);
});

test("Pages manual dispatch uses the same exact main gate", async () => {
  const eventName = "workflow_dispatch";
  assert.equal(await verify({ eventName }), sha);
  assert.equal(await verify({ eventName, eventRef: "refs/heads/feature" }), null);
  assert.equal(await verify({ eventName, manualRuns: [] }), null);
  assert.equal(await verify({ eventName, manualRuns: [{ ...trusted, head_sha: otherSha }] }), null);
  assert.equal(await verify({ eventName, jobs: [] }), null);
  assert.equal(await verify({ eventName: "push" }), null);
});

test("Pages rejects main movement before verification or immediately before deploy", async (t) => {
  assert.equal(await verify({ mainSha: otherSha }), null);
  assert.equal(await verify({ eventSha: otherSha }), null);
  const workflow = parse(readFileSync(".github/workflows/deploy-pages.yml", "utf8"));
  const current = workflow.jobs.deploy.steps.find((step) => step.id === "current");
  const directory = mkdtempSync(join(tmpdir(), "pages-gate-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  for (const [index, apiSha, eventSha, mayDeploy] of [
    [0, otherSha, sha, false],
    [1, sha, otherSha, false],
    [2, sha, sha, true],
  ]) {
    const output = join(directory, String(index));
    const result = spawnSync("bash", ["-c", 'gh() { printf "%s\\n" "$MOCK_MAIN"; }\n' + current.run], {
      encoding: "utf8",
      env: {
        ...process.env,
        CANDIDATE_SHA: sha,
        GITHUB_OUTPUT: output,
        GITHUB_SHA: eventSha,
        GITHUB_REPOSITORY: "owner/repo",
        MOCK_MAIN: apiSha,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    if (mayDeploy) assert.equal(readFileSync(output, "utf8"), "ready=true\n");
    else assert.throws(() => readFileSync(output, "utf8"), { code: "ENOENT" });
  }
  const deploy = workflow.jobs.deploy.steps.find((step) => step.id === "deployment");
  assert.equal(deploy.if, "steps.current.outputs.ready == 'true'");
});
