import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const BASE_URL = "https://tools.songyuankun.top";

export function readToolsData(root = ROOT) {
  const filePath = path.join(root, "data", "tools.js");
  const source = fs.readFileSync(filePath, "utf8");
  const sandbox = {};
  vm.runInNewContext(
    `${source}\n;globalThis.__TOOLS_DATA__ = TOOLS_DATA;\n;globalThis.__CATEGORIES__ = typeof CATEGORIES !== "undefined" ? CATEGORIES : [];`,
    sandbox,
  );
  return {
    tools: Array.isArray(sandbox.__TOOLS_DATA__) ? sandbox.__TOOLS_DATA__ : [],
    categories: Array.isArray(sandbox.__CATEGORIES__) ? sandbox.__CATEGORIES__ : [],
  };
}

export function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildUrl(loc, changefreq, priority, lastmod) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

export function collectStaticUrls(root = ROOT) {
  // 自动扫描 pages/blog/ 下的所有 HTML 文章（除 index.html）
  const blogDir = path.join(root, "pages", "blog");
  const blogUrls = fs.existsSync(blogDir)
    ? fs.readdirSync(blogDir)
        .filter((f) => f.endsWith(".html") && f !== "index.html" && f !== "post.html")
        .sort()
        .map((f) => ({
          loc: `${BASE_URL}/pages/blog/${f}`,
          changefreq: "monthly",
          priority: "0.75",
        }))
    : [];

  const aiDir = path.join(root, "pages", "ai");
  const aiUrls = fs.existsSync(aiDir)
    ? fs
        .readdirSync(aiDir)
        .filter((f) => f.endsWith(".html"))
        .sort()
        .map((f) => ({
          loc: `${BASE_URL}/pages/ai/${f}`,
          changefreq: "weekly",
          priority: "0.85",
        }))
    : [];

  return [
    { loc: `${BASE_URL}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${BASE_URL}/pages/about.html`, changefreq: "weekly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/kms.html`, changefreq: "weekly", priority: "0.6" },
    { loc: `${BASE_URL}/pages/jrebel.html`, changefreq: "daily", priority: "0.7" },
    { loc: `${BASE_URL}/pages/products.html`, changefreq: "monthly", priority: "0.6" },
    { loc: `${BASE_URL}/pages/blog/index.html`, changefreq: "weekly", priority: "0.9" },
    ...blogUrls,
    ...aiUrls,
    { loc: `${BASE_URL}/pages/tools/json.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/timestamp.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/cron.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/base64.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/jwt.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/sql-formatter.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/regex.html`, changefreq: "monthly", priority: "0.8" },
  ];
}

export function main(root = ROOT) {
  const { tools, categories } = readToolsData(root);
  const hiddenCategories = new Set(
    categories.filter((c) => c && c.hidden === true).map((c) => c.id),
  );
  const staticUrls = collectStaticUrls(root);
  const now = new Date().toISOString().slice(0, 10);

  const toolUrls = tools
    .filter((tool) => {
      if (!tool || !tool.id) return false;
      if (tool.hidden === true) return false;
      if (hiddenCategories.has(tool.category)) return false;
      return true;
    })
    .map((tool) => ({
      loc: `${BASE_URL}/pages/template.html?id=${encodeURIComponent(tool.id)}`,
      changefreq: "weekly",
      priority: "0.5",
    }));

  const allUrls = [...staticUrls, ...toolUrls];
  const body = allUrls
    .map((item) => buildUrl(item.loc, item.changefreq, item.priority, now))
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(root, "sitemap.xml"), xml, "utf8");
  console.log(`sitemap generated: ${allUrls.length} urls`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
