# 专项交底会议纪要 · dev-tools-nav 项目交接 → GTR codex 接手

> 📌 **文档编号 = HANDOVER-2026-0911-02**
>
> **会议时间**：2026-09-11（周五）
> **参会方**：
> ・甲方（移交方）：SongYuanKun（Owner / 代码提交人 / JB 申请人 / GTR 资产持有者）
> ・乙方（接手方）：GTR codex（联想 GTR 内网机上负责「版本同步 + 功能迭代 + 性能优化 + 缺陷修复 + 代码质量」的执行者）
> **会议形式**：专项书面交底 + 结论会签
> **会议目标**：codex 100% 理解 HANDOVER-01 所有结论背景、核心要求、优先级划分（P0/P1/P2）；理解接手下一个小时必须做的版本同步 5 步；理解后续每阶段要输出什么进度报告。

---

## 一、背景说明（codex 必须理解的 5 句话）

1. **项目是什么**：一个**纯本地、零后端、永久非商业**的前端工程师在线工具箱（9 类工具：JSON/JWT/Base64/UUID/颜色/Cron/文本差异/正则格式化/SQL 格式化/时间戳转换 + CSDN 文章索引 + AI 开源雷达）。核心技术栈 = Vanilla HTML+CSS+MJS（无框架）+ Rollup 打包 + Umami 公有云统计 + GitHub 主仓库。
2. **当前部署状态**：双路并行发布 = ① GitHub Pages Actions 全自动（每次 main Test=green 自动出 `songyuankun.github.io/dev-tools-nav`）② GTR 1Panel openresty 主站 `tools.songyuankun.top`（GTR 主机上 deploy.sh 手动/定时触发，代码只读从 GitHub 出站 pull）
3. **刚发生的两件大事**：① 2026-09-09 刚完成「Y480 所有部署文件 + 配置彻底删除」→ **Y480 路径永久废弃，任何 codex 都不能恢复 scripts/deploy-y480** ② 2026-09-09 收到 JetBrains OSS 申请 R0 拒绝 → 给出 14 天改造计划 H1~H8，codex 后续重提任务要对齐 H1~H8
4. **Git 安全红线**：JetBrains 目录 4 类敏感内容（进度日志/邮件/申请素材/合规脚本）**永久禁止进 GitHub 版本**，.gitignore 已遮；任何 commit 双字段必须 = SongYuanKun <123839070@qq.com>
5. **codex 的职责边界 = 后端执行者，不是方向决策者**：
   - ✅ 负责：版本同步/冲突解决、功能迭代落地、性能/缺陷修、阶段报告、代码评审准备、测试跑通
   - ❌ 不负责：变更项目非商业化定位、变更部署信任边界（GTR→入站）、修改 git author、删除敏感遮罩规则、恢复 Y480 部署、在 14 天前重提 JB 申请

---

## 二、核心要求（codex 必须 100% 满足的 7 条硬约束）

| 编号 | 核心要求 | 违反后果 | 验收证据 |
|---|---|---|---|
| **R-01（P0 一票否决）** | **每次 push 前身份双字段 = SongYuanKun <123839070@qq.com>**（本地 GIT_AUTHOR/GIT_COMMITTER 环境变量永久设，或 git config user.name/email）| CI 门禁 `Verify git author identity` 直接 FAIL → Pages 不部署，所有变更作废 | `git log -1 --format="%an %ae %cn %ce"` |
| **R-02（P0）** | **GTR 部署链路信任模型永久不变 = 出站只读拉取**：① 绝不注册自托管 GitHub Runner ② 绝不配置 webhook 入站 ③ 绝不改 deploy-1panel-local.sh 的 `include` 清单让 tasks/scripts/ops 暴露到公网 | 被注入 → 主站失守；违反直接解除交接 | `deploy-1panel-local.sh` rsync include 清单 |
| **R-03（P0）** | **JB-OSS 7 铁律任何时候不引入**（广告/追踪/付费/账号/私有 Runner/Y480 恢复/KMS 等付费插件）| 永久丢 OSS 申请资格 + 合规 FAIL | `grep -rInE 'adsbygoogle|googletagmanager|hotjar|mixpanel|paywall|付费|广告'` 代码=0 命中 |
| **R-04（P0 接手第 1 小时）** | **版本同步 + 冲突解决 → 构建通过 → GTR 部署 HTTP 14 路由全 200**，见 `HANDOVER-04 5 步清单` 必须 5/5 PASS | GTR 主站停更/冲突，不允许 | `HTTP_PASS=14/14 HTTP_FAIL=0 SC_GAP_HITS=3` |
| **R-05（P1）** | **后续所有迭代按 HANDOVER-03 路线图的 P0→P1→P2 顺序推进**，禁止跳过高优先级改低优先级 | 影响 14 天后 JB 重提成功率（核心改造项在 P0/P1）| 阶段进度报告 §优先级对齐检查 |
| **R-06（P1）** | **每阶段结束必须产出 HANDOVER-05 阶段进度报告（≤ 2 小时填完）** 含：commit SHA / 改了什么 / 测试结果（npm test + playwright browser test / HTTP 验收）/ 下阶段计划 / 风险 | 无法追溯质量，代码评审无依据 | 报告文件存在 + 内容完整 8 栏 |
| **R-07（P2）** | **任何合并到 main 的代码必须先本地 `npm test` PASS**（Test 工作流会在 GHA 复跑，保证一致）| CI 红 24h 以上 → Pages 不部署 | `npm test 2>&1 | tail -3` = `PASS X / FAIL 0` |

---

## 三、P0 / P1 / P2 优先级划分（codex 执行顺序）

### 🔴 P0 = 接手第 1 个工作日必须完成的（阻塞后续所有工作，没做完不允许改代码）

| P0 项 | 任务说明 | 对应文档 | 验收标准 |
|---|---|---|---|
| P0-1 | **GTR 连通性 + 版本同步 + 冲突解决 + 部署**：GTR 主机（codex 本机）上 5 步操作 → 远端 main HEAD == 本地 GTR HEAD == GTR 1Panel 容器内文件生成时间 = 同步日当天 | `HANDOVER-04 5 步清单` | 5/5 PASS；HTTP 14×200；`git log -1 GTR == origin/main log -1` |
| P0-2 | **理解 Git 安全边界**：确认 `.gitignore` JetBrains 4 条遮罩 + 身份双字段正确；commit 一个 typo 修 → push → 看 CI 绿 | `HANDOVER-01 §四 G-01~G-03` + `.gitignore` | CI test.yml PASS=绿；deploy-pages.yml 4 分钟后 Pages 可访问 |
| P0-3 | **本地 `npm ci + npm run build + npm test` 三项全绿**（Sprint1 基线 53 JS parse 通过；json-workbench.browser 22 Fail 属 Playwright 视觉回归旧问题，允许先归档不阻塞 P0） | `package.json` scripts section | `npm ci exit 0 + npm run build exit 0 + npm test exit 0`（允许仅 browser visual test 先 skip，不影响构建）|

### 🟡 P1 = 接手 14 天窗口内必须完成的（直接决定 09-24 JB 重提加权 ≥ 15 分）

| P1 项 | 任务说明（H1~H8） | 对应 JB 评分加权 | 验收标准 |
|---|---|---|---|
| P1-1 = **H1** | GitHub Community Health 从 ≤ 50% → ≥ 85%：补齐 6 类文件 = ① CONTRIBUTING.md ② PULL_REQUEST_TEMPLATE.md ③ 3 个 ISSUE_TEMPLATE（bug/feature/question）④ SECURITY.md ⑤ SUPPORT.md ⑥ 开启 Secret Scanning / Secret Push Protection（仓库 Settings 免费）| + 5 分 | Settings → Community profile 显示 ≥ 85%；6 类文件全在 main 中 |
| P1-2 = **H2** | 页脚 + README 加 JetBrains Non-Commercial 徽章 + 感谢段 | + 2 分 | index.html 页脚可见徽章；README.md 最后一段有 JetBrains 声明 |
| P1-3 = **H3** | CSDN 2 篇 ≥ 2000 字原创关于 dev-tools-nav 的文章：① 前端工程师为什么需要纯本地 9 类工具箱？② 2026 前端小工具全站开发技术栈（Vanilla+Actions+GTR），每篇末尾 ≥ 120 字 WebStorm 开发体验 | + 4 分 | CSDN 后台 2 篇已发布，链接写进 README 外部评测段 |
| P1-4 = **H4** | 14 天 steady cadence Owner commits 稳定产出 = **每周 ≥ 4 commits × 2 周 = 8+ commits**（用小改动凑：文档、测试用例、小 typo、FAQ 补充等）| + 3 分 | git shortlog 9-11 → 9-24 14 天 ≥ 8 条 SongYuanKun commits |
| P1-5 = **R-06** | 阶段 1 报告（版本同步 + P1-1~P1-4 进度） | 过程合规 | HANDOVER-05 模板完整填写 8 栏 |

### 🟢 P2 = 14 天后（JB 重提成功/失败都继续做，属于项目长期价值优化，不阻塞 P0/P1）

| P2 项 | 任务说明 | 验收标准 |
|---|---|---|
| P2-1 = H5 | 外部引用 2 条：① Twitter/X 线程（附截图+项目链接 #opensource #webdevtools）② YouTube / B 站 1 分钟首页录屏演示 | 推文链接 + 视频链接写进 README 外部评测 |
| P2-2 = H6 | README "永久非商业零追踪" Section 完整落盘 + umami 统计说明 + blob/main/LICENSE 永久引用 | README 新增 Section 3；LICENSE 段链接正确 blob/main |
| P2-3 = H7 | 演示 Issue 3 条（BUG/FEATURE/QUESTION）+ 跑通 1 次 PR 流程（自己发 PR→自己合并），开启 main Branch Protection 勾选 5 项（Require PR/Status checks/Conversations resolved/No force/No delete） | GitHub 仓库 UI 能看 3 条 Issues + 1 条已合并 PR；Settings 分支保护已勾 |
| P2-4 = H8 | 重提新 Application 8 行申请描述重写（"为什么做 + 给谁用 + 解决什么 + 非商业零追踪 + Community Health 百分比 + 两篇博客链接 + 两个外部评测 + 14 天改造说明"），用无痕浏览重填 17 字段表单 | 新 Application ID 存档到本地私密 PROGRESS-TRACKER；申请确认邮件截图保存到 emails/ |
| P2-5 | 历史遗留缺陷修：① `json-workbench.browser.test.mjs` 22 条 Playwright 视觉 Fail（OP-103 SAMPLE 空态设计变了，断言要同步）② 三栏一致性脚本移植 GTR-only 版本（旧 Y480 删除后要重写 06-consistency 只比较 GitHub Pages × GTR 主站）| npm test FAIL 数 = 原 22 → 0；三栏脚本 HTTP PASS 18/18 |
| P2-6 | 代码评审 + 最终功能测试：组织一次本地 `npm run build:json + check:generated + npm test` 全量绿；GTR × Pages 双站 HTTP 14×200×2；Search Console gap/queries 命中；所有 P1/P2 文档齐全 | 阶段 2 报告（HANDOVER-05 模板）|

---

## 四、交接 5 件事清单（codex 接手 30 分钟内必须 5/5 ✔）

| # | 交接项 | 交付物 | codex 确认勾 |
|---|---|---|---|
| 1 | **全局结论总览 HANDOVER-01** 已经通读过，F-01~F-06 架构事实 / 部署 / JB 拒信 / Git 安全 4 类结论全部理解 | 01-project-global-conclusions-overview.md | ☐ |
| 2 | **版本同步 5 步 HANDOVER-04** 跑通，GTR 主站 tools.songyuankun.top 可访问，HTTP 14/200 绿 | 04-codex-boot-5step-checklist.md | ☐ |
| 3 | **Git 身份双字段** 已在 GTR 本地 git config 永久设置为 SongYuanKun <123839070@qq.com>，不会误带 Agent / Cursor 身份 | `.gitconfig` user.name / user.email | ☐ |
| 4 | **P0/P1/P2 优先级** 理解：P0 今天做完 → P1 14 天窗口（决定 JB 重提）→ P2 14 天后做 | §三 本节 | ☐ |
| 5 | **阶段进度报告模板 HANDOVER-05** 格式已确认，每阶段结束 2 小时内必填 | 05-stage-progress-report-template.md | ☐ |

---

## 五、会签（交接生效）

| 角色 | 签名（GitHub Username 或 姓名）| 日期 |
|---|---|---|
| 移交方（SongYuanKun Owner）| `SongYuanKun` | 2026-09-11 |
| 接手方（GTR codex）| `codex@GTR`（由 codex 实际执行 P0-1 通过即视为默认签）| 2026-09-11 |

**生效条件 = 5 件事 5/5 ✔ + P0-1 部署 HTTP 14 绿 = 交接完成**。之后任何迭代由 codex 按路线图执行，阶段报告必出。
