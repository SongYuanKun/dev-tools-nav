# 博客源文件目录

此目录用于已接入 Markdown 构建脚本的文章；Pages 工作流会运行 `scripts/build-blog.mjs`，将这些源文件生成到 `pages/blog/*.html`。

全站 Markdown 单一事实源是 [产品路线图](../../docs/roadmap.md) 中的 Phase 2 目标，尚未完成。当前仍有手写的 `pages/blog/*.html` 与人工同步内容，不能把本目录描述为已经覆盖全部博客正文的唯一来源。

## Frontmatter 格式

```yaml
---
title: 文章标题（必填）
date: 2026-04-04（必填）
description: SEO 描述，建议 80-150 字
keywords: 关键词1, 关键词2
tags: [标签1, 标签2]
kicker: 自托管首发 · 独立开发
section: 独立开发
slug: custom-url-slug（可选，默认用文件名）
---
```

## 注意事项

- 此目录不会部署到网站（CI 已排除）
- 生成的 HTML 输出到 `pages/blog/`
- 手写的 `pages/blog/*.html` 不受影响
- 每篇文章必须有 `title` 和 `date`

## 与站内专题的衔接

涉及工具选型、免费额度、Prompt 实践的长文，可在正文或文末链到：

- **AI 专题**：`/pages/ai/index.html` 及子页（横评、工作流、Prompt 库、新手入门等）
- **在线工具**：`/pages/tools/index.html`（JSON 格式化、JWT、Cron 等）

专题与全站的阶段、状态和待办统一记在 [产品路线图](../../docs/roadmap.md)，避免在 README 或内容目录维护第二份路线。
