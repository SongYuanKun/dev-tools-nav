import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TEST_PATH = ".github/workflows/test.yml";
const TEST_STEPS = [
  "Verify checkout SHA",
  "Run npm test",
  "Run npm run check:asset-versions",
  "Run npm run check:generated",
  "Check accessibility and performance baseline",
];

function succeeded(item) {
  return item?.status === "completed" && item.conclusion === "success";
}

function trustedRun(run, workflowId, repositoryId, sha) {
  return succeeded(run)
    && Number.isSafeInteger(run.id) && run.id > 0
    && Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0
    && run.workflow_id === workflowId
    && [TEST_PATH, `${TEST_PATH}@main`].includes(run.path)
    && run.repository?.id === repositoryId
    && run.head_repository?.id === repositoryId
    && run.head_branch === "main"
    && run.head_sha === sha
    && ["push", "workflow_dispatch"].includes(run.event);
}

async function hasSuccessfulUnit(run, request) {
  const jobList = await request(`/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
  if (!Array.isArray(jobList.jobs)) return false;
  const units = jobList.jobs.filter((job) => job?.name === "unit");
  const job = units[0];
  return units.length === 1 && succeeded(job)
    && job.run_id === run.id && job.head_sha === run.head_sha && job.head_branch === "main"
    && Array.isArray(job.steps)
    && TEST_STEPS.every((name) => job.steps.some((step) => step?.name === name && succeeded(step)));
}

export async function verifyPagesCandidate({ eventName, ref, sha, repositoryId, event }, request) {
  if (ref !== "refs/heads/main" || !/^[0-9a-f]{40}$/.test(sha) || !Number.isSafeInteger(repositoryId)) {
    return null;
  }

  let triggeringRun;
  if (eventName === "workflow_run") {
    triggeringRun = event?.workflow_run;
    if (triggeringRun?.head_sha !== sha || triggeringRun?.head_branch !== "main"
      || !Number.isSafeInteger(triggeringRun.id) || triggeringRun.id < 1) return null;
  } else if (eventName !== "workflow_dispatch") {
    return null;
  }

  const main = await request("/git/ref/heads/main");
  if (main.ref !== ref || main.object?.sha !== sha) return null;

  const workflow = await request("/actions/workflows/test.yml");
  if (workflow.path !== TEST_PATH || !Number.isSafeInteger(workflow.id) || workflow.id < 1) return null;

  let runs;
  if (triggeringRun) {
    if (!trustedRun(triggeringRun, workflow.id, repositoryId, sha)) return null;
    const run = await request(`/actions/runs/${triggeringRun.id}`);
    if (run.id !== triggeringRun.id || run.run_attempt !== triggeringRun.run_attempt
      || run.event !== triggeringRun.event) return null;
    runs = [run];
  } else {
    const runList = await request(`/actions/workflows/${workflow.id}/runs?branch=main&head_sha=${sha}&status=success&per_page=100`);
    if (!Array.isArray(runList.workflow_runs)) return null;
    runs = runList.workflow_runs;
  }

  for (const run of runs) {
    if (trustedRun(run, workflow.id, repositoryId, sha) && await hasSuccessfulUnit(run, request)) return sha;
  }
  return null;
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const repository = process.env.GITHUB_REPOSITORY;
  const request = async (path) => {
    const response = await fetch(`${process.env.GITHUB_API_URL}/repos/${repository}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "error",
    });
    if (!response.ok) throw new Error(`GitHub API request failed (${response.status}): ${path}`);
    return response.json();
  };

  const verifiedSha = await verifyPagesCandidate({
    eventName: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
    repositoryId: Number(process.env.GITHUB_REPOSITORY_ID),
    event,
  }, request);

  if (verifiedSha) appendFileSync(process.env.GITHUB_OUTPUT, `sha=${verifiedSha}\n`);
  else console.log("::notice::No full successful Test for the current main candidate. Skipping deployment.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
