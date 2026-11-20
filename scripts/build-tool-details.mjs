#!/usr/bin/env node
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(MODULE_DIR, "..");
const CANONICAL_ORIGIN = "https://tools.songyuankun.top";
const DETAIL_OUTPUT_ROOT = "pages/details";
const VALID_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "#";
  } catch {
    return "#";
  }
}

function assertValidToolId(id) {
  if (!VALID_ID.test(String(id ?? ""))) {
    throw new Error(`invalid tool detail id: ${JSON.stringify(id)}`);
  }
}

export function detailPathForTool(tool) {
  if (tool?.category === "online-tools") {
    const path = String(tool.url ?? "").replace(/^\/+/, "");
    if (!path || /^(?:[a-z]+:|\/\/)/i.test(path) || path.includes("..")) {
      throw new Error(`invalid internal tool URL for ${JSON.stringify(tool?.id)}: ${JSON.stringify(tool?.url)}`);
    }
    return `/${path}`;
  }
  assertValidToolId(tool?.id);
  return `/pages/details/${tool.id}/`;
}

export function parseToolData(source) {
  const context = Object.create(null);
  runInNewContext(
    `${source}\n;globalThis.__BUILD_TOOL_DATA__ = { TOOLS_DATA, CATEGORIES };`,
    context,
    {
      timeout: 1_000,
      codeGeneration: { strings: false, wasm: false },
    },
  );
  const data = JSON.parse(JSON.stringify(context.__BUILD_TOOL_DATA__));
  if (!Array.isArray(data?.TOOLS_DATA) || !Array.isArray(data?.CATEGORIES)) {
    throw new Error("data/tools.js must define TOOLS_DATA and CATEGORIES arrays");
  }
  return { tools: data.TOOLS_DATA, categories: data.CATEGORIES };
}

function renderFreeQuota(quota) {
  if (!quota) return "";
  const models = Array.isArray(quota.models) ? quota.models.join("、") : (quota.models || "—");
  return `
      <section class="detail-section">
        <h2>免费额度</h2>
        <table class="detail-info-table">
          <tr class="detail-info-row"><td class="detail-info-label">可用模型</td><td class="detail-info-value">${esc(models)}</td></tr>
          <tr class="detail-info-row"><td class="detail-info-label">免费额度</td><td class="detail-info-value">${esc(quota.quota || "—")}</td></tr>
          <tr class="detail-info-row"><td class="detail-info-label">使用周期</td><td class="detail-info-value">${esc(quota.period || "—")}</td></tr>
          <tr><td class="detail-info-label">刷新周期</td><td class="detail-info-value">${esc(quota.refresh || "—")}</td></tr>
        </table>
      </section>`;
}

function renderContentSections(tool) {
  const content = tool.content || {};
  const intro = content.intro
    ? `<section class="detail-section"><h2>工具简介</h2><p>${esc(content.intro)}</p></section>`
    : "";
  const features = Array.isArray(content.features) && content.features.length
    ? `<section class="detail-section"><h2>核心特性</h2><ul class="detail-features-list">${content.features.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>`
    : "";
  const quickstart = Array.isArray(content.quickstart) && content.quickstart.length
    ? `<section class="detail-section"><h2>快速上手</h2><div class="detail-quickstart">${content.quickstart.map((step) => `
          <div class="detail-step">
            <h3>${esc(step.title || "")}</h3>
            <div class="detail-code-wrap">
              <button type="button" class="detail-copy-btn">复制</button>
              <pre><code>${esc(step.code || "")}</code></pre>
            </div>
          </div>`).join("")}</div></section>`
    : "";
  const tips = content.tips
    ? `<section class="detail-section"><h2>实用技巧</h2><div class="detail-tips-box">${(Array.isArray(content.tips) ? content.tips : [content.tips]).map(esc).join("<br>")}</div></section>`
    : "";
  const links = Array.isArray(content.links) && content.links.length
    ? `<section class="detail-section"><h2>相关链接</h2><div class="detail-links-wrap">${content.links.map((link) => `<a href="${esc(safeHttpUrl(link.url))}" target="_blank" rel="noopener noreferrer" class="detail-link-btn">${esc(link.label)}</a>`).join("")}</div></section>`
    : "";
  return `${intro}${renderFreeQuota(content.freeQuota)}${features}${quickstart}${tips}${links}`;
}

function renderRelated(tool, tools, category) {
  const related = tools
    .filter((candidate) => candidate.category === tool.category && candidate.id !== tool.id && candidate.category !== "online-tools")
    .slice(0, 4);
  if (!related.length) return "";
  return `
      <section class="detail-section">
        <h2>同类工具推荐</h2>
        <div class="tools-grid" style="margin-top:16px;">
          ${related.map((candidate) => `<a href="../${esc(candidate.id)}/" class="tool-card" style="text-decoration:none;display:flex;flex-direction:column;gap:10px;">
            <div class="card-header">
              <div class="card-icon"><span class="card-icon-fallback">${esc(category.icon || "🔧")}</span></div>
              <div><div class="card-title">${esc(candidate.name)}</div><div class="card-category-label">${esc(category.icon || "🔧")} ${esc(category.label || candidate.category)}</div></div>
            </div>
            <p class="card-desc">${esc(candidate.description)}</p>
          </a>`).join("")}
        </div>
      </section>`;
}

export function renderToolDetail(tool, options = {}) {
  assertValidToolId(tool?.id);
  if (tool.category === "online-tools") {
    throw new Error(`self-built tool ${tool.id} already has its own canonical page`);
  }
  const tools = options.tools || [tool];
  const categories = options.categories || [];
  const category = categories.find((item) => item.id === tool.category)
    || { label: tool.category, icon: "🔧" };
  const canonicalPath = detailPathForTool(tool);
  const canonical = `${CANONICAL_ORIGIN}${canonicalPath}`;
  const description = tool.content?.intro || tool.description || "";
  const officialUrl = safeHttpUrl(tool.url);
  const iconUrl = safeHttpUrl(tool.icon);
  const icon = iconUrl === "#"
    ? `<span style="font-size:36px;">${esc(category.icon || "🔧")}</span>`
    : `<img src="${esc(iconUrl)}" alt="${esc(tool.name)}" loading="lazy" referrerpolicy="no-referrer" />`;
  const tags = Array.isArray(tool.tags) ? tool.tags : [];
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${tool.name} · Koen的工具箱`,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Koen的工具箱", url: `${CANONICAL_ORIGIN}/` },
  }).replaceAll("<", "\\u003c");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <script>
    (function(){try{var t=localStorage.getItem("dev-tools-theme");if(!t)t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();
  </script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta name="description" content="${esc(description)}" />
  <meta property="og:title" content="${esc(tool.name)} · Koen的工具箱" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${CANONICAL_ORIGIN}/assets/avatar.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(tool.name)} · Koen的工具箱" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <link rel="icon" href="../../../assets/logo.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="../../../css/style.css?v=__ASSET_VERSION__" />
  <title>${esc(tool.name)} · Koen的工具箱</title>
  <script type="application/ld+json">${structuredData}</script>
  <script defer src="../../../js/base.js?v=__ASSET_VERSION__"></script>
</head>
<body>
  <header>
    <nav class="navbar" role="navigation" aria-label="主导航">
      <div class="navbar-inner">
        <a href="../../../index.html" class="logo" aria-label="Koen的工具箱 首页">
          <img src="../../../assets/logo.svg" alt="K" class="logo-img" />
          <span class="logo-text">Koen<span>'s</span> 工具箱</span>
        </a>
        <div class="nav-links"><a href="../../../index.html" class="nav-link">首页</a></div>
        <button id="themeToggle" class="theme-toggle" aria-label="切换暗色模式" title="切换暗色模式">🌙</button>
      </div>
    </nav>
  </header>

  <main class="detail-page" id="detailPage">
    <a href="../../../index.html" class="back-btn" aria-label="返回工具列表">← 返回工具列表</a>
    <article id="detailContent">
      <div class="detail-header">
        <div class="detail-icon">${icon}</div>
        <div class="detail-meta">
          <h1 class="detail-name">${esc(tool.name)}</h1>
          <p class="detail-desc">${esc(tool.description)}</p>
          <div class="detail-tags">${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
          <a href="${esc(officialUrl)}" target="_blank" rel="noopener noreferrer" class="detail-visit-btn">访问官网 ↗</a>
        </div>
      </div>
      ${renderContentSections(tool)}
      <section class="detail-section">
        <h2>基本信息</h2>
        <table class="detail-info-table">
          <tr class="detail-info-row"><td class="detail-info-label">分类</td><td class="detail-info-value">${esc(category.icon || "🔧")} ${esc(category.label || tool.category)}</td></tr>
          <tr class="detail-info-row"><td class="detail-info-label">官网</td><td class="detail-info-value"><a href="${esc(officialUrl)}" target="_blank" rel="noopener noreferrer" class="detail-info-link">${esc(officialUrl === "#" ? "链接不可用" : tool.url)}</a></td></tr>
          <tr><td class="detail-info-label">标签</td><td class="detail-info-value">${tags.map(esc).join(" · ")}</td></tr>
        </table>
      </section>
    </article>
${renderRelated(tool, tools, category)}
  </main>

  <footer class="footer">
    <div class="footer-content">
      <div class="footer-brand"><img src="../../../assets/logo.svg" alt="K" class="footer-logo" /><span class="footer-brand-name">Koen's 工具箱</span></div>
      <div class="footer-links"><a href="../../../index.html">首页</a><span class="footer-divider">|</span><a href="https://github.com/SongYuanKun" target="_blank" rel="noopener noreferrer">GitHub</a></div>
      <p class="footer-copyright">Made with code by Koen · 数据来源于公开信息整理</p>
    </div>
  </footer>
  <script>
    document.addEventListener("click",function(event){var button=event.target.closest(".detail-copy-btn");if(!button)return;var code=button.closest(".detail-code-wrap").querySelector("code").textContent;navigator.clipboard.writeText(code).then(function(){var original=button.textContent;button.textContent="✓ 已复制";setTimeout(function(){button.textContent=original;},2000);});});
  </script>
  <script defer src="../../../js/footer.js?v=__ASSET_VERSION__"></script>
</body>
</html>
`;
}

export function buildToolDetailArtifacts({ tools, categories }) {
  const ids = new Set();
  const artifacts = {};
  const detailTools = tools
    .filter((tool) => tool.category !== "online-tools")
    .sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);

  for (const tool of detailTools) {
    assertValidToolId(tool.id);
    if (ids.has(tool.id)) throw new Error(`duplicate tool detail id: ${tool.id}`);
    ids.add(tool.id);
    artifacts[`${DETAIL_OUTPUT_ROOT}/${tool.id}/index.html`] = renderToolDetail(tool, {
      tools,
      categories,
    });
  }
  return artifacts;
}

export function buildToolDetailSite(root = DEFAULT_ROOT) {
  const source = readFileSync(join(root, "data", "tools.js"), "utf8");
  const model = parseToolData(source);
  const artifacts = buildToolDetailArtifacts(model);
  const outputRoot = join(root, DETAIL_OUTPUT_ROOT);
  rmSync(outputRoot, { recursive: true, force: true });
  for (const [path, content] of Object.entries(artifacts)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }
  return { artifacts, model };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = buildToolDetailSite();
  console.log(`tool detail pages generated — ${Object.keys(result.artifacts).length} pages`);
}
