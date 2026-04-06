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
