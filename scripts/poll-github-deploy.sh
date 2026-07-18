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

remote_line=$("$GIT_BIN" ls-remote --exit-code "$REMOTE_URL" refs/heads/main)
read -r remote_sha remote_ref extra <<< "$remote_line"
if [[ "$remote_ref" != "refs/heads/main" || -n "${extra:-}" || ! "$remote_sha" =~ ^[0-9a-f]{40}([0-9a-f]{24})?$ ]]; then
  exit 1
fi

if [[ -f "$STATE_FILE" ]] && [[ "$(<"$STATE_FILE")" == "$remote_sha" ]]; then
  exit 0
fi

api_url="$API_BASE_URL/repos/$REPO/actions/workflows/test.yml/runs?branch=main&event=push&head_sha=$remote_sha&per_page=20"
api_response=$("$CURL_BIN" -fsS "$api_url")
run_status=$(printf '%s' "$api_response" | "$PYTHON_BIN" -c '
import json
import sys

try:
    payload = json.load(sys.stdin)
except (json.JSONDecodeError, UnicodeDecodeError):
    sys.exit(2)

runs = payload.get("workflow_runs", []) if isinstance(payload, dict) else []
expected = sys.argv[1]
for run in runs if isinstance(runs, list) else []:
    if (isinstance(run, dict)
            and run.get("head_sha") == expected
            and run.get("event") == "push"
            and run.get("conclusion") == "success"):
        print("ready")
        break
else:
    print("pending")
' "$remote_sha")

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
  "$GIT_BIN" fetch --quiet --depth=1 "$REMOTE_URL" refs/heads/main
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
SITE_SOURCE_DIR="$checkout" "$DEPLOY_BIN"

state_tmp=$(mktemp "$STATE_DIR/.last-deployed-sha.XXXXXX")
printf '%s\n' "$remote_sha" > "$state_tmp"
mv -f -- "$state_tmp" "$STATE_FILE"
state_tmp=""
