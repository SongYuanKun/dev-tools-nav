# GTR 自托管 GitHub Actions 部署设计

日期：2026-07-17

## 背景与目标

当前 `deploy-1panel-ssh.yml` 运行在 GitHub 托管 Runner 上，需要通过公网 SSH 连接 GTR。仓库密钥已经配置，但 GitHub Runner 在 `ssh-keyscan` 阶段始终无法连接；GTR 的 frpc 只代理 HTTP/HTTPS，没有可供 GitHub Runner 使用的 SSH/TCP 通道。

本次采用仓库专属的 GitHub Actions 自托管 Runner。Runner 主动向 GitHub 建立出站连接，在 GTR 本机完成构建并通过 Docker 部署到 1Panel OpenResty，不开放新端口，也不再依赖 SSH 密钥和公网入站链路。

完成标准：主分支推送后，测试、GitHub Pages 和 1Panel 部署均可自动完成；1Panel 工作流在 GTR Runner 上成功运行，线上站点内容正确，失败时能够保留或恢复上一版本。

## Runner 架构

- 在 GTR 上以普通用户 `kun` 安装仓库级 Runner，目录为 `/home/kun/.local/share/github-actions-runner/dev-tools-nav`。
- Runner 名称为 `gtr-dev-tools-nav`，增加自定义标签 `gtr`；部署任务使用 `[self-hosted, linux, x64, gtr]` 精确选择它。
- 使用 GitHub 官方 Linux x64 Runner。安装时校验官方公布的 SHA-256；注册令牌通过 GitHub API 临时获取，不写入仓库、服务文件或日志。
- 使用 `~/.config/systemd/user/github-actions-dev-tools-nav.service` 托管进程。当前用户已启用 linger，因此无需 sudo，也能在退出登录后持续运行并随机器启动。
- Runner 只注册到 `SongYuanKun/dev-tools-nav`，不供组织内其他仓库共享。

## 工作流调整

只修改 1Panel 部署工作流；测试和 GitHub Pages 继续使用 GitHub 托管 Runner。

1. 保留当前触发条件：`main` 推送、手动触发，以及 RSS 同步成功后的触发。
2. 保留 `deploy-1panel` 并发组且不取消正在执行的部署。
3. 在自托管 Runner 工作区完成完整检出、Node.js 24 配置、`npm ci`、RSS 刷新、构建和生成物校验。
4. 构建与校验全部成功后，调用仓库脚本 `scripts/deploy-1panel-local.sh`。
5. 删除 SSH agent、`ssh-keyscan`、远程 rsync 及 `ONEPANEL_*` 密钥依赖。

部署工作流不响应 `pull_request`，避免未经合并的代码在拥有 Docker 权限的 GTR 主机上执行。

## 本地部署脚本

`scripts/deploy-1panel-local.sh` 负责把构建结果安全地切换到 `/www/sites/tools.songyuankun.top/index`。

脚本使用 `set -euo pipefail`，主要流程如下：

1. 在临时目录生成部署包，排除 `.git`、`.github`、`docs`、`content`、`node_modules`、说明文档、包管理文件、部署文件、日志、备份和系统杂项。
2. 切换前验证首页、站点地图、RSS、JSON 工具页、MyBatis 文章和 favicon 等关键产物存在，并确认部署包没有暴露 `/content` 源文件。
3. 如果线上 `index` 缺失而 `.index-old` 存在，先恢复上一版本，修复可能被中断的切换。
4. 在 OpenResty 容器中创建同级 `.index-next`，复制部署包并设置属主。
5. 从当前线上目录复制两个被 Git 忽略的搜索引擎验证文件到 `.index-next`。脚本只按固定文件名保留它们，不读取或提交内容。
6. 将当前 `index` 移至 `.index-old`，再把 `.index-next` 切换为 `index`。
7. 切换后在容器内再次验证关键文件；任何失败都删除不完整的新版本并恢复 `.index-old`。
8. 成功后清理 `.index-old` 和临时目录。

容器名和站点路径允许通过环境变量覆盖，但默认值固定为当前生产环境，以便测试时注入假 Docker 实现。

## 安全边界

自托管 Runner 能执行仓库工作流，而 `kun` 用户拥有 Docker 权限，因此工作流变更等同于生产主机代码执行权限。控制措施如下：

- Runner 仅用于本仓库，且只有部署任务使用它。
- 工作流只执行已进入 `main` 的代码，不执行 PR 分支代码。
- Runner 服务不使用 sudo，不新增公网端口。
- GitHub 注册令牌仅在注册期间短暂存在。
- 生产部署使用固定容器和目录，并对部署包采用排除清单与关键产物校验。
- 主分支上的工作流和部署脚本改动必须像生产配置一样审阅。

## 测试与验证

仓库自动测试将覆盖：

- 1Panel 工作流使用指定的自托管标签，不再引用 `ubuntu-latest`、SSH、`ssh-keyscan` 或 `ONEPANEL_*`。
- 构建和生成物校验发生在部署脚本之前。
- 部署包排除开发文件并保留固定验证文件。
- 使用临时目录和假 Docker 命令验证暂存、切换、失败回滚与命令顺序，不修改生产容器。

上线验收包括：

- GitHub 仓库页面显示 `gtr-dev-tools-nav` 在线，并带有 `self-hosted`、`linux`、`x64`、`gtr` 标签。
- 用户级 systemd 服务已启用且处于 active 状态。
- 推送主分支后，Test、Pages 和 1Panel 三条 Actions 均成功。
- `https://tools.songyuankun.top/`、JSON 工具页、RSS、站点地图、MyBatis 文章和 favicon 均正常，且线上不可访问源目录 `/content`。
- 两个搜索引擎验证文件仍可访问。

## 回滚与维护

- 部署切换失败时，脚本自动恢复 `.index-old`。
- 若 Runner 故障，可停止并禁用用户服务；删除安装目录前，先使用临时删除令牌注销 Runner。
- 若未来恢复可靠的公网 SSH 通道，可以将 1Panel 工作流切回 GitHub 托管 Runner，但无需改变构建产物规范。
- Runner 升级沿用官方发布包校验、停止服务、替换程序、启动服务和执行一次部署验收的流程。

