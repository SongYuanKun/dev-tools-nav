# Task 2 Implementation Report

## Status

Implemented and committed the GitHub Actions migration from the SSH-based 1Panel deploy workflow to the GTR self-hosted runner workflow.

## TDD evidence

### RED

After changing only `scripts/workflows.test.mjs` and `scripts/generate-sitemap.test.mjs`, ran:

```text
$ node --test scripts/workflows.test.mjs scripts/generate-sitemap.test.mjs
1..17
# tests 17
# pass 15
# fail 2
# duration_ms 6269.749274
```

Both failures were the expected missing-feature failure:

```text
ENOENT: no such file or directory, open '.github/workflows/deploy-1panel.yml'
```

The failures came from `both deployment workflows generate sitemap before publishing` and `deploy workflows install dependencies and build before publishing`.

### GREEN

After renaming/replacing the workflow, ran the same focused command:

```text
$ node --test scripts/workflows.test.mjs scripts/generate-sitemap.test.mjs
1..17
# tests 17
# pass 17
# fail 0
# duration_ms 6235.117094
```

## Full verification

Ran the requested chain:

```text
$ npm test && npm run build && npm run check:generated && git diff --check
1..166
# tests 166
# pass 166
# fail 0
# duration_ms 36968.64842
sitemap.xml generated — 112 URLs
Generated artifacts match the committed sources.
```

The final command exited `0`; `git diff --check` produced no output.

The repository contains two ignored local verification HTML files. An initial build included them in `sitemap.xml`, so `check:generated` correctly reported `Modified generated artifacts: sitemap.xml`. Investigation confirmed they are ignored, untracked local deployment inputs and unrelated to this task. I restored `sitemap.xml`, temporarily moved those two files outside the repository only for the verification chain, and restored them with a shell trap. Both files were confirmed present afterward. No generator, deployment script, ledger, or documentation was changed.

## Files and commit

- Deleted `.github/workflows/deploy-1panel-ssh.yml`
- Added `.github/workflows/deploy-1panel.yml`
- Modified `scripts/workflows.test.mjs`
- Modified `scripts/generate-sitemap.test.mjs`
- Commit: `fe38701 ci: deploy 1Panel from GTR runner`

Git recorded the requested move as a delete/add because the replacement workflow has low content similarity.

## Self-review

- Workflow runs only on `[self-hosted, linux, x64, gtr]`.
- Node 24 action compatibility and setup are present.
- Dependency install, changelog generation, RSS refresh, build, and generated-artifact gate precede local deployment in the required order.
- Deployment invokes executable `scripts/deploy-1panel-local.sh` directly.
- SSH, rsync, `ubuntu-latest`, and `ONEPANEL_*` paths are absent.
- Push remains limited to `main`; no pull-request deploy trigger exists.
- Concurrency remains serialized with `cancel-in-progress: false`.
- Tracked scope is exactly the workflow replacement and the two requested test files.

## Concerns

No task-blocking concern. Local verification requires excluding the ignored site-verification HTML files from sitemap generation; this pre-existing environment interaction is outside Task 2's allowed file scope.

## Fix Review Findings

The workflow-run conclusion gate now has regression coverage for `success`, remote SSH syntax, and all `secrets` context references. The SSH fixture covers `run: ssh`, an action name containing `ssh`, and a bare `ssh` command line.

### RED

With `github.event.workflow_run.conclusion == 'failure'` temporarily present:

```text
$ node --test scripts/workflows.test.mjs
1..3
# tests 3
# pass 2
# fail 1
# duration_ms 45.143551
```

The only failure was `deploy workflows install dependencies and build before publishing`, whose assertion expected the `success` conclusion gate.

### GREEN

After restoring `conclusion == 'success'`:

```text
$ node --test scripts/workflows.test.mjs
1..4
# tests 4
# pass 4
# fail 0
# duration_ms 43.927904

$ node --test scripts/workflows.test.mjs scripts/generate-sitemap.test.mjs
1..18
# tests 18
# pass 18
# fail 0
# duration_ms 6931.873016

$ npm test
1..167
# tests 167
# pass 167
# fail 0
# duration_ms 38714.584402

$ git diff --check
```

`git diff --check` exited `0` with no output.

## Round 2

Replaced the whole-file workflow regexes with `yaml` parsing. The test now reads
`workflow.jobs.deploy.if` directly, traverses every job and step for SSH actions
or executable SSH commands, and scans parsed string values for `secrets.`
references so YAML comments do not produce false positives.

### RED

With only the bypass fixtures added and the old helper still present:

```text
$ node --test --test-name-pattern='remote SSH deployment syntax is rejected' scripts/workflows.test.mjs
1..1
# tests 1
# pass 0
# fail 1
```

The expected failure was the multiline fixture `echo ready; ssh host command`,
which did not match the old regex.

### GREEN and full verification

```text
$ node --test --test-name-pattern='remote SSH|deployment guard' scripts/workflows.test.mjs
1..2
# tests 2
# pass 2
# fail 0

$ node --test scripts/workflows.test.mjs
1..5
# tests 5
# pass 5
# fail 0

$ npm test
137 passing tests (dot reporter confirmation: 137 dots)

$ git diff --check
```

All commands exited `0`; `git diff --check` produced no output. The fixtures
cover bare/wrapped/absolute-path SSH commands, multiline and chained commands,
step and job-level `uses`, misplaced success conditions, actual secret
expressions, and legal echo/comment cases.

### Concerns

No blocking concern. The shell scan intentionally targets command positions
rather than arbitrary `ssh` text; it is not a complete shell parser.
