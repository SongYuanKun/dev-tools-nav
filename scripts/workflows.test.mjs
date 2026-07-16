import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

  const onePanel = readFileSync(".github/workflows/deploy-1panel-ssh.yml", "utf-8");
  assert.match(onePanel, /node-version: ["']24["']/);
  assertStepsInOrder(onePanel, ["run: npm ci", "name: Refresh CSDN articles from RSS", "run: npm run build", "run: npm run check:generated", "name: Sync site to temp dir"]);
  assert.match(onePanel, /name: Sync site to temp dir[\s\S]*?--exclude='node_modules'[\s\S]*?ONEPANEL_PATH/);
  assertStepsInOrder(onePanel, [
    "mkdir -p /www/sites/tools.songyuankun.top/.index-next",
    "docker cp $ONEPANEL_PATH/. 1Panel-openresty-rRvM:/www/sites/tools.songyuankun.top/.index-next/",
    "sh -ec",
    "mv \\\"\\$target\\\" \\\"\\$old\\\"",
    "if mv \\\"\\$next\\\" \\\"\\$target\\\"; then",
    "mv \\\"\\$old\\\" \\\"\\$target\\\"",
  ]);
  assert.doesNotMatch(onePanel, /find .*target.*-exec rm -rf/);
});

test("screenshot workflow builds generated assets before serving the site", () => {
  const workflow = readFileSync(".github/workflows/update-screenshots.yml", "utf-8");
  assertStepsInOrder(workflow, ["run: npm ci", "run: npm run build", "name: Capture screenshots"]);
});
