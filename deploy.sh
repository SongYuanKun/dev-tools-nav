#!/usr/bin/env bash
# 本地部署到 1Panel 静态站 (tools.songyuankun.top)
# 1Panel 网站根目录: /opt/1panel/www/sites/tools.songyuankun.top/index

set -e
ROOT="/opt/1panel/www/sites/tools.songyuankun.top/index"

if [[ ! -d "$ROOT" ]]; then
  echo "错误: 目录不存在: $ROOT"
  exit 1
fi

rsync -av --delete --delete-excluded \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='README.md' \
  --exclude='.gitignore' \
  --exclude='docs' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='node_modules' \
  --exclude='deploy.sh' \
  ./ "$ROOT/"

echo "已同步到 $ROOT"
