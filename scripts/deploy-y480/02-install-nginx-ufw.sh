#!/usr/bin/env bash
set -euo pipefail
# 02 安装 Nginx + UFW 放行；需要 sudo
# 用法： sudo bash 02-install-nginx-ufw.sh [--no-firewall]

NO_FW=0
for a in "$@"; do [ "$a" = "--no-firewall" ] && NO_FW=1; done

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"
export DEBIAN_FRONTEND=noninteractive

echo "[1/4] apt 安装 nginx-light + ca-certificates + rsync + git + curl"
$SUDO apt-get update -y -qq >/dev/null
$SUDO apt-get install -y -qq \
  nginx-light ca-certificates rsync git curl ufw logrotate \
  python3-minimal

echo "[2/4] Node 22 安装（仅构建阶段需要）"
if ! command -v node >/dev/null || ! node -e 'process.exit(process.versions.node.split(".")[0]<22)'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  $SUDO apt-get install -y -qq nodejs
fi
node -v && npm -v

echo "[3/4] 防火墙 UFW（可选，默认开启）"
if [ "$NO_FW" -eq 1 ]; then
  echo "SKIP 防火墙（--no-firewall）"
else
  $SUDO ufw allow 22/tcp     || true
  $SUDO ufw allow 80/tcp     || true
  $SUDO ufw allow 443/tcp    || true
  echo "y" | $SUDO ufw enable  || true
  echo "--- ufw status ---"
  $SUDO ufw status numbered || true
fi

echo "[4/4] Nginx 启用&开机自启；默认页面先停掉，下一步写配置"
$SUDO systemctl enable --now nginx 2>/dev/null || true
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO systemctl restart nginx
$SUDO nginx -t && echo "✅ Nginx 语法 OK"

echo "DONE 02 → 下一步执行 03-deploy-pull.sh (首次构建+rsync到站点目录)"
