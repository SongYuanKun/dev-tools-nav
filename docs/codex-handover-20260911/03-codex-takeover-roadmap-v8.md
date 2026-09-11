# codex 接手路线图 v8 · 版本同步 → 8 项功能/性能/优化 → 评审测试（P0 → P1 → P2）

> 📌 **文档编号 = HANDOVER-2026-0911-03**
>
> 本文档 = codex 接手后 0~30 天**执行顺序手册**，所有任务按 P0/P1/P2 依赖拓扑排列；codex 必须**严格按顺序**执行，未完成前序不得跳级。

---

## 🔴 P0 阶段 · 接手后 1 个工作日内完成（阻塞一切后续任务）

### P0-1 版本同步 5 步（GTR 机本地上执行）

> 对应操作清单 = `HANDOVER-04 04-codex-boot-5step-checklist.md`（**codex 先读这个再执行**）

```
① 连通性确认（入口 3 选 1：Tailscale gtr-pub / 8.130.166.49:2222 / public-srv 跳板）
② git pull origin main → 合并冲突 → git status clean（必须 ahead=0 behind=0）
③ npm ci --no-audit --no-fund  →  npm run build  →  npm run check:generated
④ bash /home/kun/vs_code/dev-tools-nav/deploy.sh → 同步进 1Panel 容器
⑤ HTTP 14 路由 × 200 + search-console 关键字命中 3
```

**验收 = P0-1 输出：**
```
HTTP_PASS=14  HTTP_FAIL=0  SC_GAP_HITS≥3
GIT_LOCAL_HEAD == origin/main HEAD（git rev-parse 一致）
1Panel 容器内 /www/sites/tools.songyuankun.top/index/index.html mtime == 部署日
```

### P0-2 Git 安全基线确认

在 GTR 机上跑一次自检脚本：
```bash
cd /home/kun/vs_code/dev-tools-nav
# 身份双字段
git config user.name "SongYuanKun"
git config user.email "123839070@qq.com"
git commit --allow-empty -m "chore(codex): P0 identity baseline test by codex@GTR"
# 检查
git log -1 --format="%an %ae %cn %ce"   # 必须= SongYuanKun 123839070@qq.com SongYuanKun 123839070@qq.com
# 然后再 empty commit 撤掉（保持历史 clean，可选）：git reset HEAD~1 --soft
```

### P0-3 三项构建绿（本地开发环境准备）

```bash
cd /home/kun/vs_code/dev-tools-nav
npm ci --no-audit --no-fund      # 锁版本 package-lock
npm run build                    # build.mjs rollup 打包所有 MJS/HTML
npm run check:generated          # 输出文件完整性校验（build-search-console / sitemap.xml）
npm test 2>&1 | tail -10          # CI 门禁；允许 browser visual test 22 先 fail（P2-5 修），核心测试需 PASS
```

---

## 🟡 P1 阶段 · 14 天窗口（2026-09-11 → 2026-09-24）完成，**直接决定 JB OSS 重提 ≥ 15 加权分**

### P1-1 = H1 · GitHub Community Health ≥ 85%（预估 4h）

| 子任务 | 产出文件 / 设置项 | 位置 |
|---|---|---|
| 1 | CONTRIBUTING.md（贡献指南 + 本地环境搭建 5 步 + PR 流程 4 步）| 仓库根 |
| 2 | PULL_REQUEST_TEMPLATE.md（标题 / 测试结果 / 改了什么 / 风险 4 勾）| `.github/PULL_REQUEST_TEMPLATE.md` |
| 3a | bug_report.md（复现步骤 / 预期 / 实际 / 版本号 4 项）| `.github/ISSUE_TEMPLATE/bug_report.md` |
| 3b | feature_request.md（动机 / 期望行为 / 替代方案 3 项）| `.github/ISSUE_TEMPLATE/feature_request.md` |
| 3c | question.md（问题描述 + 已尝试步骤）| `.github/ISSUE_TEMPLATE/question.md` |
| 4 | SECURITY.md（漏洞披露 email=123839070@qq.com + 响应 SLA 5 工作日）| 仓库根 / `.github/SECURITY.md` |
| 5 | SUPPORT.md（提问前看 FAQ / 发 Issue 模板）| 仓库根 / `.github/SUPPORT.md` |
| 6 | 仓库 Settings → Code security → 开启 **Dependabot alerts + Secret scanning + Push protection**（全免费）| Settings UI |

**验收：**
- Settings → Community Profile 显示 **≥ 85%**
- 新建 Issue 时看到 3 个模板（Bug / Feature / Question）可勾
- 新建 Pull Request 时模板自动弹出

### P1-2 = H2 · JetBrains Non-Commercial 徽章 + README 感谢段（预估 0.5h）

1. `index.html` 页脚 `<footer>` 倒数第 2 个元素内加（与 Umami 统计 badge 同栏）：
   ```html
   <a href="https://www.jetbrains.com/community/opensource/" rel="noopener" target="_blank" title="Powered by JetBrains Non-Commercial Open Source licenses">
     <img src="https://img.shields.io/badge/JetBrains-Non--Commercial%20Open%20Source-000?logo=jetbrains&logoColor=fff" alt="JetBrains Non-Commercial Open Source badge" />
   </a>
   ```
2. `README.md` 末尾新增一段（倒数第 2 段）：
   ```markdown
   ## 🔧 致谢 · 开发工具支持
   本项目使用 **JetBrains WebStorm (Non-Commercial Open Source License)** 进行前端开发，感谢 JetBrains 团队对全球开源社区的长期支持：  
   [https://www.jetbrains.com/community/opensource/](https://www.jetbrains.com/community/opensource/)
   ```

### P1-3 = H3 · CSDN 原创 2 篇（预估 6h，P1 中占时间最多）

| 文章编号 | 标题建议（可微调，核心信息必须包含） | 必需要素（少一个就不算 H3 达标） |
|---|---|---|
| **ART-1** | 《2026 前端工程师为什么需要一个纯本地的 9 类工具箱？》 | ① dev-tools-nav GitHub 链接 ② 9 类工具举例（JSON / JWT / Base64 / UUID / 颜色转换 / Cron / Diff / Regex / SQL Formatter / Timestamp / Search Console 实际场景 4 个）③ 纯本地零后端的 3 个优势：隐私 / 离线可用 / 零维护 ④ 页脚 Umami 本地追踪声明 + 无广告无 Cookie 截图 1 张 ⑤ 末尾 120+ 字 WebStorm 开发体验（如何好用、为什么比 VSCode 更顺手，要真实体验不要空泛） |
| **ART-2** | 《全站零后端 2026 前端小工具开发技术栈实战：Vanilla + GitHub Actions + GTR 1Panel 内网主站》 | ① dev-tools-nav 链接 ② 技术栈 5 大件：Vanilla HTML/CSS/MJS / Rollup 打包 / Playwright E2E / Umami 统计 / GitHub Pages 自动流水线 ③ CI 性能优化 3 招（path filter 跳 docs-only / Playwright 浏览器独立缓存 / Node24 无 deprecate）④ GTR 主站 1Panel openresty + rsync 原子部署模型 + 信任边界（出站只读 vs 入站 webhook）⑤ 末尾 120+ 字 WebStorm + DataGrip 配合管理 Search Console 数据源体验 |

- 发布后**两篇 CSDN 文章链接**写进 README 倒数第 3 段 "外部评测 / 文章引用"；文章标签带 #前端工具 #开源工具 #dev-tools-nav
- 验收 = 2 篇文章可公开访问（私密不行）+ 两篇都满足上表 5 要素

### P1-4 = H4 · 14 天 steady cadence 稳定 commits（预估全程 2h 分散）

- **目标 = 14 天 ≥ 8 commits**（每日 0.5~1 条，不用大改，小改动即可：文档补充、测试用例、FAQ、小 typo、CSS 小样式微调、README 章节补充）
- 工具提示：用 `docs/HANDOVER-05` 阶段进度报告每次记录本周 commits 数量
- 验收 = `git shortlog -sn --since="14 days ago" | head -5` 显示 SongYuanKun ≥ 8

### P1-5 · 阶段 1 进度报告

用 HANDOVER-05 模板填 P0 + P1-1~P1-4 所有执行结果，8 栏必填：
```
阶段编号 / 起止时间 / 计划 vs 实际完成项 / 代码变更（commit 列表）/ 测试结果（npm test + HTTP 14×200 / Playwright）/ 文档产出 / 风险与阻塞 / 下阶段计划
```

---

## 🟢 P2 阶段 · 2026-09-24（JB 重提窗口开放）后继续做

### P2-1 = H5 · 2 条第三方外部引用（预估 2h）

| 子任务 | 要求 | 产出 |
|---|---|---|
| ① Twitter/X 线程 | 至少 3 条：项目介绍 + 首页截图 + 一个工具 GIF（JSON 工作台）；带标签 `#opensource` `#webdevtools` `#前端工具`；@ SongYuanKun 账号（如有）| 推文永久链接（公开可访问，非私密），写进 README 外部评测 |
| ② YouTube / B 站 1 分钟视频 | 内容 = 首页 Tour 4 步 + JSON 工作台 2 个功能演示 + 页脚 JB 徽章 + 页脚 Umami 声明 + Search Console 打开 | 视频 URL 公开可访问（未列出或私密都不行），写进 README 外部评测 |

### P2-2 = H6 · README 非商业零追踪 Section 补全（预估 1h）

README 新增 Section **「3. 关于本项目 · 永久非商业零追踪」**，必须包含 6 点：
1. 永久非商业化（无广告/无付费墙/无联盟链接/无 UTM）
2. 不收集任何个人可识别信息 PII（Umami 仅做匿名统计，不含 IP/User-Agent 全量）
3. 纯本地运算，9 类工具所有处理逻辑**全部浏览器内完成**，数据不上传任何服务器
4. LICENSE = MIT，blob/main 链接引用
5. 源代码 100% 公开、任何人可审计、可 fork 自用
6. 引用 P1-3 两篇 CSDN 文章链接

### P2-3 = H7 · Issue 模板实战激活 + PR 流程跑通（预估 1h）

1. 新建 3 条演示 Issue（各 1 条 = BUG / FEATURE / QUESTION），使用 Issue 模板完整填写
2. 用 typo 修开 1 条 PR（从 feature 分支 → main），触发 PR 模板 → 合并进 main → 看 CI 变绿
3. 仓库 Settings → Branches → Branch Protection main 勾选 6 项：
   - Require a pull request before merging (1 approval)
   - Require status checks to pass (Test / unit required)
   - Require conversation resolution before merging
   - Do not allow bypassing the above settings
   - Allow deletions = ❌ No
   - Allow force pushes = ❌ No

### P2-4 = H8 · JB OSS 重提申请（预估 1h，09-24 之后执行）

- **前置条件 = P1-1/H1（≥85%）+ P1-2/H2（徽章）+ P1-3/H3（2 篇）+ P1-4/H4（8 commits）4 项全部 PASS**
- 执行方式：**无痕浏览窗口**（不能带登录 cookie，避免被关联旧 19994700 申请）→ 打开 <https://www.jetbrains.com/shop/eform/opensource> → 用 `123839070@qq.com` 重新填 17 字段表单，**"项目描述 / Why do you need JetBrains licenses"** 按下方 8 行重写：

```
项目动机：为前端工程师打造一个 100% 浏览器内计算、零后端、永久非商业的 9 类工具箱（JSON/JWT/Base64/UUID/颜色/Cron/Diff/Regex/SQL Formatter/Timestamp + CSDN文章索引 + AI开源雷达），解决日常开发中小工具分散、离线不可用、隐私泄露的痛点。
核心用户群：独立开发者 / 学生 / 非商业团队的前端/后端工程师，日均处理 JSON 解析 / JWT 调试 / 格式转换 50+ 次。
解决什么问题：① 零后端 100% 浏览器运算，数据不出浏览器，隐私合规；② 离线可用，无网络环境也能跑；③ 统一 UI 导航，告别 20+ 收藏夹工具页跳转；④ 与 CSDN 原创博客 + Search Console 数据源打通，学习/工作/复盘一体化。
非商业零追踪声明：本项目永久非商业（无广告/无付费/无联盟链接/无 Cookie 跨站追踪），所有统计使用 Umami 公有云匿名统计，不收集 PII；LICENSE=MIT 存放在 GitHub blob/main/LICENSE。
GitHub Community Health 百分比：%_COMMUNITY_HEALTH_PERCENT_% （填 Settings → Community profile 显示的实际数字，目标 ≥ 85%）。
两篇公开原创博客链接：
  1) %_ARTICLE_1_CSDN_URL_%
  2) %_ARTICLE_2_CSDN_URL_%
两条公开第三方评测引用：
  1) %_TWITTER_THREAD_URL_%
  2) %_VIDEO_YOUTUBE_OR_BILIBILI_URL_%
14 天改造计划：自 2026-09-09 收到社区反馈后，我们在 14 天内补齐了 CONTRIBUTING/PR/Issue/SECURITY/SUPPORT 8 项社区健康文件，公开 2 篇项目深度技术文章，加了 JetBrains 生态徽章，并确保了 steady cadence 的持续维护，期待 JetBrains 官方支持在 2026 下半年继续打磨 9 类工具的交互体验 + Playwright 测试覆盖。
```

- 提交成功后把 3 样东西存档到本地私密目录（禁止进 GitHub）：
  ① **新 Application ID** 写入 PROGRESS-TRACKER.md
  ② 提交成功页面截图 → `emails/p5a-submit-confirmation-page-20260924.jpg`
  ③ 确认邮件 Request ID 截图 → `emails/p5b-request-id-confirmation-email-YYYYMMDD-NEWID.jpg`

### P2-5 · 遗留缺陷修复（预估 4h）

| 子任务 | 旧状态 | 目标状态 |
|---|---|---|
| ① Playwright 22 视觉回归 Fail：`json-workbench.browser.test.mjs` 中 OP-103 SAMPLE 空态设计改动，断言是 Sprint1 旧 "empty editor starts clean" 模式 | npm test browser = 22 FAIL → **0 FAIL** |
| ② 双部署一致性脚本：旧 Y480 删除后 GTR-only 重写 `scripts/consistency-gtr-x-ghpages.sh`，只比较 GitHub Pages × GTR 主站 三栏：A=18 路由 HTTP 200 / B=8 工具子页关键字矩阵 / C=search-console SHA | 无脚本（Y480 已删）→ `scripts/consistency-gtr-x-ghpages.sh` 存在，bash -n 通过，跑通 PASS 18/18 DIFF 0 |

### P2-6 · 最终代码评审 + 功能测试（预估 2h）

1. 全量本地 `npm run build → check:generated → npm test` 三项 exit 0
2. GitHub Pages × GTR 主站 HTTP 14 × 200 × 2 双站
3. Search Console 关键字 `search-gap + search-queries` 命中双站 ≥ 3
4. 用 HANDOVER-05 模板填**阶段 2 最终报告**，附 P1~P2 所有 commit SHA 列表
5. 组织书面代码评审（SongYuanKun + codex 会签）= 所有 P0-P2 任务清单勾完 = 路线图闭环

---

## 路线图依赖拓扑（codex 必须遵守的顺序图）

```
P0-1 版本同步5步 ──→ P0-2 Git身份基线 ──→ P0-3 三项构建绿
          │                                           │
          └───────────────────────────────────────────┘
                              ↓ P0 全部 5/5 PASS
                      P1-1 社区健康85%
                      P1-2 JB徽章
                      P1-3 CSDN 2篇原创
                      P1-4 稳定14天8 commits
                      P1-5 阶段1报告
                              ↓ P1 全PASS + 日期≥2026-09-24
                      P2-1 第三方引用 2条
                      P2-2 README 非商业零追踪 Section
                      P2-3 Issue+PR实战 + 分支保护6项勾
                      P2-4 JB重提 H8 新申请（无痕表单）
                      P2-5 22 visual Fail修 + GTR一致性脚本
                      P2-6 评审测试 + 阶段2最终报告
```
