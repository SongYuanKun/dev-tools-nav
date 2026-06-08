#!/usr/bin/env bash
# 修复 Umami 访客地区为空：frp 回源时让 nginx 传递真实公网 IP
# 用法：sudo bash scripts/fix-umami-geo.sh

set -euo pipefail

CONF_DIR="/opt/1panel/www/conf.d"
MAP_FILE="${CONF_DIR}/00-client-real-ip.conf"
UMAMI_CONF="${CONF_DIR}/umami.songyuankun.top.conf"

if [[ $EUID -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo bash $0"
  exit 1
fi

if [[ ! -d "$CONF_DIR" ]]; then
  echo "错误：未找到 1Panel 配置目录 $CONF_DIR"
  exit 1
fi

# 从 X-Forwarded-For 提取真实访客 IP（frp 会把公网 IP 放在此头）
cat > "$MAP_FILE" << 'EOF'
# frp 回源时 $remote_addr 为内网地址，从 X-Forwarded-For 取真实访客 IP
map $http_x_forwarded_for $client_real_ip {
    default $remote_addr;
    "~^([^,]+)" $1;
}
EOF

if [[ ! -f "$UMAMI_CONF" ]]; then
  echo "错误：未找到 $UMAMI_CONF"
  exit 1
fi

if grep -q 'X-Real-IP \$client_real_ip' "$UMAMI_CONF"; then
  echo "umami 配置已是 client_real_ip，跳过"
else
  sed -i 's/proxy_set_header X-Real-IP \$remote_addr;/proxy_set_header X-Real-IP $client_real_ip;/' "$UMAMI_CONF"
  echo "已更新 $UMAMI_CONF"
fi

# 重载 OpenResty
if docker ps --format '{{.Names}}' | grep -q '1Panel-openresty'; then
  docker exec 1Panel-openresty-rRvM openresty -t
  docker exec 1Panel-openresty-rRvM openresty -s reload
  echo "OpenResty 已重载"
else
  echo "警告：未找到 OpenResty 容器，请手动在 1Panel 重载 OpenResty"
fi

echo "完成。新访客访问后 Umami 应显示国家/地区（历史数据不会回填）。"
