import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const poller = path.resolve('scripts/poll-github-deploy.sh');
const realGit = spawnSync('command', ['-v', 'git'], { encoding: 'utf8', shell: true }).stdout.trim();
const realPython = spawnSync('command', ['-v', 'python3'], { encoding: 'utf8', shell: true }).stdout.trim();
const realFlock = spawnSync('command', ['-v', 'flock'], { encoding: 'utf8', shell: true }).stdout.trim();
const repository = { id: 123, full_name: 'example/project' };
const requiredSteps = [
  'Verify checkout SHA',
  'Run npm test',
  'Run npm run check:asset-versions',
  'Run npm run check:generated',
  'Check accessibility and performance baseline',
];
const advanceMain = [
  'printf "race\\n" >> "$SOURCE_REPO/race.txt"',
  '"$REAL_GIT" -C "$SOURCE_REPO" add race.txt',
  '"$REAL_GIT" -C "$SOURCE_REPO" commit -m race >/dev/null',
  '"$REAL_GIT" -C "$SOURCE_REPO" push origin main >/dev/null',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

function executable(file, body) {
  writeFileSync(file, `#!/usr/bin/env bash\nset -euo pipefail\n${body}`);
  chmodSync(file, 0o755);
}

function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'outbound-poller-'));
  const remote = path.join(root, 'remote.git');
  const source = path.join(root, 'source');
  const bin = path.join(root, 'bin');
  const state = path.join(root, 'state');
  const cache = path.join(root, 'cache');
  const commandLog = path.join(root, 'commands.log');
  const curlLog = path.join(root, 'curl.log');
  const apiFixture = path.join(root, 'api.json');
  const jobsFixtures = path.join(root, 'jobs');
  const gitFetchMarker = path.join(root, 'git-fetch.marker');
  mkdirSync(source);
  mkdirSync(bin);
  mkdirSync(jobsFixtures);
  run(realGit, ['init', '--bare', remote]);
  run(realGit, ['init', '-b', 'main'], { cwd: source });
  run(realGit, ['config', 'user.email', 'poller@example.test'], { cwd: source });
  run(realGit, ['config', 'user.name', 'Poller Test'], { cwd: source });
  writeFileSync(path.join(source, 'package.json'), '{"private":true}\n');
  run(realGit, ['add', 'package.json'], { cwd: source });
  run(realGit, ['commit', '-m', 'initial'], { cwd: source });
  run(realGit, ['remote', 'add', 'origin', remote], { cwd: source });
  run(realGit, ['push', '-u', 'origin', 'main'], { cwd: source });
  const sha = run(realGit, ['rev-parse', 'HEAD'], { cwd: source });

  const curl = path.join(bin, 'curl');
  executable(curl, [
    'printf "%s\\n" "$*" >> "$CURL_LOG"',
    '[[ "${CURL_FAIL:-0}" != 1 ]] || exit 28',
    'url="${!#}"',
    'if [[ "$url" =~ /actions/runs/([0-9]+)/attempts/([0-9]+)/jobs ]]; then',
    '  cat "$JOBS_FIXTURES/${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.json"',
    'else',
    '  cat "$API_FIXTURE"',
    'fi',
  ].join('\n'));
  const npm = path.join(bin, 'npm');
  executable(npm, [
    'printf "npm:%s\\n" "$*" >> "$COMMAND_LOG"',
    'if [[ "${ASSERT_FULL_HISTORY:-0}" == 1 && "$*" == ci ]]; then',
    '  commit_count=$("$REAL_GIT" rev-list --count HEAD)',
    '  [[ "$commit_count" -ge 2 ]] || { printf "expected full history, found %s commit(s)\\n" "$commit_count" >&2; exit 43; }',
    'fi',
    'if [[ "${FAIL_NPM:-}" == "$*" ]]; then exit 41; fi',
    'if [[ "${RACE_DURING_NPM:-0}" == 1 && "$*" == "run check:generated" ]]; then',
    ...advanceMain,
    'fi',
  ].join('\n'));
  const deploy = path.join(bin, 'deploy');
  executable(deploy, [
    'printf "deploy:%s RELEASE_SHA=%s\\n" "$SITE_SOURCE_DIR" "$RELEASE_SHA" >> "$COMMAND_LOG"',
    '[[ "$RELEASE_SHA" == "$("$REAL_GIT" -C "$SITE_SOURCE_DIR" rev-parse HEAD)" ]]',
    '[[ "${FAIL_DEPLOY:-0}" != 1 ]]',
  ].join('\n'));
  const git = path.join(bin, 'git');
  executable(git, [
    'if [[ "${1:-}" == ls-remote && -n "${LS_REMOTE_OUTPUT:-}" ]]; then printf "%s\\n" "$LS_REMOTE_OUTPUT"; exit 0; fi',
    'if [[ "${1:-}" == fetch ]]; then touch "$GIT_FETCH_MARKER"; fi',
    'if [[ "${FAIL_GIT_FETCH:-0}" == 1 && "${1:-}" == fetch ]]; then exit 42; fi',
    'if [[ "${RACE_AFTER_LS_REMOTE:-0}" == 1 && "${1:-}" == ls-remote ]]; then',
    '  output=$("$REAL_GIT" "$@")',
    ...advanceMain,
    '  printf "%s\\n" "$output"',
    '  exit 0',
    'fi',
    'exec "$REAL_GIT" "$@"',
  ].join('\n'));

  function invoke(extraEnv = {}, args = []) {
    return spawnSync('bash', [poller, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        REPO: 'example/project',
        REMOTE_URL: remote,
        API_BASE_URL: 'https://api.example.test',
        STATE_DIR: state,
        CACHE_DIR: cache,
        DEPLOY_BIN: deploy,
        GIT_BIN: git,
        CURL_BIN: curl,
        PYTHON_BIN: realPython,
        NPM_BIN: npm,
        FLOCK_BIN: realFlock,
        API_FIXTURE: apiFixture,
        JOBS_FIXTURES: jobsFixtures,
        CURL_LOG: curlLog,
        COMMAND_LOG: commandLog,
        REAL_GIT: realGit,
        SOURCE_REPO: source,
        GIT_FETCH_MARKER: gitFetchMarker,
        ...extraEnv,
      },
    });
  }

  return {
    root, remote, source, state, cache, commandLog, curlLog, apiFixture, jobsFixtures, gitFetchMarker, sha, invoke,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function setRuns(fixture, runs) {
  writeFileSync(fixture.apiFixture, JSON.stringify({ workflow_runs: runs }));
}

function setJobs(fixture, jobs, id = 100, attempt = 2) {
  writeFileSync(path.join(fixture.jobsFixtures, `${id}.${attempt}.json`), JSON.stringify({ jobs }));
}

function testRun(sha, fields = {}) {
  return {
    path: '.github/workflows/test.yml@main', repository, head_repository: repository,
    id: 100, run_attempt: 2, head_sha: sha, head_branch: 'main', event: 'push',
    status: 'completed', conclusion: 'success', ...fields,
  };
}

function unitJob(sha, fields = {}) {
  return {
    name: 'unit', run_id: 100, head_sha: sha, head_branch: 'main',
    status: 'completed', conclusion: 'success',
    steps: requiredSteps.map((name) => ({ name, status: 'completed', conclusion: 'success' })),
    ...fields,
  };
}

function setSuccessfulTest(fixture, sha = fixture.sha, fields = {}) {
  setRuns(fixture, [testRun(sha, fields)]);
  setJobs(fixture, [unitJob(sha)]);
}

function assertNoWork(fixture) {
  assert.equal(existsSync(fixture.commandLog), false, 'npm or deploy ran');
}

test('unchanged SHA does not query API, run npm, or deploy', () => {
  const f = makeFixture();
  try {
    mkdirSync(f.state, { recursive: true });
    writeFileSync(path.join(f.state, 'last-deployed-sha'), `${f.sha}\n`);
    const result = f.invoke();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'SHA is already deployed; no work required.\n');
    assert.equal(existsSync(f.curlLog), false, 'API was queried');
    assertNoWork(f);
  } finally { f.cleanup(); }
});

test('pending, failed or untrusted Test runs do not deploy', async (t) => {
  const cases = {
    pending: { status: 'in_progress', conclusion: null },
    failed: { conclusion: 'failure' },
    skipped: { conclusion: 'skipped' },
    'PR event': { event: 'pull_request' },
    'different SHA': { head_sha: 'f'.repeat(40) },
    'different branch': { head_branch: 'feature' },
    'different workflow path': { path: '.github/workflows/untrusted.yml' },
    'different workflow ref': { path: '.github/workflows/test.yml@feature' },
    'different repository': { repository: { ...repository, full_name: 'other/project' } },
    'fork head': { head_repository: { ...repository, id: 456, full_name: 'other/project' } },
    'missing attempt': { run_attempt: null },
  };
  for (const [name, fields] of Object.entries(cases)) {
    await t.test(name, () => {
      const f = makeFixture();
      try {
        setRuns(f, [testRun(f.sha, fields)]);
        const result = f.invoke();
        assert.equal(result.status, 0, result.stderr);
        assertNoWork(f);
        assert.doesNotMatch(readFileSync(f.curlLog, 'utf8'), /\/jobs/);
        assert.equal(existsSync(path.join(f.state, 'last-deployed-sha')), false);
      } finally { f.cleanup(); }
    });
  }
});

test('successful exact-SHA push Test runs all gates in order and records state', () => {
  const f = makeFixture();
  try {
    setSuccessfulTest(f);
    const result = f.invoke();
    assert.equal(result.status, 0, result.stderr);
    const lines = readFileSync(f.commandLog, 'utf8').trim().split('\n');
    assert.equal(lines.length, 5, 'unexpected extra gate or deploy command');
    assert.deepEqual(lines.slice(0, 4), ['npm:ci', 'npm:test', 'npm:run build', 'npm:run check:generated']);
    assert.match(lines[4], /^deploy:\/.*\/checkout\.[^/]+ RELEASE_SHA=[0-9a-f]{40}$/);
    const deployedCheckout = lines[4].replace(/^deploy:(\/\S+) RELEASE_SHA=.+$/, '$1');
    assert.equal(existsSync(deployedCheckout), false, 'successful checkout was not cleaned');
    assert.equal(lines[4].includes(`RELEASE_SHA=${f.sha}`), true);
    assert.equal(readFileSync(path.join(f.state, 'last-deployed-sha'), 'utf8').trim(), f.sha);
    const curlArgs = readFileSync(f.curlLog, 'utf8');
    assert.match(curlArgs, new RegExp(`https://api\\.example\\.test/repos/example/project/actions/workflows/test\\.yml/runs\\?branch=main&head_sha=${f.sha}&status=success&per_page=20`));
    assert.match(curlArgs, /\/actions\/runs\/100\/attempts\/2\/jobs\?per_page=100/);
    assert.doesNotMatch(curlArgs, /authorization|token/i);
  } finally { f.cleanup(); }
});

test('workflow dispatch can release main only if its exact attempt ran the complete unit job', () => {
  const f = makeFixture();
  try {
    setRuns(f, [testRun(f.sha, { event: 'workflow_dispatch' })]);
    setJobs(f, [unitJob(f.sha)], 100, 1);
    setJobs(f, []);
    assert.equal(f.invoke().status, 0);
    assertNoWork(f);

    setJobs(f, [unitJob(f.sha)]);
    const result = f.invoke();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(f.state, 'last-deployed-sha'), 'utf8').trim(), f.sha);
    assert.doesNotMatch(readFileSync(f.curlLog, 'utf8'), /attempts\/1\/jobs/);
  } finally { f.cleanup(); }
});

test('an overall success does not qualify a missing, incomplete or mismatched unit', async (t) => {
  const cases = {
    missing: () => [],
    renamed: (sha) => [unitJob(sha, { name: 'other' })],
    skipped: (sha) => [unitJob(sha, { conclusion: 'skipped' })],
    pending: (sha) => [unitJob(sha, { status: 'in_progress' })],
    'incorrect SHA': (sha) => [unitJob(sha, { head_sha: 'f'.repeat(40) })],
    'incorrect run': (sha) => [unitJob(sha, { run_id: 200 })],
    'missing checkout verification': (sha) => {
      const job = unitJob(sha);
      return [{ ...job, steps: job.steps.filter((step) => step.name !== 'Verify checkout SHA') }];
    },
    'missing accessibility step': (sha) => {
      const job = unitJob(sha);
      job.steps.pop();
      return [job];
    },
    'skipped generated artifacts step': (sha) => {
      const job = unitJob(sha);
      job.steps.find((step) => step.name === 'Run npm run check:generated').conclusion = 'skipped';
      return [job];
    },
  };
  for (const [name, jobs] of Object.entries(cases)) {
    await t.test(name, () => {
      const f = makeFixture();
      try {
        setRuns(f, [testRun(f.sha)]);
        setJobs(f, jobs(f.sha));
        const result = f.invoke();
        assert.equal(result.status, 0, result.stderr);
        assertNoWork(f);
        assert.equal(existsSync(path.join(f.state, 'last-deployed-sha')), false);
      } finally { f.cleanup(); }
    });
  }
});

test('successful gates run from a checkout with the full reachable main history', () => {
  const f = makeFixture();
  try {
    writeFileSync(path.join(f.source, 'second.txt'), 'second commit\n');
    run(realGit, ['add', 'second.txt'], { cwd: f.source });
    run(realGit, ['commit', '-m', 'second'], { cwd: f.source });
    run(realGit, ['push', 'origin', 'main'], { cwd: f.source });
    const secondSha = run(realGit, ['rev-parse', 'HEAD'], { cwd: f.source });
    setSuccessfulTest(f, secondSha);

    const result = f.invoke({ ASSERT_FULL_HISTORY: '1' });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(f.state, 'last-deployed-sha'), 'utf8').trim(), secondSha);
  } finally { f.cleanup(); }
});

test('malformed API JSON fails without advancing state', () => {
  const f = makeFixture();
  try {
    writeFileSync(f.apiFixture, 'SECRET_API_BODY:not-json');
    const result = f.invoke();
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(path.join(f.state, 'last-deployed-sha')), false);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /SECRET_API_BODY/);
  } finally { f.cleanup(); }
});

test('a curl network failure fails without advancing state or running gates', () => {
  const f = makeFixture();
  try {
    const previousSha = '0'.repeat(40);
    mkdirSync(f.state, { recursive: true });
    writeFileSync(path.join(f.state, 'last-deployed-sha'), `${previousSha}\n`);
    const result = f.invoke({ CURL_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(path.join(f.state, 'last-deployed-sha'), 'utf8').trim(), previousSha);
    assertNoWork(f);
  } finally { f.cleanup(); }
});

test('remote SHA parsing accepts lowercase 40/64 hex and rejects ambiguous lines', async (t) => {
  const accepted64 = 'a'.repeat(64);
  await t.test('64-character SHA', () => {
    const f = makeFixture();
    try {
      setRuns(f, []);
      const result = f.invoke({ LS_REMOTE_OUTPUT: `${accepted64}\trefs/heads/main` });
      assert.equal(result.status, 0, result.stderr);
      assert.match(readFileSync(f.curlLog, 'utf8'), new RegExp(`head_sha=${accepted64}`));
      assertNoWork(f);
    } finally { f.cleanup(); }
  });

  const rejected = {
    uppercase: `${'A'.repeat(40)}\trefs/heads/main`,
    invalid: `${'g'.repeat(40)}\trefs/heads/main`,
    'wrong width': `${'a'.repeat(41)}\trefs/heads/main`,
    'wrong ref': `${'a'.repeat(40)}\trefs/heads/release`,
    'extra field': `${'a'.repeat(40)}\trefs/heads/main\textra`,
  };
  for (const [name, line] of Object.entries(rejected)) {
    await t.test(name, () => {
      const f = makeFixture();
      try {
        const result = f.invoke({ LS_REMOTE_OUTPUT: line });
        assert.notEqual(result.status, 0);
        assert.equal(existsSync(f.curlLog), false, 'invalid ref queried the API');
        assertNoWork(f);
      } finally { f.cleanup(); }
    });
  }
});

test('checkout, every npm gate, and deploy failures stop immediately without advancing state', async (t) => {
  const cases = {
    checkout: [{ FAIL_GIT_FETCH: '1' }, []],
    'npm ci': [{ FAIL_NPM: 'ci' }, ['npm:ci']],
    'npm test': [{ FAIL_NPM: 'test' }, ['npm:ci', 'npm:test']],
    build: [{ FAIL_NPM: 'run build' }, ['npm:ci', 'npm:test', 'npm:run build']],
    'check:generated': [{ FAIL_NPM: 'run check:generated' }, ['npm:ci', 'npm:test', 'npm:run build', 'npm:run check:generated']],
    deploy: [{ FAIL_DEPLOY: '1' }, null],
  };
  for (const [name, [env, expectedCommands]] of Object.entries(cases)) {
    await t.test(name, () => {
      const f = makeFixture();
      try {
        const previousSha = '0'.repeat(40);
        mkdirSync(f.state, { recursive: true });
        writeFileSync(path.join(f.state, 'last-deployed-sha'), `${previousSha}\n`);
        setSuccessfulTest(f);
        const result = f.invoke(env);
        assert.notEqual(result.status, 0);
        assert.equal(readFileSync(path.join(f.state, 'last-deployed-sha'), 'utf8').trim(), previousSha);
        assert.equal(existsSync(f.gitFetchMarker), true, 'checkout gate was not reached');
        const commands = existsSync(f.commandLog)
          ? readFileSync(f.commandLog, 'utf8').trim().split('\n')
          : [];
        if (expectedCommands) assert.deepEqual(commands, expectedCommands);
        if (name === 'checkout') assert.deepEqual(commands, []);
        if (name === 'deploy') {
          assert.equal(commands.length, 5);
          assert.deepEqual(commands.slice(0, 4), ['npm:ci', 'npm:test', 'npm:run build', 'npm:run check:generated']);
          assert.match(commands[4], /^deploy:\/.*\/checkout\.[^/]+ RELEASE_SHA=[0-9a-f]{40}$/);
        }
        const leftovers = existsSync(f.cache) ? run('find', [f.cache, '-maxdepth', '1', '-type', 'd', '-name', 'checkout*']) : '';
        assert.equal(leftovers, '', 'temporary checkout was not cleaned');
      } finally { f.cleanup(); }
    });
  }
});

test('a held flock makes a concurrent invocation exit without work', async () => {
  const f = makeFixture();
  let holder;
  try {
    mkdirSync(f.cache, { recursive: true });
    const marker = path.join(f.root, 'locked');
    holder = spawn(realFlock, [path.join(f.cache, 'deploy.lock'), 'sh', '-c', `touch '${marker}'; sleep 20`], {
      detached: true,
      stdio: 'ignore',
    });
    for (let i = 0; i < 100 && !existsSync(marker); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(existsSync(marker), true, 'failed to acquire test lock');
    const result = f.invoke();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(f.curlLog), false);
    assertNoWork(f);
  } finally {
    if (holder?.pid) {
      try { process.kill(-holder.pid, 'SIGTERM'); } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    f.cleanup();
  }
});

test('a branch race fails when fetched HEAD differs from the observed SHA', () => {
  const f = makeFixture();
  try {
    setSuccessfulTest(f);
    const result = f.invoke({ RACE_AFTER_LS_REMOTE: '1' });
    assert.notEqual(result.status, 0);
    assertNoWork(f);
    assert.equal(existsSync(path.join(f.state, 'last-deployed-sha')), false);
  } finally { f.cleanup(); }
});

test('main advancing during local checks prevents publication', () => {
  const f = makeFixture();
  try {
    setSuccessfulTest(f);
    const result = f.invoke({ RACE_DURING_NPM: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release SHA no longer matches main/);
    assert.doesNotMatch(readFileSync(f.commandLog, 'utf8'), /deploy:/);
    assert.equal(existsSync(path.join(f.state, 'last-deployed-sha')), false);
  } finally { f.cleanup(); }
});

test('direct release verification requires a matching clean checkout and a full Test', () => {
  const f = makeFixture();
  try {
    const args = ['--verify-release', f.source, f.sha, 'package.json', 'pages'];
    setRuns(f, [testRun(f.sha)]);
    setJobs(f, []);
    const missing = f.invoke({}, args);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /successful complete Test run/);
    assertNoWork(f);

    setSuccessfulTest(f);
    assert.equal(f.invoke({}, args).status, 0);
    const different = f.invoke({}, ['--verify-release', f.source, 'f'.repeat(40), 'package.json']);
    assert.notEqual(different.status, 0);
    assert.match(different.stderr, /checkout does not match the tested SHA/);

    writeFileSync(path.join(f.source, 'package.json'), '{}\n');
    const modified = f.invoke({}, args);
    assert.notEqual(modified.status, 0);
    assert.match(modified.stderr, /modified tracked files/);
    run(realGit, ['restore', 'package.json'], { cwd: f.source });

    writeFileSync(path.join(f.source, '.git', 'info', 'exclude'), '*.tmp\n');
    mkdirSync(path.join(f.source, 'pages'));
    writeFileSync(path.join(f.source, 'pages', 'not-reviewed.tmp'), 'untracked build output\n');
    const untracked = f.invoke({}, args);
    assert.notEqual(untracked.status, 0);
    assert.match(untracked.stderr, /untracked files in published paths/);
    assertNoWork(f);
  } finally { f.cleanup(); }
});
