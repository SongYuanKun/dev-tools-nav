#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-SongYuanKun/dev-tools-nav}"
REMOTE_URL="${REMOTE_URL:-https://github.com/SongYuanKun/dev-tools-nav.git}"
API_BASE_URL="${API_BASE_URL:-https://api.github.com}"
STATE_DIR="${STATE_DIR:-$HOME/.local/state/dev-tools-nav-deploy}"
CACHE_DIR="${CACHE_DIR:-$HOME/.cache/dev-tools-nav-deploy}"
DEPLOY_BIN="${DEPLOY_BIN:-$HOME/.local/libexec/dev-tools-nav-deploy/deploy-1panel-local.sh}"
GIT_BIN="${GIT_BIN:-git}"
CURL_BIN="${CURL_BIN:-curl}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
NPM_BIN="${NPM_BIN:-npm}"
FLOCK_BIN="${FLOCK_BIN:-flock}"
STATE_FILE="$STATE_DIR/last-deployed-sha"
LOCK_FILE="$CACHE_DIR/deploy.lock"

main_sha() {
  local line
  line=$("$GIT_BIN" ls-remote --exit-code "$REMOTE_URL" refs/heads/main) || return
  if [[ "$line" == *$'\n'* || ! "$line" =~ ^([0-9a-f]{40}([0-9a-f]{24})?)[[:blank:]]+refs/heads/main$ ]]; then
    echo 'Invalid response for refs/heads/main.' >&2
    return 1
  fi
  printf '%s\n' "${BASH_REMATCH[1]}"
}

assert_current_main() {
  local current
  current=$(main_sha) || return
  if [[ "$current" != "$1" ]]; then
    echo 'The release SHA no longer matches main.' >&2
    return 1
  fi
}

github_api() {
  "$CURL_BIN" -fsS -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' "$API_BASE_URL/repos/$REPO/$1"
}

test_status() {
  local sha=$1 candidates run_id attempt unit_status
  # This endpoint is scoped to the trusted workflow file, not its display name.
  candidates=$(github_api "actions/workflows/test.yml/runs?branch=main&head_sha=$sha&status=success&per_page=20" | "$PYTHON_BIN" -c '
import json
import sys

expected_sha, expected_repo = sys.argv[1:]
try:
    runs = json.load(sys.stdin)["workflow_runs"]
    if not isinstance(runs, list):
        sys.exit(2)
except (ValueError, TypeError, KeyError):
    sys.exit(2)

for run in runs:
    if not isinstance(run, dict):
        continue
    repo, head_repo = run.get("repository"), run.get("head_repository")
    run_id, attempt = run.get("id"), run.get("run_attempt")
    if (run.get("path") in (".github/workflows/test.yml", ".github/workflows/test.yml@main")
            and run.get("head_sha") == expected_sha
            and run.get("head_branch") == "main"
            and run.get("event") in ("push", "workflow_dispatch")
            and run.get("status") == "completed"
            and run.get("conclusion") == "success"
            and isinstance(repo, dict) and isinstance(head_repo, dict)
            and str(repo.get("full_name", "")).lower() == expected_repo.lower()
            and str(head_repo.get("full_name", "")).lower() == expected_repo.lower()
            and type(repo.get("id")) is int and repo["id"] == head_repo.get("id")
            and type(run_id) is int and run_id > 0
            and type(attempt) is int and attempt > 0):
        print(run_id, attempt)
' "$sha" "$REPO") || return

  while read -r run_id attempt; do
    [[ -n "$run_id" ]] || continue
    unit_status=$(github_api "actions/runs/$run_id/attempts/$attempt/jobs?per_page=100" | "$PYTHON_BIN" -c '
import json
import sys

expected_sha, expected_run = sys.argv[1:]
required_steps = {
    "Verify checkout SHA",
    "Run npm test",
    "Run npm run check:asset-versions",
    "Run npm run check:generated",
    "Check accessibility and performance baseline",
}
try:
    jobs = json.load(sys.stdin)["jobs"]
    if not isinstance(jobs, list):
        sys.exit(2)
except (ValueError, TypeError, KeyError):
    sys.exit(2)

def succeeded(item):
    return item.get("status") == "completed" and item.get("conclusion") == "success"

unit = [job for job in jobs if isinstance(job, dict) and job.get("name") == "unit"]
if len(unit) == 1:
    job = unit[0]
    if (job.get("run_id") == int(expected_run) and job.get("head_sha") == expected_sha
            and job.get("head_branch") == "main" and succeeded(job)
            and isinstance(job.get("steps"), list)):
        steps = [step for step in job["steps"] if isinstance(step, dict) and step.get("name") in required_steps]
        if len(steps) == len(required_steps) and {step["name"] for step in steps if succeeded(step)} == required_steps:
            print("ready")
' "$sha" "$run_id") || return
    if [[ "$unit_status" == ready ]]; then
      printf '%s\n' ready
      return
    fi
  done <<< "$candidates"
  printf '%s\n' pending
}

if [[ "${1:-}" == --assert-current-main && "$#" == 2 ]]; then
  assert_current_main "$2"
  exit
fi

if [[ "${1:-}" == --verify-release && "$#" -ge 4 ]]; then
  source_dir=$(cd "$2" && pwd -P)
  expected_sha=$3
  shift 3
  checkout_root=$("$GIT_BIN" -C "$source_dir" rev-parse --show-toplevel)
  source_sha=$("$GIT_BIN" -C "$source_dir" rev-parse HEAD)
  if [[ "$checkout_root" != "$source_dir" || "$source_sha" != "$expected_sha" ]]; then
    echo 'The release checkout does not match the tested SHA.' >&2
    exit 1
  fi
  "$GIT_BIN" -C "$source_dir" diff --quiet --no-ext-diff HEAD -- || {
    echo 'The release checkout has modified tracked files.' >&2
    exit 1
  }
  # Include ignored files here: rsync would otherwise publish them as well.
  extra_files=$("$GIT_BIN" -C "$source_dir" ls-files --others -- "$@")
  if [[ -n "$extra_files" ]]; then
    echo 'The release checkout has untracked files in published paths.' >&2
    exit 1
  fi
  if [[ "$(test_status "$expected_sha")" != ready ]]; then
    echo 'A successful complete Test run is required for the release SHA.' >&2
    exit 1
  fi
  assert_current_main "$expected_sha"
  exit
fi

if [[ "$#" != 0 ]]; then
  echo 'Invalid deploy poller arguments.' >&2
  exit 1
fi

umask 077
mkdir -p "$STATE_DIR" "$CACHE_DIR"
chmod 0700 "$STATE_DIR" "$CACHE_DIR"

exec 9>"$LOCK_FILE"
if ! "$FLOCK_BIN" -n 9; then
  exit 0
fi

checkout=""
state_tmp=""
cleanup() {
  if [[ -n "$checkout" ]]; then
    rm -rf -- "$checkout"
  fi
  if [[ -n "$state_tmp" ]]; then
    rm -f -- "$state_tmp"
  fi
}
trap cleanup EXIT

remote_sha=$(main_sha)

if [[ -f "$STATE_FILE" ]] && [[ "$(<"$STATE_FILE")" == "$remote_sha" ]]; then
  printf '%s\n' 'SHA is already deployed; no work required.'
  exit 0
fi

run_status=$(test_status "$remote_sha")

if [[ "$run_status" == "pending" ]]; then
  exit 0
fi
if [[ "$run_status" != "ready" ]]; then
  exit 1
fi

checkout=$(mktemp -d "$CACHE_DIR/checkout.XXXXXX")
(
  cd "$checkout"
  "$GIT_BIN" init -q
  "$GIT_BIN" fetch --quiet "$REMOTE_URL" refs/heads/main
  "$GIT_BIN" checkout --quiet --detach FETCH_HEAD
)

checkout_sha=$(cd "$checkout" && "$GIT_BIN" rev-parse HEAD)
if [[ "$checkout_sha" != "$remote_sha" ]]; then
  exit 1
fi

(
  cd "$checkout"
  "$NPM_BIN" ci
  "$NPM_BIN" test
  "$NPM_BIN" run build
  "$NPM_BIN" run check:generated
)
assert_current_main "$remote_sha"
RELEASE_SHA="$remote_sha" SITE_SOURCE_DIR="$checkout" CACHE_DIR="$CACHE_DIR" "$DEPLOY_BIN"

state_tmp=$(mktemp "$STATE_DIR/.last-deployed-sha.XXXXXX")
printf '%s\n' "$remote_sha" > "$state_tmp"
mv -f -- "$state_tmp" "$STATE_FILE"
state_tmp=""
