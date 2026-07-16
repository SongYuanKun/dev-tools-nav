#!/usr/bin/env node
/**
 * build-blog.mjs
 * 将 content/blog/*.md 转换为 pages/blog/*.html
 * 零外部依赖，纯 Node.js ESM
 *
 * Frontmatter 字段：
 *   title       文章标题（必填）
 *   date        发布日期 YYYY-MM-DD（必填）
 *   description SEO 描述（必填）
 *   category    文章分类（必填）
 *   tags        非空标签数组 [tag1, tag2]（必填）
 *   slug        仅含小写字母、数字和连字符（必填）
 *   updated     修改日期 YYYY-MM-DD（可选）
 *   keywords、kicker、featured（可选）
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const CONTENT_DIR = join(ROOT, 'content', 'blog')
const BASE_URL = 'https://tools.songyuankun.top'

// ── HTML 转义 ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Frontmatter 解析 ───────────────────────────────────────────────────────────
const REQUIRED_FRONTMATTER_FIELDS = [
  'title',
  'date',
  'description',
  'category',
  'tags',
  'slug',
]
const OPTIONAL_FRONTMATTER_FIELDS = [
  'updated',
  'keywords',
  'kicker',
  'featured',
]
const ALLOWED_FRONTMATTER_FIELDS = new Set([
  ...REQUIRED_FRONTMATTER_FIELDS,
  ...OPTIONAL_FRONTMATTER_FIELDS,
])

function sourceError(sourceFile, message) {
  return new Error(`${sourceFile}: ${message}`)
}

function parseScalar(value, sourceFile, field) {
  if (!value) return ''
  const quote = value[0]
  if (quote === '"' || quote === "'") {
    if (value.at(-1) !== quote) {
      throw sourceError(sourceFile, `unterminated quoted value for "${field}"`)
    }
    return value.slice(1, -1)
  }
  return value
}

function parseFrontmatter(raw, sourceFile) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) throw sourceError(sourceFile, 'frontmatter is required')

  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const sep = line.indexOf(':')
    if (sep < 1) throw sourceError(sourceFile, `invalid frontmatter line "${line}"`)
    const key = line.slice(0, sep).trim()
    const val = line.slice(sep + 1).trim()
    if (!ALLOWED_FRONTMATTER_FIELDS.has(key)) {
      throw sourceError(sourceFile, `unknown frontmatter field "${key}"`)
    }
    if (Object.hasOwn(meta, key)) {
      throw sourceError(sourceFile, `duplicate frontmatter field "${key}"`)
    }
    if (key === 'tags') {
      const inner = val.match(/^\[(.*)\]$/)
      meta.tags = inner
        ? inner[1].split(',').map(tag => parseScalar(tag.trim(), sourceFile, key))
        : null
    } else {
      meta[key] = parseScalar(val, sourceFile, key)
    }
  }
  return { meta, body: m[2] }
}

export function parseBlogSource(sourceFile, raw, { today } = {}) {
  const { meta, body } = parseFrontmatter(raw, sourceFile)
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    const value = meta[field]
    if (
      value === undefined ||
      (typeof value === 'string' && !value.trim()) ||
      (Array.isArray(value) && !value.length)
    ) {
      throw sourceError(sourceFile, `missing required field "${field}"`)
    }
  }

  if (!Array.isArray(meta.tags) || meta.tags.some(tag => !tag.trim())) {
    throw sourceError(sourceFile, 'tags must be a non-empty array of non-empty strings')
  }

  const buildDate = today || new Date().toISOString().slice(0, 10)
  for (const field of ['date', 'updated']) {
    const value = meta[field]
    if (value === undefined) continue
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    const parsed = match && new Date(`${value}T00:00:00Z`)
    if (
      !match ||
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== Number(match[1]) ||
      parsed.getUTCMonth() + 1 !== Number(match[2]) ||
      parsed.getUTCDate() !== Number(match[3])
    ) {
      throw sourceError(sourceFile, `invalid ${field} "${value}"`)
    }
    if (value > buildDate) {
      throw sourceError(sourceFile, `${field} cannot be in the future`)
    }
  }

  if (meta.updated && meta.updated < meta.date) {
    throw sourceError(sourceFile, 'updated cannot be earlier than date')
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.slug)) {
    throw sourceError(sourceFile, `invalid slug "${meta.slug}"`)
  }
  if (meta.featured !== undefined && !['true', 'false'].includes(meta.featured)) {
    throw sourceError(sourceFile, 'featured must be true or false')
  }

  return {
    sourceFile,
    title: meta.title,
    date: meta.date,
    updated: meta.updated || meta.date,
    description: meta.description,
    category: meta.category,
    tags: meta.tags,
    slug: meta.slug,
    keywords: meta.keywords || '',
    kicker: meta.kicker || '',
    featured: meta.featured === 'true',
    body: body.trim(),
  }
}

export function buildBlogContentModel(sources, options = {}) {
  const posts = sources.map(({ sourceFile, raw }) =>
    parseBlogSource(sourceFile, raw, options))
  const slugs = new Map()

  for (const post of posts) {
    if (post.slug === 'index' || post.slug === 'post') {
      throw sourceError(
        post.sourceFile,
        `slug "${post.slug}" conflicts with a fixed blog output`,
      )
    }
    const previousSource = slugs.get(post.slug)
    if (previousSource) {
      throw new Error(
        `duplicate slug "${post.slug}" in ${previousSource} and ${post.sourceFile}`,
      )
    }
    slugs.set(post.slug, post.sourceFile)
  }

  return posts.sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? 1 : -1
    if (left.slug === right.slug) return 0
    return left.slug < right.slug ? -1 : 1
  })
}

// ── 行内格式 ──────────────────────────────────────────────────────────────────
function isSafeLinkDestination(href) {
  return /^(?:https?:\/\/|mailto:|\/(?!\/)|\.\.?\/|#|\?)/i.test(href)
}

function formatInlineText(text) {
  return esc(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
}

function inline(text) {
  const protectedMarkup = []
  let rendered = String(text).replace(/`([^`]+)`/g, (_, code) => {
    const index = protectedMarkup.length
    protectedMarkup.push(`<code>${esc(code)}</code>`)
    return `\x00INLINE${index}\x00`
  })

  rendered = rendered.replace(
    /\[([^\]]+)\]\(([^()\s]*(?:\([^()]*\)[^()\s]*)*)\)/g,
    (_, label, href) => {
      const destination = href.trim()
      const safeLabel = formatInlineText(label)
      const markup = isSafeLinkDestination(destination)
        ? `<a href="${esc(destination)}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`
        : safeLabel
      const index = protectedMarkup.length
      protectedMarkup.push(markup)
      return `\x00INLINE${index}\x00`
    },
  )

  rendered = formatInlineText(rendered).replace(/ {2,}\n/g, '<br />\n')

  for (let index = protectedMarkup.length - 1; index >= 0; index--) {
    rendered = rendered.replace(`\x00INLINE${index}\x00`, protectedMarkup[index])
  }
  return rendered
}

// ── Markdown 块级解析 → HTML ────────────────────────────────────────────────────
export function renderMarkdown(md) {
  // 保护代码块
  const codeBlocks = []
  md = md.replace(/```(\w*)\r?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length
    codeBlocks.push(
      `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>` +
      esc(code.replace(/\n$/, '')) +
      `</code></pre>`
    )
    return `\x00CODE${i}\x00`
  })

  const lines = md.split(/\r?\n/)
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 代码块占位符
    if (line.includes('\x00CODE')) {
      blocks.push(line.trim()); i++; continue
    }

    // 标题
    const hm = line.match(/^(#{1,6})\s+(.+)$/)
    if (hm) {
      const level = hm[1].length
      blocks.push(`<h${level}>${inline(hm[2].trim())}</h${level}>`)
      i++; continue
    }

    // 分割线
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push('<hr />'); i++; continue
    }

    // 引用块
    if (line.startsWith('>')) {
      const bqLines = []
      while (i < lines.length && (lines[i].startsWith('>') || lines[i] === '')) {
        bqLines.push(lines[i].replace(/^>\s?/, '')); i++
      }
      blocks.push(`<blockquote><p>${inline(bqLines.join('\n').trim())}</p></blockquote>`)
      continue
    }

    // 无序列表
    if (/^[-*+]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*+]\s+/, ''))}</li>`); i++
      }
      blocks.push(`<ul>${items.join('')}</ul>`); continue
    }

    // 有序列表
    if (/^\d+\.\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`); i++
      }
      blocks.push(`<ol>${items.join('')}</ol>`); continue
    }

    // 空行
    if (line.trim() === '') { i++; continue }

    // 段落
    const paraLines = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,6}\s/) &&
      !/^[-*_]{3,}\s*$/.test(lines[i]) &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].startsWith('>') &&
      !lines[i].includes('\x00CODE')
    ) {
      paraLines.push(lines[i]); i++
    }
    if (paraLines.length) blocks.push(`<p>${inline(paraLines.join('\n'))}</p>`)
  }

  // 按 h2 分组为 <section>
  const sections = []
  let cur = []
  for (const block of blocks) {
    if (block.startsWith('<h2') && cur.length > 0) {
      sections.push(`<section>\n${cur.join('\n')}\n</section>`)
      cur = [block]
    } else {
      cur.push(block)
    }
  }
  if (cur.length > 0) sections.push(`<section>\n${cur.join('\n')}\n</section>`)

  let html = sections.join('\n')

  // 还原代码块
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`\x00CODE${idx}\x00`, block)
  })
  return html
}

// ── 阅读时间估算 ───────────────────────────────────────────────────────────────
function readingTime(html) {
  const text = html.replace(/<[^>]+>/g, ' ')
  const len = text.replace(/\s+/g, '').length
  return `约 ${Math.max(1, Math.round(len / 500))} 分钟阅读`
}

function readingMinutes(markdown) {
  const text = String(markdown).replace(/[`#>*_~\[\]()\-]/g, '')
  return Math.max(1, Math.round(text.replace(/\s+/g, '').length / 500))
}

function jsonForHtml(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

function xmlEsc(value) {
  return esc(value).replace(/'/g, '&apos;')
}

// ── HTML 页面模板 ──────────────────────────────────────────────────────────────
function renderPage(meta, slug, contentHtml, relatedPosts = []) {
  const {
    title = '无标题',
    date = new Date().toISOString().slice(0, 10),
    updated = date,
    description = '',
    keywords = '',
    tags = [],
    kicker = '自托管首发',
    category = '技术',
  } = meta

  const pageUrl = `${BASE_URL}/pages/blog/${slug}.html`
  const tagsHtml = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('\n          ')
  const articleJsonLd = jsonForHtml({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    inLanguage: 'zh-CN',
    datePublished: date,
    dateModified: updated,
    author: { '@type': 'Person', name: 'Koen', url: 'https://koen.songyuankun.top/' },
    publisher: {
      '@type': 'Organization',
      name: "Koen's 工具箱",
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/assets/logo.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    image: [`${BASE_URL}/assets/avatar.jpg`],
    articleSection: category,
  })
  const relatedHtml = relatedPosts.map(post =>
    `<a href="${BASE_URL}/pages/blog/${post.slug}.html">${esc(post.title)}<span>${esc(post.category)}</span></a>`
  ).join('\n          ')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="author" content="Koen" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta name="description" content="${esc(description)}" />
  <meta name="keywords" content="${esc(keywords)}" />
  <meta property="og:title" content="${esc(title)} · Koen的工具箱" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${esc(pageUrl)}" />
  <meta property="og:image" content="${BASE_URL}/assets/avatar.jpg" />
  <meta property="article:published_time" content="${esc(date)}" />
  <meta property="article:modified_time" content="${esc(updated)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(pageUrl)}" />
  <link rel="alternate" type="application/atom+xml" href="${BASE_URL}/feed.xml" title="Koen 的技术博客" />
  <title>${esc(title)} · Koen的工具箱</title>
  <link rel="icon" href="../../assets/logo.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="../../css/style.css" />
  <script>(function(){var t=localStorage.getItem('dev-tools-theme');if(t){document.documentElement.setAttribute('data-theme',t)}else if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark')}})();</script>
  <script type="application/ld+json">${articleJsonLd}</script>
  <script defer src="../../js/base.js"></script>
  <style>
    .blog-post-page { max-width: 720px; margin: 0 auto; padding: 24px 24px 80px; }
    .blog-post-header { margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid var(--border-color); }
    .blog-post-header .blog-post-kicker { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-primary); margin-bottom: 10px; }
    .blog-post-header h1 { font-size: clamp(1.25rem, 4vw, 1.75rem); font-weight: 800; color: var(--text-primary); line-height: 1.35; margin-bottom: 14px; }
    .blog-post-meta { display: flex; flex-wrap: wrap; gap: 10px 16px; font-size: 14px; color: var(--text-muted); align-items: center; }
    .blog-post-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .blog-post-tags .tag { display: inline-block; padding: 4px 12px; border-radius: var(--radius-full); background: var(--color-primary-light); color: var(--color-primary); font-size: 12px; font-weight: 600; }
    .blog-post-content { font-size: 16px; color: var(--text-secondary); line-height: 1.85; }
    .blog-post-content > section { margin-bottom: 2.25rem; }
    .blog-post-content h2 { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.85rem; padding-top: 0.25rem; }
    .blog-post-content h3 { font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 1rem 0 0.6rem; }
    .blog-post-content p { margin: 0 0 1rem; }
    .blog-post-content p:last-child { margin-bottom: 0; }
    .blog-post-content ul, .blog-post-content ol { margin: 0 0 1rem; padding-left: 1.35rem; }
    .blog-post-content li { margin-bottom: 0.45rem; }
    .blog-post-content li::marker { color: var(--color-primary); }
    .blog-post-content strong { color: var(--text-primary); font-weight: 600; }
    .blog-post-content blockquote { margin: 1.25rem 0; padding: 14px 18px; border-left: 4px solid var(--color-primary); background: var(--bg-tag); border-radius: 0 var(--radius-md) var(--radius-md) 0; color: var(--text-primary); font-size: 0.95em; }
    .blog-post-content pre { margin: 1.1rem 0; padding: 16px 18px; overflow-x: auto; border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border-card); font-family: var(--font-mono); font-size: 13px; line-height: 1.55; color: var(--text-primary); }
    .blog-post-content code { font-family: var(--font-mono); font-size: 0.9em; padding: 2px 6px; border-radius: var(--radius-sm); background: var(--bg-tag); color: var(--text-primary); }
    .blog-post-content pre code { padding: 0; background: none; font-size: inherit; }
    .blog-post-content a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
    .blog-post-content a:hover { opacity: 0.9; }
    .blog-post-content hr { border: none; border-top: 1px solid var(--border-color); margin: 2rem 0; }
    .blog-author-card { display: flex; gap: 18px; align-items: flex-start; margin-top: 40px; padding: 24px; background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
    .blog-author-card img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid var(--color-primary); flex-shrink: 0; }
    .blog-author-card h3 { font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
    .blog-author-card p { font-size: 14px; color: var(--text-secondary); line-height: 1.65; margin: 0; }
    .blog-related { margin-top: 32px; }
    .blog-related h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 14px; }
    .blog-related-list { display: flex; flex-direction: column; gap: 10px; }
    .blog-related-list a { display: block; padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-md); color: var(--text-primary); font-size: 15px; font-weight: 600; text-decoration: none; transition: border-color var(--transition), box-shadow var(--transition); }
    .blog-related-list a:hover { border-color: var(--color-primary); box-shadow: var(--shadow-card-hover); }
    .blog-related-list a span { display: block; font-size: 12px; font-weight: 500; color: var(--text-muted); margin-top: 4px; }
    @media (max-width: 640px) {
      .blog-post-page { padding: 16px 16px 64px; }
      .blog-author-card { flex-direction: column; align-items: center; text-align: center; }
    }
  </style>
</head>
<body>

  <header>
    <nav class="navbar" role="navigation" aria-label="主导航">
      <div class="navbar-inner">
        <a href="../../index.html" class="logo" aria-label="Koen的工具箱 首页">
          <img src="../../assets/logo.svg" alt="K" class="logo-img" />
          <span class="logo-text">Koen<span>'s</span> 工具箱</span>
        </a>
        <div class="nav-links">
          <a href="../../index.html" class="nav-link">首页</a>
          <a href="../tools/json.html" class="nav-link">在线工具</a>
          <a href="index.html" class="nav-link active">技术博客</a>
        </div>
        <button id="themeToggle" class="theme-toggle" aria-label="切换暗色模式" title="切换暗色模式">🌙</button>
      </div>
    </nav>
  </header>

  <main class="blog-post-page">
    <article>
      <header class="blog-post-header">
        <p class="blog-post-kicker">${esc(kicker)}</p>
        <h1>${esc(title)}</h1>
        <div class="blog-post-meta">
          <time datetime="${esc(date)}">${esc(date)}</time>
          <span>作者 Koen</span>
          <span>${readingTime(contentHtml)}</span>
        </div>
        <div class="blog-post-tags" aria-label="文章标签">
          ${tagsHtml}
        </div>
      </header>

      <div class="about-section blog-post-content">
        ${contentHtml}
      </div>

      <div class="blog-author-card">
        <img src="../../assets/avatar.jpg" alt="Koen 头像" width="72" height="72" />
        <div>
          <h3>Koen</h3>
          <p>不想只写业务代码的程序员，正在实践独立开发与全栈。Dev Tools Nav 是公开维护的工具箱，欢迎推荐工具或在 GitHub 上交流。</p>
        </div>
      </div>

      <section class="blog-related" aria-label="相关阅读">
        <h2>相关文章</h2>
        <div class="blog-related-list">
          <a href="index.html">← 返回技术博客列表<span>站内文章与外链索引</span></a>
          ${relatedHtml}
        </div>
      </section>
    </article>
  </main>

  <footer class="footer">
    <div class="footer-content">
      <div class="footer-brand">
        <img src="../../assets/logo.svg" alt="K" class="footer-logo" />
        <span class="footer-brand-name">Koen's 工具箱</span>
      </div>
      <div class="footer-links">
        <a href="https://github.com/SongYuanKun" target="_blank" rel="noopener noreferrer" title="GitHub">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        </a>
        <a href="https://blog.csdn.net/syk123839070" target="_blank" rel="noopener noreferrer" title="CSDN 博客">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.18 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </a>
        <span class="footer-divider">|</span>
        <a href="../../index.html">首页</a>
        <span class="footer-divider">|</span>
        <a href="../tools/json.html">在线工具</a>
        <span class="footer-divider">|</span>
      </div>
      <p class="footer-copyright">Made with code by Koen · 数据来源于公开信息整理</p>
    </div>
  </footer>

  <script>
    (function () {
      function initTheme() {
        var saved = localStorage.getItem("dev-tools-theme");
        var theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.setAttribute("data-theme", theme);
        var btn = document.getElementById("themeToggle");
        if (btn) {
          btn.textContent = theme === "dark" ? "☀️" : "🌙";
          btn.title = theme === "dark" ? "切换到亮色模式" : "切换到暗色模式";
          btn.addEventListener("click", function () {
            var cur = document.documentElement.getAttribute("data-theme");
            var next = cur === "dark" ? "light" : "dark";
            localStorage.setItem("dev-tools-theme", next);
            document.documentElement.setAttribute("data-theme", next);
            btn.textContent = next === "dark" ? "☀️" : "🌙";
            btn.title = next === "dark" ? "切换到亮色模式" : "切换到暗色模式";
          });
        }
      }
      document.addEventListener("DOMContentLoaded", initTheme);
    })();
  </script>
  <script defer src="../../js/footer.js"></script>
</body>
</html>`
}

function sortNormalizedPosts(posts) {
  return [...posts].sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? 1 : -1
    if (left.slug === right.slug) return 0
    return left.slug < right.slug ? -1 : 1
  })
}

function manifestPost(post) {
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    updated: post.updated,
    description: post.description,
    category: post.category,
    tags: [...post.tags],
    keywords: post.keywords,
    kicker: post.kicker,
    featured: post.featured,
    readTime: readingMinutes(post.body),
    url: `/pages/blog/${post.slug}.html`,
    canonicalUrl: `${BASE_URL}/pages/blog/${post.slug}.html`,
    sourceFile: post.sourceFile,
  }
}

function renderBlogIndex(posts) {
  const staticLinks = posts.map(post => `
        <a class="blog-card" href="${post.slug}.html">
          <span class="blog-card-category">${esc(post.category)}</span>
          <h2 class="blog-card-title">${esc(post.title)}</h2>
          <p class="blog-card-desc">${esc(post.description)}</p>
        </a>`).join('')
  const blogJsonLd = jsonForHtml({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Koen 的技术博客',
    url: `${BASE_URL}/pages/blog/`,
    inLanguage: 'zh-CN',
  })

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Koen 的技术博客：Java 源码、独立开发与 AI 实践。" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${BASE_URL}/pages/blog/" />
  <link rel="alternate" type="application/atom+xml" href="${BASE_URL}/feed.xml" title="Koen 的技术博客" />
  <link rel="stylesheet" href="../../css/style.css" />
  <link rel="stylesheet" href="../../css/blog.css" />
  <title>技术博客 · Koen的工具箱</title>
  <script type="application/ld+json">${blogJsonLd}</script>
  <script defer src="../../js/base.js"></script>
</head>
<body class="site-v2">
  <header><nav class="navbar" aria-label="主导航"><a href="../../index.html" class="logo">Koen's 工具箱</a></nav></header>
  <main class="blog-page">
    <header class="blog-header"><h1>技术博客</h1><p>Java 源码、独立开发与 AI 实践。</p></header>
    <div class="blog-stats"><span id="blogStatTotal">${posts.length} 篇文章</span><span id="blogStatShown"></span></div>
    <div class="blog-toolbar">
      <label class="blog-search" for="blogSearch"><span class="visually-hidden">搜索文章</span><input id="blogSearch" type="search" placeholder="搜索标题、标签或摘要…" /></label>
      <div class="blog-categories" id="blogCategories"></div>
    </div>
    <section class="blog-featured" id="blogFeatured" hidden></section>
    <div class="blog-list" id="blogList">${staticLinks}
    </div>
    <div class="blog-empty" id="blogEmpty" style="display:none;">暂无匹配文章。</div>
    <section class="blog-subscribe" aria-label="关注更新">
      <h2>关注更新</h2>
      <p>长文会同步发布到 CSDN，站内也提供 Atom 订阅。</p>
      <div class="blog-subscribe-links">
        <a href="${BASE_URL}/feed.xml" class="blog-subscribe-link">Atom Feed</a>
        <a href="https://blog.csdn.net/syk123839070" target="_blank" rel="noopener noreferrer" class="blog-subscribe-link">CSDN 博客</a>
      </div>
    </section>
  </main>
  <footer class="footer"></footer>
  <script src="../../data/blog-posts.js"></script>
  <script src="../../js/blog-list.js"></script>
  <script defer src="../../js/footer.js"></script>
</body>
</html>`
}

function renderBlogData(posts) {
  const compatiblePosts = posts.map(post => ({
    slug: post.slug,
    title: post.title,
    date: post.date,
    updated: post.updated,
    category: post.category,
    tags: [...post.tags],
    description: post.description,
    readTime: readingMinutes(post.body),
    featured: post.featured,
    status: 'published',
    url: `${post.slug}.html`,
  }))
  const categories = [
    { id: 'all', label: '全部' },
    ...[...new Set(posts.map(post => post.category))]
      .sort()
      .map(category => ({ id: category, label: category })),
  ]
  return `var BLOG_POSTS = ${JSON.stringify(compatiblePosts, null, 2)};\n\nvar BLOG_CATEGORIES = ${JSON.stringify(categories, null, 2)};\n`
}

function renderAtomFeed(posts) {
  const feedUpdated = posts.reduce(
    (latest, post) => post.updated > latest ? post.updated : latest,
    '1970-01-01',
  )
  const entries = posts.map(post => {
    const url = `${BASE_URL}/pages/blog/${post.slug}.html`
    return `  <entry>
    <title>${xmlEsc(post.title)}</title>
    <id>${xmlEsc(url)}</id>
    <link href="${xmlEsc(url)}" />
    <published>${post.date}T00:00:00Z</published>
    <updated>${post.updated}T00:00:00Z</updated>
    <summary>${xmlEsc(post.description)}</summary>
  </entry>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Koen 的技术博客</title>
  <id>${BASE_URL}/pages/blog/</id>
  <link href="${BASE_URL}/feed.xml" rel="self" />
  <link href="${BASE_URL}/pages/blog/" />
  <updated>${feedUpdated}T00:00:00Z</updated>
${entries}
</feed>
`
}

export function buildBlogArtifacts(normalizedPosts) {
  const posts = sortNormalizedPosts(normalizedPosts)
  const artifacts = {}

  posts.forEach((post, index) => {
    const relatedPosts = [posts[index - 1], posts[index + 1]].filter(Boolean)
    artifacts[`pages/blog/${post.slug}.html`] = renderPage(
      post,
      post.slug,
      renderMarkdown(post.body),
      relatedPosts,
    )
  })
  artifacts['pages/blog/index.html'] = renderBlogIndex(posts)
  artifacts['data/blog-manifest.json'] = `${JSON.stringify({
    version: 1,
    posts: posts.map(manifestPost),
  }, null, 2)}\n`
  artifacts['data/blog-posts.js'] = renderBlogData(posts)
  artifacts['feed.xml'] = renderAtomFeed(posts)
  return artifacts
}

export function calculateStaleBlogArticlePaths(previousManifest, currentPosts) {
  const currentSlugs = new Set(currentPosts.map(post => post.slug))
  const reserved = new Set(['index', 'post'])
  const previousPosts = previousManifest?.version === 1 && Array.isArray(previousManifest.posts)
    ? previousManifest.posts
    : []
  return previousPosts
    .map(post => post?.slug)
    .filter(slug =>
      typeof slug === 'string' &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
      !reserved.has(slug) &&
      !currentSlugs.has(slug))
    .sort()
    .map(slug => `pages/blog/${slug}.html`)
}

export function writeBlogArtifacts(root, artifacts, previousManifest = null) {
  const nextManifest = JSON.parse(artifacts['data/blog-manifest.json'])
  const stalePaths = calculateStaleBlogArticlePaths(previousManifest, nextManifest.posts)

  for (const [relativePath, content] of Object.entries(artifacts)) {
    const outputPath = join(root, relativePath)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, content, 'utf8')
  }
  for (const relativePath of stalePaths) {
    const outputPath = join(root, relativePath)
    if (existsSync(outputPath)) unlinkSync(outputPath)
  }
  return stalePaths
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
export function selectBlogMarkdownFiles(files) {
  return files
    .filter(file => file.endsWith('.md') && file.toLowerCase() !== 'readme.md')
    .sort()
}

function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.log('content/blog/ not found, skipping blog build.')
    return
  }

  const files = selectBlogMarkdownFiles(readdirSync(CONTENT_DIR))
  if (!files.length) {
    console.log('No markdown files in content/blog/, skipping.')
    return
  }

  const posts = buildBlogContentModel(files.map(sourceFile => ({
    sourceFile,
    raw: readFileSync(join(CONTENT_DIR, sourceFile), 'utf8'),
  })))
  const manifestPath = join(ROOT, 'data', 'blog-manifest.json')
  const previousManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : null
  const artifacts = buildBlogArtifacts(posts)
  const removed = writeBlogArtifacts(ROOT, artifacts, previousManifest)

  console.log(`blog build: ${posts.length} post(s), ${Object.keys(artifacts).length} artifact(s) generated.`)
  if (removed.length) console.log(`blog build: removed ${removed.join(', ')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
