#!/usr/bin/env bash
# 兼容入口：手动发布走与定时器相同的门禁。

set -euo pipefail

exec systemctl --user start dev-tools-nav-deploy.service
