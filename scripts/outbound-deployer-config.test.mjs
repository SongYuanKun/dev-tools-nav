import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  ['scripts/poll-github-deploy.sh', '.local/libexec/dev-tools-nav-deploy/poll-github-deploy.sh', 0o755],
  ['scripts/deploy-1panel-local.sh', '.local/libexec/dev-tools-nav-deploy/deploy-1panel-local.sh', 0o755],
  ['ops/dev-tools-nav-deploy.service', '.config/systemd/user/dev-tools-nav-deploy.service', 0o644],
  ['ops/dev-tools-nav-deploy.timer', '.config/systemd/user/dev-tools-nav-deploy.timer', 0o644],
];

async function read(relative) {
  return readFile(path.join(root, relative), 'utf8');
}

async function assertMode(target, expected) {
  const details = await stat(target);
  assert.equal(details.mode & 0o777, expected, `${target} has the expected mode`);
}

async function makeFixture(t, { withOldTargets = true } = {}) {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'outbound-installer-'));
  const home = path.join(fixture, 'home');
  const fakeBin = path.join(fixture, 'bin');
  const log = path.join(fixture, 'commands.log');
  const timerState = path.join(fixture, 'timer.state');
  const serviceState = path.join(fixture, 'service.state');
  t.after(() => rm(fixture, { recursive: true, force: true }));

  await mkdir(path.join(home, '.local/share/dev-tools-nav-verification'), { recursive: true });
  await mkdir(fakeBin);
  for (const name of ['baidu_verify_codeva-TByQYpVHM2.html', 'googleb710668c9aa28d4e.html']) {
    await writeFile(path.join(home, '.local/share/dev-tools-nav-verification', name), `${name}\n`, { mode: 0o644 });
  }
  await writeFile(timerState, withOldTargets ? 'enabled-active\n' : 'not-found\n');

  if (withOldTargets) {
    for (const [, relative] of targets) {
      const target = path.join(home, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, `old:${relative}\n`);
    }
  }

  const fakeCommand = path.join(fakeBin, 'fake-command');
  await writeFile(fakeCommand, `#!/usr/bin/env bash
set -euo pipefail
name="$(basename "$0")"
printf '%s' "$name" >> "$COMMAND_LOG"
printf ' %q' "$@" >> "$COMMAND_LOG"
printf '\n' >> "$COMMAND_LOG"
case "$name" in
  loginctl) printf 'yes\n' ;;
  docker) [[ " $* " == *' info '* ]] ;;
  install)
    if [[ " $* " == *'.stage.'* ]]; then
      count=0; [[ -f "$INSTALL_COUNT" ]] && count="$(<"$INSTALL_COUNT")"
      count=$((count + 1)); printf '%s\n' "$count" > "$INSTALL_COUNT"
      [[ "\${FAIL_INSTALL_AT:-0}" != "$count" ]] || exit 71
    fi
    exec /usr/bin/install "$@"
    ;;
  mv)
    count=0; [[ -f "$MV_COUNT" ]] && count="$(<"$MV_COUNT")"
    count=$((count + 1)); printf '%s\n' "$count" > "$MV_COUNT"
    if [[ " $* " == *'.restore.'* && "\${FAIL_RESTORE_MV:-0}" == 1 ]]; then exit 75; fi
    [[ "\${FAIL_MV_AT:-0}" != "$count" ]] || exit 72
    exec /usr/bin/mv "$@"
    ;;
  rm)
    if [[ " $* " == *'.install-backup.'* && "\${FAIL_BACKUP_CLEANUP:-0}" == 1 ]]; then exit 76; fi
    exec /usr/bin/rm "$@"
    ;;
  systemctl)
    if [[ " $* " == *' disable --now dev-tools-nav-deploy.timer '* ]]; then
      count=0; [[ -f "$DISABLE_COUNT" ]] && count="$(<"$DISABLE_COUNT")"
      count=$((count + 1)); printf '%s\n' "$count" > "$DISABLE_COUNT"
      if [[ "\${FAIL_INITIAL_DISABLE:-0}" == 1 && "$count" -eq 1 ]]; then exit 74; fi
      if [[ "$(<"$TIMER_STATE")" == not-found ]]; then
        printf 'Unit dev-tools-nav-deploy.timer does not exist.\n' >&2
        exit 5
      fi
      printf 'disabled-inactive\n' > "$TIMER_STATE"
    elif [[ " $* " == *' is-active dev-tools-nav-deploy.service '* ]]; then
      state="\${SERVICE_STATE:-inactive}"
      [[ -f "$SERVICE_STATE_FILE" ]] && state="$(<"$SERVICE_STATE_FILE")"
      printf '%s\n' "$state"
      [[ "$state" == inactive || "$state" == failed ]] && exit 3
      exit 0
    elif [[ " $* " == *' reset-failed dev-tools-nav-deploy.service '* ]]; then
      printf 'inactive\n' > "$SERVICE_STATE_FILE"
    elif [[ " $* " == *' daemon-reload '* ]]; then
      count=0; [[ -f "$RELOAD_COUNT" ]] && count="$(<"$RELOAD_COUNT")"
      count=$((count + 1)); printf '%s\n' "$count" > "$RELOAD_COUNT"
      [[ "\${FAIL_RELOAD_AT:-0}" != "$count" ]] || exit 73
      if [[ ! -e "$TIMER_TARGET" ]]; then
        printf 'not-found\n' > "$TIMER_STATE"
      elif [[ "$count" -eq 1 && "\${TIMER_ENABLED:-0}" == 1 ]]; then
        printf 'enabled-inactive\n' > "$TIMER_STATE"
      elif [[ "$count" -eq 1 && "\${TIMER_ACTIVE:-0}" == 1 ]]; then
        printf 'disabled-active\n' > "$TIMER_STATE"
      elif [[ "$(<"$TIMER_STATE")" == not-found && -e "$TIMER_TARGET" ]]; then
        printf 'disabled-inactive\n' > "$TIMER_STATE"
      fi
    elif [[ " $* " == *' is-enabled dev-tools-nav-deploy.timer '* ]]; then
      state="$(<"$TIMER_STATE")"
      if [[ "$state" == enabled-* ]]; then printf 'enabled\n'; exit 0; fi
      if [[ "$state" == not-found ]]; then printf 'not-found\n'; exit 4; fi
      printf 'disabled\n'; exit 1
    elif [[ " $* " == *' is-active dev-tools-nav-deploy.timer '* ]]; then
      state="$(<"$TIMER_STATE")"
      if [[ "$state" == *-active ]]; then printf 'active\n'; exit 0; fi
      if [[ "$state" == not-found ]]; then printf 'inactive\n'; exit 3; fi
      printf 'inactive\n'; exit 3
    fi
    ;;
esac
`);
  await chmod(fakeCommand, 0o755);
  for (const command of ['loginctl', 'systemctl', 'docker', 'git', 'curl', 'python3', 'npm', 'node', 'flock', 'rsync', 'install', 'mv', 'rm']) {
    await symlink('fake-command', path.join(fakeBin, command));
  }

  const env = {
    ...process.env,
    COMMAND_LOG: log,
    HOME: home,
    PATH: `${fakeBin}:/usr/bin:/bin`,
    USER: 'fixture-user',
    TIMER_STATE: timerState,
    INSTALL_COUNT: path.join(fixture, 'install.count'),
    MV_COUNT: path.join(fixture, 'mv.count'),
    RELOAD_COUNT: path.join(fixture, 'reload.count'),
    DISABLE_COUNT: path.join(fixture, 'disable.count'),
    SERVICE_STATE_FILE: serviceState,
    TIMER_TARGET: path.join(home, targets[3][1]),
  };
  const invoke = async (extraEnv = {}) => {
    try {
      const result = await execFileAsync('bash', ['scripts/install-outbound-deployer.sh'], {
        cwd: root,
        env: { ...env, ...extraEnv },
      });
      return { status: 0, ...result };
    } catch (error) {
      return { status: error.code, stdout: error.stdout, stderr: error.stderr };
    }
  };
  const old = new Map();
  if (withOldTargets) {
    for (const [, relative] of targets) old.set(relative, await readFile(path.join(home, relative)));
  }
  return { home, log, timerState, invoke, old };
}

async function installationArtifacts(fixture) {
  const roots = [
    path.join(fixture.home, '.local/libexec/dev-tools-nav-deploy'),
    path.join(fixture.home, '.config/systemd/user'),
  ];
  const entries = [];
  for (const directory of roots) {
    try {
      for (const name of await readdir(directory, { recursive: true })) entries.push(path.join(directory, name));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return entries;
}

async function assertOldTargets(fixture) {
  for (const [, relative] of targets) {
    assert.deepEqual(await readFile(path.join(fixture.home, relative)), fixture.old.get(relative));
  }
}

test('systemd units keep the hardened schedule and sandbox contract', async () => {
  const [service, timer] = await Promise.all([
    read('ops/dev-tools-nav-deploy.service'),
    read('ops/dev-tools-nav-deploy.timer'),
  ]);
  assert.match(timer, /OnBootSec=2min/);
  assert.match(timer, /OnCalendar=\*:0\/10/);
  assert.doesNotMatch(timer, /OnUnitActiveSec=/);
  assert.match(timer, /Persistent=true/);
  assert.match(service, /Type=oneshot/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /PrivateTmp=true/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /ProtectHome=read-only/);
  assert.match(service, /UMask=0077/);
});

test('installer disables an active timer before any staged target write and installs all files', async (t) => {
  const f = await makeFixture(t);
  const result = await f.invoke();
  assert.equal(result.status, 0, result.stderr);
  const calls = await readFile(f.log, 'utf8');
  const disabled = calls.indexOf('systemctl --user disable --now dev-tools-nav-deploy.timer');
  const firstStage = calls.indexOf('install -m 0755', disabled + 1);
  assert.ok(disabled >= 0 && firstStage > disabled, calls);
  assert.match(calls, /^docker info$/m);
  assert.equal(await readFile(f.timerState, 'utf8'), 'disabled-inactive\n');

  for (const [source, relative, mode] of targets) {
    const installed = path.join(f.home, relative);
    assert.deepEqual(await readFile(installed), await readFile(path.join(root, source)));
    await assertMode(installed, mode);
  }
  const verification = path.join(f.home, '.local/share/dev-tools-nav-verification');
  await assertMode(verification, 0o700);
  await assertMode(path.join(verification, 'baidu_verify_codeva-TByQYpVHM2.html'), 0o600);
  await assertMode(path.join(verification, 'googleb710668c9aa28d4e.html'), 0o600);
  for (const directory of [
    '.local/libexec/dev-tools-nav-deploy', '.cache/dev-tools-nav-deploy',
    '.local/state/dev-tools-nav-deploy', '.config/systemd/user',
  ]) await assertMode(path.join(f.home, directory), 0o700);
  const artifacts = await installationArtifacts(f);
  assert.equal(artifacts.some((entry) => entry.includes('.stage.')), false, artifacts.join('\n'));
  assert.equal(artifacts.some((entry) => entry.includes('.install-backup.')), false, artifacts.join('\n'));
});

test('installer fails closed before writes when the deploy service is active or activating', async (t) => {
  for (const state of ['active', 'activating']) {
    await t.test(state, async (t2) => {
      const f = await makeFixture(t2);
      const result = await f.invoke({ SERVICE_STATE: state });
      assert.notEqual(result.status, 0);
      await assertOldTargets(f);
      assert.equal(await readFile(f.timerState, 'utf8'), 'disabled-inactive\n');
      const calls = await readFile(f.log, 'utf8');
      assert.doesNotMatch(calls, /^install .*\.stage\./m);
    });
  }
});

test('an installed timer disable failure is fatal before target writes', async (t) => {
  const f = await makeFixture(t);
  const result = await f.invoke({ FAIL_INITIAL_DISABLE: '1' });
  assert.notEqual(result.status, 0);
  await assertOldTargets(f);
  assert.equal(await readFile(f.timerState, 'utf8'), 'enabled-active\n');
  assert.doesNotMatch(await readFile(f.log, 'utf8'), /^install .*\.stage\./m);
});

test('a first install accepts only the timer not-found disable result', async (t) => {
  const f = await makeFixture(t, { withOldTargets: false });
  const result = await f.invoke();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(f.timerState, 'utf8'), 'disabled-inactive\n');
});

test('installer rolls back all targets after staging, move, reload, or final-status failure', async (t) => {
  for (const [name, env] of Object.entries({
    staging: { FAIL_INSTALL_AT: '3' },
    move: { FAIL_MV_AT: '3' },
    reload: { FAIL_RELOAD_AT: '1' },
    'final enabled': { TIMER_ENABLED: '1' },
    'final active': { TIMER_ACTIVE: '1' },
  })) {
    await t.test(name, async (t2) => {
      const f = await makeFixture(t2);
      const result = await f.invoke(env);
      assert.notEqual(result.status, 0);
      await assertOldTargets(f);
      assert.equal(await readFile(f.timerState, 'utf8'), 'disabled-inactive\n');
      const artifacts = await installationArtifacts(f);
      assert.equal(artifacts.some((entry) => entry.includes('.stage.')), false, artifacts.join('\n'));
      assert.equal(artifacts.some((entry) => entry.includes('.install-backup.')), false, artifacts.join('\n'));
    });
  }
});

test('a restore move failure preserves the old backup and reports its paths', async (t) => {
  const f = await makeFixture(t);
  const result = await f.invoke({ FAIL_MV_AT: '3', FAIL_RESTORE_MV: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /recovery.*incomplete/i);
  assert.match(result.stderr, /backup/i);
  const artifacts = await installationArtifacts(f);
  const backups = artifacts.filter((entry) => /\.install-backup\.[^/]+\/[^/]+$/.test(entry));
  assert.ok(backups.length >= 1, artifacts.join('\n'));
  assert.match(await readFile(backups[0], 'utf8'), /^old:/);
  assert.equal(artifacts.some((entry) => entry.includes('.stage.')), false, artifacts.join('\n'));
});

test('backup cleanup failure keeps the committed install and warns with recovery paths', async (t) => {
  const f = await makeFixture(t);
  const result = await f.invoke({ FAIL_BACKUP_CLEANUP: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /warning.*backup/i);
  for (const [source, relative] of targets) {
    assert.deepEqual(await readFile(path.join(f.home, relative)), await readFile(path.join(root, source)));
  }
  const artifacts = await installationArtifacts(f);
  assert.ok(artifacts.some((entry) => entry.includes('.install-backup.')), artifacts.join('\n'));
});

test('a failed first install removes newly created targets', async (t) => {
  const f = await makeFixture(t, { withOldTargets: false });
  const result = await f.invoke({ FAIL_MV_AT: '3' });
  assert.notEqual(result.status, 0);
  for (const [, relative] of targets) {
    await assert.rejects(readFile(path.join(f.home, relative)), { code: 'ENOENT' });
  }
  assert.equal(await readFile(f.timerState, 'utf8'), 'not-found\n');
});
