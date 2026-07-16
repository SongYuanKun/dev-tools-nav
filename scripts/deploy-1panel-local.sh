#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_BIN="${DOCKER_BIN:-docker}"
OPENRESTY_CONTAINER="${OPENRESTY_CONTAINER:-1Panel-openresty-rRvM}"
SITE_BASE="${SITE_BASE:-/www/sites/tools.songyuankun.top}"
SITE_OWNER="${SITE_OWNER:-ubuntu:ubuntu}"
TARGET="$SITE_BASE/index"
NEXT="$SITE_BASE/.index-next"
OLD="$SITE_BASE/.index-old"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

required=(
  index.html sitemap.xml feed.xml favicon.svg
  tools/json/index.html
  pages/blog/java-source-mybatis.html
)
preserved=(
  baidu_verify_codeva-TByQYpVHM2.html
  googleb710668c9aa28d4e.html
)

for relative in "${required[@]}"; do
  [[ -f "$ROOT_DIR/$relative" ]] || { echo "Missing build artifact: $relative" >&2; exit 1; }
done

rsync -a --delete \
  --exclude='.git' --exclude='.github' --exclude='README.md' --exclude='.gitignore' \
  --exclude='docs' --exclude='content' --exclude='package.json' --exclude='package-lock.json' \
  --exclude='node_modules' --exclude='scripts' --exclude='deploy.sh' --exclude='logs' \
  --exclude='*.bak' --exclude='.DS_Store' \
  --exclude='baidu_verify_codeva-TByQYpVHM2.html' \
  --exclude='googleb710668c9aa28d4e.html' \
  "$ROOT_DIR/" "$STAGE/"

[[ ! -e "$STAGE/content" ]] || { echo "Source content leaked into deployment payload" >&2; exit 1; }

"$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
  target=$1; next=$2; old=$3
  if [ ! -d "$target" ] && [ -d "$old" ]; then mv "$old" "$target"; fi
  rm -rf "$next"
  mkdir -p "$next"
' _ "$TARGET" "$NEXT" "$OLD"

"$DOCKER_BIN" cp "$STAGE/." "$OPENRESTY_CONTAINER:$NEXT/"

for filename in "${preserved[@]}"; do
  "$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
    target=$1; next=$2; filename=$3
    if [ -f "$target/$filename" ]; then cp "$target/$filename" "$next/$filename"; fi
  ' _ "$TARGET" "$NEXT" "$filename"
done

required_lines="$(printf '%s\n' "${required[@]}")"
"$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
  target=$1; next=$2; old=$3; required=$4; owner=$5
  chown -R "$owner" "$next"
  rm -rf "$old"
  if [ -d "$target" ]; then mv "$target" "$old"; fi
  if ! mv "$next" "$target"; then
    [ ! -d "$old" ] || mv "$old" "$target"
    exit 1
  fi
  failed=0
  while IFS= read -r relative; do
    [ -z "$relative" ] || [ -f "$target/$relative" ] || failed=1
  done <<EOF
$required
EOF
  if [ "$failed" -ne 0 ] || [ -e "$target/content" ]; then
    rm -rf "$target"
    [ ! -d "$old" ] || mv "$old" "$target"
    exit 1
  fi
  rm -rf "$old"
' _ "$TARGET" "$NEXT" "$OLD" "$required_lines" "$SITE_OWNER"

echo "Deployed to $OPENRESTY_CONTAINER:$TARGET"
