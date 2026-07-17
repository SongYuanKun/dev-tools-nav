# 1Panel 自动部署与 GTR Runner 运维

`tools.songyuankun.top` 的权威发布入口是 `.github/workflows/deploy-1panel.yml`。Test 与 GitHub Pages 使用 GitHub 托管 Runner；1Panel 发布使用仓库专属的 `gtr-dev-tools-nav` Runner，在 GTR 本机构建并通过生成物门禁后调用 `scripts/deploy-1panel-local.sh`，由 Docker 原子切换 OpenResty 站点目录。

## 固定配置

- 仓库：`SongYuanKun/dev-tools-nav`
- Runner：`gtr-dev-tools-nav`，标签 `self-hosted,linux,x64,gtr`
- 安装目录：`/home/kun/.local/share/github-actions-runner/dev-tools-nav`
- user unit：`~/.config/systemd/user/github-actions-dev-tools-nav.service`
- 容器：`1Panel-openresty-rRvM`
- 容器站点：`/www/sites/tools.songyuankun.top/index`

## 安装 Runner

执行者的 `gh` 身份必须对仓库拥有 **Administration** 权限，才能创建注册令牌。以下代码固定安装 GitHub Actions Runner v2.335.1，归档是 `actions-runner-linux-x64-2.335.1.tar.gz`；任意下载、SHA-256 校验、解压、取令牌或注册步骤失败都会立即停止。退出时 trap 总会删除临时归档并清除 `TOKEN`：

```bash
set -euo pipefail

RUNNER_VERSION=2.335.1
RUNNER_SHA256=4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf
RUNNER_HOME="$HOME/.local/share/github-actions-runner/dev-tools-nav"
ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
ARCHIVE_PATH="/tmp/${ARCHIVE}"
TOKEN=""

rm -f "$ARCHIVE_PATH"
cleanup() {
  status=$?
  rm -f "$ARCHIVE_PATH"
  unset TOKEN
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

install -d -m 0700 "$RUNNER_HOME"
curl -fL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${ARCHIVE}" -o "$ARCHIVE_PATH"
echo "${RUNNER_SHA256}  ${ARCHIVE_PATH}" | sha256sum --check
tar -xzf "$ARCHIVE_PATH" -C "$RUNNER_HOME"
TOKEN="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/registration-token --jq .token)"
[[ -n "$TOKEN" ]]
"$RUNNER_HOME/config.sh" --unattended --url https://github.com/SongYuanKun/dev-tools-nav --token "$TOKEN" --name gtr-dev-tools-nav --labels gtr --work _work --replace
```

## 安装并启用 user service

user service 要在退出登录后继续运行，`Linger` 必须为 `yes`。下面的检查不通过会退出；请让管理员在另一个会话执行 `loginctl enable-linger "$USER"`，不要在本流程内自行 `sudo`：

```bash
set -euo pipefail

linger="$(loginctl show-user "$USER" -p Linger --value)"
if [[ "$linger" != "yes" ]]; then
  echo "Linger 必须为 yes；请管理员执行：loginctl enable-linger $USER" >&2
  exit 1
fi

install -d -m 0700 "$HOME/.config/systemd/user"
install -m 0644 ops/github-actions-dev-tools-nav.service \
  "$HOME/.config/systemd/user/github-actions-dev-tools-nav.service"
systemctl --user daemon-reload
systemctl --user enable --now github-actions-dev-tools-nav.service
systemctl --user is-enabled github-actions-dev-tools-nav.service
systemctl --user is-active github-actions-dev-tools-nav.service
gh api repos/SongYuanKun/dev-tools-nav/actions/runners \
  --jq '.runners[] | select(.name == "gtr-dev-tools-nav") | {name,status,busy,labels:[.labels[].name]}'
```

仓库内版本化模板是 `ops/github-actions-dev-tools-nav.service`；不要在主机上维护另一份 unit 内容。

## 发布与验证

推送 `main` 后，必须分别列出并等待 Test、Deploy GitHub Pages、Deploy to 1Panel 三条 workflow，且逐条确认结论为 `success`：

```bash
set -euo pipefail

REPO=SongYuanKun/dev-tools-nav
workflows=(test.yml deploy-pages.yml deploy-1panel.yml)
for workflow in "${workflows[@]}"; do
  gh run list --repo "$REPO" --workflow "$workflow" --branch main --limit 3
  run_id="$(gh run list --repo "$REPO" --workflow "$workflow" --branch main --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  [[ -n "$run_id" ]] || { echo "找不到 $workflow 的 main 运行" >&2; exit 1; }
  gh run watch "$run_id" --repo "$REPO" --exit-status
  conclusion="$(gh run view "$run_id" --repo "$REPO" --json conclusion --jq .conclusion)"
  [[ "$conclusion" == "success" ]] || { echo "$workflow 未成功：$conclusion" >&2; exit 1; }
done
```

三条 workflow 成功后验证公开 URL、两个搜索引擎验证文件，并断言 `/content/` **精确返回 404**；任何其他状态都会退出：

```bash
set -euo pipefail

BASE_URL=https://tools.songyuankun.top
for path in \
  / \
  /tools/json/ \
  /feed.xml \
  /sitemap.xml \
  /pages/blog/java-source-mybatis.html \
  /favicon.svg \
  /baidu_verify_codeva-TByQYpVHM2.html \
  /googleb710668c9aa28d4e.html
do
  curl -fsS "${BASE_URL}${path}" >/dev/null
done

content_status="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/content/")"
[[ "$content_status" == "404" ]] || {
  echo "${BASE_URL}/content/ 应为 404，实际为 ${content_status}" >&2
  exit 1
}
```

两个验证文件由原子部署脚本从当前线上版本复制到新版本，不进入 Git。

## 手动发布

推荐自动 workflow，它会在干净 checkout 中执行 `npm run check:generated`，是权威发布流程。GTR 本机存在两个被 Git 忽略的搜索引擎验证文件，生成 sitemap 后可能被漂移检查识别；兼容入口不得移动或删除这些线上凭据。因此根目录 `deploy.sh` 只执行一次 `npm run build`，随后 `exec scripts/deploy-1panel-local.sh`，不会重复维护发布清单。需要在 GTR 本机手动发布时，从仓库根目录执行：

```bash
./deploy.sh
```

不要绕过该入口直接同步站点目录。

## 站点中断后的人工恢复

自动脚本使用 `.index-next`、`.index-old` 和 `.deploy-in-progress`。下面的恢复命令只会在 marker 与 old 同时存在时删除未确认的 index 并恢复 old；若 old 不存在，会保留唯一的 index。最后清理 next 和 marker：

```bash
set -euo pipefail

docker exec 1Panel-openresty-rRvM sh -ec '
  target=/www/sites/tools.songyuankun.top/index
  next=/www/sites/tools.songyuankun.top/.index-next
  old=/www/sites/tools.songyuankun.top/.index-old
  marker=/www/sites/tools.songyuankun.top/.deploy-in-progress

  if [ -e "$marker" ]; then
    if [ -d "$old" ]; then
      if [ -d "$target" ]; then rm -rf "$target"; fi
      mv "$old" "$target"
    else
      echo "marker 存在但 old 不存在；保留唯一 index" >&2
    fi
    rm -rf "$next"
    rm -f "$marker"
  elif [ ! -d "$target" ] && [ -d "$old" ]; then
    mv "$old" "$target"
    rm -rf "$next"
  else
    rm -rf "$next"
  fi
'
```

恢复后重新执行上一节的公开 URL 与精确 404 验证。

## Runner 故障排查

Runner 离线时依次重启、检查服务与日志、GitHub 出站网络、主机和容器磁盘、Docker 权限，最后确认 GitHub 端状态：

```bash
set -euo pipefail

systemctl --user restart github-actions-dev-tools-nav.service
systemctl --user is-active github-actions-dev-tools-nav.service
systemctl --user status github-actions-dev-tools-nav.service --no-pager
journalctl --user -u github-actions-dev-tools-nav.service -n 200 --no-pager
curl -fsSI https://github.com/ >/dev/null
df -h "$HOME/.local/share/github-actions-runner/dev-tools-nav"
docker info >/dev/null
docker exec 1Panel-openresty-rRvM df -h /www/sites/tools.songyuankun.top
gh api repos/SongYuanKun/dev-tools-nav/actions/runners \
  --jq '.runners[] | select(.name == "gtr-dev-tools-nav") | {name,status,busy}'
```

## 注销 Runner

```bash
set -euo pipefail
TOKEN=""
cleanup() { unset TOKEN; }
trap cleanup EXIT

systemctl --user disable --now github-actions-dev-tools-nav.service
TOKEN="$(gh api -X POST repos/SongYuanKun/dev-tools-nav/actions/runners/remove-token --jq .token)"
[[ -n "$TOKEN" ]]
"$HOME/.local/share/github-actions-runner/dev-tools-nav/config.sh" remove --token "$TOKEN"
```

## 自动更新与可审计的人工修复升级

Runner 注册时保留默认设置，因此**默认自动更新已启用**。只有自动更新损坏或需要可审计人工修复时，才运行下面的流程。它停止服务、以权限 `0700` 备份完整 runner home、从 GitHub 官方 `actions/runner` latest release API 读取非空版本、下载地址和 `sha256:` digest、校验归档、验证新二进制版本并替换目录；替换后任一步失败，EXIT trap 都会恢复备份并重启服务。

```bash
set -euo pipefail

SERVICE=github-actions-dev-tools-nav.service
REPO=SongYuanKun/dev-tools-nav
RUNNER_NAME=gtr-dev-tools-nav
RUNNER_HOME="$HOME/.local/share/github-actions-runner/dev-tools-nav"
RELEASE_JSON="$(mktemp)"
ARCHIVE_PATH=""
NEW_HOME=""
BACKUP="${RUNNER_HOME}.backup-$(date -u +%Y%m%dT%H%M%SZ)"
RESTORE_NEEDED=0
SERVICE_STOPPED=0

cleanup_upgrade() {
  status=$?
  trap - EXIT
  [[ -z "$ARCHIVE_PATH" ]] || rm -f "$ARCHIVE_PATH"
  rm -f "$RELEASE_JSON"
  [[ -z "$NEW_HOME" ]] || rm -rf "$NEW_HOME"
  if [[ "$status" -ne 0 && "$RESTORE_NEEDED" -eq 1 ]]; then
    systemctl --user stop "$SERVICE" || true
    rm -rf "$RUNNER_HOME"
    mv "$BACKUP" "$RUNNER_HOME"
    systemctl --user start "$SERVICE" || true
    echo "升级失败，已从 $BACKUP 恢复" >&2
  elif [[ "$status" -ne 0 && "$SERVICE_STOPPED" -eq 1 ]]; then
    systemctl --user start "$SERVICE" || true
  fi
  exit "$status"
}
trap cleanup_upgrade EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

[[ -d "$RUNNER_HOME" ]]
[[ ! -e "$BACKUP" ]]
systemctl --user stop "$SERVICE"
SERVICE_STOPPED=1
cp -a "$RUNNER_HOME" "$BACKUP"
chmod 700 "$BACKUP"
RESTORE_NEEDED=1

gh api repos/actions/runner/releases/latest > "$RELEASE_JSON"
VERSION="$(jq -er '.tag_name | ltrimstr("v") | select(length > 0)' "$RELEASE_JSON")"
ARCHIVE="actions-runner-linux-x64-${VERSION}.tar.gz"
DOWNLOAD_URL="$(jq -er --arg name "$ARCHIVE" '.assets[] | select(.name == $name) | .browser_download_url | select(length > 0)' "$RELEASE_JSON")"
SHA256="$(jq -er --arg name "$ARCHIVE" '.assets[] | select(.name == $name) | .digest | select(startswith("sha256:")) | sub("^sha256:"; "") | select(test("^[0-9a-f]{64}$"))' "$RELEASE_JSON")"
[[ -n "$VERSION" && -n "$DOWNLOAD_URL" && -n "$SHA256" ]]

ARCHIVE_PATH="/tmp/${ARCHIVE}"
rm -f "$ARCHIVE_PATH"
curl -fL "$DOWNLOAD_URL" -o "$ARCHIVE_PATH"
echo "${SHA256}  ${ARCHIVE_PATH}" | sha256sum --check

NEW_HOME="$(mktemp -d "${RUNNER_HOME}.new.XXXXXX")"
cp -a "$BACKUP/." "$NEW_HOME/"
tar -xzf "$ARCHIVE_PATH" -C "$NEW_HOME"
installed_version="$("$NEW_HOME/bin/Runner.Listener" --version)"
[[ "$installed_version" == "$VERSION" ]]

rm -rf "$RUNNER_HOME"
mv "$NEW_HOME" "$RUNNER_HOME"
NEW_HOME=""
systemctl --user start "$SERVICE"
systemctl --user is-active "$SERVICE"

online=""
for attempt in {1..30}; do
  online="$(gh api "repos/${REPO}/actions/runners" --jq ".runners[] | select(.name == \"${RUNNER_NAME}\") | .status")"
  [[ "$online" == "online" ]] && break
  sleep 2
done
[[ "$online" == "online" ]]

SERVICE_STOPPED=0
RESTORE_NEEDED=0
rm -rf "$BACKUP"
```

升级完成后，再执行完整的三 workflow 与公开 URL 验收。不要复用旧注册令牌，也不要开放入站端口。
