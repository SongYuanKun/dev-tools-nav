# 1Panel 自动部署与 GTR Runner 运维

`tools.songyuankun.top` 由 `.github/workflows/deploy-1panel.yml` 自动发布。Test 与 GitHub Pages 使用 GitHub 托管 Runner；1Panel 发布使用仓库专属的 `gtr-dev-tools-nav` Runner，在 GTR 本机构建后调用 `scripts/deploy-1panel-local.sh`，再通过 Docker 原子切换 OpenResty 站点目录。

## 固定配置

- 仓库：`SongYuanKun/dev-tools-nav`
- Runner：`gtr-dev-tools-nav`，标签 `self-hosted,linux,x64,gtr`
- 安装目录：`/home/kun/.local/share/github-actions-runner/dev-tools-nav`
- 服务：`~/.config/systemd/user/github-actions-dev-tools-nav.service`
- 容器：`1Panel-openresty-rRvM`
- 容器站点：`/www/sites/tools.songyuankun.top/index`

## 安装 Runner

以下版本与校验值来自 GitHub Actions Runner v2.335.1 官方发布页，归档文件为 `actions-runner-linux-x64-2.335.1.tar.gz`：

```bash
RUNNER_VERSION=2.335.1
RUNNER_SHA256=4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf
RUNNER_HOME=/home/kun/.local/share/github-actions-runner/dev-tools-nav
ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
mkdir -p "$RUNNER_HOME"
curl -fL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${ARCHIVE}" -o "/tmp/${ARCHIVE}"
echo "${RUNNER_SHA256}  /tmp/${ARCHIVE}" | sha256sum --check
tar -xzf "/tmp/${ARCHIVE}" -C "$RUNNER_HOME"
TOKEN="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/registration-token --jq .token)"
"$RUNNER_HOME/config.sh" --unattended --url https://github.com/SongYuanKun/dev-tools-nav --token "$TOKEN" --name gtr-dev-tools-nav --labels gtr --work _work --replace
unset TOKEN
rm -f "/tmp/${ARCHIVE}"
```

创建 `~/.config/systemd/user/github-actions-dev-tools-nav.service`：

```ini
[Unit]
Description=GitHub Actions Runner for SongYuanKun/dev-tools-nav
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/kun/.local/share/github-actions-runner/dev-tools-nav
ExecStart=/home/kun/.local/share/github-actions-runner/dev-tools-nav/run.sh
Restart=always
RestartSec=10
KillSignal=SIGINT
TimeoutStopSec=300

[Install]
WantedBy=default.target
```

启用并检查：

```bash
systemctl --user daemon-reload
systemctl --user enable --now github-actions-dev-tools-nav.service
systemctl --user is-enabled github-actions-dev-tools-nav.service
systemctl --user is-active github-actions-dev-tools-nav.service
gh api repos/SongYuanKun/dev-tools-nav/actions/runners --jq '.runners[] | {name,status,busy,labels:[.labels[].name]}'
```

## 发布与验证

推送 `main` 后，依次检查 Test、Deploy GitHub Pages 和 Deploy to 1Panel。1Panel 工作流必须先通过 `npm ci`、内容刷新、构建和生成物校验，之后才执行本地部署脚本。

```bash
gh run list --repo SongYuanKun/dev-tools-nav --limit 10
curl -fsS https://tools.songyuankun.top/ >/dev/null
curl -fsS https://tools.songyuankun.top/tools/json/ >/dev/null
curl -fsS https://tools.songyuankun.top/feed.xml >/dev/null
curl -fsS https://tools.songyuankun.top/sitemap.xml >/dev/null
curl -fsS https://tools.songyuankun.top/pages/blog/java-source-mybatis.html >/dev/null
curl -fsS https://tools.songyuankun.top/favicon.svg >/dev/null
```

`content/` 必须返回 404。两个搜索引擎验证文件由部署脚本从当前线上版本复制到新版本，不进入 Git。

## 手动发布与故障恢复

正常发布前先执行 `npm ci && npm run build && npm run check:generated`，再执行 `./scripts/deploy-1panel-local.sh`。脚本使用 `.index-next` 和 `.index-old` 切换；切换后校验失败时自动恢复上一版本。

查看服务日志：`journalctl --user -u github-actions-dev-tools-nav.service -n 200 --no-pager`。若 Runner 离线，先执行 `systemctl --user restart github-actions-dev-tools-nav.service`，再检查网络、磁盘、Docker 访问和日志。

注销前先停止服务，然后获取短期删除令牌并运行 `config.sh remove`：

```bash
systemctl --user disable --now github-actions-dev-tools-nav.service
TOKEN="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/remove-token --jq .token)"
/home/kun/.local/share/github-actions-runner/dev-tools-nav/config.sh remove --token "$TOKEN"
unset TOKEN
```

升级 Runner 时，从 GitHub 官方发布页重新取得版本和 SHA-256，停止服务、替换程序、启动服务，然后执行一次完整发布验收。不要复用旧注册令牌，也不要开放入站端口。
