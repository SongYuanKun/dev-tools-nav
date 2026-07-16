# 博客源文件目录

此目录是站内原创博客正文的唯一人工维护来源。`scripts/build-blog.mjs` 会从这里生成文章 HTML、博客索引、站内文章清单和 Atom Feed；部署工作流会在发布前重建并检查漂移。

实现状态和后续优先级统一记录在 [产品路线图](../../docs/roadmap.md)。CSDN 外部文章由 RSS 同步，不属于本目录的原创正文源。

## Frontmatter 格式

```yaml
---
title: 文章标题（必填）
date: 2026-04-04（必填）
description: SEO 描述，建议 80-150 字
category: 分类（必填）
keywords: 关键词1, 关键词2
tags: [标签1, 标签2]（必填）
kicker: 自托管首发 · 独立开发
slug: custom-url-slug（必填，且必须与文件名一致）
updated: 2026-04-06（可选，不得早于 date）
featured: true（可选）
---
```

## 注意事项

- 编辑正文后运行 `npm run build`，不要直接修改生成的文章 HTML 或列表数据。
- 生成物包括 `pages/blog/*.html`、`pages/blog/index.html`、`data/blog-manifest.json`、`data/blog-posts.js`、`feed.xml` 和 `sitemap.xml`。
- `npm run check:generated` 会拒绝缺失、过期或未提交的生成物。
- 本目录不会随网站发布；部署包只包含生成后的静态文件。
- Frontmatter 会严格校验必填字段、未知字段、重复 slug 和日期关系。
- 正文支持标题、段落、平铺有序/无序列表、引用、分隔线、代码块、行内代码、强调、删除线与链接；图片和嵌套列表暂不属于受支持子集。

## 与站内专题的衔接

涉及工具选型、免费额度、Prompt 实践的长文，可在正文或文末链到：

- **AI 专题**：`/pages/ai/index.html` 及子页（横评、工作流、Prompt 库、新手入门等）
- **在线工具**：`/pages/tools/index.html`（JSON 格式化、JWT、Cron 等）

专题与全站的阶段、状态和待办统一记在 [产品路线图](../../docs/roadmap.md)，避免在 README 或内容目录维护第二份路线。
