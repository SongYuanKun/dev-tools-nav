# DevTools Nav · 开发工具导航站

> 精选 30+ 款开发 & 建站管理常用工具，纯静态实现，可直接部署到 GitHub Pages。

## 预览

![DevTools Nav](https://via.placeholder.com/1200x600/6366f1/ffffff?text=DevTools+Nav)

## 功能特性

- **分类筛选**：开发工具 / 建站工具 / 安全工具 / 运维监控 / 设计资源
- **实时搜索**：按名称、描述、标签即时过滤
- **暗色模式**：跟随系统偏好 + 手动切换，偏好持久化
- **工具详情页**：每个工具独立详情页，含同类推荐
- **响应式设计**：移动端、平板、桌面全适配
- **精选标记**：高频推荐工具标注精选徽章

## 工具分类

| 分类 | 数量 | 代表工具 |
|------|------|----------|
| 🛠️ 开发工具 | 11 | VS Code、GitHub、Postman、CodeSandbox |
| 🌐 建站工具 | 8 | Vercel、Netlify、Cloudflare、Porkbun |
| 🔒 安全工具 | 6 | SSL Labs、VirusTotal、Bitwarden |
| 📊 运维监控 | 7 | UptimeRobot、Grafana、Sentry |
| 🎨 设计资源 | 7 | Figma、Iconify、Coolors、Google Fonts |

## 文件结构

```
dev-tools-nav/
├── index.html          # 主页（导航 + 工具卡片列表）
├── css/
│   └── style.css       # 样式（CSS 变量、暗色模式、响应式）
├── js/
│   └── main.js         # 搜索过滤、分类切换、暗色模式切换
├── pages/
│   └── template.html   # 工具详情页（通过 ?id=xxx 参数动态渲染）
├── data/
│   └── tools.js        # 工具数据（JS 对象，方便扩展）
└── README.md
```

## 本地运行

直接用浏览器打开 `index.html`，或使用任意静态服务器：

```bash
# 使用 Python
python3 -m http.server 8080

# 使用 Node.js (npx)
npx serve .

# 使用 VS Code Live Server 插件
# 右键 index.html → Open with Live Server
```

## 部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库
2. 进入仓库 **Settings → Pages**
3. Source 选择 `main` 分支，目录选 `/ (root)`
4. 保存后等待几分钟，访问 `https://your-username.github.io/dev-tools-nav/`

## 添加新工具

编辑 `data/tools.js`，在 `TOOLS_DATA` 数组中添加新对象：

```js
{
  id: "unique-id",           // 唯一标识符（英文、数字、连字符）
  name: "工具名称",
  description: "工具描述，建议 50-100 字。",
  category: "dev",           // dev | hosting | security | ops | design
  tags: ["标签1", "标签2"],
  url: "https://example.com/",
  icon: "https://example.com/favicon.ico",  // 可选，加载失败会显示分类 emoji
  featured: false,           // true 表示精选，优先展示
}
```

## 添加新分类

编辑 `data/tools.js` 中的 `CATEGORIES` 数组：

```js
{ id: "new-category", label: "新分类名称", icon: "🆕" }
```

## 技术栈

- **纯静态**：HTML5 + CSS3 + Vanilla JS，零依赖，零构建
- **CSS 变量**：完整的设计 Token 系统，主题切换流畅
- **无障碍**：语义化 HTML，ARIA 标签，键盘可访问
- **性能**：图标懒加载，防抖搜索，CSS 动画硬件加速

## License

MIT
