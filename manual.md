# dev-tools-nav 使用说明

## 1. 项目定位

`dev-tools-nav` 是一个纯静态的开发者工具导航站，核心能力包括分类筛选、搜索、收藏、最近访问、暗色模式、隐藏彩蛋分类，以及 **7 款浏览器内在线工具**（数据本地处理、不上传服务器）。

## 2. 本地运行

在仓库根目录执行：

```bash
python3 -m http.server 8080
```

然后访问：`http://127.0.0.1:8080/index.html`

在线工具入口：`http://127.0.0.1:8080/pages/tools/index.html`

## 3. 主要功能

### 导航站

- **分类筛选**：点击顶部分类按钮切换工具集合。
- **搜索**：在搜索框输入关键词，按名称/描述/标签实时过滤。
- **收藏**：卡片右上角点击 `☆`/`★` 加入或取消收藏。
- **最近访问**：点击「访问/详情」会自动记录到「最近访问」标签页。
- **主题切换**：右上角按钮在亮色/暗色之间切换并持久化保存。

### 在线工具（`pages/tools/`）

| 工具 | 说明 |
|------|------|
| JSON 格式化 | 实时校验、行号错误定位、树形视图、宽松解析（`//` 注释、尾逗号、单引号）、修复/压缩、Unicode 转义、文件上传下载、`Ctrl+Enter` 格式化 |
| 时间戳 | 秒/毫秒互转、多时区显示 |
| Cron | 表达式解析、下次执行时间、部署片段 |
| Base64 | 编解码 + SHA-1/256/512 |
| JWT | Header/Payload 解码 + HMAC 验签 |
| SQL | 关键字大写、缩进、压缩 + 语句分析 |
| 正则 | 匹配测试 + JS/Java 代码生成 |

JSON 工具高级面板（页面底部）：结构统计、JSON Path 查询、按 Key 排序。

各工具页支持 URL 参数预填，例如 JSON：`tools/json/?q=%7B%22a%22%3A1%7D`。

Umami 自定义事件在后台以**中文**展示（如「工具使用」「导航点击」），详见 `js/umami-labels.js`。

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
| 1Panel 本机 | 仓库根目录 `./deploy.sh` → 见 [docs/deploy-1panel.md](docs/deploy-1panel.md) |

## 7. 稳定性说明

`js/main.js` 使用 `SafeStorage` 封装 `localStorage`，在隐私模式或存储受限时页面仍可正常加载。在线工具内容自动保存在浏览器本地（JSON 工具键名 `dev-tools-json-content`）。

## 8. 验证记录

- 语法检查：`node --check js/main.js && node --check js/json-tool.js` 通过。
- 页面冒烟：本地静态服务下 `curl -I /index.html` 返回 `200`。
- JSON 工具：非法 JSON 可定位行号；宽松模式下注释/尾逗号可解析。
