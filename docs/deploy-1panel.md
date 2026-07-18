# GTR 出站轮询部署运维手册

GTR 主机主动读取公开仓库，不接受 GitHub 下发的作业。发布链路中的 GitHub Actions 只运行 Test 和 GitHub Pages；`dev-tools-nav-deploy.timer` 每十分钟检查 `main`，仅在该精确提交的 Test push run 成功后部署。公开仓库不得重新注册任何 GitHub Actions Runner。

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

安装器从管理员审查过的本地仓库复制 poller、部署脚本和 units。poller 将远端 checkout 当作不可信输入：它在临时目录获取精确 SHA，运行依赖安装、测试、构建和生成物检查，但只调用可信目录内的部署脚本。不要从远端 checkout 执行或覆盖 `~/.local/libexec/dev-tools-nav-deploy` 中的脚本。

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

poller 先用 `git ls-remote` 读取 `main` SHA，再查询 Test workflow 的公开 API：

```text
https://api.github.com/repos/SongYuanKun/dev-tools-nav/actions/workflows/test.yml/runs?branch=main&event=push&head_sha=$remote_sha&per_page=20
```

只有响应中同一 `head_sha`、`event=push` 且 `conclusion=success` 的 run 才能放行。没有匹配成功 run 时，service 正常退出且不写状态；网络、JSON、checkout、测试、构建或部署失败时，service 失败且不写状态。两种情况都会保留待部署 SHA，供下一次十分钟 calendar 触发重试。

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

## 手动原子部署

仅在自动路径不可用且已确认本地 checkout 对应目标提交时使用。checkout 只提供站点生成物；完成门禁后，直接调用安装在可信目录中的部署脚本：

```bash
npm ci
npm test
npm run build
npm run check:generated
SITE_SOURCE_DIR="$PWD" "$HOME/.local/libexec/dev-tools-nav-deploy/deploy-1panel-local.sh"
```

部署脚本先构造 `.index-next`，保留两个验证文件，再用 `.deploy-in-progress`、`.index-old` 和目录重命名切换站点。失败时恢复旧目录。手动发布不会更新 poller 状态文件；恢复自动路径后运行一次 oneshot，让 poller 核验并记录 SHA。

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

## 生产验收

记录 `main` SHA、状态 SHA、容器状态和 HTTP 结果：

```bash
REMOTE_SHA="$(git ls-remote https://github.com/SongYuanKun/dev-tools-nav.git refs/heads/main | awk '{print $1}')"
STATE_SHA="$(cat "$HOME/.local/state/dev-tools-nav-deploy/last-deployed-sha")"
test "$REMOTE_SHA" = "$STATE_SHA"
docker ps --filter name=1Panel-openresty-rRvM
curl -fsS https://tools.songyuankun.top/ >/dev/null
test "$(curl -sS -o /dev/null -w '%{http_code}' https://tools.songyuankun.top/this-path-must-not-exist)" = 404
curl -fsS https://tools.songyuankun.top/baidu_verify_codeva-TByQYpVHM2.html >/dev/null
curl -fsS https://tools.songyuankun.top/googleb710668c9aa28d4e.html >/dev/null
```

验收要求：生产首页可访问，随机缺失路径返回 404，OpenResty 容器运行，两个验证端点可访问，状态 SHA 等于当前 `main`。同时确认 Test 和 GitHub Pages 对该 SHA 成功，以及 timer 使用十分钟 calendar 计划。

## 升级与恢复

升级时先在本地可信 checkout 审查 `scripts/poll-github-deploy.sh`、`scripts/deploy-1panel-local.sh`、`scripts/install-outbound-deployer.sh` 和 `ops/dev-tools-nav-deploy.{service,timer}`，再重新运行安装器。安装器会再次禁用 timer；重复“初次运行和启用”步骤。永远不要让远端 checkout 自行升级本地脚本或 units。

若发布中断，重新运行 oneshot；原子部署会根据 `.deploy-in-progress` 和 `.index-old` 恢复或完成切换。若必须停止自动发布：

```bash
systemctl --user disable --now dev-tools-nav-deploy.timer
```

修复并重新安装可信文件后，先手动 oneshot 和生产验收，再启用 timer。
