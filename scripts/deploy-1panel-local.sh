#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${SITE_SOURCE_DIR:-}"
release_sha="${RELEASE_SHA:-}"
release_guard="$DEPLOY_DIR/poll-github-deploy.sh"
lock_file="${CACHE_DIR:-$HOME/.cache/dev-tools-nav-deploy}/deploy.lock"
FLOCK_BIN="${FLOCK_BIN:-flock}"

if [[ -z "$SOURCE_DIR" || ! "$release_sha" =~ ^[0-9a-f]{40}([0-9a-f]{24})?$ ]] ||
   [[ ! "$lock_file" -ef /dev/fd/9 ]] || ! "$FLOCK_BIN" -n 9; then
  echo 'Release requires a candidate SHA and the deploy lock. Start dev-tools-nav-deploy.service.' >&2
  exit 1
fi
if [[ ! -x "$release_guard" ]]; then
  echo 'The installed release verifier is unavailable.' >&2
  exit 1
fi

published_dirs=(assets css data js pages tools)
published_files=(
  index.html search-console.html favicon.ico favicon.svg feed.xml robots.txt sitemap.xml
  manifest.webmanifest sw.js offline.html LICENSE CODE_OF_CONDUCT.md CONTRIBUTING.md manual.md
)
"$release_guard" --verify-release "$SOURCE_DIR" "$release_sha" \
  "${published_dirs[@]}" "${published_files[@]}" scripts/stamp-asset-version.mjs

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
ASSET_VERSION_PLACEHOLDER='__ASSET_VERSION__'

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
  search-console.html
  manifest.webmanifest sw.js offline.html
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

filters=()
for path in "${published_dirs[@]}"; do filters+=("--include=/$path/***"); done
for path in "${published_files[@]}"; do filters+=("--include=/$path"); done
rsync -a --delete "${filters[@]}" --exclude='*' "$SOURCE_DIR/" "$STAGE/"

# Stamp CSS/JS ?v= on the staging tree only (source keeps __ASSET_VERSION__ placeholder).
# Prefer the verified checkout script, with the trusted installed companion as fallback.
stamp_script=""
for candidate in \
  "$SOURCE_DIR/scripts/stamp-asset-version.mjs" \
  "$DEPLOY_DIR/stamp-asset-version.mjs"
do
  if [[ -f "$candidate" ]]; then
    stamp_script="$candidate"
    break
  fi
done
if [[ -z "$stamp_script" ]]; then
  echo "ERROR: stamp-asset-version.mjs not found. Refusing to publish $ASSET_VERSION_PLACEHOLDER placeholders." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required to stamp asset versions before deploy." >&2
  exit 1
fi

node "$stamp_script" --root "$STAGE" --version "${release_sha:0:12}"

leftover="$(grep -R -l --include='*.html' --include='sw.js' -F -- "$ASSET_VERSION_PLACEHOLDER" "$STAGE" 2>/dev/null || true)"
if [[ -n "$leftover" ]]; then
  echo "ERROR: $ASSET_VERSION_PLACEHOLDER remains in STAGE after stamp; aborting deploy:" >&2
  printf '%s\n' "$leftover" >&2
  exit 1
fi

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

"$release_guard" --assert-current-main "$release_sha"
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
