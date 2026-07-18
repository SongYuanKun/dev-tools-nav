#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${SITE_SOURCE_DIR:-$SCRIPT_ROOT}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
OPENRESTY_CONTAINER="${OPENRESTY_CONTAINER:-1Panel-openresty-rRvM}"
SITE_BASE="${SITE_BASE:-/www/sites/tools.songyuankun.top}"
SITE_OWNER="${SITE_OWNER:-ubuntu:ubuntu}"
VERIFICATION_SOURCE_DIR="${VERIFICATION_SOURCE_DIR:-$HOME/.local/share/dev-tools-nav-verification}"
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
  [[ -f "$SOURCE_DIR/$relative" ]] || { echo "Missing build artifact: $relative" >&2; exit 1; }
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
  "$SOURCE_DIR/" "$STAGE/"

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
  if "$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" test -s "$TARGET/$filename"; then
    "$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" cp "$TARGET/$filename" "$NEXT/$filename"
  elif [[ -s "$VERIFICATION_SOURCE_DIR/$filename" ]]; then
    "$DOCKER_BIN" cp "$VERIFICATION_SOURCE_DIR/$filename" "$OPENRESTY_CONTAINER:$NEXT/$filename"
  else
    echo "Missing verification file: $filename" >&2
    exit 1
  fi
  "$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" test -s "$NEXT/$filename"
  "$DOCKER_BIN" exec "$OPENRESTY_CONTAINER" chmod 0644 "$NEXT/$filename"
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
  rm -f "$marker"
  committed=1
  trap - EXIT
  if ! rm -rf "$old"; then
    echo "Warning: verified release is active, but old cleanup failed: $old" >&2
  fi
' _ "$TARGET" "$NEXT" "$OLD" "$MARKER" "$required_lines" "$SITE_OWNER"

REMOTE_DIRTY=0
echo "Deployed to $OPENRESTY_CONTAINER:$TARGET"
