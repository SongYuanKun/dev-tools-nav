#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_ROOT"

required_commands=(
  curl docker flock git install loginctl node npm python3 rsync systemctl
)
for command in "${required_commands[@]}"; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

linger=$(loginctl show-user "$USER" -p Linger --value)
if [[ "$linger" != "yes" ]]; then
  echo "User lingering must be enabled before installing the deploy timer." >&2
  exit 1
fi

verification_source="$HOME/.local/share/dev-tools-nav-verification"
test -s "$verification_source/baidu_verify_codeva-TByQYpVHM2.html"
test -s "$verification_source/googleb710668c9aa28d4e.html"

libexec_dir="$HOME/.local/libexec/dev-tools-nav-deploy"
cache_dir="$HOME/.cache/dev-tools-nav-deploy"
state_dir="$HOME/.local/state/dev-tools-nav-deploy"
unit_dir="$HOME/.config/systemd/user"

install -d -m 0700 "$libexec_dir" "$cache_dir" "$state_dir" "$unit_dir"
install -m 0755 scripts/poll-github-deploy.sh "$libexec_dir/poll-github-deploy.sh"
install -m 0755 scripts/deploy-1panel-local.sh "$libexec_dir/deploy-1panel-local.sh"
install -m 0644 ops/dev-tools-nav-deploy.service "$unit_dir/dev-tools-nav-deploy.service"
install -m 0644 ops/dev-tools-nav-deploy.timer "$unit_dir/dev-tools-nav-deploy.timer"

systemctl --user daemon-reload
systemctl --user disable --now dev-tools-nav-deploy.timer

enabled_status=0
enabled_state=$(systemctl --user is-enabled dev-tools-nav-deploy.timer) || enabled_status=$?
if [[ "$enabled_status" -ne 1 || "$enabled_state" != "disabled" ]]; then
  echo "Expected dev-tools-nav-deploy.timer to be disabled; got '$enabled_state' (status $enabled_status)." >&2
  exit 1
fi

active_status=0
active_state=$(systemctl --user is-active dev-tools-nav-deploy.timer) || active_status=$?
if [[ "$active_status" -ne 3 || "$active_state" != "inactive" ]]; then
  echo "Expected dev-tools-nav-deploy.timer to be inactive; got '$active_state' (status $active_status)." >&2
  exit 1
fi

echo "Installed dev-tools-nav deploy units; the timer remains disabled and inactive."
