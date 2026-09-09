# JetBrains OSS License 申请存档（公共模板部分）

> 🎯 本目录只放**可以提交到 GitHub 公开仓库**的「申请流程模板 / 合规 Checklist / 操作指南**。
>
> 🔒 **所有个人沟通内容**（往来邮件截图、真实 Application ID、工单编号、提交素材、身份验证截图、合规脚本）**禁止进入 Git 版本库**。

---

## 📁 子目录访问控制（.gitignore 自动生效）

本仓库根 `.gitignore` 已添加如下条目（新增申请目录时无需再改 gitignore）：

```
docs/*jetbrains*/PROGRESS-TRACKER.md
docs/*jetbrains*/emails/
docs/*jetbrains*/submission-pack/
docs/*jetbrains*/audit/
```

**→ 只保留到 GitHub 远端 = 本 README + 下方 3 个 md**

---

## ✅ 公开保留的公共文件清单

| 文件名 | 用途 | 是否开源安全？ |
|---|---|---|
| **`SUBMISSION-CHECKLIST.md` | JB-OSS 7 铁律合规 Checklist（提交前 17 项逐项核验）| ✅ 无任何个人信息 |
| **`APPLICATION-OPERATIONS-GUIDE.md` | 申请标准 5 阶段 P0~P7 操作流程模板 | ✅ 纯 SOP 通用 |
| **`ARCHIVE-INDEX.md` | 索引模板（仅列文件名结构，不含真实内容）| ✅ 无真实 ID / 工单 |
| **`README.md`（本文件）**| 公开/私有边界说明 | ✅ 纯说明文档 |

---

## 🕵️‍♀️ 本地个人素材仅本机保留（*.gitignore 遮罩）*

| 本地子项 | 说明 | **是否会被 Git 跟踪？** |
|---|---|---|
| `PROGRESS-TRACKER.md` | 真实时间线、Application ID、工单编号 | ❌ NO（.gitignore 已覆盖）|
| `emails/` 目录 | 邮件截图、Message-ID、截图 | ❌ NO |
| `submission-pack/` 目录 | 项目描述、Owner身份声明、License URL 素材 | ❌ NO |
| `audit/` 目录 | 合规脚本、含邮箱白名单正则 | ❌ NO |

> ⚠️ 续期时创建新的 `jetbrains-oss-application-YYYYMM/` 目录也会自动继承 `.gitignore` 规则，**不用再手动修改**。

---

## 🚦 新申请/续期标准操作

1. 用本目录三个公共模板作为起点；
2. 在本机新建 `PROGRESS-TRACKER.md` 和 `emails/submission-pack/audit/` 目录放素材；
3. 提交前执行 `git status`，看到这 4 项应显示 `Untracked files` 或**不在 staged 中**；
4. 确认 staged 中只有公共模板文件后，再执行 commit。

---

## 🆘 紧急：不小心把个人素材 add 了怎么办？

（按严重性升序）

1. **已 staged 未 commit → 执行 `git rm -r --cached docs/<误提交路径>`**，把文件从索引移除但保留磁盘；
2. **已 commit 未 push → `git reset HEAD~1 --soft`，重新正确 add；
3. **已 push 到公开仓库 → 必须用 `git filter-repo` 做**全历史重写**，并配合 GitHub 强制更新分支保护规则。

---

*本文件内容不含任何真实个人信息或申请跟踪号。*
