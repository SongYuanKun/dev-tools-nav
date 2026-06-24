#!/usr/bin/env node
/**
 * 自动生成 sitemap.xml
 * 扫描 pages/、tools/ 和 index.html，生成所有页面的 sitemap
 * 用法：node scripts/generate-sitemap.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const BASE_URL = 'https://tools.songyuankun.top';

// 排除列表
const EXCLUDE = ['node_modules', '.git', '.github', 'docs', 'node_modules'];
const EXCLUDE_PATTERNS = [/_bak/, /\.bak/, /README\.md$/];

function shouldExclude(name, fullPath) {
  if (EXCLUDE.includes(name)) return true;
  if (EXCLUDE_PATTERNS.some(p => p.test(name))) return true;
  return false;
}

function pagePriority(path) {
  if (path === '/index.html' || path === '/') return { priority: 1.0, changefreq: 'daily' };
  if (path.startsWith('/pages/blog/')) return { priority: 0.9, changefreq: 'weekly' };
  if (path.startsWith('/pages/ai/')) return { priority: 0.85, changefreq: 'weekly' };
  if (path.startsWith('/pages/')) return { priority: 0.7, changefreq: 'weekly' };
  if (path.startsWith('/tools/')) return { priority: 0.7, changefreq: 'weekly' };
  return { priority: 0.5, changefreq: 'monthly' };
}

function walkDir(dir, relativePath = '') {
  let entries = [];
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      if (shouldExclude(item)) continue;
      const fullPath = join(dir, item);
      const relPath = relativePath ? `${relativePath}/${item}` : item;
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        entries = entries.concat(walkDir(fullPath, relPath));
      } else if (item.endsWith('.html') && item !== 'template.html') {
        entries.push({ path: relPath, mtime: stat.mtime });
      }
    }
  } catch (e) { /* skip */ }
  return entries;
}

function collectTemplateTools() {
  // 从 data/tools.js 中提取所有 AI/工具类别的 id，用于 template.html 页面
  const toolIds = [];
  const toolsJsPath = join(ROOT, 'data', 'tools.js');
  if (existsSync(toolsJsPath)) {
    const content = readFileSync(toolsJsPath, 'utf-8');
    const match = content.match(/id:\s*"([^"]+)"/g);
    if (match) {
      for (const m of match) {
        const id = m.match(/id:\s*"([^"]+)"/)[1];
        if (id) toolIds.push(id);
      }
    }
  }
  return toolIds;
}

const urls = [];

// 首页
urls.push({
  loc: '/',
  lastmod: new Date().toISOString().split('T')[0],
  priority: 1.0,
  changefreq: 'daily',
});

// 扫描 pages/ 目录
const pages = walkDir(join(ROOT, 'pages'), 'pages');
for (const p of pages) {
  const priority = pagePriority('/' + p.path);
  urls.push({
    loc: '/' + p.path,
    lastmod: p.mtime.toISOString().split('T')[0],
    priority: priority.priority,
    changefreq: priority.changefreq,
  });
}

// 扫描 tools/ 目录
const tools = walkDir(join(ROOT, 'tools'), 'tools');
for (const t of tools) {
  const priority = pagePriority('/' + t.path);
  urls.push({
    loc: '/' + t.path,
    lastmod: t.mtime.toISOString().split('T')[0],
    priority: priority.priority,
    changefreq: priority.changefreq,
  });
}

// template.html 工具页面
const toolIds = collectTemplateTools();
for (const id of toolIds) {
  urls.push({
    loc: `/pages/template.html?id=${id}`,
    lastmod: new Date().toISOString().split('T')[0],
    priority: 0.5,
    changefreq: 'monthly',
  });
}

// 生成 XML
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${BASE_URL}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`).join('\n')}
</urlset>`;

writeFileSync(join(ROOT, 'sitemap.xml'), xml, 'utf-8');
console.log(`✅ sitemap.xml generated — ${urls.length} URLs`);
