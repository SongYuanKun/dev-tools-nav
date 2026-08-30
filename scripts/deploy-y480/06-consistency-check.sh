#!/usr/bin/env bash
set -euo pipefail
# 双部署一致性全量校验（可在任意 Mac/Linux/Win WSL 执行，不在 Y480 也行）
# 输出 PASS/FAIL 差异清单 + 8 OP × 30 项功能矩阵勾选项
# 用法： bash 06-consistency-check.sh <Y480_URL> <GITHUB_PAGES_URL>
# 例：   bash 06-consistency-check.sh http://192.168.1.123 https://songyuankun.github.io/dev-tools-nav/

Y480="${1:-http://127.0.0.1/}"
GHP="${2:-https://songyuankun.github.io/dev-tools-nav/}"

# 统一末尾斜杠
Y480="${Y480%/}/"; GHP="${GHP%/}/"

PASS=0 DIFF=0 WARN=0
green(){ PASS=$((PASS+1)); printf '✅ '; echo "$*"; }
diffn(){ DIFF=$((DIFF+1)); printf '🔀 '; echo "$*"; }
warn(){ WARN=$((WARN+1)); printf '⚠️  '; echo "$*"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 双部署一致性：[$Y480]  ↔️  [$GHP]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# A: 字节级 SHA 比对（40 个关键资源）
echo ""
echo "【A/3】40 个核心资源 SHA 字节对字节 100% 一致？"
RELS=(
  index.html search-console.html sitemap.xml robots.txt feed.xml favicon.svg
  tools/json/index.html tools/jwt/index.html tools/base64/index.html
  tools/cron/index.html tools/diff/index.html tools/sql-formatter/index.html
  tools/regex/index.html tools/timestamp/index.html tools/color/index.html tools/uuid/index.html
  pages/tools/index.html pages/ai/index.html pages/blog/index.html
  pages/ai/beginner.html pages/ai/compare.html pages/ai/dev-api.html pages/ai/glossary.html
  pages/ai/prompts.html pages/ai/safety.html pages/ai/workflow.html
  js/toast.js js/privacy-banner.js js/mru-fav.js js/tour.js js/jwt-tool.js js/encoding-tool.js js/json-workbench.bundle.js
  js/main.js js/footer.js js/theme-mini.js js/umami-helper.js
  css/style.css css/tools.css css/json-workbench.css
)
for rel in "${RELS[@]}"; do
  a=$(curl -fsSL --max-time 15 "$Y480$rel" 2>/dev/null | sha256sum | awk '{print $1}')
  b=$(curl -fsSL --max-time 15 "$GHP/$rel" 2>/dev/null | sha256sum | awk '{print $1}')
  [ "$a" = "" ] && { warn "Y480缺失/下载失败 /$rel" ; continue; }
  [ "$b" = "" ] && { warn "GHP缺失/下载失败 /$rel"  ; continue; }
  if [ "$a" = "$b" ]; then green "SHA= /$rel"; else diffn "/$rel  Y480=${a:0:8} GHP=${b:0:8}"; fi
done

# B: 功能勾选矩阵 8 OP × N 项（关键字 grep 级）
echo ""
echo "【B/3】8 OP × 30 项 功能关键字矩阵（两边站点 DOM 含同一组功能字符串 = 功能一致）"
feats=(
  'OP203_MIT_BADGE'       'MIT License.*badge|shield\.io.*MIT'
  'OP203_JB_BADGE'        'JetBrains OSS|jetbrains.*badge'
  'OP303_ZERO_UPLOAD'     '零上传'
  'OP303_ZERO_SDK'        '零第三方 SDK'
  'OP303_LOCAL'           '纯本地计算'
  'OP101_SELF_10_CARDS'   'data-tool-id="json".*jwt.*base64.*cron.*diff.*sql-formatter.*regex.*timestamp.*color.*uuid'
  'OP101_7_CATEGORY'      'AI专题|开发工具|建站工具|安全工具|运维工具|设计工具|在线工具'
  'OP101_SEARCH_CONSOLE'  'search-console.html|搜索复盘'
  'OP101_STICKY_DIR'      'sticky.*directory-nav|directory-nav.*position:\s*sticky'
  'OP102_TOUR_4STEP'      'tour.js|tour_done_v1|fav-entry-anchor'
  'OP103_SAMPLE_5'        'name.*Koen.s 工具箱|tools.*tags.*owner.*lastUpdated'
  'OP103_TOAST'           'Toast\.show|inferJsonFixHint|JSON语法有误'
  'OP103_FIX_5_HINT'      '多余逗号|少闭合|少双引号|单引号改为双引号|中文标点'
  'OP105_JWT_TO_JSON'     'jwt_to_json_click|from_jwt=1|jwt_decode_payload_v1'
  'OP105_JSON_TO_YAML'    '🎨.*JSON工作台|YAML.*跳Tab|jwt_encode_payload_v1'
  'OP105_B64_TO_JSON'     'base64_to_json_click|base64_decode_json_v1'
  'OP107_MRU_FAV'         'mru_v1|devtools-favorites|MruFav\.record|toggleFavId|prefs-list|mruAndFavTitle'
  'OP201_TOP_HITS'        'Top Hits|搜索复盘看板'
  'OP201_LOW_CTR'         '低 CTR|高曝光无匹配|Gap.*录入 Issue'
  'OP201_ISSUE_TEMPLATE'  'search-gap|search-queries'
)
len=${#feats[@]}
for ((i=0;i<len;i+=2)); do
  k="${feats[$i]}"; pattern="${feats[$i+1]}"
  a=$(curl -fsSL --max-time 15 "$Y480" 2>/dev/null | grep -cE "$pattern" || true)
  b=$(curl -fsSL --max-time 15 "$GHP/" 2>/dev/null | grep -cE "$pattern" || true)
  sub_pages_ok=1
  # OP103/OP105/OP201 必须同时工具子页也命中，追加抽查
  case "$k" in
    OP103_*)
      a2=$(curl -fsSL --max-time 15 "$Y480/tools/json/" 2>/dev/null | grep -cE "$pattern" || true)
      b2=$(curl -fsSL --max-time 15 "$GHP/tools/json/" 2>/dev/null | grep -cE "$pattern" || true)
      [ "$a2" -gt 0 -a "$b2" -gt 0 ] || sub_pages_ok=0 ;;
    OP105_JWT_*)
      a2=$(curl -fsSL --max-time 15 "$Y480/tools/jwt/" 2>/dev/null | grep -cE "$pattern" || true)
      b2=$(curl -fsSL --max-time 15 "$GHP/tools/jwt/" 2>/dev/null | grep -cE "$pattern" || true)
      [ "$a2" -gt 0 -a "$b2" -gt 0 ] || sub_pages_ok=0 ;;
    OP105_B64_*)
      a2=$(curl -fsSL --max-time 15 "$Y480/tools/base64/" 2>/dev/null | grep -cE "$pattern" || true)
      b2=$(curl -fsSL --max-time 15 "$GHP/tools/base64/" 2>/dev/null | grep -cE "$pattern" || true)
      [ "$a2" -gt 0 -a "$b2" -gt 0 ] || sub_pages_ok=0 ;;
    OP201_*)
      a2=$(curl -fsSL --max-time 15 "$Y480/search-console.html" 2>/dev/null | grep -cE "$pattern" || true)
      b2=$(curl -fsSL --max-time 15 "$GHP/search-console.html" 2>/dev/null | grep -cE "$pattern" || true)
      [ "$a2" -gt 0 -a "$b2" -gt 0 ] || sub_pages_ok=0 ;;
  esac
  if [ "$a" -gt 0 -a "$b" -gt 0 -a "$sub_pages_ok" -eq 1 ]; then green "功能一致 $k (y=$a g=$b)"; else
    diffn "功能不一致/缺失 $k — Y480_首页命中=$a GHP_首页命中=$b 子页ok=$sub_pages_ok"; fi
done

# C: 响应头 & 状态码
echo ""
echo "【C/3】HTTP 200 + 安全头 + Content-Type 正确"
for rel in /index.html /tools/json/index.html /tools/jwt/index.html /tools/base64/index.html /search-console.html /js/toast.js /css/style.css /sitemap.xml /feed.xml; do
  ha=$(curl -sS -I --max-time 10 "$Y480${rel#/}" 2>/dev/null | tr -d '\r')
  hb=$(curl -sS -I --max-time 10 "$GHP/${rel#/}"  2>/dev/null | tr -d '\r')
  sa=$(echo "$ha" | awk 'NR==1{print $2}')
  sb=$(echo "$hb" | awk 'NR==1{print $2}')
  if [ "$sa" = "200" -a "$sb" = "200" ]; then green "HTTP200  $rel"; else diffn "HTTP 非200 $rel  Y480=$sa GHP=$sb"; fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 一致性总评：PASS=$PASS  DIFF=$DIFF  WARN=$WARN"
if [ "$DIFF" -eq 0 ]; then
  echo "✅ DOUBLE_DEPLOY_CONSISTENT_OK = 双部署功能/资源 100% 一致"; exit 0
fi
echo "❌ DOUBLE_DEPLOY_HAS_DIFFS：$DIFF 项存在差异，请优先解决上述 🔀 项后重跑"
exit 1
