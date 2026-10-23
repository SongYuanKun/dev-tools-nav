import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import test, { after, before } from "node:test";
import { chromium } from "playwright";

const root = resolve(new URL("..", import.meta.url).pathname);

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("PWA manifest declares installable metadata and icons", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.name, "Koen's 工具箱");
  assert.ok(manifest.short_name);
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(Array.isArray(manifest.icons));
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    assert.ok(existsSync(join(root, icon.src)), `missing icon ${icon.src}`);
    assert.ok(statSync(join(root, icon.src)).size > 100, `icon too small: ${icon.src}`);
  }
});

test("offline fallback page is noindex and points users to cached tools", () => {
  const html = read("offline.html");
  assert.match(html, /noindex/i);
  assert.match(html, /tools\//);
  assert.match(html, /离线/);
});

test("service worker keeps blog/CSDN fresh and cache-first for self-built tools", () => {
  const sw = read("sw.js");
  assert.match(sw, /isFreshContent/);
  assert.match(sw, /csdn-articles|blog-posts|blog-manifest/);
  assert.match(sw, /networkFirst/);
  assert.match(sw, /isToolAsset/);
  assert.match(sw, /cacheFirst/);
  assert.match(sw, /\/tools\//);
  assert.match(sw, /\/pages\/tools\//);
  assert.match(sw, /SELF_BUILT_SLUGS/);
  assert.match(sw, /offline\.html/);
  assert.doesNotMatch(sw, /cacheFirst\(.*blog/s);
});

test("base.js injects manifest and registers SW against the site root", () => {
  const base = read("js/base.js");
  assert.match(base, /resolveSiteRoot/);
  assert.match(base, /manifest\.webmanifest/);
  assert.match(base, /serviceWorker\.register/);
  assert.match(base, /scope:\s*root/);
  assert.match(base, /isEmbed\(\)/);
  assert.match(base, /theme-color/);
});

test("homepage declares manifest and theme-color for install prompts", () => {
  const html = read("index.html");
  assert.match(html, /rel="manifest"/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /name="theme-color"/);
  assert.match(html, /apple-touch-icon/);
});

test("precache list covers every self-built tool shell and legacy page", () => {
  const sw = read("sw.js");
  const slugs = [
    "base64", "color", "cron", "diff", "json",
    "jwt", "regex", "sql-formatter", "timestamp", "uuid",
  ];
  for (const slug of slugs) {
    assert.ok(existsSync(join(root, "tools", slug, "index.html")), `shell missing: ${slug}`);
    assert.ok(existsSync(join(root, "pages", "tools", `${slug}.html`)), `legacy missing: ${slug}`);
    assert.match(sw, new RegExp(`["'].*${slug}`));
  }
});

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

let browser;
let origin;
let server;

before(async () => {
  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname === "/"
      ? "index.html"
      : `${pathname.replace(/^\/+/, "")}${pathname.endsWith("/") ? "index.html" : ""}`;
    const file = normalize(resolve(root, relative));
    if (!file.startsWith(`${root}/`) && file !== root) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const stream = createReadStream(file);
    stream.once("error", () => response.writeHead(404).end("Not found"));
    stream.once("open", () => {
      response.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
      stream.pipe(response);
    });
  });
  await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise((resolveClosed) => server?.close(resolveClosed));
});

test("browser registers the service worker with root scope and loads the manifest", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("https://umami.songyuankun.top/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}",
  }));
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto(`${origin}/`, { waitUntil: "load" });

  const manifestHref = await page.locator('link[rel="manifest"]').first().getAttribute("href");
  assert.ok(manifestHref && manifestHref.includes("manifest.webmanifest"));

  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, {
    timeout: 10_000,
  });
  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return {
      scope: ready.scope,
      scriptURL: ready.active?.scriptURL || ready.installing?.scriptURL || ready.waiting?.scriptURL || "",
    };
  });
  assert.equal(registration.scope, `${origin}/`);
  assert.match(registration.scriptURL, /\/sw\.js$/);

  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shell = keys.find((key) => key.includes("shell"));
    if (!shell) return [];
    const cache = await caches.open(shell);
    const reqs = await cache.keys();
    return reqs.map((request) => new URL(request.url).pathname);
  });
  assert.ok(cached.some((path) => path.endsWith("/offline.html") || path === "/offline.html"));
  assert.ok(cached.some((path) => path.includes("/tools/")));

  await context.close();
});
