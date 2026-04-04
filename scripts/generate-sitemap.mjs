import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const BASE_URL = "https://songyuankun.github.io/dev-tools-nav";

function readToolsData() {
  const filePath = path.join(ROOT, "data", "tools.js");
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

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildUrl(loc, changefreq, priority, lastmod) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

function main() {
  const { tools, categories } = readToolsData();
  const hiddenCategories = new Set(
    categories.filter((c) => c && c.hidden === true).map((c) => c.id),
  );
  const now = new Date().toISOString().slice(0, 10);

  const staticUrls = [
    { loc: `${BASE_URL}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${BASE_URL}/pages/about.html`, changefreq: "weekly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/kms.html`, changefreq: "weekly", priority: "0.6" },
    { loc: `${BASE_URL}/pages/jrebel.html`, changefreq: "daily", priority: "0.7" },
    { loc: `${BASE_URL}/pages/products.html`, changefreq: "monthly", priority: "0.6" },
    { loc: `${BASE_URL}/pages/blog/index.html`, changefreq: "weekly", priority: "0.9" },
    { loc: `${BASE_URL}/pages/blog/why-build-dev-tools-nav.html`, changefreq: "monthly", priority: "0.7" },
    { loc: `${BASE_URL}/pages/blog/ai-free-tokens-handbook.html`, changefreq: "monthly", priority: "0.75" },
    { loc: `${BASE_URL}/pages/tools/json.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/timestamp.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/cron.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/base64.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/jwt.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/sql-formatter.html`, changefreq: "monthly", priority: "0.8" },
    { loc: `${BASE_URL}/pages/tools/regex.html`, changefreq: "monthly", priority: "0.8" },
  ];

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

  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
  console.log(`sitemap generated: ${allUrls.length} urls`);
}

main();
