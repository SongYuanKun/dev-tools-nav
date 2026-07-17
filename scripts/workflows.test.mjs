import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const forbiddenSsh = /^\s*(?:-\s*uses:\s*\S*ssh\S*|(?:-\s*)?run:\s*[^\n]*\bssh\b|ssh\b)/im;

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
  assert.match(onePanel, /name: ["']?Deploy to 1Panel \(GTR self-hosted\)["']?/);
  assert.match(onePanel, /node-version: ["']24["']/);
  assert.match(onePanel, /runs-on:\s*\[self-hosted, linux, x64, gtr\]/);
  assert.match(onePanel, /concurrency:\s*\n\s+group: deploy-1panel\s*\n\s+cancel-in-progress: false/);
  assert.match(
    onePanel,
    /^\s*if:\s*(["'])?\s*(?:\$\{\{\s*)?github\.event_name\s*!=\s*["']workflow_run["']\s*\|\|\s*github\.event\.workflow_run\.conclusion\s*==\s*["']success["'](?:\s*\}\})?\s*\1\s*$/m,
  );
  assertStepsInOrder(onePanel, [
    "run: npm ci",
    "name: Generate AI topic changelog",
    "name: Refresh CSDN articles from RSS",
    "run: npm run build",
    "run: npm run check:generated",
    "run: ./scripts/deploy-1panel-local.sh",
  ]);
  assert.doesNotMatch(onePanel, /ubuntu-latest|ssh-keyscan|ssh-agent|rsync|ONEPANEL_/);
  assert.doesNotMatch(onePanel, forbiddenSsh);
  assert.doesNotMatch(onePanel, /\bsecrets\b/i);
  assert.doesNotMatch(onePanel, /pull_request:/);
});

test("remote SSH deployment syntax is rejected", () => {
  for (const unsafe of ["- run: ssh host command", "- uses: vendor/ssh-action@v1", "ssh host command"]) {
    assert.match(unsafe, forbiddenSsh);
  }
});

test("screenshot workflow builds generated assets before serving the site", () => {
  const workflow = readFileSync(".github/workflows/update-screenshots.yml", "utf-8");
  assertStepsInOrder(workflow, ["run: npm ci", "run: npm run build", "name: Capture screenshots"]);
});
