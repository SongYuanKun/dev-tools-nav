#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseToolCatalog } from "./audit-tools.mjs";

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_ROOT = join(MODULE_DIR, "..");
const BASE_URL = "https://tools.songyuankun.top";
const EXCLUDED_NAMES = new Set(["node_modules", ".git", ".github", "docs"]);
const EXCLUDED_FILES = new Set(["template.html", "post.html"]);
const LASTMOD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shouldExclude(name) {
  return EXCLUDED_NAMES.has(name) || /_bak|\.bak$|README\.md$/.test(name);
}

function pageMeta(pathname) {
  if (pathname === "/") return { priority: 1, changefreq: "daily" };
  if (pathname.startsWith("/pages/blog/")) return { priority: 0.9, changefreq: "weekly" };
  if (pathname.startsWith("/pages/ai/")) return { priority: 0.85, changefreq: "weekly" };
  if (pathname.startsWith("/pages/template.html?id=")) {
    return { priority: 0.5, changefreq: "monthly" };
  }
  if (pathname.startsWith("/pages/") || pathname.startsWith("/tools/")) {
    return { priority: 0.7, changefreq: "weekly" };
  }
  return { priority: 0.5, changefreq: "monthly" };
}

function walkHtml(root, relativePath = "") {
  const directory = join(root, relativePath);
  if (!existsSync(directory)) return [];

  const entries = [];
  for (const name of readdirSync(directory).sort()) {
    if (shouldExclude(name)) continue;
    const childRelativePath = relativePath ? `${relativePath}/${name}` : name;
    const stat = statSync(join(root, childRelativePath));

    if (stat.isDirectory()) {
      entries.push(...walkHtml(root, childRelativePath));
    } else if (name.endsWith(".html") && !EXCLUDED_FILES.has(name)) {
      entries.push({ path: childRelativePath });
    }
  }
  return entries;
}

function pathnameFor(path) {
  if (path === "index.html") return "/";
  if (path.startsWith("tools/") && path.endsWith("/index.html")) {
    return `/${path.slice(0, -"index.html".length)}`;
  }
  return `/${path}`;
}

function collectTemplateIds(root) {
  const toolsPath = join(root, "data", "tools.js");
  if (!existsSync(toolsPath)) return [];

  return parseToolCatalog(readFileSync(toolsPath, "utf-8")).tools
    .map((tool) => tool.id);
}

export function resolveGitLastmod(root, relativeSourcePath) {
  try {
    const value = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", relativeSourcePath],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return LASTMOD_PATTERN.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function collectStaticUrls(root, options = {}) {
  const resolveLastmod = options.resolveLastmod
    ?? ((sourcePath) => resolveGitLastmod(root, sourcePath));
  const urls = [];

  const addUrl = (pathname, sourcePath) => {
    const candidate = resolveLastmod(sourcePath);
    const lastmod = LASTMOD_PATTERN.test(candidate ?? "") ? candidate : undefined;
    const meta = pageMeta(pathname);
    urls.push({
      loc: `${BASE_URL}${pathname}`,
      ...(lastmod ? { lastmod } : {}),
      ...meta,
    });
  };

  addUrl("/", "index.html");
  for (const entry of walkHtml(root)) {
    const pathname = pathnameFor(entry.path);
    if (pathname !== "/") addUrl(pathname, entry.path);
  }
  for (const id of collectTemplateIds(root)) {
    addUrl(`/pages/template.html?id=${id}`, "data/tools.js");
  }

  return [...new Map(urls.map((url) => [url.loc, url])).values()]
    .sort((a, b) => a.loc.localeCompare(b.loc));
}

export function renderSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
${url.lastmod ? `    <lastmod>${xmlEscape(url.lastmod)}</lastmod>\n` : ""}    <changefreq>${xmlEscape(url.changefreq)}</changefreq>
    <priority>${xmlEscape(url.priority.toFixed(1))}</priority>
  </url>`).join("\n")}
</urlset>`;
}

export function generateSitemap(root = DEFAULT_ROOT, options = {}) {
  return renderSitemap(collectStaticUrls(root, options));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const urls = collectStaticUrls(DEFAULT_ROOT);
  writeFileSync(join(DEFAULT_ROOT, "sitemap.xml"), renderSitemap(urls), "utf-8");
  console.log(`sitemap.xml generated — ${urls.length} URLs`);
}
