# JetBrains OSS License 申请操作手册（P0 → P7 分阶段执行指南）
> **配套文件**：[SUBMISSION-CHECKLIST.md](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/SUBMISSION-CHECKLIST.md)（所有字段值在这里）
> **存档目录**：[docs/jetbrains-oss-application-20260828/](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828)

本手册 = 用户实际操作申请表的**「一步步陪填指南」**，每阶段提供：
- 当前进度百分比（0% → 100%）
- 本阶段待办清单（必须全勾才能进入下阶段）
- 操作说明（含浏览器点击顺序、复制什么、粘贴到哪里）
- 出错时的回退方案

---

## 📚 阶段目录速览
| 阶段 | 名称 | 完成时进度 | 耗时估算 | 是否需要用户参与 |
|------|------|-----------|---------|----------------|
| P0 | 浏览器准备 + GitHub 邮箱公开核验 | 10% | 5 分钟 | ✅ 用户手动 |
| P1 | 打开 JetBrains 申请表 → 选择 New/Existing Customer | 20% | 3 分钟 | ✅ 用户手动 |
| P2 | 填写项目基本信息 Fields M-02 ~ M-10（名称 / 主页 / 仓库 / 许可证 URL / 描述 / 国家 / 数量） | 45% | 10 分钟 | ✅ 用户 + 🤖 陪填 |
| P3 | 填写维护者信息 Fields M-11 ~ M-14（IDE 勾选 / 姓名 / 邮箱 / GitHub 主页） | 65% | 5 分钟 | ✅ 用户 + 🤖 陪填 |
| P4 | 勾选 3 个同意复选框（M-15 / M-16 / M-17） + 预览 + 最终一致性检查 | 85% | 5 分钟 | ✅ 用户 + 🤖 复核 |
| P5 | 正式提交 → 截图 + 邮件归档 OP-01 / OP-02-01 | 92% | 3 分钟 | ✅ 用户手动 |
| P6 | 提交后 1 - 7 工作日审核跟进（邮件入档 / 应对补充材料 / 进度记录） | 95% ~ 99% | 每天 2 分钟 × 7 天 | ✅ 用户 + 🤖 提供模板 |
| P7 | 收到批准邮件 → 激活 → 归档 → 流程闭环 | **100% ✅** | 10 分钟 | ✅ 用户 + 🤖 归档 |

---

## P0 · 准备阶段（进度 0% → 10%）

**目标**：确保浏览器环境、GitHub 邮箱公开、所有 submission-pack 文本已保存为本地 .txt 文件可快速复制。

📝 本阶段待办清单：
- [ ] 在 macOS 上打开 **Chrome / Safari / Edge（推荐 Chrome）**，新建隐私/无痕窗口以防账号已登录导致不一致
- [ ] **登录**以下 3 个账号到同一邮箱的环境：
  - [ ] GitHub（<https://github.com/SongYuanKun>）
  - [ ] 邮箱：<https://mail.qq.com>（123839070@qq.com），确认可收邮件
  - [ ] （可选）JetBrains Account <https://account.jetbrains.com/>，用同一邮箱注册或登录可减少激活步骤
- [ ] **公开 GitHub 邮箱（最高优先级，必须完成）**：
  1. 访问 <https://github.com/settings/emails>
  2. **取消勾选**「Keep my email addresses private」（否则审核员无法把 123839070@qq.com 与你的 GitHub 身份关联）
  3. 在「Primary email address」下拉框中选 `123839070@qq.com` 作为主邮箱
  4. 打开你的公开主页 <https://github.com/SongYuanKun> 并点击「Contact」左侧，确认能看到 email 显示 `123839070@qq.com`，✅ 截图保存到 `emails/` 目录
- [ ] 把 `submission-pack/01-project-description.txt` / `02-role-statement.txt` / `03-license-urls-and-metadata.txt` 的内容提前用 TextEdit / VS Code 打开，准备随时复制粘贴

✅ P0 完成 → 回复 Agent：「P0 完成，请继续 P1」（**进入 P1 前必须所有 6 项打钩**）

---

## P1 · 打开申请表（进度 10% → 20%）

**目标**：进入 JetBrains 申请表正确 URL，选择客户类型。

### 操作步骤
1. 浏览器打开官方申请表：**<https://www.jetbrains.com/shop/eform/opensource>**
2. 若语言不是英文，**切换页面语言为 English**（建议英文版填写最准确，避免翻译错配字段）
3. **Customer type 字段（M-01）**：
   - 如果你和你的团队**从未通过 JetBrains Open Source Support 获得过许可证** → 选：**☑️ No, we are a new customer**（大多数情况）
   - 如果你之前**已经有一次 Open Source license 且仍在有效期** → 选：**☑️ Yes, we have got an open source license from JetBrains before**，然后填入之前的 License ID / License Server URL
4. 点击 `Continue to next step`（或 `Next`）

### 出错回退
- 若打开 404 / 被地区屏蔽：尝试用无痕模式，或直接访问 `https://www.jetbrains.com/community/opensource/#support` 然后点击绿色「Apply Now」按钮
- 若误选 customer type：右上角「Back」返回重选，不要强行继续

✅ P1 完成 → 回复 Agent：「P1 完成，请提供 P2 陪填字段值」

---

## P2 · 填写项目基本信息（进度 20% → 45%）

**目标**：把 **Fields M-02 ~ M-10（9 个字段）**全部准确填入，对应 §二 表一。

### 陪填表格（按页面字段从上到下顺序，复制 submission-pack/03 & 01 对应行内容）

| # | 页面字段名 | 粘贴内容来源 | 填入内容（可直接 Copy） | 审核提示 |
|---|-----------|-------------|----------------------|---------|
| M-02 | Project name（项目名称） | submission-pack / 03 · 第一行 | `Koen's 工具箱 · dev-tools-nav — Open Source Developer Toolkit & Navigation` | 不要只填 dev-tools-nav，让审核员一眼看懂是啥 |
| M-03 | Project website / homepage URL | submission-pack / 03 · 第二行 | `https://tools.songyuankun.top` | 必须填 HTTPS，**不要**填 GitHub 仓库 URL（那是 M-04） |
| M-04 | Source code repository URL | submission-pack / 03 · 第三行 | `https://github.com/SongYuanKun/dev-tools-nav` | 必须可公开访问；若私有直接拒 |
| M-05 | **License URL（最重要字段之一）** | submission-pack / 03 · 第四行 | `https://github.com/SongYuanKun/dev-tools-nav/blob/main/LICENSE` | 🚨 **绝对不能填 GitHub 根路径**（blob/main/LICENSE 的「内容页」是唯一正确格式），错填会被系统自动判许可证无效 |
| M-06 | Project description | submission-pack / 01 · SECTION A 全文 | 复制 5 句英文段 → 直接粘贴 | 长度控制 200-400 单词之间；全英文，不要中英混合 |
| M-07 | What makes this project stand out?（亮点） | submission-pack / 01 · SECTION B 全文 | 复制 2 句英文段 → 直接粘贴 | 这里不要重复 M-06，说差异化价值 |
| M-08 | Country / region | 下拉选择 | `China`（找字母 C 开头） | |
| M-09 | Number of licenses needed（需要许可证数量） | 用户已在 Checklist §四确认 | `1`（单人 Owner = 1；多人项目按核心贡献者填） | 🚨 填越多 → 审核越严格 → 批准率越低；1 人项目强烈推荐填 **1** |
| M-10 | Project / Company website | 可重复 M-03，或填 GitHub 主页 | `https://tools.songyuankun.top`（= M-03，不用改） | |

### 本阶段一致性检查
按 Submit 前请先在本阶段末端 4 项自查：
- [ ] 粘贴 M-05 后，点一下超链接确实能打开 MIT License 全文页面（不是 404 / 仓库首页）
- [ ] M-03 与 M-10 是同一个 URL（tools.songyuankun.top），不冲突
- [ ] M-02 项目名 与 GitHub 仓库名 `SongYuanKun/dev-tools-nav` 对得上
- [ ] 所有 URL 均为 HTTPS

✅ P2 完成 → 截图保存「项目基本信息填写完的表单页」到 `emails/2026-08-28-p2-project-info-filled.png` → 回复 Agent：「P2 完成，继续 P3」

---

## P3 · 填写维护者身份信息（进度 45% → 65%）

### 陪填表格（对应 Fields M-11 ~ M-14）

| # | 页面字段名 | 粘贴内容来源 | 填入内容 / 操作 | 提示 |
|---|-----------|-------------|----------------|------|
| M-11 | IDE(s) you need（IDE 工具包多选） | submission-pack / 03 · IDE 清单 | **强烈建议勾选「☑️ All Products Pack」**，最省心 — 含 IntelliJ IDEA Ultimate / WebStorm / Rider / GoLand / PyCharm / DataGrip / CLion / RubyMine 等 12+ 款 | 单勾选 IntelliJ IDEA = 只批一种 IDE，后续要新工具需重新申请；All Products Pack 批准率 = 同等，用起来最自由 |
| M-12 | Your full name | submission-pack / 02 · 第一段 | `SongYuanKun`（或 `Song Yuan Kun`，中英文均可，只要和 GitHub 姓名一致） | |
| M-13 | Email address（申请联系邮箱） | submission-pack / 02 · 第二段 | **`123839070@qq.com`（4 处同源邮箱）** | 🚨 **唯一正确邮箱**，填错 = 后续所有邮件收不到 |
| M-14 | GitHub profile URL（你的 GitHub 公开主页） | submission-pack / 02 · 第三段 | `https://github.com/SongYuanKun` | 提交前再点开一次，确认公开页面上能看到 Email 字段显示 123839070@qq.com |

✅ P3 完成 → 回复 Agent：「P3 完成，继续 P4 勾选同意框」

---

## P4 · 预览 + 最终合规检查（进度 65% → 85%）

**目标**：在点 Submit 前，把所有数据再跑一遍一致性，避免 1 分钟错误导致 10 工作日延后。

### 🔴 最后 7 条「一票否决」式检查（必须全 ✅ 才能进入 P5）

- [ ] **C1 许可证一致性**：LICENSE 文件正文（MIT 官方文本） + package.json.license = MIT + M-05 点进去实际显示 MIT 全文 **三处 100% 一致**
- [ ] **C2 非商业声明**：README → `FUNDING.yml` → `CONTRIBUTING.md 不接受列表` 三处均明示「不接受广告/联盟/付费」，与 M-15 勾选一致
- [ ] **C3 邮箱 6 处同源**：git config user.email / package.json.bugs.email / SECURITY.md 披露邮箱 / CoC 执行邮箱 / M-13 申请表邮箱 / GitHub 公开主页邮箱 **全部 = 123839070@qq.com**
- [ ] **C4 活跃周期**：最近 commit ≤ 24h（2026-08-28 3 原子 commits push 完成）；6/6 月 100% 活跃 ✔
- [ ] **C5 三件套存在**：README.md / CONTRIBUTING.md / CODE_OF_CONDUCT.md 三个文件均在根目录且能打开
- [ ] **C6 模板存在**：ISSUE_TEMPLATE 2 个 + PR_TEMPLATE 1 个 + SECURITY + FUNDING 5 个配置文件均在 .github 目录下
- [ ] **C7 M-05 URL 格式**（最后重查一次）：以 `https://github.com/SongYuanKun/dev-tools-nav/blob/main/LICENSE` 结尾，**不是** `/tree/main`、**不是** `LICENSE.md`、**不是** `/`

> **C1~C7 有任何 ❌ → 先不要点 Submit，马上回复 Agent，我会在 1 分钟内给出修正方案**。全部 ✅ 之后 → 进入 P5。

✅ P4 完成 → 回复 Agent：「C1~C7 全部 ✅，进入 P5 提交」

---

## P5 · 正式提交 + 首屏归档（进度 85% → 92%）

### 操作步骤
1. 点击页面底部 `Submit application`（或 Submit / Send）按钮
2. 页面会跳转到「Thank you / Your application has been received」确认页
3. **立即截图保存**到 `emails/2026-08-28-p5-submission-success.png`（重要：含 Application ID 一行，后续问询要用）
4. 在 1 小时内，你会收到来自 `opensource@jetbrains.com` 或 `no-reply@jetbrains.com` 的确认邮件，标题通常为：
   - 「Thank you for applying to the JetBrains Open Source Support Program」
   - 「We've received your JetBrains OSS License application」
5. 收到后立即把该邮件**导出为 .eml**（或另存 PDF），并移动到 `emails/2026-08-28-jb-submission-confirmed.eml`（.pdf 亦可）
6. 打开 [PROGRESS-TRACKER.md](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/PROGRESS-TRACKER.md)，把 Application ID + 提交日期 + 邮件 Message-ID 填进去

### ❓ 常见异常处理
| 异常 | 操作 |
|------|------|
| Submit 后 404 / 错误页面 | 刷新一次，浏览器 Back 回到表单再点 Submit（大概率成功；不要重新填新的表单） |
| 3 小时内仍未收到确认邮件 | ① 检查垃圾箱 ② 检查 QQ 邮箱「其他邮箱」/「订阅邮件」栏 ③ 登录 <https://account.jetbrains.com> → Permissions / Orders 看是否有记录；仍无则 24 小时后重提交 |
| 立即收到拒绝邮件（「Unfortunately your application has been declined」） | **按原样转发到 123839070@qq.com + 同步 Agent**，我会在 15 分钟内给出针对拒绝原因的修订方案（通常 = 邮箱不一致 / M-05 错），修改后 24 小时后重新提交 |

✅ P5 完成 → 回复 Agent：「P5 提交成功，已收到确认邮件」（附 Application ID 末 4 位）

---

## P6 · 审核跟进（3-7 工作日，每天 2 分钟维护日志）

详见 **[PROGRESS-TRACKER.md](file:///Users/mac/vs-code/dev-tools-nav/docs/jetbrains-oss-application-20260828/PROGRESS-TRACKER.md)**，包含：
- 每天标准巡检步骤（3 步 ≈ 2 分钟）
- 常见 4 类审核问询的标准回复邮件模板（直接复制 → 改 Application ID → 回复）
- 补充材料的应对：如何在 <24h 内准备完整的项目活跃度证明 / 许可证一致性截图 / CoC 执行承诺
- 7 工作日无消息的「礼貌询问」邮件模板（不要超过 1 次）

✅ P6 完成标志 = 收到「Approved」或「Additional information → replied → then Approved」邮件

---

## P7 · 批准 + 激活 + 归档闭环（100% 完成 ✅）

### 操作步骤
1. **批准邮件特征**（确认这不是钓鱼邮件）：
   - 发送方域名 = `@jetbrains.com`（不是 jětbrains / jetbrains-support 等变体）
   - 正文含 Application ID，与 PROGRESS-TRACKER 中一致
   - 标题包含「Open Source license is available」/「License granted」/「Welcome to JetBrains」
2. 点击邮件中的激活链接，跳转到 JetBrains Account 登录页
3. 用邮箱 **123839070@qq.com** 登录 JetBrains Account（若没有 → 立即注册并用同一邮箱）
4. 激活完成后会看到 All Products Pack 有效期从激活日起 **365 天**
5. **截图保存 3 张**到 `emails/2026-MM-DD-jb-approved-final/` 目录：
   - [ ] 批准邮件完整截图（含 Application ID）
   - [ ] JetBrains Account 中 Licenses 页面（能看到 Open Source 字样 + 过期日期）
   - [ ] IDE 内首次激活成功页（可选，IntelliJ 或 WebStorm）
6. 回复 Agent 上传以上 3 张，**我会把所有材料整理进 ARCHIVE-INDEX.md，整个流程闭环 100% VERIFIED**
7. **（重要提醒）**：335 天后（约 2027-07-28）会启动**续期申请流程**，届时 Agent 会复用本项目 70% 材料 + 补新增的 12 个月 commits 活跃度证明

---

### ✅ P7 完成 = 申请流程 100% 闭环
> **感谢你的信任！整个存档目录可随时打包为 `jetbrains-oss-application-20260828.zip` 作为备份，用于次年续期申请或应对后续审核查询。** 🎉
