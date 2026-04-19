# 博客源文件目录

将 Markdown 文件放在这里，CI 会自动转换为 `pages/blog/*.html`。

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

## 与 AI 专题的衔接

涉及工具选型、免费额度、Prompt 实践的长文，可在正文或文末链到站内 **AI 专题**（`/pages/ai/index.html` 及子页：横评、工作流、Prompt 库、新手入门等）。专题与全站的 **路线图 / 待办** 统一记在仓库根目录 **[README.md](../../README.md)** 的 **「AI 专题规划」** 一节，避免文档分叉。
