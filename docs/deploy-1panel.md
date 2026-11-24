# GTR 出站轮询部署运维手册

GTR 主机主动读取公开仓库，不接受 GitHub 下发的作业。`dev-tools-nav-deploy.timer` 每十分钟检查 `main`，仅部署通过完整 Test 的当前提交。GitHub Pages 也在完整 Test 通过后发布同一个 SHA。公开仓库不得重新注册任何 GitHub Actions Runner。

## 固定配置与信任边界

| 项目 | 值 |
|---|---|
| 仓库 | `SongYuanKun/dev-tools-nav` |
| 远端 | `https://github.com/SongYuanKun/dev-tools-nav.git` |
| 容器 | `1Panel-openresty-rRvM` |
| 站点目录 | `/www/sites/tools.songyuankun.top/index` |
| 可信脚本目录 | `~/.local/libexec/dev-tools-nav-deploy` |
| 状态文件 | `~/.local/state/dev-tools-nav-deploy/last-deployed-sha` |
| 缓存目录 | `~/.cache/dev-tools-nav-deploy` |
| user units | `~/.config/systemd/user/dev-tools-nav-deploy.{service,timer}` |
| 计划 | `OnBootSec=2min`、`OnCalendar=*:0/10`、`Persistent=true` |

安装器从管理员审查过的本地仓库复制 poller、部署脚本和 units。poller 在临时 checkout 中运行 `npm ci`（包括 lifecycle scripts）、测试、构建和生成物检查；这些命令在拥有 Docker 权限的 service 用户下执行，因此合并到 `main` 等同于授予生产主机代码执行权限。仓库合并权限必须按生产执行权限管理。

本地可信脚本只防止 checkout 替换轮询器、部署器和 units，不构成 sandbox，也不限制 checkout 中代码能访问的 service 用户权限。不要从远端 checkout 执行或覆盖 `~/.local/libexec/dev-tools-nav-deploy` 中的控制面脚本。

## 首次安装

先确认 `curl`、Docker、`flock`、Git、Node.js 24、npm、Python 3 和 `rsync` 可用，并确认当前用户能运行 `docker info`。user timer 依赖 lingering；若下列检查不是 `yes`，由系统管理员先启用它：

```bash
loginctl show-user "$USER" -p Linger --value
docker info
```

### 准备站点验证文件

验证文件独立于远端 checkout。将生产站现有文件保存为仅当前用户可读的本地源：

```bash
VERIFICATION_SOURCE="$HOME/.local/share/dev-tools-nav-verification"
install -d -m 0700 "$VERIFICATION_SOURCE"
docker cp 1Panel-openresty-rRvM:/www/sites/tools.songyuankun.top/index/baidu_verify_codeva-TByQYpVHM2.html "$VERIFICATION_SOURCE/"
docker cp 1Panel-openresty-rRvM:/www/sites/tools.songyuankun.top/index/googleb710668c9aa28d4e.html "$VERIFICATION_SOURCE/"
chmod 0600 "$VERIFICATION_SOURCE"/*.html
test -s "$VERIFICATION_SOURCE/baidu_verify_codeva-TByQYpVHM2.html"
test -s "$VERIFICATION_SOURCE/googleb710668c9aa28d4e.html"
```

### 安装、初次运行和启用

从已审查的本地 checkout 安装。安装器会强制 timer 保持 `disabled` 和 `inactive`，因此安装本身不会发布：

```bash
./scripts/install-outbound-deployer.sh
systemctl --user is-enabled dev-tools-nav-deploy.timer
systemctl --user is-active dev-tools-nav-deploy.timer
```

检查旧状态；首次迁移应没有状态文件。若文件存在，先核对其 SHA，不要盲目删除或改写：

```bash
STATE_FILE="$HOME/.local/state/dev-tools-nav-deploy/last-deployed-sha"
if test -f "$STATE_FILE"; then cat "$STATE_FILE"; else echo "no deployed SHA recorded"; fi
```

手动触发初次 oneshot。poller 只有在部署成功后才会原子写入 `last-deployed-sha`；Test 尚未成功或 GitHub 暂时不可用时，它不更新状态，下一次检查会重试：

```bash
systemctl --user start dev-tools-nav-deploy.service
systemctl --user status dev-tools-nav-deploy.service --no-pager
cat "$STATE_FILE"
```

完成下文的生产验收后再启用 timer：

```bash
systemctl --user enable --now dev-tools-nav-deploy.timer
systemctl --user list-timers dev-tools-nav-deploy.timer
```

## 精确 SHA 发布门禁

poller 用 `git ls-remote` 读取 `main` SHA，再从 GitHub 公开 API 查询受信任工作流 `test.yml` 对该 SHA 的运行记录，以及对应运行尝试的 jobs：

```text
GET /repos/SongYuanKun/dev-tools-nav/actions/workflows/test.yml/runs?branch=main&head_sha=$remote_sha&status=success&per_page=20
GET /repos/SongYuanKun/dev-tools-nav/actions/runs/{run_id}/attempts/{attempt_number}/jobs?per_page=100
```

同仓库 `main` 的 `push` 或 `workflow_dispatch` Test 必须成功完成。对应尝试的 `unit` job 及 `npm test`、资源版本检查、生成物检查、可访问性和性能门禁都必须成功。跳过、缺失或失败的 job 或步骤不会放行。发布前会再次核对远端 `main` 与检出和已测试的 SHA。没有匹配的 Test 时，service 退出并等待下次轮询。网络、JSON、checkout、测试、构建或部署失败时，保留上次已发布 SHA。

CSDN 和开源雷达同步仅在内容变化且成功推送 `main` 后，用短期 `GITHUB_TOKEN` 发起 `workflow_dispatch`，传入刚推送的 `expected_sha`。只有抓取时间变化时保留现有文件。若主干已前移，同步会跳过过期的 dispatch，或者由 Test 拒绝 SHA 不匹配的请求。GitHub Pages 由 Test 完成触发，使用已验证 SHA 的提交内容和生成物组装发布副本。Pages 手动发布也需要同一门禁。

如果 `main` 已前移但没有有效 Test，例如自动同步 dispatch 失败，或截图更新机器人单独推进了 `main`，有仓库权限的操作者可为当前提交启动完整 Test：

```bash
REMOTE_SHA="$(git ls-remote https://github.com/SongYuanKun/dev-tools-nav.git refs/heads/main | awk '{print $1}')"
test -n "$REMOTE_SHA" && gh workflow run test.yml --ref main -f "expected_sha=$REMOTE_SHA"
```

## 日常诊断

```bash
systemctl --user status dev-tools-nav-deploy.timer --no-pager
systemctl --user status dev-tools-nav-deploy.service --no-pager
systemctl --user list-timers dev-tools-nav-deploy.timer
journalctl --user -u dev-tools-nav-deploy.service -n 100 --no-pager
cat "$HOME/.local/state/dev-tools-nav-deploy/last-deployed-sha"
git ls-remote https://github.com/SongYuanKun/dev-tools-nav.git refs/heads/main
```

`service` 显示失败时，先从 journal 找到第一个失败命令。状态 SHA 与远端相同表示无需发布；不同表示 Test 尚未放行或发布失败。缓存中的锁阻止并发执行。

## 手动运行发布检查

在 GTR 上手动启动已安装的 oneshot，沿用自动轮询的同一把锁与完整 Test 门禁。若 service 正在运行，等待完成后再读取状态。发布器先构造 `.index-next`，保留两个站点验证文件，再用 `.deploy-in-progress`、`.index-old` 和目录重命名切换站点，失败时恢复旧目录。

```bash
set -euo pipefail
systemctl --user start dev-tools-nav-deploy.service
journalctl --user -u dev-tools-nav-deploy.service -n 100 --no-pager
cat "$HOME/.local/state/dev-tools-nav-deploy/last-deployed-sha"
```

用下文生产验收核对实际发布 SHA。oneshot 退出成功也可能表示正在等待 Test，或者当前 SHA 已经发布。

## 注销旧 Runner

执行者的 `gh` 身份必须有仓库 Administration 权限。先停止旧进程，再轮询 GitHub API，确认旧 Runner `gtr-dev-tools-nav` 已显示 **Offline**：

```bash
systemctl --user disable --now github-actions-dev-tools-nav.service
RUNNER_STATUS=""
for attempt in {1..30}; do
  RUNNER_STATUS="$(gh api repos/SongYuanKun/dev-tools-nav/actions/runners \
    --jq '.runners[] | select(.name == "gtr-dev-tools-nav") | .status')"
  [[ "$RUNNER_STATUS" == "offline" ]] && break
  sleep 2
done
[[ "$RUNNER_STATUS" == "offline" ]] || { echo "Runner did not become Offline" >&2; exit 1; }
```

确认 Offline 后获取一次性 remove token，校验非空，再注销：

```bash
REMOVE_TOKEN="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/remove-token --jq .token)"
[[ -n "$REMOVE_TOKEN" ]] || { echo "Empty Runner remove token" >&2; exit 1; }
cd "$HOME/.local/share/github-actions-runner/dev-tools-nav"
./config.sh remove --token "$REMOVE_TOKEN"
unset REMOVE_TOKEN
```

通过 API 确认该 Runner 已消失；也在 GitHub 的 **Settings → Actions → Runners** 页面复核。只有两处都确认后，才能删除旧凭据、安装目录和 unit：

```bash
RUNNER_MATCH="$(gh api repos/SongYuanKun/dev-tools-nav/actions/runners \
  --jq '.runners[] | select(.name == "gtr-dev-tools-nav") | .name')"
[[ -z "$RUNNER_MATCH" ]] || { echo "Runner still registered" >&2; exit 1; }
rm -rf "$HOME/.local/share/github-actions-runner/dev-tools-nav"
rm -f "$HOME/.config/systemd/user/github-actions-dev-tools-nav.service"
systemctl --user daemon-reload
```

remove token 只放在当前 shell，不写入仓库、命令脚本、日志或配置文件。若注销失败，保留目录，重新取得临时 remove token 后重试。不要为公开仓库创建新的注册令牌；无论结果如何，都不得重新注册 Runner。

## 静态资源版本号

`scripts/deploy-1panel-local.sh` 在 STAGE 目录上运行 `scripts/stamp-asset-version.mjs`，把 HTML / `sw.js` 中的 `__ASSET_VERSION__` 换成已测试 SHA 的前 12 位。源仓库 HTML 保持占位符，发布副本使用版本查询参数 `?v=` 使 CSS/JS 缓存失效。GitHub Pages 同样用已测试的 SHA 标记发布副本。

安装器会把 `stamp-asset-version.mjs` 一并安装到 `~/.local/libexec/dev-tools-nav-deploy/`，与 `deploy-1panel-local.sh` 同目录。部署器优先使用已验证 checkout 的脚本，其次使用安装副本。找不到脚本、缺少 Node.js、stamp 失败或 STAGE 仍包含 `__ASSET_VERSION__` 时，部署会中止。

合并本次完整 Test 门禁更新后，在 GTR 审查合并提交，再用 `scripts/install-outbound-deployer.sh` 重新安装可信 poller 与部署脚本。安装完成后先执行 oneshot 并验收，再启用 timer。远端 checkout 不会自动升级 libexec。

### 部署后校验（GTR 操作者）

生产 HTML / `sw.js` 不得再出现字面量占位符：

```bash
# 应无输出（exit 1 = 干净）；若打印出 __ASSET_VERSION__ 则 stamp 未生效，需停用 timer 并排查
curl -fsS https://tools.songyuankun.top/ | grep -F '__ASSET_VERSION__' && echo 'FAIL: placeholder still live' && exit 1
curl -fsS https://tools.songyuankun.top/sw.js | grep -F '__ASSET_VERSION__' && echo 'FAIL: placeholder still live' && exit 1
curl -fsS https://tools.songyuankun.top/offline.html | grep -F '__ASSET_VERSION__' && echo 'FAIL: placeholder still live' && exit 1
# 应能看到真实 ?v=<short-sha>（与当前 main short SHA / Pages 一致或同一次发布）
curl -fsS https://tools.songyuankun.top/ | grep -oE 'css/style\.css\?v=[0-9a-f]+'
```

## 生产验收

从已审查的仓库 checkout 记录 `main` SHA、状态 SHA、容器状态和 HTTP 结果，并比较站点上的同步数据与该提交：

```bash
set -euo pipefail
REMOTE_SHA="$(git ls-remote https://github.com/SongYuanKun/dev-tools-nav.git refs/heads/main | awk '{print $1}')"
STATE_SHA="$(cat "$HOME/.local/state/dev-tools-nav-deploy/last-deployed-sha")"
test "$REMOTE_SHA" = "$STATE_SHA"
docker ps --filter name=1Panel-openresty-rRvM
curl -fsS https://tools.songyuankun.top/ >/dev/null
test "$(curl -sS -o /dev/null -w '%{http_code}' https://tools.songyuankun.top/content/)" = 404
curl -fsS https://tools.songyuankun.top/baidu_verify_codeva-TByQYpVHM2.html >/dev/null
curl -fsS https://tools.songyuankun.top/googleb710668c9aa28d4e.html >/dev/null
for path in data/csdn-articles.json data/open-source-radar.json; do
  git show "$STATE_SHA:$path" | cmp - <(curl -fsS "https://tools.songyuankun.top/$path")
done
# 静态资源版本号：字面量占位符不得出现在生产 HTML / sw.js
! curl -fsS https://tools.songyuankun.top/ | grep -F '__ASSET_VERSION__'
! curl -fsS https://tools.songyuankun.top/sw.js | grep -F '__ASSET_VERSION__'
```

验收要求：生产首页可访问，`https://tools.songyuankun.top/content/` 精确返回 404，OpenResty 容器运行，两个验证端点可访问，状态 SHA 等于当前 `main`，且首页 / `sw.js` 不含字面量 `__ASSET_VERSION__`。同时确认 Test 和 GitHub Pages 对该 SHA 成功，以及 timer 使用十分钟 calendar 计划。

### 双站一致性（GTR × GitHub Pages）

在主站与 Pages 都更新到同一 `main` 后，可跑三栏巡检：

```bash
npm run check:consistency
```

脚本 [`scripts/consistency-gtr-x-ghpages.sh`](../scripts/consistency-gtr-x-ghpages.sh) 检查：A 栏路由双站 HTTP 200（含 PWA 的 `/manifest.webmanifest`、`/sw.js`、`/offline.html` 与全部自建 `/tools/*/`）、B 栏 `pages/tools/*.html` 关键字矩阵、C 栏 `search-console.html` 内容指纹、四个数据区块与 Search Gap 反馈入口。全部通过时输出 `RESULT: ALL GREEN`。

## 升级与恢复

GitHub 侧以当前 `main` 的完整 Test 成功、Pages 发布成功以及镜像内容与该 SHA 一致为准。合并仓库及 GitHub Pages 发布均不会更新 GTR 本机的 libexec。

升级时先在本地可信 checkout 审查 `scripts/poll-github-deploy.sh`、`scripts/deploy-1panel-local.sh`、`scripts/stamp-asset-version.mjs`、`scripts/install-outbound-deployer.sh` 和 `ops/dev-tools-nav-deploy.{service,timer}`，再重新运行安装器。安装器必须先禁用已有 timer；若禁用失败或 oneshot 仍在运行，则不写目标文件并退出。安装过程先备份旧文件，再 staging 并原子替换 5 个目标（poller、deploy、stamp、service、timer）；失败时逐项恢复、reload、重新禁用 timer 并验证状态。若恢复替换失败，错误会列出目标和保留的 backup 路径；不要删除该 backup 目录。文件与 timer 状态全部验证后才到 commit point，之后的 backup 清理失败只产生 warning 并保留 backup，不回滚新安装。成功后重复“初次运行和启用”步骤。永远不要让远端 checkout 自行升级本地脚本或 units。

取得生产操作授权后，从已审查版本安装。安装成功时 timer 仍为 `disabled` / `inactive`。运行 oneshot，核对 `last-deployed-sha` 与当前 `main` 相同，并完成上面的站点内容验收。然后显式执行 `systemctl --user enable --now dev-tools-nav-deploy.timer`，用 `systemctl --user list-timers --all dev-tools-nav-deploy.timer` 确认 `NEXT` 显示下一次运行时间。

若发布中断，重新运行 oneshot；原子部署会根据 `.deploy-in-progress` 和 `.index-old` 恢复或完成切换。若必须停止自动发布：

```bash
systemctl --user disable --now dev-tools-nav-deploy.timer
```

修复并重新安装可信文件后，先手动 oneshot 和生产验收，再启用 timer。
