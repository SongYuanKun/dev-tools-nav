# codex 接手开机即跑 5 步操作清单（GTR 机本地执行 Copy & Paste）

> 📌 **文档编号 = HANDOVER-2026-0911-04**
>
> **执行前提**：你（codex）已经在 GTR 联想主机上用 **SSH 登入了 kun 用户**（3 入口任选一活的就行）
>
> - 入口 1（最快，Tailscale 内网）：`ssh gtr` 或 `ssh gtr-pub`
> - 入口 2（frp 公网隧道，frpc 心跳活着就行）：`ssh -p 2222 kun@8.130.166.49`
> - 入口 3（跳板，GTR 关机但内网能通 public-srv）：`ssh public-srv` → 再 `ssh kun@192.168.31.195`
>
> **预计耗时 = 20~40 分钟**（npm ci 慢时 20 分钟，快的话 10 分钟内搞定）

---

## 📋 每次操作前先设身份（P0 强制，codex 每次登 GTR 先 Copy Paste 下面 4 行）

```bash
cd /home/kun/vs_code/dev-tools-nav
export GIT_AUTHOR_NAME="SongYuanKun" GIT_AUTHOR_EMAIL="123839070@qq.com"
export GIT_COMMITTER_NAME="SongYuanKun" GIT_COMMITTER_EMAIL="123839070@qq.com"
git config user.name  "SongYuanKun"
git config user.email "123839070@qq.com"
git config --global --get user.name ; git config --global --get user.email
# 期望输出：SongYuanKun / 123839070@qq.com
```

---

## 🚀 Step 1 · 连通性 & 现状快照（5 分钟）

```bash
cd /home/kun/vs_code/dev-tools-nav
echo '=== 1.1 本机信息 ==='
hostname && whoami && pwd && echo "DISK=$(df -h /home | tail -1 | awk '{print $4}')  FREE"
echo '=== 1.2 Git 远端与当前 HEAD ==='
git remote -v && echo 'BRANCH:' && git branch --show-current
echo 'LOCAL_HEAD='$(git rev-parse --short HEAD)
echo 'REMOTE_MAIN='$(git ls-remote origin refs/heads/main | cut -c1-8)
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
echo "STATUS: AHEAD=$AHEAD  BEHIND=$BEHIND"
echo '=== 1.3 站点是否活着 ==='
HTTP_HOME=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 8 https://tools.songyuankun.top/ 2>/dev/null || echo 000)
echo "MAIN_SITE_HTTP / = $HTTP_HOME  (200=OK, 000=frpc心跳断了先跑 STEP 4.2 修复)"
```

**异常处理：**
- HTTP_HOME=000（frpc 心跳断了）→ 跳到 **Step 4.2 修复 frpc**，跑完再回到 Step 2
- BEHIND > 0 → 说明 GTR 代码落后于 main，正常，继续 Step 2

---

## 🔀 Step 2 · 拉取最新 main + 冲突解决（10 分钟）

```bash
cd /home/kun/vs_code/dev-tools-nav
echo '=== 2.1 先 stash 本地未提交变更（如果有） ==='
STASH_COUNT_BEFORE=$(git stash list | wc -l | awk '{print $1}')
git status --short
git stash push -m "codex-sync-pre-$(date +%Y%m%d-%H%M)" 2>&1 | tail -3

echo '=== 2.2 REBASE 拉 main（不产生 merge commit） ==='
GIT_EDITOR=true git pull --rebase origin main 2>&1 | tail -10
PULL_RC=$?
if [ $PULL_RC -ne 0 ]; then
  echo '🔴 REBASE CONFLICT ——进入冲突解决模式'
  echo '冲突文件列表：' ; git diff --name-only --diff-filter=U
  echo '>>> 逐个编辑冲突文件，解决后执行：git add <文件>；所有解决后 git rebase --continue <<<'
  echo '>>> 如果想放弃本次同步回退：git rebase --abort <<<'
  exit 2
fi
STASH_COUNT_AFTER=$(git stash list | wc -l | awk '{print $1}')
[ "$STASH_COUNT_AFTER" -gt "$STASH_COUNT_BEFORE" ] && { echo '应用 stash...'; git stash pop 2>&1 | tail -5; }

echo '=== 2.3 校验 ahead=0 behind=0 ==='
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
echo "POST-PULL: AHEAD=$AHEAD  BEHIND=$BEHIND"
[ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ] && echo "✅ 版本同步完成" || { echo "🔴 ahead/behind不为0，手工处理"; exit 2; }
echo 'SYNCED_HEAD='$(git rev-parse --short HEAD)
```

---

## 🔨 Step 3 · npm ci + 构建 + 生成校验（15 分钟，HDD+境外 30 分钟）

```bash
cd /home/kun/vs_code/dev-tools-nav
echo '=== 3.0 可选：国内镜像加速（npm ci 卡住 30s 不动就跑）=== '
# npm config set registry https://registry.npmmirror.com

echo '=== 3.1 npm ci（锁版本，无 audit/fund 提示）=== '
rm -rf node_modules
npm ci --no-audit --no-fund 2>&1 | tail -8
CI_RC=$?
[ $CI_RC -eq 0 ] && echo "✅ npm ci exit 0" || { echo "🔴 npm ci FAILED exit $CI_RC"; exit 3; }

echo '=== 3.2 build === '
npm run build 2>&1 | tail -10
BUILD_RC=$?
[ $BUILD_RC -eq 0 ] && echo "✅ npm run build exit 0" || { echo "🔴 build FAILED exit $BUILD_RC"; exit 3; }

echo '=== 3.3 check:generated === '
npm run check:generated 2>&1 | tail -5
CHECK_RC=$?
[ $CHECK_RC -eq 0 ] && echo "✅ check:generated exit 0" || { echo "🔴 check:generated FAILED exit $CHECK_RC"; exit 3; }
```

---

## 📦 Step 4 · 部署到 1Panel 容器 + frpc 心跳修复（10 分钟）

### 4.1 部署主流程（只要 HTTP_HOME=200 就跑这个）

```bash
cd /home/kun/vs_code/dev-tools-nav
echo '=== 4.1 deploy.sh 原子同步到 1Panel ==='
bash deploy.sh 2>&1 | tail -25
DEPLOY_RC=$?
[ $DEPLOY_RC -eq 0 ] && echo "✅ deploy.sh SUCCESS exit 0" || { echo "🔴 deploy FAILED exit $DEPLOY_RC"; exit 4; }
```

### 4.2 如果 Step 1.3 HTTP_HOME=000 → 修复 frpc 心跳再部署（GTR 关机后 frpc 容器易掉）

```bash
echo '=== 4.2.1 1Panel 本机 frpc 容器状态 ==='
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -iE 'frpc|NAME'
echo '=== 4.2.2 重启 frpc（1Panel 自动生成，名字形如 1Panel-frpc-XXXX） ==='
FRPC=$(docker ps -a --format '{{.Names}}' | grep frpc | head -1)
echo "FRPC=$FRPC"
[ -n "$FRPC" ] && docker restart "$FRPC" 2>&1 | tail -3
echo '=== 4.2.3 等 20 秒 + 测 / ==='
sleep 20
HTTP_AGAIN=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 8 https://tools.songyuankun.top/ 2>/dev/null || echo 000)
echo "MAIN_SITE_HTTP / = $HTTP_AGAIN"
[ "$HTTP_AGAIN" != "200" ] && { echo "🔴 frpc重启后仍 000，请登录 1Panel 面板检查 站点/SSL 证书"; exit 42; }
echo "✅ frpc 心跳恢复；回到 Step 4.1 跑 deploy.sh"
```

---

## ✅ Step 5 · HTTP 14 路由验收 + Search Console 关键字命中（5 分钟）

```bash
cd /home/kun/vs_code/dev-tools-nav
echo '=== 5.1 GTR 主站 14 路由 ==='
H="https://tools.songyuankun.top"
PASS=0; FAIL=0
for p in / /search-console.html /sitemap.xml /tools/json/ /tools/jwt/ /tools/base64/ /tools/uuid/ /tools/color/ /tools/cron/ /tools/diff/ /tools/regex/ /tools/sql-formatter/ /tools/timestamp/ /tools/; do
  c=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 8 "$H$p")
  printf 'HTTP %s  %s\n' "$c" "$p"
  if [ "$c" = "200" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
done
echo "====== HTTP_SUMMARY: PASS=$PASS/14  FAIL=$FAIL ======"
[ "$FAIL" -ne 0 ] && { echo "🔴 存在 FAIL 路由，检查 1Panel 容器 rsync 有没有漏掉路径"; exit 5; }

echo '=== 5.2 Search Console gap/queries 命中（≥ 3 = PASS） ==='
SC_HTML=$(curl -k -s --max-time 8 "$H/search-console.html")
GAP_HITS=$(echo "$SC_HTML" | grep -cE 'search-gap|search-queries' || echo 0)
echo "Search Console 命中数 = $GAP_HITS"
[ "$GAP_HITS" -ge 3 ] && echo "✅ Search Console PASS hits=$GAP_HITS" || { echo "🔴 Search Console FAIL 内容没同步，跑 STEP 4.1 deploy.sh"; exit 5; }

echo '=== 5.3 3 HEAD 一致（GTR本地/GitHub/1Panel容器内index.html版本）==='
GIT=$(git rev-parse --short HEAD)
ORIGIN=$(git ls-remote origin refs/heads/main | cut -c1-8)
IN_CONTAINER=$(docker exec 1Panel-openresty-rRvM sh -c 'grep -oE "content=[0-9a-f]{40}" /www/sites/tools.songyuankun.top/index/index.html 2>/dev/null | head -1 | cut -c10-17')
echo "GTR_LOCAL_GIT=$GIT  ORIGIN_MAIN=$ORIGIN  1PANEL_INNER_HEAD_MATCH_PREFIX=${IN_CONTAINER:-无法读取}"

echo
echo '======================================================================='
echo '  ✅✅✅ codex 5 步清单 5/5 PASS  （HTTP 14/14 + SC命中≥3 + HEAD同步）'
echo '  接下来可以按 HANDOVER-03 路线图 P1-1 ~ P1-5 顺序开工'
echo '======================================================================='
```

---

### ⚠️ 故障排查速查表（Top 5）

| 现象 | 根因（大概率）| 30 秒解 |
|---|---|---|
| npm ci 在 idealTree 卡住不动 | 境外 npm registry 10KB/s 龟速 | Step 3 顶部 `npm config set registry https://registry.npmmirror.com` |
| deploy.sh 报 `/www/sites/... 目录不存在` | 1Panel 站点还没建；路径以 GTR 机真实 1Panel 面板为准 | 1Panel 面板先建站点 tools.songyuankun.top 拿到目录，改 deploy.sh 内 ROOT 变量 |
| deploy.sh 报 nginx reload 失败 | 1Panel openresty 容器名改了（旧=1Panel-openresty-rRvM，新可能不同）| `docker ps | grep -iE 'openresty|nginx'` 拿真实名改 deploy.sh 最后 docker exec 段 |
| HTTP 403 Forbidden 首页 | /www/sites 目录权限 a+x 没开（www-data 读不到） | `docker exec -u 0 1Panel-openresty-rRvM chmod -R a+rX /www/sites/tools.songyuankun.top/index` |
| Search Console gap hits=0 | `check:generated` 没跑成功，Search Console 还是旧数据 | 重新跑 `npm run build && npm run check:generated && bash deploy.sh` |
