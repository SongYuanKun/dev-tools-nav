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
MARKER="$SITE_BASE/.deploy-in-progress"
STAGE="$(mktemp -d)"
REMOTE_DIRTY=0

cleanup() {
  status=$?
  trap - EXIT
  rm -rf "$STAGE"
  if [[ "$REMOTE_DIRTY" == "1" ]]; then
    "$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
      target=$1; next=$2; old=$3; marker=$4
      if [ -e "$marker" ]; then
        if [ -d "$old" ]; then
          rm -rf "$target"
          mv "$old" "$target"
        fi
        rm -f "$marker"
      fi
      rm -rf "$next"
    ' _ "$TARGET" "$NEXT" "$OLD" "$MARKER" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

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
  --include='/assets/***' \
  --include='/css/***' \
  --include='/data/***' \
  --include='/js/***' \
  --include='/pages/***' \
  --include='/tools/***' \
  --include='/index.html' \
  --include='/favicon.ico' \
  --include='/favicon.svg' \
  --include='/feed.xml' \
  --include='/robots.txt' \
  --include='/sitemap.xml' \
  --exclude='*' \
  "$ROOT_DIR/" "$STAGE/"

REMOTE_DIRTY=1
"$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
  target=$1; next=$2; old=$3; marker=$4
  if [ -e "$marker" ]; then
    if [ -d "$old" ]; then
      rm -rf "$target"
      mv "$old" "$target"
    fi
    rm -f "$marker"
  elif [ ! -d "$target" ] && [ -d "$old" ]; then
    mv "$old" "$target"
  fi
  rm -rf "$next"
  mkdir -p "$next"
' _ "$TARGET" "$NEXT" "$OLD" "$MARKER"

"$DOCKER_BIN" cp "$STAGE/." "$OPENRESTY_CONTAINER:$NEXT/"

for filename in "${preserved[@]}"; do
  "$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
    target=$1; next=$2; filename=$3
    if [ -f "$target/$filename" ]; then cp "$target/$filename" "$next/$filename"; fi
  ' _ "$TARGET" "$NEXT" "$filename"
done

required_lines="$(printf '%s\n' "${required[@]}")"
"$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" sh -ec '
  target=$1; next=$2; old=$3; marker=$4; required=$5; owner=$6
  committed=0
  rollback() {
    status=$?
    trap - EXIT
    if [ "$committed" -eq 0 ]; then
      if [ -e "$marker" ] && [ -d "$old" ]; then
        rm -rf "$target"
        mv "$old" "$target"
      fi
      rm -rf "$next"
      rm -f "$marker"
    fi
    exit "$status"
  }
  trap rollback EXIT
  chown -R "$owner" "$next"
  rm -rf "$old"
  : > "$marker"
  if [ -d "$target" ]; then mv "$target" "$old"; fi
  mv "$next" "$target"
  failed=0
  while IFS= read -r relative; do
    [ -z "$relative" ] || [ -f "$target/$relative" ] || failed=1
  done <<EOF
$required
EOF
  [ "$failed" -eq 0 ] || exit 1
  rm -rf "$old"
  rm -f "$marker"
  committed=1
  trap - EXIT
' _ "$TARGET" "$NEXT" "$OLD" "$MARKER" "$required_lines" "$SITE_OWNER"

REMOTE_DIRTY=0
echo "Deployed to $OPENRESTY_CONTAINER:$TARGET"
