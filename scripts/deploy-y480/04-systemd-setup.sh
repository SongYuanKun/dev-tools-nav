#!/usr/bin/env bash
set -euo pipefail
# 04 安装 user systemd unit: oneshot 部署 + 每10分钟 timer
# 用法： bash 04-systemd-setup.sh (当前用户无需sudo；推荐先enable-linger开机自启)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/03-deploy-pull.sh"

UDIR="$HOME/.config/systemd/user"
mkdir -p "$UDIR"

# 先部署脚本设可执行
chmod +x "$SCRIPT_DIR"/0*.sh

SERVICE_FILE="$UDIR/dev-tools-nav-y480.service"
TIMER_FILE="$UDIR/dev-tools-nav-y480.timer"

cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Dev Tools Nav Y480 Deploy (GitHub Test Green Gate)
After=network-online.target nss-lookup.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash $DEPLOY_SCRIPT
Environment=HOME=$HOME
Environment=NPM_CONFIG_CACHE=$HOME/.cache/dev-tools-nav-y480/npm
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$HOME/.cache/dev-tools-nav-y480 $HOME/.local/state/dev-tools-nav-y480
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
StandardOutput=append:$HOME/.local/state/dev-tools-nav-y480/deploy.log
StandardError=append:$HOME/.local/state/dev-tools-nav-y480/deploy.log
EOF

cat >"$TIMER_FILE" <<EOF
[Unit]
Description=Run dev-tools-nav-y480 deploy every 10 min (at boot + persistent)

[Timer]
OnBootSec=2min
OnCalendar=*:0/10
Persistent=true
RandomizedDelaySec=45s
Unit=dev-tools-nav-y480.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now dev-tools-nav-y480.timer

echo "=== 验证 ==="
systemctl --user list-timers dev-tools-nav-y480.timer --all
echo "手动 oneshot（立即部署一次）： systemctl --user start dev-tools-nav-y480.service"
echo "状态查看:                 journalctl --user -u dev-tools-nav-y480.service -n 50 -f"
echo "持久化(开机自启timer需要管理员执行):  sudo loginctl enable-linger $USER"
