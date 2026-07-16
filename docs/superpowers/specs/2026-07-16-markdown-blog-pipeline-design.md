# Markdown 博客单一来源流水线设计

日期：2026-07-16  
状态：approved

## 目标

将三篇站内长文迁移到 `content/blog/*.md`，让 Markdown 成为正文和文章元数据的唯一人工来源。一次构建必须确定性生成文章页、博客列表数据、博客清单、Atom Feed 与 sitemap；两个部署目标和 CI 使用同一条构建命令。

本次迁移保留已有独立文章 URL：

- `/pages/blog/ai-free-tokens-handbook.html`
- `/pages/blog/why-build-dev-tools-nav.html`
- `/pages/blog/java-source-mybatis.html`

旧的 `/pages/blog/post.html?slug=...` 仅作兼容入口，不再承载或索引正文。

## 内容模型

每篇 Markdown 使用受约束的 frontmatter：

- `title`、`date`、`description`、`category`、`tags`、`slug` 为必填。
- `date` 使用 `YYYY-MM-DD`，表示首次发布日期。
- `updated` 可选，格式同上；缺省时与 `date` 相同。
- `keywords`、`kicker`、`featured` 可选。
- slug 必须只含小写字母、数字和连字符，并在全部文章中唯一。
- 正文不得在生成的 HTML、JavaScript 或 JSON 中再次人工维护。

构建遇到字段缺失、非法日期、重复 slug、未知 frontmatter 字段或输出路径冲突时必须失败，不得跳过后继续发布。

## 生成物

`scripts/build-blog.mjs` 负责生成：

1. `pages/blog/<slug>.html`：直出完整正文、canonical、Open Graph、Article JSON-LD、发布日期和修改日期。
2. `pages/blog/index.html`：保留搜索与分类交互，站内文章链接全部指向独立 HTML。
3. `data/blog-manifest.json`：供构建、审计和后续功能消费的稳定 JSON 清单，不包含正文。
4. `data/blog-posts.js`：由 manifest 派生的现有列表页兼容数据，不包含正文和伪外链。
5. `feed.xml`：Atom 1.0，包含站内文章的稳定 id、canonical 链接、摘要、发布时间和更新时间。

所有生成物按发布日期降序排列；相同输入产生逐字节相同的输出。生成页不得含重复 canonical。

## CSDN 数据边界

`data/csdn-articles.json` 是 RSS 同步得到的真实外部文章索引。删除 `data/blog-posts.js` 中四条只指向 CSDN 首页的伪文章；列表页继续在运行时读取真实 RSS 数据，并按 URL 去重。外部内容不进入站内 Atom Feed，也不冒充站内正文。

部署工作流必须先刷新 CSDN 数据，再执行统一构建，保证发布时列表页消费的是最新真实数据；RSS 失败时沿用仓库内最后一次有效数据。

## 旧路由兼容

`pages/blog/post.html` 设置 `noindex,follow`，不进入 sitemap。页面只维护最小 slug 到独立文章 URL 的映射：

- 已知 slug 使用 `location.replace` 跳转，并保留站点部署前缀，兼容自有域名和 GitHub Pages。
- 无 slug 或未知 slug 返回博客索引。
- 旧页不加载 `data/blog-posts.js`，不保留第二份正文或动态渲染逻辑。

## sitemap 与真实日期

生成文章 URL 的 `lastmod` 必须追溯对应的 `content/blog/<file>.md`，而非生成 HTML 的提交时间。其他页面继续使用各自内容源。Atom 的 `published`/`updated` 使用 frontmatter 的真实日期；未来文章日期视为构建错误。

## 构建、部署与门禁

- `npm run build` 仍是唯一完整构建入口。
- `npm run check:generated` 重建并拒绝文章页、索引、manifest、兼容 JS、Feed 或 sitemap 漂移。
- CI checkout 保留完整 Git 历史，以便计算 sitemap lastmod。
- GitHub Pages 和 1Panel 工作流均运行 `npm ci` 与 `npm run build`，并排除 Markdown 源文件，不排除生成物。
- 构建器应暴露纯函数，核心内容模型、排序、转义、Feed、旧路由、sitemap 来源映射均有 Node 测试；关键页面链接和兼容跳转有真实浏览器回归。

## 验收标准

- 三篇 Markdown 可独立重建全部站内博客正文，删除任一源文件会删除对应生成文章并更新所有索引。
- 仓库不再存在手写的站内正文副本或 CSDN 首页占位文章。
- 三个 canonical URL 可直接访问；旧 slug URL 正确跳转且不被索引。
- manifest、列表、Atom 与 sitemap 的文章集合和日期一致。
- 全量测试、工具审计、完整构建与生成物漂移检查通过；双部署 Actions 和两个线上入口验收通过。

## 非目标

- 不抓取或复制 CSDN 正文。
- 不引入 CMS、数据库、服务端渲染或客户端 Markdown 渲染。
- 不在本任务中改写文章观点，只做来源迁移、必要的事实/链接修正和生成模板统一。
