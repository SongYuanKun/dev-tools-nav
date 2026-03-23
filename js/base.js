/**
 * 公共基础脚本 - 所有页面共享
 * 包含：页面访问统计（Umami）
 */

// ============================================================
// Umami 兼容数据采集（直接调用 /api/send，无需 document.currentScript）
// ============================================================
(function () {
  const UMAMI_HOST = "https://umami.songyuankun.top";
  const WEBSITE_ID = "99e14cad-6300-4f3c-83d2-b3b71c7d6a25";

  if (localStorage.getItem("umami.disabled")) return;

  const { screen: { width, height }, navigator: { language }, location, document: doc } = window;
  const screen = `${width}x${height}`;

  let cache;
  let currentUrl = location.pathname + location.search;
  let currentRef = document.referrer.startsWith(location.origin) ? "" : document.referrer;

  var MAX_RETRIES = 2;
  var RETRY_DELAY = 1500;

  function send(payload, attempt) {
    attempt = attempt || 0;
    var body = JSON.stringify({ type: "event", payload });
    var headers = { "Content-Type": "application/json" };
    if (cache) headers["x-umami-cache"] = cache;
    fetch(UMAMI_HOST + "/api/send", { method: "POST", body: body, headers: headers, keepalive: true, credentials: "omit" })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d) cache = d.cache; })
      .catch(function () {
        if (attempt < MAX_RETRIES) {
          setTimeout(function () { send(payload, attempt + 1); }, RETRY_DELAY * (attempt + 1));
        }
      });
  }

  function trackPageview() {
    send({ website: WEBSITE_ID, hostname: location.hostname, screen, language, title: doc.title, url: currentUrl, referrer: currentRef });
  }

  // SPA 路由兼容（pushState / replaceState）
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function () { origPush.apply(this, arguments); onNav(); };
  history.replaceState = function () { origReplace.apply(this, arguments); onNav(); };
  function onNav() {
    var prev = currentUrl;
    currentRef = prev;
    currentUrl = location.pathname + location.search;
    if (currentUrl !== prev) setTimeout(trackPageview, 300);
  }

  // 自定义事件追踪（供外部调用 umami.track("event_name", {data})）
  window.umami = {
    track: function (name, data) {
      if (typeof name === "string") {
        send({ website: WEBSITE_ID, hostname: location.hostname, screen, language, title: doc.title, url: currentUrl, referrer: currentRef, name: name, data: data });
      } else {
        trackPageview();
      }
    }
  };

  if (doc.readyState === "complete") {
    trackPageview();
  } else {
    doc.addEventListener("readystatechange", function () {
      if (doc.readyState === "complete") trackPageview();
    });
  }
})();
