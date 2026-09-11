#!/usr/bin/env bash
# GTR 主站 × GitHub Pages 三栏一致性检查（Y480 已废弃，仅双站）
# A=18 路由 HTTP 200　B=8 工具实现页关键字矩阵　C=search-console 内容指纹
set -euo pipefail

GTR_BASE="${GTR_BASE:-https://tools.songyuankun.top}"
PAGES_BASE="${PAGES_BASE:-https://songyuankun.github.io/dev-tools-nav}"
# 状态码探测不用 -f，避免 4xx 时把码与兜底 000 拼在一起
CURL_GET=(-sS -L --max-time 12 -A "dev-tools-nav-consistency/1.0")

ROUTES=(
  /
  /search-console.html
  /sitemap.xml
  /robots.txt
  /feed.xml
  /pages/blog/
  /pages/ai/
  /tools/
  /tools/json/
  /tools/jwt/
  /tools/base64/
  /tools/uuid/
  /tools/color/
  /tools/cron/
  /tools/diff/
  /tools/regex/
  /tools/sql-formatter/
  /tools/timestamp/
)

# 实现页（多数 /tools/*/ 为 iframe 壳）→ 关键字全部需命中
declare -A TOOL_KEYWORDS=(
  ["/pages/tools/json.html"]="JSON 工作台|JSON"
  ["/pages/tools/jwt.html"]="JWT|jwt"
  ["/pages/tools/base64.html"]="Base64|base64"
  ["/pages/tools/cron.html"]="Cron|cron"
  ["/pages/tools/regex.html"]="正则|regex"
  ["/pages/tools/sql-formatter.html"]="SQL|sql"
  ["/pages/tools/timestamp.html"]="时间戳|timestamp"
  ["/pages/tools/color.html"]="颜色|color"
)

url_for() {
  local base="$1" path="$2"
  if [[ "$path" == "/" ]]; then
    printf '%s/' "${base%/}"
  else
    printf '%s%s' "${base%/}" "$path"
  fi
}

http_code() {
  local url="$1"
  curl "${CURL_GET[@]}" -o /dev/null -w '%{http_code}' "$url" || true
}

fetch_body() {
  local url="$1"
  curl "${CURL_GET[@]}" "$url" || true
}

sha_of() {
  printf '%s' "$1" | tr -s '[:space:]' ' ' | sha256sum | awk '{print $1}'
}

echo "=== consistency-gtr-x-ghpages ==="
echo "GTR_BASE=$GTR_BASE"
echo "PAGES_BASE=$PAGES_BASE"
echo

a_pass=0
a_fail=0
echo "--- A · HTTP 18 路由 ---"
for path in "${ROUTES[@]}"; do
  gtr_url="$(url_for "$GTR_BASE" "$path")"
  pages_url="$(url_for "$PAGES_BASE" "$path")"
  gtr_c="$(http_code "$gtr_url")"
  pages_c="$(http_code "$pages_url")"
  if [[ "$gtr_c" == "200" && "$pages_c" == "200" ]]; then
    printf 'PASS  %-36s  GTR=%s  Pages=%s\n' "$path" "$gtr_c" "$pages_c"
    a_pass=$((a_pass + 1))
  else
    printf 'FAIL  %-36s  GTR=%s  Pages=%s\n' "$path" "$gtr_c" "$pages_c"
    a_fail=$((a_fail + 1))
  fi
done
echo "A_SUMMARY: PASS=$a_pass/18 FAIL=$a_fail"
echo

b_pass=0
b_fail=0
echo "--- B · 8 工具实现页关键字矩阵 ---"
for path in \
  /pages/tools/json.html \
  /pages/tools/jwt.html \
  /pages/tools/base64.html \
  /pages/tools/cron.html \
  /pages/tools/regex.html \
  /pages/tools/sql-formatter.html \
  /pages/tools/timestamp.html \
  /pages/tools/color.html
do
  keys="${TOOL_KEYWORDS[$path]}"
  gtr_body="$(fetch_body "$(url_for "$GTR_BASE" "$path")")"
  pages_body="$(fetch_body "$(url_for "$PAGES_BASE" "$path")")"
  ok=1
  missing=()
  IFS='|' read -ra PARTS <<< "$keys"
  for key in "${PARTS[@]}"; do
    if ! grep -Fq "$key" <<<"$gtr_body"; then
      ok=0
      missing+=("GTR缺少:$key")
    fi
    if ! grep -Fq "$key" <<<"$pages_body"; then
      ok=0
      missing+=("Pages缺少:$key")
    fi
  done
  if [[ "$ok" -eq 1 ]]; then
    printf 'PASS  %s\n' "$path"
    b_pass=$((b_pass + 1))
  else
    printf 'FAIL  %s  (%s)\n' "$path" "${missing[*]:-unknown}"
    b_fail=$((b_fail + 1))
  fi
done
echo "B_SUMMARY: PASS=$b_pass/8 FAIL=$b_fail"
echo

echo "--- C · search-console 内容指纹 ---"
gtr_sc="$(fetch_body "$(url_for "$GTR_BASE" "/search-console.html")")"
pages_sc="$(fetch_body "$(url_for "$PAGES_BASE" "/search-console.html")")"
gtr_sha="$(sha_of "$gtr_sc")"
pages_sha="$(sha_of "$pages_sc")"
gtr_hits="$(grep -cE 'search-gap|search-queries' <<<"$gtr_sc" || true)"
pages_hits="$(grep -cE 'search-gap|search-queries' <<<"$pages_sc" || true)"
c_ok=1
if [[ -z "$gtr_sc" || -z "$pages_sc" ]]; then
  echo "FAIL  search-console 正文为空  GTR_len=${#gtr_sc} Pages_len=${#pages_sc}"
  c_ok=0
elif [[ "$gtr_sha" != "$pages_sha" ]]; then
  echo "DIFF  search-console SHA  GTR=$gtr_sha  Pages=$pages_sha"
  c_ok=0
else
  echo "PASS  search-console SHA match  $gtr_sha"
fi
if [[ "${gtr_hits:-0}" -lt 3 || "${pages_hits:-0}" -lt 3 ]]; then
  echo "FAIL  search-gap/queries hits  GTR=$gtr_hits  Pages=$pages_hits (need ≥3 each)"
  c_ok=0
else
  echo "PASS  search-gap/queries hits  GTR=$gtr_hits  Pages=$pages_hits"
fi
if [[ "$c_ok" -eq 1 ]]; then
  echo "C_SUMMARY: PASS DIFF=0"
else
  echo "C_SUMMARY: FAIL"
fi
echo

echo "====== FINAL ======"
echo "A HTTP: PASS=$a_pass/18 FAIL=$a_fail"
echo "B KEYS: PASS=$b_pass/8 FAIL=$b_fail"
if [[ "$c_ok" -eq 1 ]]; then
  echo "C SC:   PASS DIFF=0"
else
  echo "C SC:   FAIL"
fi

if [[ "$a_fail" -eq 0 && "$b_fail" -eq 0 && "$c_ok" -eq 1 ]]; then
  echo "RESULT: ALL GREEN"
  exit 0
fi
echo "RESULT: NEEDS ATTENTION"
exit 1
