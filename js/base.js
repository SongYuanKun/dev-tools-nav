/**
 * 公共基础脚本 - 所有页面共享
 * 包含：统一导航注入、主题切换、页面访问统计（Umami）
 */

// ============================================================
// 统一导航注入 — 保证所有页面 nav 内容一致
// ============================================================
(function () {
  // 根据 canonical URL 的路径深度计算到根目录的相对前缀
  // 使用 canonical 而非当前 URL，确保 GitHub Pages / 自定义域名 / 本地都正确
  function getRootPrefix() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      try {
        var canonPath = new URL(canonical.href).pathname; // 如 /pages/ai/index.html 或 /dev-tools-nav/pages/ai/index.html
        var parts = canonPath.split('/').filter(Boolean);
        // 去掉末尾文件名
        if (parts.length && parts[parts.length - 1].indexOf('.') !== -1) parts.pop();
        // 若 canonical 在 *.github.io 上，第一段是仓库名，不算深度
        var canonHost = new URL(canonical.href).hostname;
        if (canonHost.endsWith('.github.io') && parts.length > 0) parts = parts.slice(1);
        return parts.length === 0 ? '' : parts.map(function () { return '..'; }).join('/') + '/';
      } catch (_) {}
    }
    // 无 canonical 时回退：用当前路径（自定义域名上始终正确）
    var parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length && parts[parts.length - 1].indexOf('.') !== -1) parts.pop();
    return parts.length === 0 ? '' : parts.map(function () { return '..'; }).join('/') + '/';
  }

  // 根据当前路径判断哪个 nav-link 高亮
  function getActiveSection() {
    var p = window.location.pathname.toLowerCase();
    if (p.includes('/pages/ai/'))        return 'ai';
    if (p.includes('/pages/tools/') || p.includes('/tools/')) return 'tools';
    if (p.includes('/pages/blog/'))      return 'blog';
    return 'home';
  }

  function a(href, label, section, active) {
    var cls = active === section
      ? 'class="nav-link active" aria-current="page"'
      : 'class="nav-link"';
    return '<a href="' + href + '" ' + cls + '>' + label + '</a>';
  }

  function buildNav(prefix, active) {
    var aiActive = active === 'ai';
    var aiDropdown = [
      '<details class="nav-menu">',
      '  <summary class="nav-link nav-menu-trigger' + (aiActive ? ' active' : '') + '"',
      '    aria-label="展开 AI 专题子页面导航">AI 专题</summary>',
      '  <div class="nav-menu-panel" aria-label="AI 专题子页面">',
      '    <a href="' + prefix + 'pages/ai/index.html">专题首页<span>学习路径与场景速查</span></a>',
      '    <a href="' + prefix + 'pages/ai/beginner.html">新手入门<span>从概念到第一步</span></a>',
      '    <a href="' + prefix + 'pages/ai/workflow.html">场景工作流<span>写作、编程、办公</span></a>',
      '    <a href="' + prefix + 'pages/ai/prompts.html">Prompt 模板<span>可直接复制使用</span></a>',
      '    <a href="' + prefix + 'pages/ai/compare.html">工具横评<span>按任务选择工具</span></a>',
      '  </div>',
      '</details>'
    ].join('');

    return [
      '<div class="navbar-inner">',
      '  <a href="' + prefix + 'index.html" class="logo" aria-label="Koen 首页">',
      '    <img src="' + prefix + 'assets/logo.svg" alt="K" class="logo-img" />',
      '    <span class="logo-text">Koen</span>',
      '  </a>',
      '  <div class="nav-links">',
      '    ' + a(prefix + 'index.html', '首页', 'home', active),
      '    ' + aiDropdown,
      '    ' + a(prefix + 'pages/tools/index.html', '工具', 'tools', active),
      '    ' + a(prefix + 'pages/blog/index.html', '博客', 'blog', active),
      '  </div>',
      '  <button id="themeToggle" class="theme-toggle"',
      '    aria-label="切换主题" title="切换主题">亮色</button>',
      '</div>'
    ].join('');
  }

  function applyThemeToBtn(btn, theme) {
    if (!btn) return;
    btn.textContent = theme === 'dark' ? '亮色' : '暗色';
    btn.setAttribute('title', theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式');
  }

  function stripDecorativeEmoji(root) {
    if (!root || !document.createTreeWalker) return;
    var emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE)$/i.test(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        emojiPattern.lastIndex = 0;
        return emojiPattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      node.nodeValue = node.nodeValue.replace(emojiPattern, '').replace(/\s{2,}/g, ' ').trim();
    });
  }

  function normalizeToolNav() {
    var labels = {
      'json.html': 'JSON 格式化',
      'timestamp.html': '时间戳',
      'cron.html': 'Cron',
      'base64.html': 'Base64',
      'jwt.html': 'JWT',
      'sql-formatter.html': 'SQL',
      'regex.html': '正则'
    };
    document.querySelectorAll('.tool-nav-item').forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('/').pop();
      if (labels[href]) link.textContent = labels[href];
    });
  }

  function getCurrentSiteLabel() {
    var host = window.location.host || 'tools.songyuankun.top';
    var pathParts = window.location.pathname.split('/').filter(Boolean);
    if (window.location.hostname.endsWith('.github.io') && pathParts.length > 0) {
      return host + '/' + pathParts[0];
    }
    return host;
  }

  function updateCurrentSiteLabels() {
    document.querySelectorAll('[data-current-site]').forEach(function (el) {
      el.textContent = getCurrentSiteLabel();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body) {
      document.body.classList.add('site-v2');
    }

    updateCurrentSiteLabels();

    var nav = document.querySelector('nav.navbar') || document.querySelector('nav.nav');
    if (!nav) return;
    nav.className = 'navbar';

    var prefix = getRootPrefix();
    var active = getActiveSection();
    nav.innerHTML = buildNav(prefix, active);

    // 主题切换绑定（main.js 的 ThemeManager 在首页也会绑定，重复无害）
    var btn = document.getElementById('themeToggle');
    var theme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('dev-tools-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    applyThemeToBtn(btn, theme);

    if (btn) {
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') || 'dark';
        var next = cur === 'dark' ? 'light' : 'dark';
        localStorage.setItem('dev-tools-theme', next);
        document.documentElement.setAttribute('data-theme', next);
        applyThemeToBtn(btn, next);
        if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('theme_toggle', { from: cur, to: next });
        }
        // 同步 main.js ThemeManager（如果存在）
        if (window.ThemeManager) window.ThemeManager.apply(next);
      });
    }

    var aiSubnav = document.querySelector('.ai-subnav-inner');
    if (aiSubnav) {
      var current = window.location.pathname.split('/').pop() || 'index.html';
      var aiLinks = [
        ['index.html', '专题首页'],
        ['beginner.html', '入门'],
        ['workflow.html', '工作流'],
        ['prompts.html', 'Prompt'],
        ['compare.html', '横评']
      ];
      aiSubnav.innerHTML = aiLinks.map(function (item) {
        var cls = item[0] === current ? 'ai-subnav-link ai-subnav-current' : 'ai-subnav-link';
        return '<a href="' + item[0] + '" class="' + cls + '">' + item[1] + '</a>';
      }).join('');
    }

    normalizeToolNav();
    stripDecorativeEmoji(document.body);
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
  function getAnalyticsUrl() {
    return location.pathname || "/";
  }

  let currentUrl = getAnalyticsUrl();
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
    currentUrl = getAnalyticsUrl();
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

// ==================== Umami 自定义事件 helper ====================
(function () {
  var scripts = document.getElementsByTagName('script');
  var i = scripts.length;
  var baseJs = '';
  while (i--) {
    var src = scripts[i].src || '';
    if (src.indexOf('/js/base.js') !== -1) {
      baseJs = src;
      break;
    }
  }
  var helperSrc = baseJs
    ? baseJs.replace(/\/js\/base\.js(?:\?.*)?$/, '/js/umami-helper.js')
    : 'js/umami-helper.js';

  var helper = document.createElement('script');
  helper.defer = true;
  helper.src = helperSrc;
  document.head.appendChild(helper);
})();
