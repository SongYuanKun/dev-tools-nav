#!/usr/bin/env bash
set -euo pipefail
# 03 轮询 & 构建 & 部署（支持 oneshot 手动，也被 systemd timer 每10分钟调用）
# 参数：$1 可选 = 强制目标 SHA（默认 main 最新）
# 站点目录：/var/www/dev-tools-nav  工作缓存：~/.cache/dev-tools-nav
# 门禁：只有 SHA 的 test.yml 在 GitHub Actions 标绿才部署，否则跳过下次重试

SUDO=""
[ -w /var/www ] || SUDO="sudo"

REMOTE="https://github.com/SongYuanKun/dev-tools-nav.git"
SITE_DIR="/var/www/dev-tools-nav"
STATE_DIR="$HOME/.local/state/dev-tools-nav-y480"
CACHE_DIR="$HOME/.cache/dev-tools-nav-y480"
SHA_FILE="$STATE_DIR/last-deployed-sha"
LOG_FILE="$STATE_DIR/deploy.log"

mkdir -p "$STATE_DIR" "$CACHE_DIR"
touch "$LOG_FILE"
log(){ echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"; }

log "=== 开始轮询 ==="

# 1. 读 main SHA
TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  TARGET="$(git ls-remote --heads "$REMOTE" main 2>/dev/null | awk '{print $1}')"
  [ -z "$TARGET" ] && { log "❌ 无法读取 main SHA，下轮重试"; exit 0; }
fi
log "main@${TARGET:0:8}"

# 2. 短路：已部署
CURR=""
[ -f "$SHA_FILE" ] && CURR="$(cat "$SHA_FILE")"
if [ "$CURR" = "$TARGET" ]; then
  log "SKIP $TARGET 已部署"
  exit 0
fi

# 3. Test Push Run 门禁（只有 GitHub Actions Test 标绿才允许部署）
GHA_STATUS="pending"
RCHECK="$(curl -fsSL --max-time 15 \
  "https://api.github.com/repos/SongYuanKun/dev-tools-nav/commits/${TARGET}/check-runs?per_page=100" 2>/dev/null \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); r=[x for x in d.get("check_runs",[]) if x.get("name")=="Test" or x.get("name")=="unit"]; print(r[-1]["conclusion"] if r and r[-1].get("status")=="completed" else "pending")' 2>/dev/null || echo pending)"
[ "$RCHECK" != "" ] && GHA_STATUS="$RCHECK"
if [ "$GHA_STATUS" != "success" ]; then
  log "⏸  GHA Test=${GHA_STATUS} 门禁未通过，跳过部署，下轮重试"
  exit 0
fi
log "✅ GHA Test=success 门禁通过"

# 4. 干净缓存 → 克隆（浅）→ 安装 → 构建 → 门禁产物 → rsync 原子发布
WORK="$CACHE_DIR/work-${TARGET:0:8}"
rm -rf "$WORK"
log "[1/5] clone $TARGET"
git clone --depth 50 --branch main --single-branch "$REMOTE" "$WORK" >/dev/null 2>&1
git -C "$WORK" reset --hard "$TARGET" >/dev/null 2>&1

log "[2/5] npm ci（~100秒，Y480 HDD 可能慢）"
( cd "$WORK" && npm ci --no-audit --no-fund > "$STATE_DIR/npmci.log" 2>&1 ) || {
  log "❌ npm ci 失败：$STATE_DIR/npmci.log"; exit 1; }

log "[3/5] npm run build (rollup+blog+sitemap)"
( cd "$WORK" && npm run build > "$STATE_DIR/build.log" 2>&1 ) || {
  log "❌ build 失败：$STATE_DIR/build.log"; exit 1; }
( cd "$WORK" && npm run check:generated > "$STATE_DIR/check.log" 2>&1 ) || {
  log "❌ check:generated 失败：$STATE_DIR/check.log"; exit 1; }

log "[4/5] rsync 原子发布到 $SITE_DIR"
RSYNC_FROM="$WORK/"
EXCLUDES=(
  --exclude='.git' --exclude='.github' --exclude='.gitignore'
  --exclude='node_modules' --exclude='logs' --exclude='content'
  --exclude='package.json' --exclude='package-lock.json'
  --exclude='deploy.sh' --exclude='tasks' --exclude='scripts' --exclude='ops'
  --exclude='*.bak' --exclude='.DS_Store'
)
$SUDO mkdir -p "$SITE_DIR"
$SUDO rsync -a --delete "${EXCLUDES[@]}" "$RSYNC_FROM" "$SITE_DIR/"
echo -n | $SUDO tee "$SITE_DIR/.nojekyll" >/dev/null
echo "$TARGET" | $SUDO tee "$SITE_DIR/.deploy-sha" >/dev/null

# 5. SHA 原子写入 + Nginx reload
echo -n "$TARGET" > "$SHA_FILE"
$SUDO nginx -t && $SUDO systemctl reload nginx || {
  log "❌ Nginx reload 失败，请检查配置"; exit 1; }
rm -rf "$WORK"

log "✅ DEPLOYED main@${TARGET:0:8} 站点: $SITE_DIR"
exit 0
