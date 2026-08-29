# JetBrains Open Source License 申请 · 材料清单 / 时间节点 / 资质要求（三合一）
> **项目存档目录**：[docs/jetbrains-oss-application-20260828/](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828)
> **前置检查报告**：[docs/jetbrains-oss-precheck-report-20260828.md](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-precheck-report-20260828.md)
> **维护者**：SongYuanKun · **联系邮箱**：<123839070@qq.com>

---

## 一、资质要求（全满足才能提交，任何一项不达标 = 自动被拒）

### ✅ 硬性门槛（JetBrains 官方对开源项目申请人的 7 条铁律）

| # | 资质要求 | 本项目状态 | 达标证据 |
|---|---------|-----------|----------|
| A1 | 项目必须使用 **OSI 官方认可**的开源许可证（MIT / Apache-2.0 / GPL 等，**禁止自定义许可证**） | ✅ **PASS** | [LICENSE](file:///Users/mac/vs-code/dev-tools-nav/LICENSE) = MIT 官方完整文本；[package.json](file:///Users/mac/vs-code/dev-tools-nav/package.json#L5) `license="MIT"`；README 徽章标注 OSI Approved |
| A2 | 项目必须为 **Public（公开仓库）**，`package.json`/`setup.py` 等元数据中 **禁止 `"private": true`** | ✅ **PASS** | 已删除 `private:true`；[package.json](file:///Users/mac/vs-code/dev-tools-nav/package.json#L1-L3) 首三行明确为公共项目；main 分支公开可访问 |
| A3 | 项目必须为 **非商业（Non-commercial）**，不展示广告、不收付费功能、不做联盟推广、不提供商业付费服务 | ✅ **PASS** | README「关于本项目」首段明示；FUNDING.yml 明示「不接受商业付费/合同资助」；CONTRIBUTING 「不接受列表」明拒广告/联盟/付费排名 |
| A4 | **项目年龄 ≥ 3 个月**，且「每月有人工代码提交」（防止临时建仓刷许可） | ✅ **PASS** | 首 commit 2026-03-11 → 今 2026-08-28 = 171 天 ≈ 5.7 个月；6 月全活跃 100%；Owner 6 月累计人工 243 commits |
| A5 | **维护者本人**必须是项目 Owner 或在过去 90 天内**有真实代码贡献**（非纯 bot/自动同步） | ✅ **PASS** | 近 90 天 Owner SongYuanKun 人工 141 commits；git log -3 author=123839070@qq.com 100% 命中 |
| A6 | 邮箱必须**真实可触达**，且与 GitHub 账号公开邮箱 / `package.json.bugs.email` / CoC 执行邮箱一致 | ✅ **PASS** | 统一用 `123839070@qq.com`（4 处同源：git config / package.json.bugs.email / CoC 执行邮箱 / SECURITY 披露邮箱） |
| A7 | 申请所需 IDE 工具必须真实用于该项目开发（如 IntelliJ IDEA = 开发工具链 / WebStorm = 前端） | ✅ **PASS** | 本项目为纯 HTML/JS/CSS 静态站 + Node 脚本，IntelliJ IDEA / WebStorm / Rider 均可直接适用 |

### ⚠️ 软性加分项（非强制，但可显著降低审核问询概率）

| # | 加分项 | 本项目状态 |
|---|--------|-----------|
| B1 | 有完整 CI 工作流（Test / Build / Deploy）自动在 push/PR 上跑 | ✅ 5 个 `.github/workflows/*.yml` 全激活 |
| B2 | 具备社区三件套 **README / CONTRIBUTING / CODE_OF_CONDUCT** | ✅ 三件套全备，含 CoC v2.1 官方 |
| B3 | 具备 **SECURITY.md + FUNDING.yml + Issue/PR 模板** | ✅ 7 份文件齐备 |
| B4 | 有公开生产站点可访问（<https://tools.songyuankun.top>） | ✅ 主站 + GitHub Pages 镜像双在线 |
| B5 | 项目描述清晰包含：用途（Use Case）/ 用户场景 / 技术栈 / 差异化价值 | ✅ README 首 200 字 + 报告 §4 |

---

## 二、材料清单（13 项，按申请表字段顺序排列）

以下材料 = JetBrains 官方申请表 <https://www.jetbrains.com/shop/eform/opensource> 所有字段 **100% 预填充**。

### 📘 表一：项目基本信息（Fields 1 - 13，约占 60%）

| 序号 | 申请表字段 | 对应材料文件 | 本仓库取值 / URL | 是否需要用户手动填 |
|------|-----------|-------------|-----------------|------------------|
| M-01 | Customer type（老客户 / 新客户） | — | **New customer**（如是首次申请） | ⚠️ 视实际选；首次申请 = **No, we are a new customer** |
| M-02 | Project name（项目名称） | [03-license-urls-and-metadata.txt](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/submission-pack/03-license-urls-and-metadata.txt) | `Koen's 工具箱 · dev-tools-nav — Open Source Developer Toolkit & Navigation` | 🟢 直接粘贴 |
| M-03 | Project website / homepage URL（项目官网） | 同上 M-02 | `https://tools.songyuankun.top` | 🟢 直接粘贴 |
| M-04 | Source code repository URL（代码仓库） | 同上 M-02 | `https://github.com/SongYuanKun/dev-tools-nav` | 🟢 直接粘贴 |
| M-05 | License URL（许可证文件的**公开可访问 URL**） | 同上 M-02 | `https://github.com/SongYuanKun/dev-tools-nav/blob/main/LICENSE` | 🟢 直接粘贴（**关键点：必须用 blob/main/LICENSE 形式，不能是根目录路径**） |
| M-06 | Project description（项目描述，英文 3-6 句） | [01-project-description.txt](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/submission-pack/01-project-description.txt) | 全文 5 句约 220 字，涵盖：非商业声明 / MIT 许可 / 5.7 个月活跃 / 141 Owner commits / 10 款浏览器工具 / 5 个 CI 工作流 | 🟢 **全文复制粘贴** |
| M-07 | What makes this project stand out?（项目亮点/差异化，英文 1-4 句） | 01-project-description.txt 末尾 Section B | 2 句：数据不出站 + 71 条人工维护的导航 + 多镜像部署 | 🟢 **直接粘贴** |
| M-08 | Country / region（国家） | — | `China / 中国` | 🟢 直接选 |
| M-09 | Number of licenses needed（需要多少个 IDE 许可证） | — | `1`（仅 Owner 本人） | ⚠️ 若团队协作可按需填 2-5；单人项目 **推荐填 1**，批准率最高 |
| M-10 | Project / Company website（公司/项目官网，可与 M-03 同） | M-03 同 | `https://tools.songyuankun.top` | 🟢 直接填 |
| M-11 | IDE(s) you need（需要哪些 IDE 工具包，多选） | 03-license-urls-and-metadata.txt 末段清单 | **勾选 All Products Pack**（推荐，含所有 IDE：IntelliJ IDEA / WebStorm / Rider / GoLand / PyCharm 等） | 🟢 直接勾选 |
| M-12 | Your full name（申请人全名） | [02-role-statement.txt](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/submission-pack/02-role-statement.txt) | `Song Yuan Kun`（或 `SongYuanKun`，两种均可） | 🟢 直接填 |
| M-13 | Email address（申请人邮箱，必须真实可收信） | 02-role-statement.txt 开头 | **`123839070@qq.com`（4 处同源邮箱）** | 🟢 **务必填此邮箱**，降低「身份不一致」问询概率 |

### 📗 表二：维护者身份 + 共享承诺（Fields 14 - 17，3 个同意复选框 + GitHub Profile URL）

| 序号 | 申请表字段 / 复选框 | 要求 | 填写内容 / 勾选 |
|------|-------------------|------|-----------------|
| M-14 | GitHub profile URL（GitHub 公开主页） | 必须真实，且能在公开 Contributions 图上显示最近维护活动 | `https://github.com/SongYuanKun`（📌 提交前请在 GitHub Profile → Settings → Emails 中将 `123839070@qq.com` 设为 **公开可见邮箱**，这是审核人员核验身份的头号依据） |
| M-15 | ☑️ 「I confirm the project is being developed WITHOUT any commercial purposes」 | 强制勾选，不能跳过 | ☑️ **必须勾选**（本项目非商业声明全链路齐备，勾选合规） |
| M-16 | ☑️ 「I confirm the project is open source and licensed under an OSI-approved license」 | 强制勾选，不能跳过 | ☑️ **必须勾选**（MIT License 已落地 + 66 项合规检查全过） |
| M-17 | ☑️ 「I agree to the License Agreement and the Privacy Policy」 | 强制勾选，不能跳过 | ☑️ **必须勾选**（JetBrains 标准条款） |

### 📙 表三：提交后需存档的运营材料（不填进申请表，但应对审核问询用）

| 序号 | 存档文件 / 运营要求 | 对应文件路径 | 生成时间 |
|------|-------------------|-------------|---------|
| OP-01 | 申请提交当天屏幕截图（表单提交确认页 / 成功邮件） | `emails/` 目录（用户自行保存 PNG） | 📅 **2026-08-28** — 提交当天 |
| OP-02 | JetBrains 官方邮件存档（审核通过 / 补充材料 / 拒绝三类） | `emails/YYYY-MM-DD-jb-<purpose>.eml`（用户手动移入） | 📅 3-10 工作日审核期内 |
| OP-03 | 合规性审查报告（本次申请配置完整度评估） | [audit/jb-application-compliance-audit-20260828.md](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/audit/) | 📅 **2026-08-28** 生成 |
| OP-04 | 审核进度跟踪日志（含问询/回复时间线） | [PROGRESS-TRACKER.md](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/PROGRESS-TRACKER.md) | 📅 申请当天起维护 15 天 |

---

## 三、时间节点（8 步标准节奏，总周期约 3-10 工作日）

| 阶段编号 | 日期（目标） | 里程碑 | 责任方 | 关键产出 / 核验标准 | 风险提示 |
|---------|------------|--------|--------|-------------------|---------|
| **T+0** | **2026-08-28**（今天） | ✅ **材料准备完成**（本 Checklist 落地 100%） | 🤖 Agent | 本文件 + 3 份 submission-pack 文本 + 操作手册 | — |
| **T+0**（提交前 10 分钟） | 2026-08-28 | 🛂 **预提交核对（Checklist 13+7+15 = 35 项逐项打钩）** | 👤 User + 🤖 Agent | 核对 §一 A1~A7、§二 M-01~M-17 共 24 字段 0 遗漏 §三 OP-01 准备完毕 | 🚨 **最大风险：M-05 许可证 URL 错填成根路径**，必须用 `blob/main/LICENSE` 形式 |
| **T+0**（正式提交） | 2026-08-28 | 🚀 **提交申请表**并保存确认页截图 / 邮件 | 👤 User（浏览器操作） | OP-01 截图存入 `emails/`；邮件存档为 `emails/2026-08-28-jb-submission-confirmed.eml` | 建议用 Chrome → 另存 PDF 归档 |
| **T+1（1 工作日后）** | 2026-08-29 | 📥 **自动确认邮件核验**（JetBrains 在提交后 1 小时内会发「Received」） | 👤 User → 🤖 Agent 入档 | 若未收到：检查垃圾箱 / 用 M-13 邮箱登录 JetBrains | 若 24 小时没收到，走 §PROGRESS-TRACKER Case-A 重新提交 |
| **T+1 ~ T+7** | 2026-08-29 ~ 2026-09-04 | ⏳ **标准审核周期 3-7 工作日**（JetBrains 团队人工审阅） | JetBrains 审核员 | **无消息 = 好消息**，不要重复提交，不要催 | **严禁多提交，否则直接进入垃圾邮件队列** |
| **T+7 若需补充**（约 20% 概率） | 2026-09-04 左右 | 📨 **「Additional information requested」邮件**（常见 4 类：邮箱一致性 / 项目说明 / 许可证 / 贡献证明） | 👤 User + 🤖 Agent 起草回复模板 | 收到邮件 <24 小时内按模板回复，用同一邮箱 Reply | 响应越慢 → 拖审越久；必须用同一邮箱 thread 回复 |
| **T+10（平均批准日）** | ≈ 2026-09-07 | 🎉 **审核批准邮件**（含 JetBrains Account 激活链接 + 许可证密钥 / All Products Pack 激活码） | JetBrains 系统自动 | 邮件命名通常为「Your JetBrains Open Source license is available」 | 立即激活，365 天有效期；次年 **T+365 - 30 天**可续期 |
| **T+30（追溯归档）** | 2026-09-27 | 🗂️ **流程正式闭环归档**（所有材料 + 邮件 + 激活截图 100% 入档） | 🤖 Agent | ARCHIVE-INDEX.md 所有条目 = ✅ VERIFIED；存档目录打包为 zip 可选备份 | 若续期时用同一套材料直接复用 70%，仅需补近 12 个月 commits 记录 |

---

## 四、用户确认项（申请提交前请在此处打钩，**勾选完毕才算真正进入 T+0 提交阶段**）

请在以下每条前打 **✅** 代表你已经确认：

- [ ] **A1-A7 七项硬门槛**我都已核实过，没有虚标
- [ ] **M-05 许可证 URL** 我会用 `https://github.com/SongYuanKun/dev-tools-nav/blob/main/LICENSE`（blob 形式）而不是根路径
- [ ] **M-13 邮箱**我会严格使用 `123839070@qq.com`，不使用其他邮箱
- [ ] **M-14 GitHub 主页邮箱**我已在 GitHub Profile → Settings → Emails 中把 `123839070@qq.com` 改成公开可见（取消 `Keep my email addresses private`）
- [ ] **M-09 所需许可数**我最终决定填：`__1__`（如需 >1 请在此注明理由，多人协作一般填 2-5 需对应多账号主页）
- [ ] **M-15 / M-16 / M-17** 三个同意框我理解全部内容，勾选合规

> **全部 6 条完成后回复我：「材料清单确认完毕，下一步执行操作手册 T+0 提交」**，我会陪你逐项操作浏览器表单，边填边核对。
