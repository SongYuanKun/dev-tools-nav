#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_ROOT"

required_commands=(
  chmod cmp cp curl dirname docker flock git install loginctl mktemp mv node npm python3 rm rmdir rsync stat systemctl
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

timer_preexisted=0
[[ -e "${targets[3]}" ]] && timer_preexisted=1

# Stop future triggers before inspecting the oneshot. Never stop a deployment in progress.
disable_status=0
disable_output=$(systemctl --user disable --now dev-tools-nav-deploy.timer 2>&1) || disable_status=$?
if [[ "$disable_status" -ne 0 ]]; then
  disable_reason=${disable_output,,}
  if [[ "$timer_preexisted" -eq 1 || ( "$disable_reason" != *"not found"* && "$disable_reason" != *"does not exist"* && "$disable_reason" != *"not loaded"* ) ]]; then
    echo "ERROR: could not disable the installed deploy timer before installation (status $disable_status); no targets were written." >&2
    exit 1
  fi
fi

service_status=0
service_state=$(systemctl --user is-active dev-tools-nav-deploy.service) || service_status=$?
if [[ "$service_state" != "inactive" && "$service_state" != "failed" ]]; then
  echo "Cannot install while dev-tools-nav-deploy.service is '$service_state' (status $service_status)." >&2
  exit 1
fi

install -d -m 0700 "$libexec_dir" "$cache_dir" "$state_dir" "$unit_dir"

staged=("" "" "" "")
backups=("" "" "" "")
backup_dirs=("" "" "" "")
original_exists=(0 0 0 0)
restored=(0 0 0 0)
transaction_started=1
install_committed=0

verify_timer_safe() {
  local allow_absent=$1
  local enabled_status=0 enabled_state active_status=0 active_state
  enabled_state=$(systemctl --user is-enabled dev-tools-nav-deploy.timer) || enabled_status=$?
  active_state=$(systemctl --user is-active dev-tools-nav-deploy.timer) || active_status=$?
  if [[ "$enabled_status" -eq 1 && "$enabled_state" == "disabled" && "$active_status" -eq 3 && "$active_state" == "inactive" ]]; then
    return 0
  fi
  if [[ "$allow_absent" -eq 1 && "$enabled_status" -eq 4 && "$enabled_state" == "not-found" && "$active_status" -eq 3 && "$active_state" == "inactive" ]]; then
    return 0
  fi
  echo "ERROR: timer safety is unconfirmed: enabled='$enabled_state' (status $enabled_status), active='$active_state' (status $active_status)." >&2
  return 1
}

remove_backup() {
  local index=$1
  local context=$2
  if [[ -n "${backups[$index]}" && -e "${backups[$index]}" ]]; then
    if ! rm -f -- "${backups[$index]}"; then
      echo "WARNING: $context; retained backup '${backups[$index]}' for target '${targets[$index]}'." >&2
      return 1
    fi
    backups[$index]=""
  fi
  if [[ -n "${backup_dirs[$index]}" && -d "${backup_dirs[$index]}" ]]; then
    if ! rmdir -- "${backup_dirs[$index]}"; then
      echo "WARNING: $context; retained backup directory '${backup_dirs[$index]}' for target '${targets[$index]}'." >&2
      return 1
    fi
    backup_dirs[$index]=""
  fi
  return 0
}

cleanup() {
  local exit_status=$?
  local recovery_incomplete=0 timer_safe=0 restore_stage=""
  trap - EXIT
  set +e

  if [[ "$transaction_started" -eq 1 && "$install_committed" -ne 1 ]]; then
    [[ "$exit_status" -ne 0 ]] || exit_status=1
    for index in "${!targets[@]}"; do
      if [[ "${original_exists[$index]}" -eq 1 ]]; then
        if [[ -n "${backups[$index]}" && -e "${backups[$index]}" ]]; then
          restore_stage=$(mktemp "${targets[$index]}.restore.XXXXXX")
          if cp -p -- "${backups[$index]}" "$restore_stage" && mv -f -- "$restore_stage" "${targets[$index]}"; then
            restored[$index]=1
          else
            recovery_incomplete=1
            echo "ERROR: recovery incomplete for target '${targets[$index]}'; retained backup '${backups[$index]}'." >&2
          fi
          if [[ -e "$restore_stage" ]] && ! rm -f -- "$restore_stage"; then
            recovery_incomplete=1
            echo "ERROR: retained restore staging file '$restore_stage'." >&2
          fi
          restore_stage=""
        else
          recovery_incomplete=1
          echo "ERROR: recovery backup is unavailable for target '${targets[$index]}'." >&2
        fi
      elif ! rm -f -- "${targets[$index]}"; then
        recovery_incomplete=1
        echo "ERROR: could not remove first-install target '${targets[$index]}'." >&2
      fi
    done

    for temporary in "${staged[@]}"; do
      if [[ -n "$temporary" && -e "$temporary" ]] && ! rm -f -- "$temporary"; then
        recovery_incomplete=1
        echo "ERROR: retained installation staging file '$temporary'." >&2
      fi
    done

    if ! systemctl --user daemon-reload; then
      recovery_incomplete=1
      echo "ERROR: daemon-reload failed during installer recovery." >&2
    fi
    if ! systemctl --user disable --now dev-tools-nav-deploy.timer; then
      if [[ "$timer_preexisted" -eq 1 ]]; then
        recovery_incomplete=1
        echo "ERROR: could not disable the deploy timer during recovery." >&2
      fi
    fi
    if verify_timer_safe "$((1 - timer_preexisted))"; then
      timer_safe=1
    else
      recovery_incomplete=1
      echo "ERROR: HIGH PRIORITY: timer state is unsafe or unknown; recovery backups and diagnostics were retained." >&2
    fi

    if [[ "$timer_safe" -eq 1 ]]; then
      for index in "${!targets[@]}"; do
        if [[ "${original_exists[$index]}" -eq 1 && "${restored[$index]}" -eq 1 ]]; then
          remove_backup "$index" "post-recovery backup cleanup failed" || recovery_incomplete=1
        elif [[ "${original_exists[$index]}" -eq 0 && -n "${backup_dirs[$index]}" ]]; then
          remove_backup "$index" "post-recovery backup cleanup failed" || recovery_incomplete=1
        fi
      done
    fi

    if [[ "$recovery_incomplete" -ne 0 ]]; then
      echo "ERROR: installer recovery was incomplete; inspect the reported target, staging, and backup paths before retrying." >&2
    fi
  fi
  exit "$exit_status"
}
trap cleanup EXIT

for index in "${!targets[@]}"; do
  backup_dirs[$index]=$(mktemp -d "$(dirname "${targets[$index]}")/.install-backup.XXXXXX")
  chmod 0700 "${backup_dirs[$index]}"
  if [[ -e "${targets[$index]}" ]]; then
    original_exists[$index]=1
    backup_candidate="${backup_dirs[$index]}/original"
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
verify_timer_safe 0

for index in "${!targets[@]}"; do
  cmp -s -- "${sources[$index]}" "${targets[$index]}"
  actual_mode=$(stat -c '%a' "${targets[$index]}")
  expected_mode=${modes[$index]#0}
  if [[ "$actual_mode" != "$expected_mode" ]]; then
    echo "Installed target has unexpected mode: ${targets[$index]}" >&2
    exit 1
  fi
done

# The new installation is committed after files and timer state pass verification.
install_committed=1
for index in "${!targets[@]}"; do
  remove_backup "$index" "committed installation backup cleanup failed" || true
done
trap - EXIT

echo "Installed dev-tools-nav deploy units; the timer remains disabled and inactive."
