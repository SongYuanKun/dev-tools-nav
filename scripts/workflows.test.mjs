import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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

  const activeWorkflowsAndSummaries = [
    readFileSync(".github/workflows/test.yml", "utf8"),
    readFileSync(".github/workflows/deploy-pages.yml", "utf8"),
    readFileSync("README.md", "utf8"),
    readFileSync("manual.md", "utf8"),
    readFileSync("docs/README.md", "utf8"),
  ].join("\n");
  assert.doesNotMatch(activeWorkflowsAndSummaries, /self-hosted|gtr-dev-tools-nav|github-actions-dev-tools-nav|deploy-1panel\.yml/);

  const runbook = readFileSync("docs/deploy-1panel.md", "utf8");
  assert.match(runbook, /gtr-dev-tools-nav/);
  assert.match(runbook, /config\.sh["']? remove --token/);
  assert.match(runbook, /actions\/workflows\/test\.yml\/runs\?branch=main&event=push&head_sha=\$remote_sha/);
  assert.match(runbook, /OnCalendar=\*:0\/10/);
  assert.match(runbook, /\.local\/state\/dev-tools-nav-deploy\/last-deployed-sha/);
  assert.match(runbook, /offline/i);
  assert.match(runbook, /systemctl --user start dev-tools-nav-deploy\.service/);
  assert.match(runbook, /curl[^\n]*https:\/\/tools\.songyuankun\.top/);
});
