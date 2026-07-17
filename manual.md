# dev-tools-nav 使用说明

## 1. 项目定位

`dev-tools-nav` 是一个纯静态的开发者工具导航站，核心能力包括分类筛选、搜索、收藏、最近访问、暗色模式、隐藏彩蛋分类，以及 **10 款浏览器内在线工具**（数据本地处理、不上传服务器）。

## 2. 本地运行

在仓库根目录执行：

```bash
python3 -m http.server 8080
```

然后访问：`http://127.0.0.1:8080/index.html`

在线工具入口：`http://127.0.0.1:8080/tools/`

## 3. 主要功能

### 导航站

- **分类筛选**：点击顶部分类按钮切换工具集合。
- **搜索**：在搜索框输入关键词，按名称/描述/标签实时过滤。
- **收藏**：卡片右上角点击 `☆`/`★` 加入或取消收藏。
- **最近访问**：点击工具会自动记录到「最近访问」标签页。
- **主题切换**：右上角按钮在亮色/暗色之间切换并持久化保存。

### 在线工具（`tools/` 壳层 + `pages/tools/` 实现）

| 工具 | 说明 |
|------|------|
| JSON 格式化 | 校验、树形视图、YAML 互转、双 JSON Diff、Path 查询、宽松解析 |
| 时间戳 | 秒/毫秒/微秒/纳秒、多时区、批量、时间差、代码片段 |
| Cron | Linux 五段 / Quartz 六段、执行预览、K8s/GitHub Actions 片段 |
| Base64 | 编解码、Hash、Hex、文件摘要、Data URL 预览 |
| JWT | 解码、生成、HMAC/RS 验签、安全审计 |
| SQL | 格式化/压缩/分析，MySQL/PostgreSQL 方言 |
| 正则 | 26+ 模板、Python/Go/JS/Java 代码生成 |
| UUID | v4 / v7 批量生成 |
| 文本 Diff | 行级对比、Unified Diff 导出 |
| 颜色转换 | HEX/RGB/HSL/HWB、WCAG 对比度 |

共享壳层：`js/tool-chrome.js`（导航、复制 Toast、本地处理提示）。

各工具页支持 URL 参数预填，例如 JSON：`tools/json/?q=%7B%22a%22%3A1%7D`，时间戳：`?ts=1704067200`。

Umami 自定义事件在后台以**中文**展示（如「工具使用」「导航点击」），详见 `js/umami-labels.js`。

### 技术博客维护

- 站内原创正文只编辑 `content/blog/*.md`；Frontmatter 字段和约束见 `content/blog/README.md`。
- 编辑后执行 `npm run build`，生成文章 HTML、博客索引、manifest、列表数据、Atom Feed 与 sitemap。
- 不要直接维护生成文件；提交前执行 `npm run check:generated`，确认生成物与 Markdown 源一致。
- CSDN 外部文章由 `scripts/sync-csdn-rss.py` 同步，只用于博客索引，不进入站内 Atom Feed。

## 4. 预览截图

README 与小红书稿使用的截图位于 `assets/`：

| 文件 | 对应页面 |
|------|----------|
| `screenshot.png` | 首页 |
| `screenshot-json-tool.png` | JSON 工具 |
| `screenshot-blog.png` | 博客列表 |

更新方式：

```bash
python3 -m http.server 9876   # 另开终端
BASE_URL=http://127.0.0.1:9876 npm run capture-screenshots
```

截图脚本按计划由 GitHub Actions 运行；截图是否新鲜以 Actions 的最近成功记录为准，不保证固定每周都能成功刷新。

## 5. 彩蛋解锁方式

隐藏分类「激活工具」支持以下方式解锁：

- URL 参数：`?devtools2024=unlock`
- Logo 连击（3 秒内 7 次）
- Konami 代码：`↑↑↓↓←→←→BA`
- 搜索框内 `Ctrl/Cmd + Shift + A`
- 页脚 `?` 连续点击 7 次

## 6. 部署

| 方式 | 说明 |
|------|------|
| GitHub Pages | 推送 `main` → Actions **Deploy GitHub Pages** |
| 1Panel 自动发布（推荐） | 推送 `main` → Actions **Deploy to 1Panel**；见 [docs/deploy-1panel.md](docs/deploy-1panel.md) |
| 1Panel 本机兼容入口 | `./deploy.sh` 先构建生成物，再委托原子部署脚本；自动工作流仍是权威发布流程 |

## 7. 稳定性说明

`js/main.js` 使用 `SafeStorage` 封装 `localStorage`，在隐私模式或存储受限时页面仍可正常加载。JSON 工作台专属设置只保存缩进、宽松解析和 Unicode 显示偏好，不保存编辑内容；全站另保存主题、收藏和最近使用记录，刷新页面后 JSON 编辑器仍从空白文档开始。

## 8. 产品路线

活跃的阶段、状态、验收标准和商业化约束只在 [docs/roadmap.md](docs/roadmap.md) 维护；本手册不保存容易过期的运营快照或路线表。

## 9. 验证记录

- 语法检查：`node --check js/*-tool.js js/tool-chrome.js` 通过。
- 页面冒烟：本地静态服务下 `curl -I /index.html` 返回 `200`。
- JSON 工作台：非法 JSON 可定位行列；宽松模式支持注释/尾逗号；树视图、JSONPath、YAML 与 Diff 均在浏览器本地运行。
- 博客流水线：`npm run build` 与 `npm run check:generated` 通过；文章集合和日期由 `content/blog/*.md` 统一生成。
