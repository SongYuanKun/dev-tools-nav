# 文档索引

| 文档 | 说明 |
|------|------|
| [../README.md](../README.md) | 仓库主说明；含 **「AI 专题规划」**、**在线工具**、**预览截图**更新步骤 |
| [../manual.md](../manual.md) | 简明使用说明（导航站 + 在线工具 + 截图 + 部署） |
| [deploy-1panel.md](./deploy-1panel.md) | 同步到 1Panel 静态站（tools.songyuankun.top）的步骤与 rsync 示例 |
| [umami-integration-spec.md](./umami-integration-spec.md) | Umami 埋点规范（含 `tool_used` 等在线工具事件） |
| [sdlc-project-delivery-kit.md](./sdlc-project-delivery-kit.md) | 全流程交付套件：需求调研、Sprint、验收模板（对齐静态站） |
| [ai-free-tokens-handbook.md](./ai-free-tokens-handbook.md) | AI 免费 Token 手册；**线上正文**见 `pages/blog/ai-free-tokens-handbook.html` |
| [xiaohongshu-online-tools-welcome.md](./xiaohongshu-online-tools-welcome.md) | 小红书稿：在线工具欢迎帖 + **配图路径**（`assets/screenshot*.png`） |
| [xiaohongshu-ai-free-tokens-handbook.md](./xiaohongshu-ai-free-tokens-handbook.md) | 小红书稿：AI 免费额度手册推广 |
| [chatdev-p1p2-prompt.md](./chatdev-p1p2-prompt.md) | 历史 Prompt：P1/P2 站点优化任务归档 |

## 预览截图维护

| 项 | 说明 |
|----|------|
| 脚本 | `scripts/capture-screenshots.mjs` |
| 命令 | `BASE_URL=http://127.0.0.1:9876 npm run capture-screenshots`（需先起静态服务） |
| 输出 | `assets/screenshot.png`、`screenshot-json-tool.png`、`screenshot-blog.png` |
| CI | [`.github/workflows/update-screenshots.yml`](../.github/workflows/update-screenshots.yml) 每周一自动刷新 |

公开访问（GitHub Pages）与 CI 说明见仓库根目录 [README.md](../README.md)。
