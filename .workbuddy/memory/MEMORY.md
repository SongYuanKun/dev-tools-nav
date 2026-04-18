# DevTools Nav 项目记忆

## 项目概况
- **名称**: Koen的工具箱 / dev-tools-nav
- **定位**: 开发者工具导航站，收录 60+ 工具，纯静态（HTML+CSS+JS），零构建
- **线上地址**: https://tools.songyuankun.top / https://songyuankun.github.io/dev-tools-nav/
- **部署**: GitHub Pages (Actions 自动部署) + 1Panel (deploy.sh 手动同步)
- **作者**: Koen (SongYuanKun)，CSDN: syk123839070，邮箱: syk123839070@163.com

## 设计规范
- **主色**: #6366f1 (Indigo)，渐变用 #6366f1 → #8b5cf6 → #ec4899
- **图标服务**: icon.horse（中国友好，CORS 支持）
- **暗色模式**: CSS 变量 + localStorage 持久化
- **响应式**: 480/640/768/900/1024/1280px 断点
- **卡片圆角**: --radius-lg (16px)，按钮圆角: --radius-full

## AI 专题模块（2026-04-18 新增，同日扩充）
- **数据文件**: `data/ai-compare.js`（6组横评 + 6个工作流 + Prompt模板库 + 新手入门 + 价格速查 + 30+工具映射）
- **专用CSS**: `css/ai-topic.css`
- **页面**:
  - `pages/ai/index.html` - 专题首页（4个专题入口 + 场景速查表8项 + 价格一览12款 + 选工具建议）
  - `pages/ai/compare.html` - 横评对比页（6组：LLM/AI编程/AI绘图/AI搜索/AI视频/AI翻译）
  - `pages/ai/workflow.html` - 场景工作流页（6个：独立开发/内容创作/日常效率/设计师/数据分析/学术研究）
  - `pages/ai/prompts.html` - Prompt模板库（6大类20+模板 + Prompt写作公式 + 一键复制）
  - `pages/ai/beginner.html` - AI新手入门（4概念 + 4步上手 + 5误区 + 6条学习路径）
- **横评数据**: LLM对话(5款)、AI编程(4款)、AI绘图(5款)、AI搜索(5款)、AI视频(5款)、AI翻译(5款)
- **工作流**: 独立开发者(6步)、内容创作者(4步)、日常效率(3步)、设计师(4步)、数据分析(3步)、学术研究(3步)
- **入口**: 导航栏"🤖 AI 专题" + 首页 AI 横幅（选中AI分类时显示）

## 之前完成的事项
- 工具图标全部切换到 icon.horse 服务
- 移除图标懒加载，改为 IntersectionObserver 按需加载
- 个人描述优化：源码级探索者、7年后端、独立开发实践者
- 邮箱从 QQ 换成 163
- CSDN 文章 RSS 自动同步（scripts/sync-csdn-rss.py）
