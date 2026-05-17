/**
 * 公共基础脚本 - 所有页面共享
 * 包含：统一导航注入、主题切换、页面访问统计（Umami）
 */

// ============================================================
// 统一导航注入 — 保证所有页面 nav 内容一致
// ============================================================
(function () {
  // 根据当前 URL 路径计算到根目录的相对前缀
  function getRootPrefix() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    // 去掉末尾的文件名
    if (parts.length && parts[parts.length - 1].indexOf('.') !== -1) parts.pop();
    // GitHub Pages 下第一段是仓库名（如 /dev-tools-nav/...），不算路径深度
    if (window.location.hostname.endsWith('.github.io') && parts.length > 0) parts = parts.slice(1);
    return parts.length === 0 ? '' : parts.map(function () { return '..'; }).join('/') + '/';
  }

  // 根据当前路径判断哪个 nav-link 高亮
  function getActiveSection() {
    var p = window.location.pathname.toLowerCase();
    if (p.includes('/pages/ai/'))        return 'ai';
    if (p.includes('/pages/tools/'))     return 'tools';
    if (p.includes('/pages/blog/'))      return 'blog';
    if (p.includes('/pages/portfolio'))  return 'portfolio';
    if (p.includes('/pages/about'))      return 'about';
    return 'home';
  }

  function a(href, label, section, active) {
    var cls = active === section
      ? 'class="nav-link active" aria-current="page"'
      : 'class="nav-link"';
    return '<a href="' + href + '" ' + cls + '>' + label + '</a>';
  }

  function buildNav(prefix, active) {
    var isHome = active === 'home';

    // 搜索框仅在首页显示（main.js 负责绑定逻辑）
    var search = isHome ? [
      '<div class="search-wrapper" role="search">',
      '  <span class="search-icon" aria-hidden="true">🔍</span>',
      '  <input type="search" id="searchInput" class="search-input"',
      '    placeholder="搜索工具名称、描述、标签…（按 / 聚焦）"',
      '    aria-label="搜索工具" autocomplete="off" spellcheck="false" />',
      '</div>'
    ].join('') : '';

    var aiActive = active === 'ai';
    var aiDropdown = [
      '<details class="nav-menu"' + (aiActive ? ' open' : '') + '>',
      '  <summary class="nav-link nav-menu-trigger' + (aiActive ? ' active' : '') + '"',
      '    aria-label="展开 AI 专题子页面导航">🤖 AI 专题</summary>',
      '  <div class="nav-menu-panel" aria-label="AI 专题子页面">',
      '    <a href="' + prefix + 'pages/ai/index.html">专题首页<span>学习路径与场景速查</span></a>',
      '    <a href="' + prefix + 'pages/ai/beginner.html">新手入门<span>从概念到第一步</span></a>',
      '    <a href="' + prefix + 'pages/ai/workflow.html">场景工作流<span>写作、编程、办公</span></a>',
      '    <a href="' + prefix + 'pages/ai/prompts.html">Prompt 模板<span>可直接复制使用</span></a>',
      '    <a href="' + prefix + 'pages/ai/compare.html">工具横评<span>按任务选择工具</span></a>',
      '    <a href="' + prefix + 'pages/ai/glossary.html">术语词典<span>模型、Token、RAG</span></a>',
      '    <a href="' + prefix + 'pages/ai/safety.html">隐私安全<span>数据与账号风险</span></a>',
      '    <a href="' + prefix + 'pages/ai/dev-api.html">开发者 API<span>网页、API、IDE 助手</span></a>',
      '  </div>',
      '</details>'
    ].join('');

    return [
      '<div class="navbar-inner">',
      '  <a href="' + prefix + 'index.html" class="logo" aria-label="Koen的工具箱 首页">',
      '    <img src="' + prefix + 'assets/logo.svg" alt="K" class="logo-img" />',
      '    <span class="logo-text">Koen<span>\'s</span> 工具箱</span>',
      '  </a>',
      search,
      '  <div class="nav-links">',
      '    ' + a(prefix + 'index.html', '工具导航', 'home', active),
      '    ' + aiDropdown,
      '    ' + a(prefix + 'pages/tools/index.html', '在线工具', 'tools', active),
      '    ' + a(prefix + 'pages/blog/index.html', '技术博客', 'blog', active),
      '    ' + a(prefix + 'pages/portfolio.html', '作品集', 'portfolio', active),
      '    ' + a(prefix + 'pages/about.html', '关于我', 'about', active),
      '  </div>',
      '  <button id="themeToggle" class="theme-toggle"',
      '    aria-label="切换暗色模式" title="切换暗色模式">🌙</button>',
      '</div>'
    ].join('');
  }

  function applyThemeToBtn(btn, theme) {
    if (!btn) return;
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('title', theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('nav.navbar');
    if (!nav) return;

    var prefix = getRootPrefix();
    var active = getActiveSection();
    nav.innerHTML = buildNav(prefix, active);

    // 主题切换绑定（main.js 的 ThemeManager 在首页也会绑定，重复无害）
    var btn = document.getElementById('themeToggle');
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    applyThemeToBtn(btn, theme);

    if (btn) {
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') || 'light';
        var next = cur === 'dark' ? 'light' : 'dark';
        localStorage.setItem('dev-tools-theme', next);
        document.documentElement.setAttribute('data-theme', next);
        applyThemeToBtn(btn, next);
        // 同步 main.js ThemeManager（如果存在）
        if (window.ThemeManager) window.ThemeManager.apply(next);
      });
    }
  });
})();

// ============================================================
// 嵌入模式：在线工具被详情页 iframe 调用时，隐藏站点级外壳
// ============================================================
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get("embed") === "1") {
      document.documentElement.classList.add("is-embed");
    }
  } catch (_) {}
})();

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

  // JS 错误追踪
  window.addEventListener("error", function (e) {
    send({ website: WEBSITE_ID, hostname: location.hostname, screen: screen, language: language, title: doc.title, url: currentUrl, referrer: currentRef, name: "js_error", data: { message: e.message, source: (e.filename || "").split("/").pop(), line: e.lineno } });
  });

  // LCP 性能采集
  if ("PerformanceObserver" in window) {
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var last = entries[entries.length - 1];
        if (last) send({ website: WEBSITE_ID, hostname: location.hostname, screen: screen, language: language, title: doc.title, url: currentUrl, referrer: currentRef, name: "perf_lcp", data: { value: Math.round(last.startTime) } });
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (_) {}
  }
})();
