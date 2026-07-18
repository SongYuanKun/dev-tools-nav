#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_ROOT"

required_commands=(
  chmod cmp cp curl dirname docker flock git install loginctl mktemp mv node npm python3 rm rsync stat systemctl
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
docker info >/dev/null

verification_source="$HOME/.local/share/dev-tools-nav-verification"
test -s "$verification_source/baidu_verify_codeva-TByQYpVHM2.html"
test -s "$verification_source/googleb710668c9aa28d4e.html"
chmod 0700 "$verification_source"
chmod 0600 \
  "$verification_source/baidu_verify_codeva-TByQYpVHM2.html" \
  "$verification_source/googleb710668c9aa28d4e.html"

libexec_dir="$HOME/.local/libexec/dev-tools-nav-deploy"
cache_dir="$HOME/.cache/dev-tools-nav-deploy"
state_dir="$HOME/.local/state/dev-tools-nav-deploy"
unit_dir="$HOME/.config/systemd/user"

# Stop future triggers before inspecting the oneshot. Never stop a deployment in progress.
systemctl --user disable --now dev-tools-nav-deploy.timer >/dev/null 2>&1 || true
service_status=0
service_state=$(systemctl --user is-active dev-tools-nav-deploy.service) || service_status=$?
if [[ "$service_state" != "inactive" && "$service_state" != "failed" ]]; then
  echo "Cannot install while dev-tools-nav-deploy.service is '$service_state' (status $service_status)." >&2
  exit 1
fi

install -d -m 0700 "$libexec_dir" "$cache_dir" "$state_dir" "$unit_dir"

sources=(
  scripts/poll-github-deploy.sh
  scripts/deploy-1panel-local.sh
  ops/dev-tools-nav-deploy.service
  ops/dev-tools-nav-deploy.timer
)
targets=(
  "$libexec_dir/poll-github-deploy.sh"
  "$libexec_dir/deploy-1panel-local.sh"
  "$unit_dir/dev-tools-nav-deploy.service"
  "$unit_dir/dev-tools-nav-deploy.timer"
)
modes=(0755 0755 0644 0644)
staged=("" "" "" "")
backups=("" "" "" "")
original_exists=(0 0 0 0)
transaction_started=1
install_succeeded=0

cleanup() {
  local exit_status=$?
  set +e
  if [[ "$transaction_started" -eq 1 && "$install_succeeded" -ne 1 ]]; then
    for index in "${!targets[@]}"; do
      if [[ "${original_exists[$index]}" -eq 1 ]]; then
        if [[ -n "${backups[$index]}" && -e "${backups[$index]}" ]]; then
          mv -f -- "${backups[$index]}" "${targets[$index]}"
          backups[$index]=""
        fi
      else
        rm -f -- "${targets[$index]}"
      fi
    done
    systemctl --user daemon-reload >/dev/null 2>&1 || true
  fi
  for temporary in "${staged[@]}" "${backups[@]}"; do
    [[ -z "$temporary" ]] || rm -f -- "$temporary"
  done
  exit "$exit_status"
}
trap cleanup EXIT

for index in "${!targets[@]}"; do
  if [[ -e "${targets[$index]}" ]]; then
    original_exists[$index]=1
    backup_candidate=$(mktemp "${targets[$index]}.backup.XXXXXX")
    if ! cp -p -- "${targets[$index]}" "$backup_candidate"; then
      rm -f -- "$backup_candidate"
      exit 1
    fi
    backups[$index]=$backup_candidate
  fi
done

for index in "${!targets[@]}"; do
  staged[$index]=$(mktemp "${targets[$index]}.stage.XXXXXX")
  install -m "${modes[$index]}" "${sources[$index]}" "${staged[$index]}"
done

for index in "${!targets[@]}"; do
  mv -f -- "${staged[$index]}" "${targets[$index]}"
  staged[$index]=""
done

systemctl --user daemon-reload

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

for index in "${!targets[@]}"; do
  cmp -s -- "${sources[$index]}" "${targets[$index]}"
  actual_mode=$(stat -c '%a' "${targets[$index]}")
  expected_mode=${modes[$index]#0}
  if [[ "$actual_mode" != "$expected_mode" ]]; then
    echo "Installed target has unexpected mode: ${targets[$index]}" >&2
    exit 1
  fi
done

install_succeeded=1
for backup in "${backups[@]}"; do
  [[ -z "$backup" ]] || rm -f -- "$backup"
done
backups=("" "" "" "")

echo "Installed dev-tools-nav deploy units; the timer remains disabled and inactive."
