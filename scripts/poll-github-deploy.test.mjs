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
  const gitFetchMarker = path.join(root, 'git-fetch.marker');
  mkdirSync(source);
  mkdirSync(bin);
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
  executable(curl, 'printf "%s\\n" "$*" >> "$CURL_LOG"\ncat "$API_FIXTURE"\n');
  const npm = path.join(bin, 'npm');
  executable(npm, [
    'printf "npm:%s\\n" "$*" >> "$COMMAND_LOG"',
    'if [[ "${FAIL_NPM:-}" == "$*" ]]; then exit 41; fi',
  ].join('\n'));
  const deploy = path.join(bin, 'deploy');
  executable(deploy, [
    'printf "deploy:%s\\n" "$SITE_SOURCE_DIR" >> "$COMMAND_LOG"',
    '[[ "${FAIL_DEPLOY:-0}" != 1 ]]',
  ].join('\n'));
  const git = path.join(bin, 'git');
  executable(git, [
    'if [[ "${1:-}" == fetch ]]; then touch "$GIT_FETCH_MARKER"; fi',
    'if [[ "${FAIL_GIT_FETCH:-0}" == 1 && "${1:-}" == fetch ]]; then exit 42; fi',
    'if [[ "${RACE_AFTER_LS_REMOTE:-0}" == 1 && "${1:-}" == ls-remote ]]; then',
    '  output=$("$REAL_GIT" "$@")',
    '  printf "race\\n" >> "$SOURCE_REPO/race.txt"',
    '  "$REAL_GIT" -C "$SOURCE_REPO" add race.txt',
    '  "$REAL_GIT" -C "$SOURCE_REPO" commit -m race >/dev/null',
    '  "$REAL_GIT" -C "$SOURCE_REPO" push origin main >/dev/null',
    '  printf "%s\\n" "$output"',
    '  exit 0',
    'fi',
    'exec "$REAL_GIT" "$@"',
  ].join('\n'));

  function invoke(extraEnv = {}) {
    return spawnSync('bash', [poller], {
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
    root, remote, source, state, cache, commandLog, curlLog, apiFixture, gitFetchMarker, sha, invoke,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function setRuns(fixture, runs) {
  writeFileSync(fixture.apiFixture, JSON.stringify({ workflow_runs: runs }));
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
    assert.equal(existsSync(f.curlLog), false, 'API was queried');
    assertNoWork(f);
  } finally { f.cleanup(); }
});

test('pending, failed, non-push, and mismatched Test runs do not deploy', async (t) => {
  const cases = {
    pending: (sha) => [{ head_sha: sha, event: 'push', conclusion: null }],
    failed: (sha) => [{ head_sha: sha, event: 'push', conclusion: 'failure' }],
    'non-push': (sha) => [{ head_sha: sha, event: 'workflow_dispatch', conclusion: 'success' }],
    mismatched: () => [{ head_sha: 'f'.repeat(40), event: 'push', conclusion: 'success' }],
  };
  for (const [name, runs] of Object.entries(cases)) {
    await t.test(name, () => {
      const f = makeFixture();
      try {
        setRuns(f, runs(f.sha));
        const result = f.invoke();
        assert.equal(result.status, 0, result.stderr);
        assertNoWork(f);
        assert.equal(existsSync(path.join(f.state, 'last-deployed-sha')), false);
      } finally { f.cleanup(); }
    });
  }
});

test('successful exact-SHA push Test runs all gates in order and records state', () => {
  const f = makeFixture();
  try {
    setRuns(f, [{ head_sha: f.sha, event: 'push', conclusion: 'success' }]);
    const result = f.invoke();
    assert.equal(result.status, 0, result.stderr);
    const lines = readFileSync(f.commandLog, 'utf8').trim().split('\n');
    assert.equal(lines.length, 5, 'unexpected extra gate or deploy command');
    assert.deepEqual(lines.slice(0, 4), ['npm:ci', 'npm:test', 'npm:run build', 'npm:run check:generated']);
    assert.match(lines[4], /^deploy:\/.*\/checkout\.[^/]+$/);
    assert.equal(existsSync(lines[4].slice('deploy:'.length)), false, 'successful checkout was not cleaned');
    assert.equal(readFileSync(path.join(f.state, 'last-deployed-sha'), 'utf8').trim(), f.sha);
    const curlArgs = readFileSync(f.curlLog, 'utf8');
    assert.match(curlArgs, new RegExp(`https://api\\.example\\.test/repos/example/project/actions/workflows/test\\.yml/runs\\?branch=main&event=push&head_sha=${f.sha}&per_page=20`));
    assert.doesNotMatch(curlArgs, /authorization|token/i);
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

test('checkout, npm, and deploy failures do not advance state', async (t) => {
  const cases = {
    checkout: { FAIL_GIT_FETCH: '1' },
    npm: { FAIL_NPM: 'test' },
    deploy: { FAIL_DEPLOY: '1' },
  };
  for (const [name, env] of Object.entries(cases)) {
    await t.test(name, () => {
      const f = makeFixture();
      try {
        const previousSha = '0'.repeat(40);
        mkdirSync(f.state, { recursive: true });
        writeFileSync(path.join(f.state, 'last-deployed-sha'), `${previousSha}\n`);
        setRuns(f, [{ head_sha: f.sha, event: 'push', conclusion: 'success' }]);
        const result = f.invoke(env);
        assert.notEqual(result.status, 0);
        assert.equal(readFileSync(path.join(f.state, 'last-deployed-sha'), 'utf8').trim(), previousSha);
        assert.equal(existsSync(f.gitFetchMarker), true, 'checkout gate was not reached');
        const commands = existsSync(f.commandLog)
          ? readFileSync(f.commandLog, 'utf8').trim().split('\n')
          : [];
        if (name === 'checkout') assert.deepEqual(commands, []);
        if (name === 'npm') assert.deepEqual(commands, ['npm:ci', 'npm:test']);
        if (name === 'deploy') {
          assert.equal(commands.length, 5);
          assert.deepEqual(commands.slice(0, 4), ['npm:ci', 'npm:test', 'npm:run build', 'npm:run check:generated']);
          assert.match(commands[4], /^deploy:\/.*\/checkout\.[^/]+$/);
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
    setRuns(f, [{ head_sha: f.sha, event: 'push', conclusion: 'success' }]);
    const result = f.invoke({ RACE_AFTER_LS_REMOTE: '1' });
    assert.notEqual(result.status, 0);
    assertNoWork(f);
    assert.equal(existsSync(path.join(f.state, 'last-deployed-sha')), false);
  } finally { f.cleanup(); }
});
