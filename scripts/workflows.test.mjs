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

function assertDeploymentVerificationContract(deployDoc) {
  assert.match(
    deployDoc,
    /^      gh run list --repo "\$REPO" --workflow "\$workflow" --branch main \\\n        --limit 50 --json databaseId,headSha \|\n        jq -r --arg sha "\$HEAD_SHA" 'map\(select\(\.headSha == \$sha\)\) \| \.\[0\]\.databaseId \/\/ empty'$/m,
  );
  assert.match(
    deployDoc,
    /^  done\n  \[\[ "\$run_id" =~ \^\[0-9\]\+\$ \]\] \|\| \{\n    echo [^\n]+ >&2\n    exit 1\n  \}$/m,
  );
  assert.match(deployDoc, /^\s*gh run watch "\$run_id" --repo "\$REPO" --exit-status$/m);
  assert.match(
    deployDoc,
    /^\s*conclusion="\$\(gh run view "\$run_id" --repo "\$REPO" --json conclusion --jq \.conclusion\)"$/m,
  );
  assert.match(
    deployDoc,
    /^\s*\[\[ "\$conclusion" == "success" \]\] \|\| \{ [^\n]* >&2; exit 1; \}$/m,
  );
}

function replaceRequiredFragment(value, fragment, replacement = "") {
  assert.ok(value.includes(fragment), `mutant fragment must exist: ${fragment}`);
  return value.replace(fragment, replacement);
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

test("deployment documentation is an executable GTR runner operations contract", () => {
  const deployDoc = readFileSync("docs/deploy-1panel.md", "utf-8");
  const readme = readFileSync("README.md", "utf-8");
  const manual = readFileSync("manual.md", "utf-8");
  const docsIndex = readFileSync("docs/README.md", "utf-8");
  const unit = readFileSync("ops/github-actions-dev-tools-nav.service", "utf-8");
  const wrapper = readFileSync("deploy.sh", "utf-8");
  const activeDeploymentFiles = [deployDoc, readme, manual, docsIndex, unit, wrapper].join("\n");

  assert.match(deployDoc, /gtr-dev-tools-nav/);
  assert.match(deployDoc, /github-actions-dev-tools-nav\.service/);
  assert.match(deployDoc, /scripts\/deploy-1panel-local\.sh/);
  assert.match(deployDoc, /actions-runner-linux-x64-2\.335\.1\.tar\.gz/);
  assert.match(deployDoc, /4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf/);
  assert.match(deployDoc, /set -euo pipefail/);
  assert.match(deployDoc, /trap cleanup EXIT/);
  assert.match(deployDoc, /rm -f "\$ARCHIVE_PATH"/);
  assert.match(deployDoc, /unset TOKEN/);
  assert.match(deployDoc, /Administration/);
  assert.match(deployDoc, /install -d -m 0700 "\$HOME\/\.config\/systemd\/user"/);
  assert.match(deployDoc, /install -m 0644 ops\/github-actions-dev-tools-nav\.service/);
  assert.match(deployDoc, /loginctl show-user "\$USER" -p Linger --value/);
  assert.match(deployDoc, /Linger[^\n]*yes/);
  assert.match(deployDoc, /gh run list[\s\S]*gh run watch/);
  assert.doesNotThrow(() => assertDeploymentVerificationContract(deployDoc));
  for (const [fragment, replacement = ""] of [
    [" // empty"],
    ['[[ "$run_id" =~ ^[0-9]+$ ]] || {'],
    ['    exit 1\n  }\n  gh run watch', '  }\n  gh run watch'],
    [" --exit-status"],
    [" --json conclusion"],
    ['[[ "$conclusion" == "success" ]] ||'],
    [" >&2; exit 1; }", " >&2; }"],
  ]) {
    const mutant = replaceRequiredFragment(deployDoc, fragment, replacement);
    assert.throws(
      () => assertDeploymentVerificationContract(mutant),
      undefined,
      `removing ${fragment} must violate the deployment verification contract`,
    );
  }
  assert.match(deployDoc, /HEAD_SHA="\$\(git rev-parse HEAD\)"/);
  assert.match(deployDoc, /export HEAD_SHA/);
  assert.match(deployDoc, /--json databaseId,headSha/);
  assert.match(deployDoc, /select\(\.headSha == \$sha\)/);
  assert.match(deployDoc, /for attempt in \{1\.\.30\}; do[\s\S]*sleep 5/);
  assert.match(deployDoc, /workflows=\(test\.yml deploy-pages\.yml deploy-1panel\.yml\)[\s\S]*for workflow in "\$\{workflows\[@\]\}"[\s\S]*--arg sha "\$HEAD_SHA"/);
  assert.doesNotMatch(deployDoc, /--limit 1 --json databaseId(?:\s|$)/);
  assert.match(deployDoc, /content_status=.*%\{http_code\}/);
  assert.match(deployDoc, /\[\[ "\$content_status" == "404" \]\]/);
  assert.match(deployDoc, /baidu_verify_codeva-TByQYpVHM2\.html/);
  assert.match(deployDoc, /googleb710668c9aa28d4e\.html/);
  assert.match(deployDoc, /\.deploy-in-progress/);
  assert.match(deployDoc, /if \[ -d "\$old" \]/);
  assert.match(deployDoc, /journalctl --user -u github-actions-dev-tools-nav\.service/);
  assert.match(deployDoc, /docker info/);
  assert.match(deployDoc, /默认自动更新已启用/);
  assert.match(deployDoc, /repos\/actions\/runner\/releases\/latest/);
  assert.match(deployDoc, /\.digest/);
  assert.match(deployDoc, /chmod 700 "\$BACKUP"/);
  assert.match(deployDoc, /mv "\$BACKUP" "\$RUNNER_HOME"/);
  assert.match(deployDoc, /SERVICE_STOPPED=1/);
  assert.match(deployDoc, /elif \[\[ "\$status" -ne 0 && "\$SERVICE_STOPPED" -eq 1 \]\][\s\S]*systemctl --user start "\$SERVICE"/);
  assert.doesNotMatch(deployDoc, /--disableupdate|TBD|占位 SHA/);
  assert.match(unit, /WorkingDirectory=%h\/\.local\/share\/github-actions-runner\/dev-tools-nav/);
  assert.match(unit, /ExecStart=%h\/\.local\/share\/github-actions-runner\/dev-tools-nav\/run\.sh/);
  assert.match(wrapper, /exec .*scripts\/deploy-1panel-local\.sh/);
  assert.doesNotMatch(activeDeploymentFiles, /ONEPANEL_SSH_KEY|ssh-keyscan|deploy-1panel-ssh|1Panel SSH|\/opt\/1panel\/www\/sites\/tools\.songyuankun\.top\/index|三套部署 manifest/);
  assert.match(readme, /deploy-1panel\.yml/);
  assert.match(readme, /deploy\.sh[^\n]*兼容/);
  assert.match(manual, /Deploy to 1Panel/);
  assert.match(docsIndex, /GTR 自托管 Runner/);
});
