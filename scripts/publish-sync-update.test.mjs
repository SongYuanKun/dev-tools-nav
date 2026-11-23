import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("publish-sync-update.sh", import.meta.url));
const repository = "SongYuanKun/dev-tools-nav";
const dataPath = "data/csdn-articles.json";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "publish-sync-update-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const checkout = join(root, "checkout");
  const remote = join(root, "remote.git");
  const bin = join(root, "bin");
  const dispatchLog = join(root, "dispatch.log");
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  mkdirSync(checkout);
  mkdirSync(bin);
  writeFileSync(join(bin, "gh"), '#!/usr/bin/env bash\nprintf "%s\\n" "$@" >> "$DISPATCH_LOG"\n', { mode: 0o755 });

  git(root, "init", "-q", "--bare", "--initial-branch=main", remote);
  git(checkout, "init", "-q", "--initial-branch=main");
  git(checkout, "config", "user.name", "Sync Test");
  git(checkout, "config", "user.email", "sync-test@example.com");
  git(checkout, "remote", "add", "origin", remote);
  mkdirSync(join(checkout, "data"));
  writeFileSync(join(checkout, dataPath), "[]\n");
  git(checkout, "add", dataPath);
  git(checkout, "commit", "-qm", "Initial data");
  git(checkout, "push", "-q", "origin", "main");
  git(checkout, "checkout", "--quiet", "--detach");

  const main = () => git(remote, "rev-parse", "refs/heads/main");
  const start = main();
  return {
    main,
    start,
    changeData: () => writeFileSync(join(checkout, dataPath), '[{"title":"updated"}]\n'),
    hook: (name, body) => writeFileSync(join(remote, "hooks", name), body, { mode: 0o755 }),
    dispatchArgs: () => readFileSync(dispatchLog, "utf8").trim().split("\n"),
    run: () => spawnSync("bash", [script, dataPath, "Update synced data"], {
      cwd: checkout,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: repository, DISPATCH_LOG: dispatchLog },
      encoding: "utf8",
    }),
  };
}

test("unchanged sync data neither pushes nor dispatches Test", (t) => {
  const sync = fixture(t);
  const result = sync.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(sync.main(), sync.start);
  assert.throws(sync.dispatchArgs, { code: "ENOENT" });
});

test("changed sync data dispatches Test for the exact commit it pushed to main", (t) => {
  const sync = fixture(t);
  sync.changeData();
  const result = sync.run();
  assert.equal(result.status, 0, result.stderr);
  const published = sync.main();
  assert.notEqual(published, sync.start);
  assert.deepEqual(sync.dispatchArgs(), ["workflow", "run", "test.yml", "--repo", repository, "--ref", "main", "-f", `expected_sha=${published}`]);
});

test("a rejected push cannot dispatch Test", (t) => {
  const sync = fixture(t);
  sync.hook("pre-receive", "#!/usr/bin/env bash\nexit 1\n");
  sync.changeData();
  const result = sync.run();
  assert.notEqual(result.status, 0);
  assert.equal(sync.main(), sync.start);
  assert.throws(sync.dispatchArgs, { code: "ENOENT" });
});

test("a concurrent main update after the push suppresses the stale Test dispatch", (t) => {
  const sync = fixture(t);
  sync.hook("post-receive", `#!/usr/bin/env bash
set -euo pipefail
read -r old_sha new_sha ref
git update-ref "$ref" \
  "$(git -c user.name='Another writer' -c user.email='writer@example.com' commit-tree "$new_sha^{tree}" -p "$new_sha" -m 'Concurrent main update')" "$new_sha"
`);
  sync.changeData();
  const result = sync.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /main advanced/);
  assert.throws(sync.dispatchArgs, { code: "ENOENT" });
});
