# GTR 出站轮询部署设计

日期：2026-07-18

## 背景与目标

当前 1Panel 部署由公开 GitHub 仓库中的自托管 Runner 执行。即使部署 workflow 不响应 Pull Request，外部 PR 仍可修改其他 workflow 并尝试请求同一 Runner。一旦有人批准该运行，PR 代码就可能接触拥有 Docker 权限的 GTR 用户。

本设计用 GTR 用户级定时任务替换自托管 Runner。GTR 每 10 分钟主动检查 `origin/main`，只在该提交的 GitHub Test workflow 成功后构建并部署。GitHub 不再向 GTR 分发任务，外部 PR 也无法调度 GTR。

完成标准：GitHub Test 和 Pages 继续成功；GTR 能在 10 分钟轮询周期内自动部署已通过 Test 的 `main` 提交；生产站点、验证文件、回滚和 `/content/` 404 约束保持有效；GitHub 仓库不再注册自托管 Runner。

本设计取代 `2026-07-17-gtr-self-hosted-deploy-design.md` 中的 Runner 架构。原文保留为决策记录，但不再代表当前运维方式。

## 安全边界

- GTR 只发起出站 HTTPS 和 Git 请求，不开放入站端口。
- GitHub 仓库删除 1Panel 自托管 workflow，并注销仓库级 Runner。
- 轮询器只接受 `origin/main` 当前 SHA，不接受分支名、PR ref 或调用参数指定的任意提交。
- 轮询器通过 GitHub 公共 API 检查 `test.yml`：`head_sha` 必须等于目标 SHA，事件必须是 `push`，结论必须是 `success`。
- GitHub API 查询不使用 token。10 分钟轮询仅在发现新 SHA 时查询 Actions，保持在公共 API 限额内。
- 从 Git 安装到 GTR 本地的轮询器和部署器是可信控制面；它们能防止远端 checkout 替换控制脚本，但不是 sandbox。
- checkout 的 npm lifecycle、测试和构建由拥有 Docker 权限的 service 用户执行。只有合并进 `main` 且通过 Test 的代码会运行，但合并权限因此等同于生产主机代码执行权限，而不只是站点生成物发布权限。
- systemd 服务以 `kun` 运行，不使用 sudo。它保留 Docker 访问，但不接受 GitHub 下发的任意作业。

## 组件与职责

### 1. 出站轮询器

新增 `scripts/poll-github-deploy.sh`。安装时将它复制到 `~/.local/libexec/dev-tools-nav-deploy/`，timer 始终执行本地副本。

轮询器使用 `flock` 保证单实例，执行以下流程：

1. 用 `git ls-remote` 取得 `origin/main` SHA，并验证它是 40 或 64 位十六进制值。
2. 若 SHA 等于 `~/.local/state/dev-tools-nav-deploy/last-deployed-sha`，输出固定日志 `SHA is already deployed; no work required.` 后成功退出，不查询 API、运行 npm 或调用部署器。
3. 调用 GitHub 公共 Actions API，要求同 SHA 的 `test.yml` push run 已成功。Test 尚未完成时不报错，也不更新状态，等待下一轮。
4. 在 `~/.cache/dev-tools-nav-deploy/` 下创建临时 checkout，获取目标 `main` SHA 的完整可达历史，并再次验证 `HEAD` 与已观察 SHA 完全相等。
5. 在干净 checkout 中执行 `npm ci`、`npm test`、`npm run build` 和 `npm run check:generated`。
6. 以 `SITE_SOURCE_DIR` 指向 checkout，调用本地安装的可信 `deploy-1panel-local.sh`。
7. 生产部署成功后，以原子文件替换方式写入 `last-deployed-sha`。

任何网络、API、checkout、构建或部署失败都不会推进状态；下一轮会重试同一 SHA。

### 2. 本地部署器

现有 `scripts/deploy-1panel-local.sh` 增加 `SITE_SOURCE_DIR`，默认仍为仓库根目录。轮询器安装的本地副本用它部署临时 checkout。

部署器继续使用固定静态白名单、`.deploy-in-progress`、`.index-next` 和 `.index-old`。同时修复两个最终审查问题：

- live 和 host 验证文件都必须非空；空 live 文件不得覆盖有效 host 备份。
- 新版本验证完成后先清除事务 marker 并解除回滚，再清理 `.index-old`。旧版本清理失败只能留下待清理目录，不能删除已经验证的新版本。

搜索引擎验证文件继续来自当前 live 副本或 `~/.local/share/dev-tools-nav-verification`，源文件保持 `0600`，公开副本为 `0644`，内容不进入 Git 或日志。

### 3. systemd 用户服务与定时器

新增两个版本化模板：

- `ops/dev-tools-nav-deploy.service`：oneshot 服务，运行本地轮询器。
- `ops/dev-tools-nav-deploy.timer`：`OnBootSec=2min`，`OnCalendar=*:0/10`，`Persistent=true`；若主机停机期间错过 calendar 触发，恢复后补跑一次。

服务使用 `UMask=0077`、`NoNewPrivileges=true`、`PrivateTmp=true` 和受限的读写目录。缓存、npm cache、锁和状态分别位于专用的用户目录。日志进入 user journal。

### 4. 安装与运维入口

新增 `scripts/install-outbound-deployer.sh`，负责：

- 检查 `Linger=yes`、Docker、Git、curl、Python、Node、npm 和 flock。
- 创建权限受限的 libexec、cache、state 和验证文件目录；验证目录固定为 `0700`，两个源文件固定为 `0600`。
- 在写 4 个目标前先禁用 timer，并确认 oneshot 不处于 active 或 activating；安装器不停止正在部署的 service。
- 备份 4 个旧目标，在各目标目录 staging 正确 mode 的新文件，再逐个原子替换。
- 任一 staging、替换、daemon reload 或最终状态验证失败时，恢复全部旧目标（首装则删除新目标）、再次 reload，并保持 timer disabled；成功也保持 timer disabled/inactive。
- 不会自动注销 Runner、启用 timer 或推送 Git。

运维手册记录安装、手动触发、日志、状态、失败重试、升级和卸载命令。根 `deploy.sh` 继续作为人工兼容入口。

## 切换顺序

迁移按以下顺序执行，避免同时存在两套自动部署器：

1. 完成代码、测试和审查。
2. 在 GTR 安装轮询器、部署器和 timer，但暂不启用 timer。
3. 记录当前生产 SHA 作为初始状态。
4. 停止并禁用自托管 Runner 服务，通过 GitHub 临时删除令牌注销 Runner，然后删除其凭据目录。
5. 普通推送移除自托管 workflow 的提交，不使用 force push。
6. 等待该 SHA 的 GitHub Test 和 Pages 成功。
7. 手动启动一次 oneshot 轮询服务，验证它部署精确 SHA。
8. 启用 timer，验证下一次空轮询不重复部署。
9. 检查生产 URL、两个验证文件、`/content/` 404、容器事务目录、状态文件和 GitHub Runner 列表。

若步骤 4 完成后首次部署失败，生产站点保持旧版本。操作者可修复轮询器后重试 oneshot；不得为恢复发布而重新注册公开仓库 Runner。

## 测试策略

### 轮询器契约测试

使用临时 Git 仓库和 fake API、npm、部署器覆盖：

- SHA 未变化时不查询 API、不构建、不部署。
- Test 缺失、排队、失败、事件非 push 或 SHA 不匹配时不部署。
- Test 成功后 checkout 精确 SHA，并按规定顺序执行测试、构建、生成物校验和部署。
- checkout、npm 或部署失败时不更新状态。
- 成功后原子写入状态；并发调用只有一个实例执行。
- API 返回畸形 JSON、网络失败和非法 SHA 时安全失败。
- 40/64 位小写 SHA 合法；大写、非法字符、错误长度、错误 ref 和多余字段在 API 查询前拒绝。
- `npm ci`、`npm test`、build 或生成物检查任一失败时，不运行后续 gate、部署器，也不推进状态。

### 部署器回归测试

使用 fake Docker 增加：

- 空 live 验证文件回退到非空 host 备份。
- live 与 host 都为空时在切换前失败。
- `.index-old` 清理失败时，已验证的新 `index` 保持在线，marker 已清除。

### 配置与文档测试

- 仓库不存在 self-hosted 1Panel workflow，也不再引用 Runner 标签或 Runner 服务。
- service、timer 和安装脚本路径、权限、事务回滚、10 分钟周期及 hardening 配置一致。
- 手册明确公共 API、精确 SHA、首次切换、卸载 Runner 和恢复流程；手动路径禁用 timer、等待 service inactive，并用 poller 的同一非阻塞锁串行调用可信部署器。

## 验收标准

- GitHub Runner API 中没有 `gtr-dev-tools-nav`。
- 旧 Runner user service 不存在或处于 disabled/inactive，凭据目录已移除。
- 新 timer 为 enabled/active；oneshot 成功后状态文件等于目标 `main` SHA。
- Test 和 Pages 对目标 SHA 成功，仓库没有 1Panel self-hosted run。
- user journal 显示目标 SHA 通过 Test 后构建、部署和记录状态。
- 生产核心 URL 与两个验证文件返回 200，`/content/` 返回 404。
- 容器中没有 `.index-next`、`.index-old` 或 `.deploy-in-progress` 残留。
- 下一次无变更轮询不会运行 npm 或 Docker 部署。

## 回滚

- 轮询器失败时，停用 timer；生产站点保持最后成功版本。
- 部署失败由现有事务逻辑恢复旧 `index`，状态 SHA 不更新。
- 安装升级失败时由 EXIT trap 恢复 libexec 和 unit 的全部上一个本地备份（原先不存在则删除新目标），清理 staging/备份，再 daemon reload；timer 保持 disabled。
- 只有仓库改为私有或具备受限 Runner Group 后，才允许重新采用自托管 Runner。公开仓库不得回滚到当前 Runner 架构。
