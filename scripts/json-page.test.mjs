import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("../tools/json/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../css/json-workbench.css", import.meta.url), "utf8").catch(() => "");
const workbenchSource = await readFile(new URL("../js/json-workbench.mjs", import.meta.url), "utf8");
const legacyHtml = await readFile(new URL("../pages/tools/json.html", import.meta.url), "utf8");

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

function count(pattern) {
  return [...html.matchAll(pattern)].length;
}

function structuredData() {
  return [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

test("canonical JSON page loads the direct workbench without an iframe", () => {
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(html, /pages\/tools\/json\.html|[?&]embed=1/i);
  assert.match(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/tools\.songyuankun\.top\/tools\/json\/["']/i);
  assert.match(html, /href=["']\.\.\/\.\.\/css\/json-workbench\.css["']/i);
  assert.match(html, /src=["']\.\.\/\.\.\/js\/json-workbench\.bundle\.js["']/i);
});

test("legacy JSON page is a noindex redirect that preserves non-embed query parameters", async () => {
  assert.match(legacyHtml, /<meta[^>]+name=["']robots["'][^>]+content=["']noindex(?:,\s*nofollow)?["']/i);
  assert.doesNotMatch(legacyHtml, /json-workbench|json-tool\.js|data-json-editor|<textarea\b/i);

  const script = legacyHtml.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(script, "legacy redirect script is missing");
  const redirects = [];
  vm.runInNewContext(script, {
    URLSearchParams,
    location: {
      search: "?embed=1&q=%7B%22a%22%3A1%7D&mode=tree&embed=0",
      replace(value) { redirects.push(value); },
    },
  });
  assert.deepEqual(redirects, ["../../tools/json/?q=%7B%22a%22%3A1%7D&mode=tree"]);
  assert.match(legacyHtml, /<a[^>]+href=["']\.\.\/\.\.\/tools\/json\/["'][^>]*>[^<]+<\/a>/i);
  const redirect = redirects[0];
  assert.equal(
    new URL(redirect, "https://tools.songyuankun.top/pages/tools/json.html").href,
    "https://tools.songyuankun.top/tools/json/?q=%7B%22a%22%3A1%7D&mode=tree",
  );
  assert.equal(
    new URL(redirect, "https://songyuankun.github.io/dev-tools-nav/pages/tools/json.html").href,
    "https://songyuankun.github.io/dev-tools-nav/tools/json/?q=%7B%22a%22%3A1%7D&mode=tree",
  );
});

test("repository HTML no longer references the legacy JSON implementation or embed URL", async () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const htmlFiles = await collectHtmlFiles(root);
  for (const path of htmlFiles) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /(?:\.\.\/)*js\/json-tool\.js/i, `${path} references json-tool.js`);
    assert.doesNotMatch(source, /pages\/tools\/json\.html[^"'\s>]*[?&]embed=1/i, `${path} references the legacy JSON embed`);
  }
});

test("workbench exposes one editor, five accessible modes, and complete command groups", () => {
  assert.equal(count(/\bdata-json-editor(?:\s|=|>)/g), 1);
  assert.match(html, /role=["']tablist["'][^>]+aria-label=["']JSON 工作模式["']/i);

  for (const [mode, label] of [
    ["format", "格式化"],
    ["tree", "树视图"],
    ["jsonpath", "JSONPath"],
    ["yaml", "YAML"],
    ["diff", "对比"],
  ]) {
    assert.match(html, new RegExp(`role=["']tab["'][^>]+data-json-mode=["']${mode}["'][^>]*>[\\s\\S]*?${label}`, "i"));
    assert.match(html, new RegExp(`id=["']json-panel-${mode}["'][^>]+role=["']tabpanel["']`, "i"));
  }

  for (const action of ["format", "minify", "copy", "clear", "upload", "download", "sample", "unicode", "sort", "repair"]) {
    assert.match(html, new RegExp(`data-json-action=["']${action}["']`, "i"));
  }

  assert.match(html, /data-json-error[^>]+role=["']alert["'][^>]+aria-live=["']assertive["']/i);
  assert.match(html, /data-json-status[^>]+role=["']status["']/i);
  assert.match(html, /data-json-selection-status/i);
});

test("page has semantic chrome, learning content, FAQ, related tools, and privacy copy", () => {
  assert.match(html, /class=["'][^"']*skip-link[^"']*["'][^>]+href=["']#json-workbench["']/i);
  assert.match(html, /<header\b[\s\S]*?<nav\b[^>]+aria-label=["']主导航["']/i);
  assert.match(html, /<main\b[^>]+id=["']json-workbench["']/i);
  assert.match(html, /数据仅在浏览器本地处理，不会上传/i);
  assert.match(html, /<section\b[^>]+aria-labelledby=["']json-guide-title["']/i);
  assert.match(html, /<h2\b[^>]+id=["']json-guide-title["'][^>]*>[^<]*JSON[^<]*(使用指南|怎么用)/i);
  assert.match(html, /<section\b[^>]+aria-labelledby=["']json-faq-title["']/i);
  assert.match(html, /<h2\b[^>]+id=["']json-faq-title["'][^>]*>常见问题/i);
  assert.match(html, /<section\b[^>]+aria-labelledby=["']related-tools-title["']/i);
  assert.match(html, /<footer\b[^>]+class=["'][^"']*footer/i);
});

test("SoftwareApplication, HowTo and FAQ schemas match visible content", () => {
  const schemas = structuredData();
  const byType = new Map(schemas.map((schema) => [schema["@type"], schema]));

  const app = byType.get("SoftwareApplication");
  assert.ok(app, "missing SoftwareApplication JSON-LD");
  assert.equal(app.name, "JSON 工作台");
  assert.equal(app.url, "https://tools.songyuankun.top/tools/json/");
  assert.equal(app.applicationCategory, "DeveloperApplication");
  assert.match(html, new RegExp(`<h1[^>]*>[\\s\\S]*?${app.name}`, "i"));

  const howTo = byType.get("HowTo");
  assert.ok(howTo, "missing HowTo JSON-LD");
  assert.ok(howTo.step.length >= 3);
  for (const step of howTo.step) {
    assert.match(html, new RegExp(step.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  const faq = byType.get("FAQPage");
  assert.ok(faq, "missing FAQPage JSON-LD");
  assert.ok(faq.mainEntity.length >= 3);
  for (const item of faq.mainEntity) {
    assert.equal(item["@type"], "Question");
    assert.equal(item.acceptedAnswer["@type"], "Answer");
    assert.match(html, new RegExp(item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    assert.match(html, new RegExp(item.acceptedAnswer.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("workbench stylesheet encodes touch, narrow-screen, theme, and reduced-motion contracts", () => {
  assert.match(css, /min-height:\s*44px/i);
  assert.match(css, /@media\s*\([^)]*max-width:\s*(?:24\.375rem|390px)[^)]*\)/i);
  assert.match(css, /overflow-wrap:\s*anywhere|word-break:\s*break-word/i);
  assert.match(css, /\[data-theme=["']light["']\]/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /focus-visible/i);
});

test("an empty editor starts clean instead of showing a JSON lint error", () => {
  assert.match(workbenchSource, /state\.doc\.length\s*===\s*0[\s\S]*?return \[\]/);
});

test("upload, favorites, recents, and desktop sticky controls remain accessible", () => {
  assert.match(html, /<input[^>]+type=["']file["'][^>]+class=["'][^"']*json-visually-hidden/i);
  assert.doesNotMatch(html, /<input[^>]+type=["']file["'][^>]+\shidden(?:\s|=|\/?>)/i);
  assert.match(html, /data-json-favorite/);
  assert.match(html, /src=["']\.\.\/\.\.\/js\/tools-prefs\.js["']/);
  assert.match(workbenchSource, /ToolsPrefs\.addRecent\(["']json["']\)/);
  assert.match(workbenchSource, /ToolsPrefs\.toggleFavorite\(["']json["']\)/);
  assert.match(css, /\.json-app-topbar[\s\S]*?position:\s*sticky/i);
  assert.match(css, /\.json-command-area[\s\S]*?position:\s*sticky/i);
});

test("tabs are keyboard operable and optional preferences cannot block the editor", () => {
  assert.match(workbenchSource, /ArrowRight/);
  assert.match(workbenchSource, /ArrowLeft/);
  assert.match(workbenchSource, /Home/);
  assert.match(workbenchSource, /End/);
  assert.match(workbenchSource, /panel\.hidden\s*=\s*!active/);
  assert.match(
    workbenchSource,
    /function mountAvailableEditors\(\)[\s\S]*?mountJsonWorkbench\(mount\)[\s\S]*?initializeToolPreferences\(\)/,
  );
  assert.match(workbenchSource, /try\s*\{[\s\S]*?ToolsPrefs\.addRecent/);
  assert.match(css, /\.json-app-topbar[^}]*top:\s*60px/i);
  assert.match(css, /\.json-command-area[^}]*top:\s*118px/i);
  assert.match(css, /\.json-favorite-icon::before[\s\S]*?content:\s*["']☆["']/i);
});
