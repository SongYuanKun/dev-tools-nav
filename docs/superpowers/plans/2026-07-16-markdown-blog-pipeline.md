# Markdown 博客单一来源流水线实施计划

日期：2026-07-16
对应设计：`docs/superpowers/specs/2026-07-16-markdown-blog-pipeline-design.md`

## Task 1：锁定内容模型和生成契约

- 扩展 `scripts/build-blog.test.mjs`，先覆盖 frontmatter 校验、slug 唯一性、日期、排序和安全转义。
- 将 `scripts/build-blog.mjs` 重构为可测试的纯函数与薄 CLI；错误必须使进程非零退出。
- 验证旧输入测试失败、新实现通过。

## Task 2：迁移三篇 Markdown 正文

- 从现有两个静态 HTML 和 `BLOG_POSTS_DATA` 提取三篇正文与真实元数据。
- 新建 `content/blog/ai-free-tokens-handbook.md`、`why-build-dev-tools-nav.md`、`java-source-mybatis.md`。
- 为正文关键段落、代码块和 canonical slug 增加回归断言，防止迁移丢失。

## Task 3：生成文章 HTML

- 为单 canonical、Article JSON-LD、OG、日期、正文、站内相邻文章链接先写失败测试。
- 统一文章模板，生成三个稳定的独立 URL。
- 删除手写正文副本，由构建产物接管相同路径。

## Task 4：生成 manifest、列表兼容数据和博客索引

- 先测试三种产物集合、顺序和链接完全一致。
- 生成 `data/blog-manifest.json` 与无正文的 `data/blog-posts.js`。
- 生成或更新博客索引；保留现有搜索、分类和真实 CSDN RSS 合并能力。
- 删除四条 CSDN 首页占位文章和 `BLOG_POSTS_DATA` 正文数组。

## Task 5：生成 Atom Feed 与真实 sitemap lastmod

- 为 Atom XML 转义、稳定 id、发布时间/更新时间和文章排序写测试。
- 生成根目录 `feed.xml`，并在博客页暴露 feed discovery 链接。
- 扩展 sitemap 来源映射测试，使文章 HTML 的 lastmod 来自对应 Markdown frontmatter 的 `updated`。

## Task 6：替换旧动态文章页为兼容跳转

- 先覆盖已知、未知和空 slug，以及自有域名/GitHub Pages 两种 base URL。
- 将 `pages/blog/post.html` 缩减为 `noindex,follow` 兼容页面，不加载正文数据。
- 确认 sitemap 排除旧页。

## Task 7：统一构建、漂移和部署顺序

- 扩展 workflow/package/generated-path 测试。
- 确认 CI 和两个部署都走 `npm run build`；部署先同步真实 CSDN 数据再构建。
- 确认生成物清单会捕获新增、删除和修改漂移。

## Task 8：文档、复审与发布

- 更新 `content/blog/README.md`、README、manual 和 roadmap，将流水线从 planned 改为 done 并给出证据。
- 对规格一致性和代码质量各做一次只读复审，修复重要问题。
- 执行 `npm ci`、`npm test`、`npm run audit:tools`、`npm run build`、`npm run check:generated`、`git diff --check`。
- 快进推送 `main`，等待 Test、GitHub Pages、1Panel 三条 Actions 成功，并用真实浏览器验收两个部署入口。
