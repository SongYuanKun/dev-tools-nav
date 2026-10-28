/* Koen's 工具箱 Service Worker
 * - 自建工具与静态壳：cache-first，便于离线使用
 * - 博客 / CSDN / Feed / 更新数据：network-first，避免陈旧内容
 * - 通过 registration.scope 自动适配 GitHub Pages 子路径与 1Panel 根路径
 */
/* eslint-disable no-restricted-globals */
/* VERSION / asset ?v= are stamped at publish with scripts/stamp-asset-version.mjs */
const VERSION = "pwa-__ASSET_VERSION__";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SELF_BUILT_SLUGS = [
  "base64",
  "color",
  "cron",
  "diff",
  "hash",
  "json",
  "jwt",
  "qrcode",
  "regex",
  "sql-formatter",
  "timestamp",
  "url-encode",
  "uuid",
];

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/style.css?v=__ASSET_VERSION__",
  "./css/tools.css?v=__ASSET_VERSION__",
  "./css/json-workbench.css?v=__ASSET_VERSION__",
  "./js/base.js?v=__ASSET_VERSION__",
  "./js/footer.js?v=__ASSET_VERSION__",
  "./js/theme-mini.js?v=__ASSET_VERSION__",
  "./js/toast.js?v=__ASSET_VERSION__",
  "./js/tools-prefs.js?v=__ASSET_VERSION__",
  "./js/tools-hub.js?v=__ASSET_VERSION__",
  "./js/tools-shell.js?v=__ASSET_VERSION__",
  "./js/tool-chrome.js?v=__ASSET_VERSION__",
  "./js/json-workbench.bundle.js?v=__ASSET_VERSION__",
  "./js/encoding-tool.js?v=__ASSET_VERSION__",
  "./js/color-tool.js?v=__ASSET_VERSION__",
  "./js/cron-tool.js?v=__ASSET_VERSION__",
  "./js/diff-tool.js?v=__ASSET_VERSION__",
  "./js/hash-tool.js?v=__ASSET_VERSION__",
  "./js/jwt-tool.js?v=__ASSET_VERSION__",
  "./js/qrcode-tool.bundle.js?v=__ASSET_VERSION__",
  "./js/regex-tool.js?v=__ASSET_VERSION__",
  "./js/sql-tool.js?v=__ASSET_VERSION__",
  "./js/timestamp-tool.js?v=__ASSET_VERSION__",
  "./js/url-tool.js?v=__ASSET_VERSION__",
  "./js/uuid-tool.js?v=__ASSET_VERSION__",
  "./data/tools.js?v=__ASSET_VERSION__",
  "./assets/logo.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./tools/",
  "./tools/index.html",
  "./pages/tools/index.html",
].concat(SELF_BUILT_SLUGS.reduce(function (list, slug) {
  list.push("./tools/" + slug + "/");
  list.push("./tools/" + slug + "/index.html");
  list.push("./pages/tools/" + slug + ".html");
  return list;
}, []));

function toURL(request) {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
}

function sameOrigin(url) {
  return url && url.origin === self.location.origin;
}

function isFreshContent(url) {
  const path = url.pathname;
  return (
    /\/data\/(csdn-articles|articles|blog-posts|blog-manifest|updates|open-source-radar)\.(json|js)$/.test(path)
    || /\/feed\.xml$/.test(path)
    || /\/sitemap\.xml$/.test(path)
    || /\/pages\/blog\//.test(path)
    || /\/content\//.test(path)
  );
}

function isToolAsset(url) {
  const path = url.pathname;
  return (
    /\/tools\//.test(path)
    || /\/pages\/tools\//.test(path)
    || /\/js\//.test(path)
    || /\/css\//.test(path)
    || /\/assets\//.test(path)
    || /\/data\/tools\.js$/.test(path)
    || /\/manifest\.webmanifest$/.test(path)
  );
}

async function putCache(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (_) {}
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    await putCache(RUNTIME_CACHE, request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await putCache(RUNTIME_CACHE, request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await caches.match("./offline.html");
      if (offline) return offline;
    }
    throw _;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(
      PRECACHE_URLS.map(async (path) => {
        try {
          const request = new Request(new URL(path, self.registration.scope));
          const response = await fetch(request);
          if (response && response.ok) await cache.put(request, response);
        } catch (_) {}
      }),
    );
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("pwa-") && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = toURL(request);
  if (!sameOrigin(url)) return;

  // 勿拦截分析与跨源请求
  if (url.hostname !== self.location.hostname) return;

  if (isFreshContent(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await putCache(RUNTIME_CACHE, request, response.clone());
        }
        return response;
      } catch (_) {
        const cached = await caches.match(request);
        if (cached) return cached;
        // 优先回退到工具中心，便于离线继续用自建工具
        const tools = await caches.match(new URL("./tools/", self.registration.scope));
        if (tools) return tools;
        const offline = await caches.match(new URL("./offline.html", self.registration.scope));
        if (offline) return offline;
        throw _;
      }
    })());
    return;
  }

  if (isToolAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
