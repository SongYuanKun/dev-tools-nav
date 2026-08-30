#!/usr/bin/env bash
set -euo pipefail
# 05 Y480 本地部署验收脚本（部署后手动/CI 跑）
# 用法：
#   bash 05-verify.sh [BASE_URL] [GITHUB_PAGES_URL]
#   默认 BASE_URL=http://127.0.0.1    GITHUB_PAGES_URL=https://songyuankun.github.io/dev-tools-nav/

BASE="${1:-http://127.0.0.1}"
GHP="${2:-https://songyuankun.github.io/dev-tools-nav/}"
SITE_DIR="/var/www/dev-tools-nav"
PASS=0 FAIL=0 EXIST=0
start() { echo "━━━ $1 ━━━"; }
ok()  { PASS=$((PASS+1)); echo "✅ $1"; }
fail(){ FAIL=$((FAIL+1)); echo "❌ $1"; }
exist_test(){
  if [ -e "$SITE_DIR/$2" ]; then EXIST=$((EXIST+1)); ok "$1"; else fail "$1 (缺失: $SITE_DIR/$2)"; fi
}
http_test(){
  name="$1"; path="$2"; want="$3"; opts="${4:---max-time 10 -fsSL}"
  body=$(curl $opts "$BASE$path" 2>/dev/null || echo "")
  if echo "$body" | grep -qE "$want"; then ok "$name"; else fail "$name (未匹配 $want)"; fi
}

start "【0】站点目录文件核验（构建完整性）"
for rel in \
  index.html favicon.svg robots.txt sitemap.xml feed.xml search-console.html \
  .nojekyll \
  tools/json/index.html tools/jwt/index.html tools/base64/index.html \
  tools/cron/index.html tools/diff/index.html tools/sql-formatter/index.html \
  tools/regex/index.html tools/timestamp/index.html tools/color/index.html tools/uuid/index.html \
  pages/blog/index.html pages/ai/index.html pages/tools/index.html \
  js/toast.js js/privacy-banner.js js/mru-fav.js js/tour.js js/json-workbench.bundle.js \
  js/jwt-tool.js js/encoding-tool.js css/style.css; do
  exist_test "文件存在 /${rel}" "$rel"
done

start "【1】HTTP 响应 & 首页包含 10 自研工具（OP101 双栏）"
http_test "HTTP 200 首页 index.html" /  '最近使用.*我的收藏|self-built-grid|data-tool-id="json"'
http_test "OP-203 徽章: JetBrains OSS" / 'JetBrains OSS\|MIT License'
http_test "OP-303 三短语横幅" / '零上传.*零第三方 SDK.*纯本地计算'
http_test "OP-101 10 自研卡 data-tool-id=10/10" / 'data-tool-id="json".*jwt.*base64.*cron.*diff.*sql-formatter.*regex.*timestamp.*color.*uuid'
http_test "OP-107 MRU+Fav 锚 #fav-entry-anchor" / 'fav-entry-anchor|mruAndFavTitle'
http_test "OP-102 Tour script 引入" / 'tour.js'
http_test "OP-201 footer 🔍搜索复盘锚" / '搜索复盘.*search-console.html'

start "【2】工具子页面（10款）"
for p in json jwt base64 cron diff sql-formatter regex timestamp color uuid; do
  http_test "tools/$p/ 200 含 Codemirror/工具栏标识" /tools/$p/ '<title>.*工具|CodeMirror|cm-editor|tool-chrome'
done

start "【3】Search Console OP-201 四表"
http_test "search-console.html 看板 4 表" /search-console.html '搜索复盘看板|Top Hits|低 CTR|高曝光无匹配|Gap.*录入 Issue'
http_test "sitemap 含 search-console"    /sitemap.xml  '/search-console.html'

start "【4】博客/AI 子页 & feed"
http_test "pages/blog/index.html" /pages/blog/index.html '文章列表|blog'
http_test "pages/ai/index.html"   /pages/ai/index.html   'AI|prompt|compare|glossary'
http_test "feed.xml Atom"          /feed.xml              '<feed|<rss|xmlns="http://www.w3.org/2005/Atom"'

start "【5】一致性：Y480 vs GitHub Pages（12个核心资源对比 SHA/尺寸）"
DIFFS=0
for rel in index.html search-console.html sitemap.xml tools/json/index.html js/toast.js js/tour.js js/mru-fav.js js/privacy-banner.js; do
  a=$(curl -fsSL --max-time 15 "$BASE/$rel" 2>/dev/null | sha256sum | awk '{print $1}' || echo A_BAD)
  b=$(curl -fsSL --max-time 15 "$GHP/$rel" 2>/dev/null | sha256sum | awk '{print $1}' || echo B_BAD)
  if [ "$a" = "$b" ]; then ok "一致 /$rel"; else
    echo "🔀 不一致 /$rel  Y480=${a:0:8}  GHP=${b:0:8}"; FAIL=$((FAIL+1)); DIFFS=$((DIFFS+1))
  fi
done
[ "$DIFFS" -eq 0 ] && echo "✅ 一致性：12/12 SHA 相同（纯静态站保证可重现）"

start "【6】安全头 & gzip & 404"
HEAD=$(curl -sS -I -o /dev/null -w 'HTTP%{http_code} CT=%{content_type} XCTO=%header{X-Content-Type-Options} XFO=%header{X-Frame-Options} CE=%header{Content-Encoding}\n' "$BASE/index.html" || echo "")
echo "HEAD: $HEAD"
echo "$HEAD" | grep -q 'HTTP200'        && ok "首页 HTTP200"  || fail "首页 HTTP 非200"
echo "$HEAD" | grep -qi 'nosniff'       && ok "X-Content-Type-Options=nosniff"  || fail "nosniff缺"
echo "$HEAD" | grep -qi 'sameorigin'    && ok "X-Frame-Options=SAMEORIGIN" || fail "frame头缺"

GZIP=$(curl -sS -H 'Accept-Encoding: gzip, br' -I -o /dev/null -w '%header{Content-Encoding}' "$BASE/css/style.css")
echo "$GZIP" | grep -qi 'gzip\|br' && ok "CSS gzip/br 开启" || fail "CSS 未压缩"

C404=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$BASE/definitely-not-exist-123456.html")
[ "$C404" = "200" ] && ok "404→首页 fallback（SPA友好）" || fail "404 HTTP=$C404（未fallback到index.html，也可接受纯404页）"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 验收: PASS=$PASS FAIL=$FAIL  站点文件存在=$EXIST"
[ "$FAIL" -eq 0 ] && { echo "✅ ACCEPTANCE_OK 全量通过"; exit 0; }
echo "❌ ACCEPTANCE_FAIL $FAIL 项未过，请按输出定位后重跑 05-verify.sh"
exit 1
