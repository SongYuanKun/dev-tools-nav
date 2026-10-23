import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { CANONICAL_ORIGIN } from "./site-host.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", ".github", "docs", "content", "scripts", "ops", "tasks"]);

function walkHtml(root = ".", relative = "") {
  const dir = join(root, relative);
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const child = relative ? `${relative}/${name}` : name;
    const st = statSync(join(root, child));
    if (st.isDirectory()) out.push(...walkHtml(root, child));
    else if (name.endsWith(".html")) out.push(child);
  }
  return out;
}

function metaContent(html, attrName, attrValue) {
  const re = new RegExp(
    `<meta\\b[^>]*\\b${attrName}=["']${attrValue}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>` +
      `|` +
      `<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b${attrName}=["']${attrValue}["'][^>]*>`,
    "i",
  );
  const m = html.match(re);
  return m ? (m[1] ?? m[2] ?? "") : null;
}

function canonicalHref(html) {
  const m = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i);
  return m ? m[1] : null;
}

function pageTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : "";
}

function isNoindex(html) {
  const robots = metaContent(html, "name", "robots") || "";
  return /\bnoindex\b/i.test(robots);
}

test("robots.txt points sitemap at the custom domain", () => {
  const robots = readFileSync("robots.txt", "utf8");
  assert.match(robots, new RegExp(`^Sitemap:\\s*${CANONICAL_ORIGIN.replace(/\./g, "\\.")}/sitemap\\.xml\\s*$`, "m"));
  assert.match(robots, /^User-agent:\s*\*\s*$/m);
});

test("sitemap locations are absolute custom-domain URLs and omit bare template.html", () => {
  const sitemap = readFileSync("sitemap.xml", "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 10);
  for (const loc of locs) {
    assert.ok(loc.startsWith(`${CANONICAL_ORIGIN}/`), loc);
  }
  assert.ok(!locs.includes(`${CANONICAL_ORIGIN}/pages/template.html`));
  assert.ok(locs.some((loc) => loc.includes("/pages/template.html?id=")));
});

test("indexable HTML pages expose a custom-domain canonical link", () => {
  const failures = [];
  for (const path of walkHtml()) {
    const html = readFileSync(path, "utf8");
    if (isNoindex(html)) continue;
    // Compatibility redirect shells may omit OG but still need canonical when indexable.
    const href = canonicalHref(html);
    if (!href) {
      failures.push(`${path}: missing canonical`);
      continue;
    }
    if (!href.startsWith(`${CANONICAL_ORIGIN}/`) && href !== `${CANONICAL_ORIGIN}`) {
      failures.push(`${path}: canonical ${href}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("template.html defaults to noindex and does not self-canonicalize the bare shell", () => {
  const html = readFileSync("pages/template.html", "utf8");
  assert.equal(metaContent(html, "name", "robots"), "noindex,follow");
  assert.equal(canonicalHref(html), `${CANONICAL_ORIGIN}/`);
  assert.match(html, /URLSearchParams\(location\.search\)\.get\(["']id["']\)/);
});

test("online tool shell pages have unique titles, descriptions, OG, and canonicals", () => {
  const slugs = [
    "base64", "color", "cron", "diff", "hash", "json",
    "jwt", "qrcode", "regex", "sql-formatter", "timestamp", "url-encode", "uuid",
  ];
  const titles = new Set();
  for (const slug of slugs) {
    const path = `tools/${slug}/index.html`;
    const html = readFileSync(path, "utf8");
    const title = pageTitle(html);
    const description = metaContent(html, "name", "description");
    const ogTitle = metaContent(html, "property", "og:title");
    const href = canonicalHref(html);

    assert.ok(title && title !== "在线工具 · Koen的工具箱", `${path} title`);
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    titles.add(title);
    assert.ok(description && description !== "在线工具", `${path} description`);
    assert.ok(ogTitle, `${path} og:title`);
    assert.equal(href, `${CANONICAL_ORIGIN}/tools/${slug}/`);
  }
});

test("repository does not ship a CNAME that would steal the 1Panel custom domain", () => {
  try {
    readFileSync("CNAME", "utf8");
    assert.fail("CNAME must not exist while 1Panel hosts tools.songyuankun.top");
  } catch (error) {
    assert.equal(error.code, "ENOENT");
  }
});
