#!/usr/bin/env bash
set -euo pipefail
# Y480 环境核验脚本（非破坏性，只读）
# 用法： bash 01-env-check.sh
# 退出码 0=满足最低要求 1=不满足 请按输出列表逐项修复

echo "=== [1/6] Y480 硬件 & OS 核验 ==="
echo "hostname: $(hostname)"
echo "kernel:   $(uname -r)"
echo "arch:     $(uname -m)"
DISTRO_ID="$(grep -E '^ID=' /etc/os-release 2>/dev/null | head -1 | cut -d= -f2 | tr -d '"')"
DISTRO_VER="$(grep -E '^VERSION_ID=' /etc/os-release 2>/dev/null | head -1 | cut -d= -f2 | tr -d '"')"
echo "distro:   ${DISTRO_ID:-unknown} ${DISTRO_VER:-}"
MEM_GB="$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || echo 0)"
DISK_GB="$(df -BG --output=avail / 2>/dev/null | awk 'NR==2{gsub(/G/,"",$2); print $2}' || echo 0)"
CPU_CORES="$(nproc 2>/dev/null || echo 1)"
echo "cpu:      ${CPU_CORES} cores"
echo "mem:      ${MEM_GB} GB available"
echo "disk(/):  ${DISK_GB} GB free"

MIN_MEM=2 MIN_DISK=3 OK=1
echo "MIN要求:  MEM>=${MIN_MEM}G DISK>=${MIN_DISK}G; 推荐>=4G MEM >=10G DISK"
[ "${MEM_GB:-0}" -lt "$MIN_MEM" ] && { echo "❌ RAM 不足${MIN_MEM}GB"; OK=0; }
[ "${DISK_GB:-0}" -lt "$MIN_DISK" ] && { echo "❌ / 磁盘空余不足${MIN_DISK}GB"; OK=0; }

echo ""
echo "=== [2/6] 运行时依赖（按用途分类）==="
check_cmd(){
  name="$1" pkg="$2" req="$3"
  if command -v "$name" >/dev/null 2>&1; then
    ver=$($name --version 2>/dev/null | head -1 | awk '{print $NF; exit}')
    echo "✅ ${name} (${ver:-?}) 提供: ${pkg}"
  else
    echo "❌ ${name} 缺失 安装: ${req}"
    OK=0
  fi
}
echo "--- 构建阶段依赖（仅构建时需要，部署纯静态后可卸载 Node） ---"
check_cmd node   nodejs     "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs"
check_cmd npm    npm        "同上 nodejs 包自带 npm"
check_cmd python3 python3   "apt install -y python3-minimal"
echo "--- 拉取 & 同步依赖 ---"
check_cmd git    git        "apt install -y git ca-certificates"
check_cmd curl   curl       "apt install -y curl"
check_cmd rsync  rsync      "apt install -y rsync"
echo "--- 服务依赖（推荐 Nginx；或用 Caddy/Apache） ---"
check_cmd nginx  nginx      "apt install -y nginx-light"
check_cmd ufw    ufw        "apt install -y ufw (防火墙可选，推荐启用)"
check_cmd systemctl systemd "apt install -y systemd (init守护; Debian12/Ubuntu22 自带)"
echo "--- 网络诊断 ---"
check_cmd dig    dnsutils   "apt install -y dnsutils"
check_cmd ss     iproute2   "apt install -y iproute2"

echo ""
echo "=== [3/6] GitHub 仓库可访问性（出网检查）==="
REMOTE="https://github.com/SongYuanKun/dev-tools-nav.git"
HEAD_SHA=$(git ls-remote --heads "$REMOTE" main 2>/dev/null | awk '{print $1}' || echo "")
if [ -n "$HEAD_SHA" ]; then
  echo "✅ 仓库可达 main@${HEAD_SHA:0:8}"
else
  echo "❌ 无法连 $REMOTE，检查 DNS/代理/出网策略；HTTPS 443 需要出网"
  OK=0
fi

echo ""
echo "=== [4/6] 现有服务占用检查（端口 80/443/8080） ==="
for p in 80 443 8080; do
  occu=$(ss -ltnp 2>/dev/null | awk -v p=":$p" '$4~p{print; exit}')
  [ -n "$occu" ] && echo "⚠️  端口$p 被占用 → $occu" || echo "✅ 端口$p 空闲"
done

echo ""
echo "=== [5/6] systemd 用户 lingering（timer持久化推荐） ==="
LINGER="$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || echo no)"
echo "linger=${LINGER}；如为 no 且想启用每10分钟自动轮询，管理员执行: loginctl enable-linger $USER"

echo ""
echo "=== [6/6] 结果总结 ==="
if [ "$OK" -eq 1 ]; then
  echo "✅ ENV_OK；下一步执行 02-install-nginx-ufw.sh"
  exit 0
else
  echo "❌ ENV_FAIL；请按上方❌列表逐项修复后重跑"
  exit 1
fi
