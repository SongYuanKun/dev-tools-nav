# 贡献指南

感谢你对 **Koen's 工具箱（dev-tools-nav）** 的关注与贡献意愿！本项目是非商业开源项目，代码与站内原创内容以 **[MIT 协议（OSI 认可）](LICENSE)** 公开，欢迎任何人提交 Issue 与 Pull Request。参与本项目即表示你同意遵守本文档及 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) 的全部条款。

---

## 贡献前必读

| 文档 | 什么时候该读 |
|------|-------------|
| **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** | **提交前** — 社区行为准则（Contributor Covenant v2.1） |
| **[SECURITY.md](SECURITY.md)** | 发现安全漏洞时 — 请走私密邮件渠道，不要公开提交 Issue |
| **[docs/roadmap.md](docs/roadmap.md)** | 计划提交新功能前 — 确认需求优先级是否已在路线图中 |
| **[LICENSE](LICENSE)** | 贡献你的代码前 — 了解 MIT 协议与版权授予范围 |

---

## 贡献范围

| 欢迎 ✅ | 不接受 ❌ |
|---------|----------|
| 收录、更新或修正开发者工具条目 | 商业软件的破解、序列号与许可绕过类内容 |
| 改进 `/tools/*` 浏览器内自研工具（纯前端、数据不出站） | 广告、联盟推广、付费排名与赞助位 |
| 撰写或校订 `content/blog/*.md` 原创文章 | 弹窗、遮挡、自动播放与诱导点击 |
| 修正文档、无障碍（a11y）与性能问题 | 把用户输入上传到服务端的在线工具实现 |
| 新增或完善单元测试与 CI 工作流 | 违反 OSI 开源定义 / MIT 协议的许可证变更 |
| 修复 Issue 列表中有明确复现步骤的 bug | 任何形式的 DRM、许可证管理或付费墙 |

阶段优先级与待办只在[产品路线图](docs/roadmap.md)维护，本文件不保存第二份计划。

---

## 本地运行与开发

站点是**纯静态实现**（HTML + CSS + Vanilla JS，无构建步骤即可运行），装好依赖后起一个静态服务即可：

```bash
# 1. 克隆仓库
git clone https://github.com/SongYuanKun/dev-tools-nav.git
cd dev-tools-nav

# 2. 安装 npm 依赖（CodeMirror、Playwright 等）
npm ci

# 3. 启动本地静态服务器（任选其一）
python3 -m http.server 8080     # 方式 A：Python 内置
# 或
npx serve .                     # 方式 B：Node.js serve

# 4. 在浏览器打开
# http://127.0.0.1:8080
```

改动 HTML / CSS / JS 后刷新浏览器就能看到效果，除以下构建产物外**无需额外构建**：

- `js/json-workbench.bundle.js`：CodeMirror 打包产物，改动 `js/json-core.mjs` / `js/json-workbench.mjs` 后执行 `npm run build:json`
- `sitemap.xml` / `feed.xml` / `pages/blog/*.html` / `data/blog-*`：博客流水线产物，改动源文件后执行 `npm run build` 重新生成并**一并提交**，不要手工编辑生成物。

---

## 提交前自查清单（合并前必须全部通过）

```bash
# T1. 全部单元 + 集成测试（首次执行前需 npx playwright install chromium）
npm test

# T2. 工具目录审计：ID 唯一性、数量一致性、canonical URL 契约
npm run audit:tools

# T3. 生成物漂移检查：重建 sitemap/博客/bundle 并与磁盘对比
npm run check:generated
```

> 📌 新增或删除工具时，README 顶部的 `<!-- catalog-total -->` 等计数标记也要同步更新，否则 `T2` 会失败。工具与分类的字段格式见 README 的「添加新工具」「添加新分类」两节。

---

## 提交与 Pull Request 流程

### 1. Git 分支策略（Trunk-Based）

```
origin/main  ←── fork/main ──┐
                             │  rebase onto latest main
                             ▼
                  feature/<slug>  ──►  squash or rebase  ──►  PR to main
```

- 基于**最新**的 `main` 建功能分支：`git checkout main && git pull origin main && git checkout -b feature/<slug>`
- 分支命名建议：`feature/xxx`（功能）、`fix/xxx`（修复）、`docs/xxx`（文档）、`test/xxx`（测试）
- PR 目标分支：**`main`**

### 2. Commit 规范（Conventional Commits）

一个提交只做一件事。commit message 必须**说明为什么改**，而不是复述改了哪些文件。推荐格式：

```
<type>[optional scope]: <subject>

[optional body]
```

常用 type：`fix` / `feat` / `docs` / `test` / `chore` / `refactor` / `perf` / `ci`。

示例：
```
feat(tools/json): add JSON5 宽松解析入口（#123）
fix: 修复 iOS Safari 时间戳时区偏移（Closes #45）
docs(readme): 补全社区与协作入口、OSI 徽章
```

### 3. PR 合并门禁

合并前**所有**项必须为 ✅：

| 门禁项 | 由谁验证 |
|--------|---------|
| PR 模板必填项完整 | 代码审查者 |
| 自查清单 3 条命令本地通过 | 提交者（附日志截图） |
| [.github/workflows/test.yml](.github/workflows/test.yml) CI 绿灯 | GitHub Actions 自动 |
| 至少 1 位维护者批准（或 Owner 本人） | 维护者 |
| 涉及界面的改动附 Before/After 截图 | 提交者 |

---

## 许可证与版权（重要）

- **项目许可证**：[MIT](LICENSE)，OSI 官方认可的开源许可证。
- **版权所有**：Copyright (c) 2026 SongYuanKun 及本项目贡献者。
- **贡献版权授予（无 CLA 模式）**：提交 Pull Request 即视为你授予项目与下游用户在 MIT 协议条款下使用、修改、分发你所贡献代码的**非排他、永久、不可撤销**的许可；同时你保证所提交内容为原创或拥有合法再许可权利，不侵犯任何第三方知识产权。**本项目不需要签署单独 CLA 文件。**
- **署名**：贡献者将出现在对应 commit 的 `Author` 字段中；重大贡献可额外在 README「贡献者」章节列名（请在 PR 中主动要求）。

---

## 联系维护者

| 场景 | 渠道 |
|------|------|
| 一般问题、功能需求、Bug | [GitHub Issues](https://github.com/SongYuanKun/dev-tools-nav/issues) |
| 安全漏洞披露（不要公开 Issue） | 邮件 **SongYuanKun <123839070@qq.com>**，详见 [SECURITY.md](SECURITY.md) |
| 社区行为准则违反举报 | 同上邮件地址，详见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |

