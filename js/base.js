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
        if (typeof window.umamiTrack === 'function') {
          window.umamiTrack('theme_toggle', { from: cur, to: next });
        }
        if (window.umami && typeof window.umami.identify === 'function') {
          window.umami.identify({ 主题: next });
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
// Umami 数据采集（对齐官方 tracker：identify / performance / tag）
// ============================================================
(function () {
  var UMAMI_HOST = "https://umami.songyuankun.top";
  var WEBSITE_ID = "99e14cad-6300-4f3c-83d2-b3b71c7d6a25";
  var VISITOR_KEY = "umami.visitor-id";
  var SINCE_KEY = "umami.visitor-since";
  var NAV_DELAY = 300;
  var MAX_RETRIES = 2;
  var RETRY_DELAY = 1500;

  function dntEnabled() {
    var v = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return v === "1" || v === "yes";
  }

  try {
    if (localStorage.getItem("umami.disabled") || dntEnabled()) return;
  } catch (_) {
    if (dntEnabled()) return;
  }

  var scr = window.screen || { width: 0, height: 0 };
  var screen = scr.width + "x" + scr.height;
  var language = navigator.language || "";
  var location = window.location;
  var doc = document;

  var cache;
  var distinctId;
  var currentUrl = normalizeUrl(location.pathname + location.search);
  var currentRef = normalizeRef(document.referrer);
  var pageTag = detectPageTag();
  var onPerfPageHide;

  function detectPageTag() {
    var p = location.pathname.toLowerCase();
    if (p.indexOf("/pages/ai/") !== -1) return "ai";
    if (p.indexOf("/pages/tools/") !== -1 || p.indexOf("/tools/") !== -1) return "tools";
    if (p.indexOf("/pages/blog/") !== -1) return "blog";
    return "home";
  }

  function normalizeUrl(url) {
    if (!url) return url;
    try {
      var u = new URL(url, location.origin);
      u.search = "";
      u.hash = "";
      return u.pathname;
    } catch (_) {
      return url.split("?")[0].split("#")[0];
    }
  }

  function normalizeRef(ref) {
    if (!ref) return "";
    try {
      if (new URL(ref).origin === location.origin) return "";
    } catch (_) {}
    return ref;
  }

  var isNewVisitor = false;

  function getOrCreateVisitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      isNewVisitor = !id;
      if (!id) {
        id = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(VISITOR_KEY, id);
        localStorage.setItem(SINCE_KEY, new Date().toISOString().slice(0, 10));
      }
      return id;
    } catch (_) {
      return null;
    }
  }

  function buildSessionData() {
    var theme = "dark";
    var since = "";
    try {
      theme = document.documentElement.getAttribute("data-theme") || localStorage.getItem("dev-tools-theme") || "dark";
      since = localStorage.getItem(SINCE_KEY) || "";
    } catch (_) {}
    return {
      主题: theme,
      区域: pageTag,
      回访: isNewVisitor ? "否" : "是",
      首访: since,
      嵌入: document.documentElement.classList.contains("is-embed") ? "是" : "否"
    };
  }

  function basePayload() {
    return {
      website: WEBSITE_ID,
      hostname: location.hostname,
      screen: screen,
      language: language,
      title: doc.title,
      url: currentUrl,
      referrer: currentRef,
      tag: pageTag,
      id: distinctId || undefined
    };
  }

  function beforeSend(type, payload) {
    if (typeof window.umamiBeforeSend !== "function") return payload;
    try {
      var next = window.umamiBeforeSend(type, payload);
      return next || null;
    } catch (_) {
      return payload;
    }
  }

  function send(payload, type, attempt) {
    type = type || "event";
    attempt = attempt || 0;
    payload = beforeSend(type, payload);
    if (!payload) return;

    var headers = { "Content-Type": "application/json" };
    if (cache) headers["x-umami-cache"] = cache;

    fetch(UMAMI_HOST + "/api/send", {
      method: "POST",
      body: JSON.stringify({ type: type, payload: payload }),
      headers: headers,
      keepalive: true,
      credentials: "omit"
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.cache) cache = d.cache;
        if (d && d.disabled) cache = "";
      })
      .catch(function () {
        if (attempt < MAX_RETRIES) {
          setTimeout(function () { send(payload, type, attempt + 1); }, RETRY_DELAY * (attempt + 1));
        }
      });
  }

  function trackPageview() {
    send(basePayload(), "event");
  }

  function sendEvent(name, data) {
    // 已由 umamiTrack 中文化（含 描述 字段）
    if (data && data.描述) {
      var ready = basePayload();
      ready.name = name;
      ready.data = data;
      send(ready, "event");
      return;
    }
    // 优先走中文事件名映射
    if (typeof window.umamiTrack === "function") {
      window.umamiTrack(name, data);
      return;
    }
    var props = data;
    if (window.umamiEnrich) props = window.umamiEnrich(name, data);
    var payload = basePayload();
    payload.name = name;
    payload.data = props;
    send(payload, "event");
  }

  function identify(idOrData, data) {
    if (typeof idOrData === "string") {
      distinctId = idOrData;
      try { localStorage.setItem(VISITOR_KEY, idOrData); } catch (_) {}
    } else {
      data = idOrData;
    }
    cache = "";
    var payload = basePayload();
    payload.data = data || {};
    send(payload, "identify");
  }

  distinctId = getOrCreateVisitorId();

  // SPA 路由兼容
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function () { origPush.apply(this, arguments); onNav(); };
  history.replaceState = function () { origReplace.apply(this, arguments); onNav(); };
  window.addEventListener("popstate", onNav);

  function onNav() {
    if (onPerfPageHide) onPerfPageHide();
    var prev = currentUrl;
    currentRef = prev;
    currentUrl = normalizeUrl(location.pathname + location.search);
    pageTag = detectPageTag();
    if (currentUrl !== prev) setTimeout(trackPageview, NAV_DELAY);
  }

  window.umami = {
    _rawTrack: function (name, data) {
      sendEvent(name, data);
    },
    track: function (name, data) {
      if (typeof name === "string") {
        if (typeof window.umamiTrack === "function") {
          window.umamiTrack(name, data);
        } else {
          sendEvent(name, data);
        }
      } else if (typeof name === "function") {
        send(name(basePayload()), "event");
      } else if (name && typeof name === "object") {
        send(Object.assign({}, basePayload(), name), "event");
      } else {
        trackPageview();
      }
    },
    identify: identify,
    getSession: function () {
      return { cache: cache, website: WEBSITE_ID, id: distinctId };
    }
  };

  function startTracking() {
    identify(distinctId, buildSessionData());
    trackPageview();
    initPerformance();
  }

  if (doc.readyState === "complete") {
    startTracking();
  } else {
    doc.addEventListener("readystatechange", function () {
      if (doc.readyState === "complete") startTracking();
    });
  }

  // JS 错误 + 未捕获 Promise 拒绝
  window.addEventListener("error", function (e) {
    sendEvent("js_error", {
      message: e.message,
      source: (e.filename || "").split("/").pop(),
      line: e.lineno
    });
  });
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e.reason;
    sendEvent("js_error", {
      message: reason && reason.message ? reason.message : String(reason),
      source: "promise",
      line: 0
    });
  });

  // Core Web Vitals — type: performance，在 Umami Performance 面板展示
  function initPerformance() {
    if (!window.PerformanceObserver) return;

    var metrics = {};
    var sent = false;
    var timer;
    var activationStart = 0;
    var clsScore = 0;
    var clsEntries = [];
    var pageStart = performance.now();

    function observe(type, onEntry) {
      try {
        new PerformanceObserver(function (list) {
          list.getEntries().forEach(onEntry);
        }).observe({ type: type, buffered: true });
      } catch (_) {}
    }

    observe("navigation", function (e) {
      activationStart = e.activationStart || 0;
      metrics.ttfb = Math.max(e.responseStart - activationStart, 0);
    });
    observe("paint", function (e) {
      if (e.name === "first-contentful-paint") {
        metrics.fcp = Math.max(e.startTime - activationStart, 0);
      }
    });
    observe("largest-contentful-paint", function (e) {
      metrics.lcp = Math.max(e.startTime - activationStart, 0);
    });
    observe("layout-shift", function (e) {
      if (e.hadRecentInput) return;
      var last = clsEntries[clsEntries.length - 1];
      var first = clsEntries[0];
      if (last && e.startTime - last.startTime - last.duration < 1000 && e.startTime - first.startTime < 5000) {
        clsScore += e.value;
        clsEntries.push(e);
      } else {
        clsScore = e.value;
        clsEntries = [e];
      }
      if (clsScore > (metrics.cls || 0)) metrics.cls = clsScore;
    });

    try {
      var interactions = {};
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          if (!e.interactionId) return;
          var prev = interactions[e.interactionId];
          if (!prev || e.duration > prev) interactions[e.interactionId] = e.duration;
          var sorted = Object.values(interactions).sort(function (a, b) { return b - a; });
          if (sorted.length) {
            var idx = Math.floor(0.02 * Math.max(sorted.length, 10));
            metrics.inp = sorted[Math.min(idx, sorted.length - 1)];
          }
        });
      }).observe({ type: "event", buffered: true, durationThreshold: 40 });
    } catch (_) {}

    function flushPerformance() {
      if (sent) return;
      sent = true;
      if (timer) clearTimeout(timer);
      metrics.duration = Math.round(performance.now() - pageStart);
      var payload = basePayload();
      Object.keys(metrics).forEach(function (k) { payload[k] = metrics[k]; });
      send(payload, "performance");
    }

    function resetPerformance() {
      flushPerformance();
      sent = false;
      metrics = {};
      clsScore = 0;
      clsEntries = [];
      activationStart = 0;
      pageStart = performance.now();
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushPerformance, 10000);
    }

    onPerfPageHide = resetPerformance;
    timer = setTimeout(flushPerformance, 10000);
    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState === "hidden") flushPerformance();
    });
    window.addEventListener("pagehide", flushPerformance);
  }
})();

// ==================== Umami 中文描述 + 自定义事件 helper ====================
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
  var root = baseJs
    ? baseJs.replace(/\/js\/base\.js(?:\?.*)?$/, '/js/')
    : 'js/';

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = src;
    s.onload = function () { if (cb) cb(); };
    document.head.appendChild(s);
  }

  // 先加载中文描述，再加载事件委托，最后加载全站彩蛋
  loadScript(root + 'umami-labels.js', function () {
    loadScript(root + 'umami-helper.js', function () {
      loadScript(root + 'easter-egg.js');
    });
  });
})();
