#!/usr/bin/env bash
# 兼容入口：本机手动部署统一委托给原子部署脚本。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "构建发布生成物..."
npm run build

exec "$ROOT_DIR/scripts/deploy-1panel-local.sh"
