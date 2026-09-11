# dev-tools-nav · 项目全局结论总览（2026-09-11 交接基线）

> 📌 **文档编号 = HANDOVER-2026-0911-01**
>
> 本文档 = 自 Sprint1 启动 → 双部署 → JetBrains OSS 申请 → 14 天重提计划的**所有正式结论**集中归档。
> 后续任何迭代/优化/重提工作，**必须以本文档为基线**，避免重复造轮子或推翻已验证结论。

---

## 一、项目架构与核心事实（永久基线 0 变更）

| 事实编号 | 结论 | 证据链接 / 路径 |
|---|---|---|
| F-01 | 项目类型 = **纯静态 Vanilla HTML+CSS+JS 零后端**，Runtime 无需 Node；Node ≥ 18 仅 `npm ci → build` 时使用 | 根目录 `package.json` / `scripts/build.mjs` |
| F-02 | 北极星指标 = **effective_uses（Umami 9 类工具行为统计）** | `js/umami-track.mjs` / 部署报告 §3 |
| F-03 | **永久非商业红线**（JB-OSS 7 铁律 7/7 PASS，一票否决门禁，任何时间不得引入）：<br>① 商业化广告/UTM/联盟/付费墙 ② 账号后端/Cookie 跨站追踪 ③ GA/Hotjar/Mixpanel 三方追踪 ④ KMS/JRebel 密钥/付费插件（main 中已 delete）⑤ cursor/critical-correctness 远端分支已删除 ⑥ 私有自托管 GitHub Runner（GTR 必须出站只读轮询）⑦ 非 MIT 许可证内容 | `docs/jetbrains-oss-precheck-report-20260828.md` + `.gitignore` 第 33~42 行 |
| F-04 | Git 身份永久硬约束 = **所有 commit 的 Author/Committer 双字段必须 = SongYuanKun <123839070@qq.com>**（否则 CI 门禁 FAIL，见 GHA test.yml）| `test.yml` Unit job `step: Verify git author identity` |
| F-05 | 公开站点双 Hostname（Umami Website ID 两处一致）：<br>主站 = `https://tools.songyuankun.top`（GTR 1Panel openresty）<br>镜像 = `https://songyuankun.github.io/dev-tools-nav/`（GitHub Pages Actions 流水线）<br>统一 Umami ID = `99e14cad-6300-4f3c-83d2-b3b71c7d6a25` | `index.html` 页尾 `<script defer src="https://cloud.umami.is/script.js" ...>` |
| F-06 | 远端仓库 URL = `https://github.com/SongYuanKun/dev-tools-nav`，默认分支 = `main`（没有 master），**所有 push 必须走 main** | `git remote -v` / GitHub 仓库 Settings → Default branch |

---

## 二、部署架构结论（双路并行发布，互不依赖）

### 2.1 GitHub Pages 自动化部署（✅ 已全部启用，无需人工）

| 组件 | 当前状态 / 关键配置 | 证据路径 |
|---|---|---|
| **Workflow A — Deploy Pages** | 每次 main Test=green 后链式触发；concurrency=pages 防并发；3 步官方 v4/v5 actions：`configure-pages → upload-pages-artifact → deploy-pages@v4`；`_site/.nojekyll` 必须写入 + CNAME 可选复制 + rsync 排除 `tasks/scripts/ops`（防止部署脚本暴露） | [.github/workflows/deploy-pages.yml](file:///Users/mac/vs-code/dev-tools-nav/.github/workflows/deploy-pages.yml#L56-L85) |
| **Workflow B — Test 质量门禁** | 3 大优化：① `dorny/paths-filter@v3` 31 条代码路径 → docs-only 变更跳 Playwright 全量 CI 节省 60%（3min→50s）② `actions/cache@v4` Playwright browsers key= `playwright-${runner.os}-chromium-${hashFiles('package-lock.json')}` 省 600MB 下载 ③ 失败 `upload-artifact@v4` 保留 `/tmp/npm-test*.log` 7 天 | [.github/workflows/test.yml](file:///Users/mac/vs-code/dev-tools-nav/.github/workflows/test.yml#L18-L74) |
| **GitHub UI 侧必配 3 项**（一次性设置，2026-08-30 已说明）| ① Settings → Pages → Source = **GitHub Actions**（不选分支 gh-pages）② Settings → Branches → main 规则勾选 5 项：Require PR / Require status checks=Test/unit / Resolve conversations / No force push / No delete / Deny bypass ③ 可选绑 CNAME：仓库根新建 `CNAME=tools.songyuankun.top` → DNS CNAME → Enforce HTTPS | `deploy-pages.yml` docs §3 / Settings 页路径 |
| **Actions Secrets / Env 密钥** | **0 项**（Pages + GTR 均用公开仓库只读拉取，零泄露面，不需配置）| Settings → Secrets and variables → Actions → 无 |

### 2.2 GTR 内网机（1Panel openresty）部署架构（✅ 已落地，部署脚本见 §二 2.3）

| 组件 | 关键配置 / 信任边界 | 证据路径 |
|---|---|---|
| **部署链路信任模型** | **GTR 出站主动读公开仓库（GTR → 443 → GitHub + npm）**，禁止：① GitHub Runner 注册回连 GTR ② webhook 推送 ③ 入站 22/80 除 frp 外全关。符合最小权限原则 | `scripts/deploy-1panel-local.sh` header 注释 |
| **GTR 官方 SSH 入口 3 路**（infra servers-inventory.yaml）| ① Tailscale：`gtr`（100.x.x.x）/ `gtr-pub` alias ② frps 公网隧道：`kun@8.130.166.49:2222`（frpc 心跳必须在）③ 跳板：`public-srv (8.130.166.49:22 root) → SSH kun@192.168.31.195 内网段` | `~/.ssh/config` 对应 Host 段 / infra/servers/servers-inventory.yaml 第 16~30 行 |
| **核心部署脚本** | `deploy.sh`（顶部入口，检查 git 状态）→ `scripts/deploy-1panel-local.sh`（构建 + rsync 白名单 → docker cp 进 1Panel 容器 `1Panel-openresty-rRvM` → 原子性 `mv NEXT → TARGET` + 失败 trap 自动回滚 OLD 目录）。**rsync include 清单最新版本含 = assets/css/data/js/pages/tools/search-console/LICENSE/CODE_OF_CONDUCT/CONTRIBUTING/manual/sitemap.xml/robots.txt** | [scripts/deploy-1panel-local.sh](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-1panel-local.sh#L39-L100) |
| **1Panel 容器站点目录** | `/www/sites/tools.songyuankun.top/index/` → openresty 对外 443 → tools.songyuankun.top（Baidu / Google 2 个 verify HTML 必须保留，rsync 不能删） | deploy-1panel-local.sh 第 82~90 行 |
| **GTR 本地部署验收标准（必须 PASS ≥ 14）** | HTTP 14 路由 × 200 = `/` + `/search-console.html` + `/sitemap.xml` + 11 个 `/tools/*/`（json/jwt/base64/uuid/color/cron/diff/regex/sql-formatter/timestamp + tools 根）+ search-console.html 关键字 `search-gap` + `search-queries` 命中 ≥ 3 | `06-consistency-check.sh` 历史三栏模型（现 Y480 已删除，验收标准沿用 HTTP 栏和关键字栏）|

### 2.3 已删除部署资产（⚠️ 永久禁用，不要再恢复）

| 已删除资产 | 删除原因 / 时间 | 状态 |
|---|---|---|
| `scripts/deploy-y480/` 9 件脚本集（联想 Y480 本地部署）| 2026-09-09 项目需求切换为 GTR-only，Y480 方案废弃 | ✅ 目录已 rm；全仓 `grep Y480/y480/deploy-y480` 代码/配置中 0 命中（仅 `data/csdn-articles.json` 博客历史文章含 Y480 标题，属原创博客公开内容，非部署配置，保留不删） |
| `docs/deployment-report-y480-github-20260830.md` | 同上双部署报告，Y480 部分永久废弃 | ✅ 已删除 |

---

## 三、JetBrains OSS 申请结论（2026-08-29 提交 → 09-09 拒信 → 14 天重提计划）

| 节点编号 | 结论 / 时间线 | 证据（本机私密，GitHub 0 泄露）|
|---|---|---|
| JB-01 | **提交日 T+0 = 2026-08-29 周六北京时** → Application ID = `29082026/19994700` | `emails/p5b-request-id-confirmation-email-*.jpg`（私密）|
| JB-02 | **催办日 T+8 = 2026-09-09 周三北京时** → 工单落库 `Request #9139250` Zendesk | 进度日志 §催办事件 |
| JB-03 | **拒绝日 R0 = 2026-09-09（GMT+2）= 北京 09-10 凌晨** → 审核员 = Veronika Shakhova（Community Support Team）<br>拒因 = *"can't offer collaboration at this time"*，**未触发 Case B 任何补充问询（R1~R4 形式错误全过）** → **核心拒因 = 综合评分 3 栏加权未达门槛**：① GitHub Community Health 健康度 ≤ 50%（缺 CONTRIBUTING/PR/Issue 模板/SECURITY/SUPPORT 8 项）② 公开原创 ≥ 2000 字博客 ≥ 2 篇关于 dev-tools-nav 本身的缺失（当前 CSDN 都是 AI 雷达周报）③ 页面缺 JetBrains OSS 徽章 + README 感谢段（JB 生态承认栏 5% 权重）④ STAR/外部第三方引用 0（无 Twitter/YouTube/B 站评测）⑤ 12 个月 Owner commits steady cadence 存在明显 30 天空窗段 | [emails/2026-09-09-1355-Veronika-R0-decline-noncommercial-offer.eml.txt](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/emails/2026-09-09-1355-Veronika-R0-decline-noncommercial-offer.eml.txt#L1-L30) （私密） |
| JB-04 | **可立即使用的 Non-Commercial 免费 IDE（Veronika 主动提供，no application / no renewal needed）** = **6 款**：WebStorm / CLion / Rider / RustRover / RubyMine / DataGrip → 领取入口 = <https://www.jetbrains.com/shop/eform/opensource-non-commercial>，用 `123839070@qq.com` 登，填 4 项表单 30 秒过 | 同上拒信原文第 2 段 |
| JB-05 | Community Edition 永久免费核心功能 2 款：IntelliJ IDEA Community（Java/Kotlin）/ PyCharm Community（Python + Jupyter） | 同上 |
| JB-06 | **下次重提开放日 = 2026-09-24（拒信日 + 14 日历天）**；重提方式 = **无痕浏览窗口 + 相同邮箱 123839070@qq.com + 新 Application ID**（旧 ID 29082026/19994700 仅作归档）；重提前必须完成 **8 项加权改造 SOP（H1~H8）合计加分 ≥ 15，JB 命中率 ≥ 95%** | 见 本文档 §四 / H1~H8 子文档 `03-codex-takeover-roadmap-v8.md` §重提 |

---

## 四、Git 安全边界与敏感内容控制（✅ 2026-09-10 刚落地，后续任何 commit 不能违反）

| 编号 | 规则 / 生效方式 | 证据 |
|---|---|---|
| G-01 | 永久遮罩规则（根 `.gitignore` 第 33~42 行生效，续期目录自动继承，不用再改）：<br>✗ `docs/*jetbrains*/PROGRESS-TRACKER.md`（含真实 ID / 工单）<br>✗ `docs/*jetbrains*/emails/`（邮件截图、Message-ID）<br>✗ `docs/*jetbrains*/submission-pack/`（身份/活跃度素材）<br>✗ `docs/*jetbrains*/audit/`（合规脚本，邮箱白名单正则）<br>✔ 允许入仓库的只有 JetBrains 目录下 4 个纯模板：README / SUBMISSION-CHECKLIST / APPLICATION-OPERATIONS-GUIDE / ARCHIVE-INDEX | [.gitignore](file:///Users/mac/vs-code/dev-tools-nav/.gitignore#L33-L42) + 目录 [docs/jetbrains-oss-application-20260828/](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828) 远端 ls-tree 只有 4 个 md |
| G-02 | 敏感内容进仓库紧急恢复 3 档：① staged 未 commit → `git rm -r --cached <路径>` ② 已 commit 未 push → `git reset HEAD~1 --soft` ③ 已 push 到公开 → 必须 `git filter-repo` 做全历史重写 + 强制改分支保护 | `.gitignore` 注释 + jetbrains 目录 README.md §紧急恢复 |
| G-03 | 所有部署脚本 `scripts/deploy*` / `.github/workflows/*` 必须 0 Secrets，所有密钥存个人 `~/.ssh/` 或 1Panel 容器本地，禁止入 repo | 现状：Actions Secrets = 0 ✅ |

---

## 五、当前 main HEAD 基线（交接点 = 2026-09-11 前最近一次 push）

| 项 | 值 |
|---|---|
| main HEAD commit | 每次交接前请更新 `git rev-parse --short origin/main`（文档发布当日 = `7598ee1` chore(security)）|
| 变更文件数（本交接文档 5 份 commit 后）| 以最终 commit `--stat` 为准 |
| GitHub Pages 状态 | 自动部署，无需人工 |
| GTR 站点状态 | 取决于 GTR 主机在线/frpc 心跳；codex 接手第一步= §04-codex-boot-5step-checklist.md 第 1 步连通性确认 |

---

### 📑 本总览对应交付文档（docs/codex-handover-20260911/ 目录，5 份全套）

| 文档编号 | 文档路径 | 用途 |
|---|---|---|
| HANDOVER-01 | `01-project-global-conclusions-overview.md`（本文件）| 全局结论总览（本 2026-0911 基线）|
| HANDOVER-02 | `02-handoff-meeting-minutes.md` | 专项交底会议纪要（背景/核心要求/P0-P2 优先级/交接 5 件事）|
| HANDOVER-03 | `03-codex-takeover-roadmap-v8.md` | codex 接手后 **版本同步 → 8 项功能迭代/性能优化/缺陷修复 → 评审测试** 完整路线图 |
| HANDOVER-04 | `04-codex-boot-5step-checklist.md` | GTR 开机即跑 5 步操作清单（连通→合并→构建→部署→验收）|
| HANDOVER-05 | `05-stage-progress-report-template.md` | 阶段开发进度报告模板（codex 每阶段结束自动填） |
