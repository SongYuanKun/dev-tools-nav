import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relative) {
  return readFile(path.join(root, relative), 'utf8');
}

async function assertMode(target, expected) {
  const details = await stat(target);
  assert.equal(details.mode & 0o777, expected, `${target} has the expected mode`);
}

test('systemd units and installer keep the hardened disabled-install contract', async () => {
  const [service, timer, installer] = await Promise.all([
    read('ops/dev-tools-nav-deploy.service'),
    read('ops/dev-tools-nav-deploy.timer'),
    read('scripts/install-outbound-deployer.sh'),
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
  assert.match(installer, /loginctl show-user "\$USER" -p Linger --value/);
  assert.match(installer, /install -m 0755 scripts\/poll-github-deploy\.sh/);
  assert.match(installer, /install -m 0755 scripts\/deploy-1panel-local\.sh/);
  assert.match(installer, /required_commands=\([\s\S]*\bnode\b[\s\S]*\)/);
  assert.match(installer, /systemctl --user disable --now dev-tools-nav-deploy\.timer/);
  assert.match(installer, /systemctl --user is-enabled/);
  assert.match(installer, /systemctl --user is-active/);
  assert.doesNotMatch(installer, /systemctl[^\n]*\benable\b|sudo|gh api/);
  assert.doesNotMatch(installer, /systemctl[^\n]*\b(?:enable|start)\b/);
});

test('installer copies trusted files with strict modes and leaves the timer inactive', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'outbound-installer-'));
  const home = path.join(fixture, 'home');
  const fakeBin = path.join(fixture, 'bin');
  const log = path.join(fixture, 'commands.log');
  t.after(async () => {
    await import('node:fs/promises').then(({ rm }) => rm(fixture, { recursive: true, force: true }));
  });

  await mkdir(path.join(home, '.local/share/dev-tools-nav-verification'), { recursive: true });
  await mkdir(fakeBin);
  await writeFile(
    path.join(home, '.local/share/dev-tools-nav-verification/baidu_verify_codeva-TByQYpVHM2.html'),
    'baidu-verification\n',
  );
  await writeFile(
    path.join(home, '.local/share/dev-tools-nav-verification/googleb710668c9aa28d4e.html'),
    'google-verification\n',
  );

  const fakeCommand = path.join(fakeBin, 'fake-command');
  await writeFile(fakeCommand, `#!/usr/bin/env bash
set -euo pipefail
name="$(basename "$0")"
printf '%s' "$name" >> "$COMMAND_LOG"
printf ' %q' "$@" >> "$COMMAND_LOG"
printf '\n' >> "$COMMAND_LOG"
if [[ "$name" == loginctl ]]; then
  printf 'yes\n'
elif [[ "$name" == systemctl && " $* " == *' is-enabled '* ]]; then
  printf 'disabled\n'
  exit 1
elif [[ "$name" == systemctl && " $* " == *' is-active '* ]]; then
  printf 'inactive\n'
  exit 3
fi
`);
  await chmod(fakeCommand, 0o755);
  for (const command of ['loginctl', 'systemctl', 'docker', 'git', 'curl', 'python3', 'npm', 'node', 'flock', 'rsync']) {
    await symlink('fake-command', path.join(fakeBin, command));
  }

  await execFileAsync('bash', ['scripts/install-outbound-deployer.sh'], {
    cwd: root,
    env: {
      ...process.env,
      COMMAND_LOG: log,
      HOME: home,
      PATH: `${fakeBin}:/usr/bin:/bin`,
      USER: 'fixture-user',
    },
  });

  const libexec = path.join(home, '.local/libexec/dev-tools-nav-deploy');
  const cache = path.join(home, '.cache/dev-tools-nav-deploy');
  const state = path.join(home, '.local/state/dev-tools-nav-deploy');
  const unitDir = path.join(home, '.config/systemd/user');
  for (const directory of [libexec, cache, state, unitDir]) {
    await assertMode(directory, 0o700);
  }

  const copies = [
    ['scripts/poll-github-deploy.sh', path.join(libexec, 'poll-github-deploy.sh'), 0o755],
    ['scripts/deploy-1panel-local.sh', path.join(libexec, 'deploy-1panel-local.sh'), 0o755],
    ['ops/dev-tools-nav-deploy.service', path.join(unitDir, 'dev-tools-nav-deploy.service'), 0o644],
    ['ops/dev-tools-nav-deploy.timer', path.join(unitDir, 'dev-tools-nav-deploy.timer'), 0o644],
  ];
  for (const [source, installed, mode] of copies) {
    assert.deepEqual(await readFile(installed), await readFile(path.join(root, source)));
    await assertMode(installed, mode);
  }

  const calls = await readFile(log, 'utf8');
  assert.match(calls, /^loginctl show-user fixture-user -p Linger --value$/m);
  assert.match(calls, /^systemctl --user daemon-reload$/m);
  assert.match(calls, /^systemctl --user disable --now dev-tools-nav-deploy\.timer$/m);
  assert.match(calls, /^systemctl --user is-enabled dev-tools-nav-deploy\.timer$/m);
  assert.match(calls, /^systemctl --user is-active dev-tools-nav-deploy\.timer$/m);
  assert.doesNotMatch(calls, /systemctl[^\n]*\b(?:enable|start)\b/);
  assert.doesNotMatch(calls, /^gh\b|^sudo\b/m);
});
