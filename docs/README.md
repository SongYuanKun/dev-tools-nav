# 文档索引

| 文档 | 说明 |
|------|------|
| [../README.md](../README.md) | 仓库主说明；含 **「AI 专题规划」**、**在线工具**、**预览截图**更新步骤 |
| [../manual.md](../manual.md) | 简明使用说明（导航站 + 在线工具 + 截图 + 部署） |
| [roadmap.md](./roadmap.md) | 唯一活跃产品路线图：阶段、状态、验收标准、指标与商业化约束 |
| [deploy-1panel.md](./deploy-1panel.md) | 同步到 1Panel 静态站（tools.songyuankun.top）的步骤与 rsync 示例 |
| [umami-integration-spec.md](./umami-integration-spec.md) | Umami 埋点规范（含 `tool_used` 等在线工具事件） |
| [analytics-insights.md](./analytics-insights.md) | 带日期、窗口与查询依据的 Umami 运营快照；不是自动保持当前状态的仪表盘 |
| [../scripts/rebuild-umami-goals.sql](../scripts/rebuild-umami-goals.sql) | Umami Goals/Funnels 中文事件名重建 SQL |
| [sdlc-project-delivery-kit.md](./sdlc-project-delivery-kit.md) | 全流程交付套件：需求调研、Sprint、验收模板（对齐静态站） |
| [ai-free-tokens-handbook.md](./ai-free-tokens-handbook.md) | AI 免费 Token 手册；**线上正文**见 `pages/blog/ai-free-tokens-handbook.html` |
| [chatdev-p1p2-prompt.md](./chatdev-p1p2-prompt.md) | 历史归档：早期 P1/P2 Prompt，不得作为当前实施依据 |

## 预览截图维护

| 项 | 说明 |
|----|------|
| 脚本 | `scripts/capture-screenshots.mjs` |
| 命令 | `BASE_URL=http://127.0.0.1:9876 npm run capture-screenshots`（需先起静态服务） |
| 输出 | `assets/screenshot.png`、`screenshot-json-tool.png`、`screenshot-blog.png` |
| CI | [`.github/workflows/update-screenshots.yml`](../.github/workflows/update-screenshots.yml) 按计划运行；截图新鲜度以 Actions 最近成功记录为准 |

公开访问（GitHub Pages）与 CI 说明见仓库根目录 [README.md](../README.md)。
