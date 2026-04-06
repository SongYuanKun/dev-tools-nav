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
 *   keywords    SEO 关键词，逗号分隔
 *   tags        标签数组 [tag1, tag2]
 *   kicker      文章小标题，如「自托管首发 · 独立开发」
 *   section     Schema.org articleSection
 *   slug        自定义 URL slug（可选，默认为文件名去掉 .md）
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const CONTENT_DIR = join(ROOT, 'content', 'blog')
const OUTPUT_DIR = join(ROOT, 'pages', 'blog')
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
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: raw }

  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const sep = line.indexOf(':')
    if (sep < 0) continue
    const key = line.slice(0, sep).trim()
    const val = line.slice(sep + 1).trim()
    if (key === 'tags') {
      const inner = val.match(/^\[(.+)\]$/)
      meta.tags = inner
        ? inner[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''))
        : val.split(',').map(t => t.trim().replace(/^["']|["']$/g, ''))
    } else {
      meta[key] = val.replace(/^["']|["']$/g, '')
    }
  }
  return { meta, body: m[2] }
}

// ── 行内格式 ──────────────────────────────────────────────────────────────────
function inline(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
      `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`)
}

// ── Markdown 块级解析 → HTML ────────────────────────────────────────────────────
function mdToHtml(md) {
  // 保护代码块
  const codeBlocks = []
  md = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
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

// ── HTML 页面模板 ──────────────────────────────────────────────────────────────
function renderPage(meta, slug, contentHtml) {
  const {
    title = '无标题',
    date = new Date().toISOString().slice(0, 10),
    description = '',
    keywords = '',
    tags = [],
    kicker = '自托管首发',
    section = '技术',
  } = meta

  const pageUrl = `${BASE_URL}/pages/blog/${slug}.html`
  const tagsHtml = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('\n          ')

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
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(pageUrl)}" />
  <title>${esc(title)} · Koen的工具箱</title>
  <link rel="icon" href="../../assets/logo.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="../../css/style.css" />
  <script>(function(){var t=localStorage.getItem('dev-tools-theme');if(t){document.documentElement.setAttribute('data-theme',t)}else if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.setAttribute('data-theme','dark')}})();</script>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "${esc(title)}",
      "description": "${esc(description)}",
      "inLanguage": "zh-CN",
      "datePublished": "${esc(date)}",
      "dateModified": "${esc(date)}",
      "author": { "@type": "Person", "name": "Koen", "url": "${BASE_URL}/pages/about.html" },
      "publisher": {
        "@type": "Organization",
        "name": "Koen's 工具箱",
        "logo": { "@type": "ImageObject", "url": "${BASE_URL}/assets/logo.svg" }
      },
      "mainEntityOfPage": { "@type": "WebPage", "@id": "${esc(pageUrl)}" },
      "image": ["${BASE_URL}/assets/avatar.jpg"],
      "articleSection": "${esc(section)}"
    }
  </script>
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
          <a href="../../index.html" class="nav-link">工具导航</a>
          <a href="../tools/json.html" class="nav-link">在线工具</a>
          <a href="index.html" class="nav-link active">技术博客</a>
          <a href="../about.html" class="nav-link">关于我</a>
        </div>
        <button id="themeToggle" class="theme-toggle" aria-label="切换暗色模式" title="切换暗色模式">🌙</button>
      </div>
    </nav>
  </header>

  <main class="about-page blog-post-page">
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
          <a href="ai-free-tokens-handbook.html">AI 免费 Token / 额度薅羊毛手册<span>站内 · AI 实践</span></a>
          <a href="why-build-dev-tools-nav.html">为什么一个程序员，会花3天做一个导航站？<span>站内 · 独立开发</span></a>
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
        <a href="../../index.html">工具导航</a>
        <span class="footer-divider">|</span>
        <a href="../tools/json.html">在线工具</a>
        <span class="footer-divider">|</span>
        <a href="../about.html">关于我</a>
      </div>
      <p class="footer-copyright">Made with ❤️ by Koen · 数据来源于公开信息整理</p>
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
</body>
</html>`
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.log('content/blog/ not found, skipping blog build.')
    return
  }

  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))
  if (!files.length) {
    console.log('No markdown files in content/blog/, skipping.')
    return
  }

  let count = 0
  for (const file of files) {
    const raw = readFileSync(join(CONTENT_DIR, file), 'utf8')
    const { meta, body } = parseFrontmatter(raw)
    if (!meta.title) {
      console.warn(`  ⚠ ${file}: missing 'title' in frontmatter, skipping.`)
      continue
    }
    const slug = meta.slug || basename(file, '.md')
    const contentHtml = mdToHtml(body)
    const html = renderPage(meta, slug, contentHtml)
    writeFileSync(join(OUTPUT_DIR, `${slug}.html`), html, 'utf8')
    console.log(`  ✓ ${file} → pages/blog/${slug}.html`)
    count++
  }
  console.log(`blog build: ${count} post(s) generated.`)
}

main()
