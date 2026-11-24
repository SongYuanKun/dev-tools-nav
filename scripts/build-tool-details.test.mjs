import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import vm from "node:vm";

import {
  buildToolDetailArtifacts,
  buildToolDetailSite,
  detailPathForTool,
  parseToolData,
  renderToolDetail,
} from "./build-tool-details.mjs";

const source = readFileSync("data/tools.js", "utf8");
const model = parseToolData(source);
const legacyTemplate = readFileSync("pages/template.html", "utf8");

function metaContent(html, name) {
  return html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1];
}

function runLegacyTemplate(search, fixtureId = "deepseek") {
  const script = [...legacyTemplate.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .find((body) => /function renderDetail/.test(body));
  const element = (attributes = {}) => ({
    attributes: { ...attributes },
    innerHTML: "",
    addEventListener() {},
    setAttribute(name, value) { this.attributes[name] = value; },
  });
  const selectors = new Map([
    ['meta[name="robots"]', element({ content: "noindex,follow" })],
    ['meta[name="description"]', element({ content: "" })],
    ['meta[property="og:title"]', element({ content: "" })],
    ['meta[property="og:description"]', element({ content: "" })],
    ['meta[property="og:url"]', element({ content: "https://tools.songyuankun.top/" })],
    ['meta[name="twitter:title"]', element({ content: "" })],
    ['meta[name="twitter:description"]', element({ content: "" })],
    ['link[rel="canonical"]', element({ href: "https://tools.songyuankun.top/" })],
  ]);
  const ids = new Map([
    ["detailContent", element()],
    ["relatedSection", element()],
  ]);
  let ready;
  const document = {
    title: "",
    addEventListener(name, callback) { if (name === "DOMContentLoaded") ready = callback; },
    getElementById(id) { return ids.get(id) || null; },
    querySelector(selector) { return selectors.get(selector) || null; },
  };
  const tool = { ...model.tools.find((item) => item.id === fixtureId), icon: "" };
  const window = {
    location: { search },
    escapeHtml(value) {
      return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    },
  };

  assert.ok(script);
  vm.runInNewContext(script, {
    CATEGORIES: model.categories,
    TOOLS_DATA: [tool],
    URLSearchParams,
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout,
    window,
  });
  assert.equal(typeof ready, "function");
  ready();
  return { ids, selectors };
}

test("catalog tools with curated detail content get deterministic static artifacts", () => {
  const artifacts = buildToolDetailArtifacts(model);
  const expected = model.tools.filter((tool) => tool.category !== "online-tools");

  assert.equal(Object.keys(artifacts).length, expected.length);
  assert.deepEqual(buildToolDetailArtifacts(structuredClone(model)), artifacts);
  assert.ok(expected.length > 0);
  assert.ok(!("pages/details/online-json/index.html" in artifacts));
  for (const id of ["", "ai", "dev", "design", "hosting", "online-tools", "ops", "security"]) {
    assert.ok(!(`pages/details/${id}/index.html` in artifacts), `unexpected route for ${JSON.stringify(id)}`);
  }
});

test("representative generated pages are indexable, self-canonical, and readable without JavaScript", () => {
  const artifacts = buildToolDetailArtifacts(model);
  for (const id of ["better-uptime", "midjourney", "vscode"]) {
    const html = artifacts[`pages/details/${id}/index.html`];
    const tool = model.tools.find((item) => item.id === id);
    assert.ok(html, id);
    assert.equal(metaContent(html, "robots"), "index,follow,max-image-preview:large");
    assert.match(html, new RegExp(`<link rel="canonical" href="https://tools\\.songyuankun\\.top/pages/details/${id}/"`));
    assert.match(html, new RegExp(`<h1 class="detail-name">${tool.name}</h1>`));
    assert.match(html, new RegExp(tool.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(html, /加载中/);
  }
});

test("canonical routing keeps self-built tools on their existing pages and rejects unsafe IDs", () => {
  assert.equal(
    detailPathForTool({ id: "deepseek", category: "ai" }),
    "/pages/details/deepseek/",
  );
  assert.equal(
    detailPathForTool({ id: "online-json", category: "online-tools", url: "tools/json/" }),
    "/tools/json/",
  );
  assert.throws(() => detailPathForTool({ id: "", category: "ai" }), /invalid tool detail id/);
  assert.throws(() => detailPathForTool({ id: "Bad ID", category: "ai" }), /invalid tool detail id/);
  assert.throws(
    () => detailPathForTool({ id: "online-bad", category: "online-tools", url: "../private" }),
    /invalid internal tool URL/,
  );
});

test("static detail rendering escapes catalog text and blocks unsafe outbound schemes", () => {
  const html = renderToolDetail({
    id: "safe-id",
    name: "<img src=x onerror=alert(1)>",
    description: "A & B",
    category: "dev",
    tags: ["<script>alert(1)</script>"],
    url: "javascript:alert(1)",
    icon: "javascript:alert(2)",
    content: {
      intro: "</script><script>alert(3)</script>",
      links: [{ label: "bad", url: "data:text/html,bad" }],
    },
  }, { categories: [{ id: "dev", label: "开发", icon: "🛠️" }] });

  assert.doesNotMatch(html, /<img src=x|<script>alert\([123]\)<\/script>|javascript:|data:text\/html/i);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /href="#"/);
  assert.match(html, /\\u003c\/script>/);
});

test("building the generated detail tree removes stale pages", () => {
  const root = mkdtempSync(join(tmpdir(), "tool-details-"));
  try {
    const stale = join(root, "pages/details/removed/index.html");
    mkdirSync(dirname(stale), { recursive: true });
    writeFileSync(stale, "stale");
    mkdirSync(join(root, "data"), { recursive: true });
    writeFileSync(join(root, "data/tools.js"), `
      const TOOLS_DATA = [{
        id: "current", name: "Current", description: "Current detail", category: "dev",
        tags: [], url: "https://example.com/", icon: "", content: { intro: "Readable" },
      }];
      const CATEGORIES = [{ id: "dev", label: "开发", icon: "🛠️" }];
    `);

    buildToolDetailSite(root);
    assert.equal(existsSync(stale), false);
    assert.equal(existsSync(join(root, "pages/details/current/index.html")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy query shell renders valid IDs at static canonicals and rejects empty or invalid IDs", () => {
  assert.equal(metaContent(legacyTemplate, "robots"), "noindex,follow");
  assert.doesNotMatch(legacyTemplate, /setAttribute\(["']content["'], ["']index,follow/);

  const valid = runLegacyTemplate("?id=deepseek");
  assert.match(valid.ids.get("detailContent").innerHTML, /<h1 class="detail-name">DeepSeek<\/h1>/);
  assert.equal(
    valid.selectors.get('link[rel="canonical"]').attributes.href,
    "https://tools.songyuankun.top/pages/details/deepseek/",
  );
  assert.equal(valid.selectors.get('meta[name="robots"]').attributes.content, "noindex,follow");

  const online = runLegacyTemplate("?id=online-json", "online-json");
  const links = [...online.ids.get("detailContent").innerHTML.matchAll(/href="([^"]+)"/g)];
  assert.ok(links.length >= 2);
  for (const [, href] of links) assert.equal(new URL(href, "https://example.org/pages/template.html").pathname, "/tools/json/");

  for (const search of ["", "?id=dev"]) {
    const invalid = runLegacyTemplate(search);
    assert.match(invalid.ids.get("detailContent").innerHTML, /工具未找到/);
    assert.equal(invalid.selectors.get('link[rel="canonical"]').attributes.href, "https://tools.songyuankun.top/");
    assert.equal(invalid.selectors.get('meta[name="robots"]').attributes.content, "noindex,follow");
  }
});

test("old tools index redirect remains a noindex compatibility route", () => {
  const html = readFileSync("pages/tools/index.html", "utf8");
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .find((body) => /location\.replace/.test(body));
  const redirects = [];

  assert.equal(metaContent(html, "robots"), "noindex,follow");
  assert.ok(script);
  vm.runInNewContext(script, {
    location: {
      search: "?from=legacy",
      replace(value) { redirects.push(value); },
    },
  });
  assert.deepEqual(redirects, ["../../tools/?from=legacy"]);
  assert.match(html, /<link rel="canonical" href="https:\/\/tools\.songyuankun\.top\/tools\/"/);
});
