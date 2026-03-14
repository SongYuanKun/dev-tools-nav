# Koen's 工具箱 · 开发者工具导航站

> 精选 30+ 款开发 & 建站管理常用工具，纯静态实现，可直接部署到 GitHub Pages 或 1Panel。

## 预览

![Koen's 工具箱](https://via.placeholder.com/1200x600/6366f1/ffffff?text=Koen's+Toolbox)

## 功能特性

- **分类筛选**：开发工具 / 建站工具 / 安全工具 / 运维监控 / 设计资源
- **实时搜索**：按名称、描述、标签即时过滤
- **暗色模式**：跟随系统偏好 + 手动切换，偏好持久化
- **工具详情页**：每个工具独立详情页，含同类推荐
- **响应式设计**：移动端、平板、桌面全适配
- **精选标记**：高频推荐工具标注精选徽章
- **🎮 彩蛋系统**：隐藏的"激活工具"分类，5 种趣味解锁方式！

## 工具分类

| 分类 | 数量 | 代表工具 |
|------|------|----------|
| 🛠️ 开发工具 | 11 | VS Code、GitHub、Postman、CodeSandbox |
| 🌐 建站工具 | 8 | Vercel、Netlify、Cloudflare、Porkbun |
| 🔒 安全工具 | 6 | SSL Labs、VirusTotal、Bitwarden |
| 📊 运维监控 | 7 | UptimeRobot、Grafana、Sentry |
| 🎨 设计资源 | 7 | Figma、Iconify、Coolors、Google Fonts |
| 🔑 激活工具 | 2 | KMS 激活、JRebel 激活 |

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

## 部署到 1Panel

1. 将代码推送到 Git 仓库
2. 在 1Panel 中创建静态网站
3. 配置 Git 部署，填入仓库地址
4. 设置网站目录为根目录
5. 配置域名和 SSL 证书

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

## 🎮 彩蛋系统

"激活工具"分类被隐藏，需要通过有趣的解锁方式才能发现！

### 解锁方式

1. **URL 参数** ⭐ - 最简单
   ```
   http://your-site.com/?devtools2024=unlock
   ```

2. **Logo 连击** ⭐⭐ - 点击页面 Logo 7 次（3 秒内）

3. **Konami 代码** ⭐⭐⭐⭐ - 输入 ↑↑↓↓←→←→BA

4. **快捷键** ⭐⭐⭐ - 搜索框中按 Cmd/Ctrl+Shift+A

5. **页脚问号** ⭐ - 连续点击页脚的 "?" 7 次

### 更多信息

详细说明请查看：[彩蛋系统文档](./EGG_README.md)

解锁后会显示：
- 🎊 撒花动画
- 💬 提示消息
- 🌀 分类按钮动画
- 持久化存储（一次解锁，永久享受）

## License

MIT

---

## 📁 相关文档

- [彩蛋系统详细说明](./EGG_README.md) - 所有解锁方式的详细指南
- [彩蛋系统设计文档](./EGG_DESIGN.md) - 设计理念和技术实现
- [彩蛋系统测试指南](./EGG_TESTING.md) - 测试清单和验证方法
- [项目完成总结](./FINAL_SUMMARY.md) - 项目总结和成就
- [交付清单](./DELIVERABLE.md) - 完整的交付物清单
