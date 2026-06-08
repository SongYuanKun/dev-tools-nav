/**
 * dev-tools-nav — Umami 自定义事件埋点
 * 零依赖，事件委托模式，全站通用
 * 事件名对齐 docs/umami-integration-spec.md
 * 注意：umami 对象由 base.js 内联定义，无需等待加载
 */
(function () {
  'use strict';

  function track(name, props) {
    try {
      if (typeof window.umamiTrack === 'function') {
        window.umamiTrack(name, props);
      } else if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
        umami.track(name, props);
      }
    } catch (_) {}
  }

  // 声明式埋点：data-umami-event="事件名" data-umami-event-foo="bar"
  var EVENT_ATTR = /^data-umami-event-([\w-_]+)/;

  function trackDeclarative(el) {
    var name = attr(el, 'data-umami-event');
    if (!name) return;
    var props = {};
    el.getAttributeNames().forEach(function (key) {
      var m = key.match(EVENT_ATTR);
      if (m) props[m[1]] = el.getAttribute(key);
    });
    track(name, props);
  }

  function attr(el, name) {
    if (!el) return '';
    return el.getAttribute(name) || '';
  }

  function isExternal(href) {
    return href.startsWith('http') && href.indexOf(location.hostname) === -1;
  }

  function linkText(link) {
    return (link.textContent || '').trim().slice(0, 50);
  }

  function pageSlug() {
    var parts = location.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : 'index';
  }

  function v2ToolCategory(card) {
    if (!card) return '';
    var cls = card.className || '';
    if (cls.indexOf('v2-tool-time') !== -1) return 'time';
    if (cls.indexOf('v2-tool-encode') !== -1) return 'encode';
    if (cls.indexOf('v2-tool-match') !== -1) return 'regex';
    if (cls.indexOf('v2-tool-jwt') !== -1) return 'auth';
    if (cls.indexOf('v2-tool-format') !== -1 || cls.indexOf('v2-tool-sql') !== -1) return 'data';
    return '';
  }

  function toolNameFromCard(card, fallback) {
    if (!card) return fallback;
    var nameEl = card.querySelector('strong, .tools-card-name, h3');
    return ((nameEl && nameEl.textContent) || fallback || '').trim().slice(0, 50);
  }

  // 点击埋点
  document.addEventListener('click', function (e) {
    // 声明式：data-umami-event
    var declarative = e.target.closest('[data-umami-event]');
    if (declarative) {
      trackDeclarative(declarative);
      return;
    }

    // CTA：首页 Hero、博客订阅、支持作者
    var ctaBtn = e.target.closest('.v2-btn');
    if (ctaBtn) {
      track('cta_action', {
        action: ctaBtn.classList.contains('v2-btn-primary') ? 'start_tools' : 'browse_ai',
        target: attr(ctaBtn, 'href') || linkText(ctaBtn)
      });
      return;
    }

    var subscribeLink = e.target.closest('.blog-subscribe-link');
    if (subscribeLink) {
      track('cta_action', {
        action: 'follow_platform',
        target: attr(subscribeLink, 'href').slice(0, 200)
      });
      return;
    }

    if (e.target.closest('.footer-support-summary')) {
      track('cta_action', { action: 'support_open', target: 'footer' });
      return;
    }

    var sponsorBtn = e.target.closest('[data-sponsor-modal]');
    if (sponsorBtn) {
      track('cta_action', {
        action: 'support_qr',
        target: attr(sponsorBtn, 'data-sponsor-title') || 'sponsor'
      });
      return;
    }

    // 复制按钮（扩展事件，规范外）
    var copyBtn = e.target.closest('.copy-btn, .workflow-prompt-copy');
    if (copyBtn) {
      track('copy_click', {
        page: pageSlug(),
        label: (copyBtn.textContent || '').trim().slice(0, 30)
      });
      return;
    }

    // AI 速查筛选（扩展事件）
    var lookupFilter = e.target.closest('.ai-lookup-filter');
    if (lookupFilter) {
      track('ai_filter', { scene: attr(lookupFilter, 'data-lookup-filter') });
      return;
    }

    // 分类 Tab / 筛选（规范：category_click）
    var catBtn = e.target.closest('.blog-cat-btn, .ai-quick-nav-btn[data-category], .category-btn');
    if (catBtn) {
      track('category_click', {
        category: attr(catBtn, 'data-category') || (catBtn.textContent || '').trim().slice(0, 30)
      });
      return;
    }

    var link = e.target.closest('a');
    if (!link) return;

    var href = attr(link, 'href') || '';
    var text = linkText(link);

    // 博客文章（扩展事件）
    if (link.closest('.blog-card')) {
      track('article_click', {
        title: text.slice(0, 80),
        external: isExternal(href),
        url: href.slice(0, 200)
      });
      return;
    }

    // AI 学习路径（扩展事件）
    if (link.closest('.ai-learn-step')) {
      track('ai_path_click', { step: text.slice(0, 50), page: href });
      return;
    }

    // AI 专题卡片（扩展事件）
    if (link.closest('.ai-topic-card, .ai-role-quick-card, .ai-lookup-tool-chip, .v2-card-interactive')) {
      track('ai_nav_click', { label: text, page: href.slice(0, 200) });
      return;
    }

    // 工具卡片（规范：tool_click）
    if (link.closest('.v2-tool-card, .tool-index-card')) {
      var hubCard = link.closest('.v2-tool-card, .tool-index-card');
      track('tool_click', {
        name: toolNameFromCard(hubCard, text),
        category: v2ToolCategory(hubCard)
      });
      return;
    }

    // 分类 Tab 链接（旧版首页）
    if (link.closest('.category-tabs, .tab-nav, [data-category]')) {
      var catEl = link.closest('[data-category]');
      track('category_click', {
        category: attr(catEl, 'data-category') || text
      });
      return;
    }

    // main.js 已精细上报，避免重复
    if (link.hasAttribute('data-tool-id')) return;

    // 旧版工具卡片
    var card = link.closest('.tool-card, .tool-item, .resource-item');
    if (card) {
      var catParent = card.closest('[data-category]');
      track('tool_click', {
        name: toolNameFromCard(card, text),
        category: attr(card, 'data-category') || attr(catParent, 'data-category') || ''
      });
      return;
    }

    // 外部链接（规范）
    if (isExternal(href)) {
      track('external_link', { url: href.slice(0, 200), label: text });
      return;
    }

    // 站内导航（规范）
    if (link.closest('nav, .navbar, .sidebar, .header, .menu, .footer-links, .ai-subnav-inner')) {
      track('nav_click', { page: href, label: text });
    }
  });

  // 滚动深度（25/50/75/100%）
  var scrollMarks = [25, 50, 75, 100];
  var scrollFired = {};
  var pageStart = Date.now();

  window.addEventListener('scroll', function () {
    var doc = document.documentElement;
    var max = Math.max(doc.scrollHeight - window.innerHeight, 1);
    var pct = Math.round((window.scrollY / max) * 100);
    scrollMarks.forEach(function (mark) {
      if (!scrollFired[mark] && pct >= mark) {
        scrollFired[mark] = true;
        track('scroll_depth', { depth: mark });
      }
    });
  }, { passive: true });

  window.addEventListener('pagehide', function () {
    track('page_exit', { duration: Date.now() - pageStart });
  });

  // 搜索（规范：search_use；toolsSearch / searchInput 由业务脚本带 results 上报）
  var searchTimers = new WeakMap();
  document.addEventListener('input', function (e) {
    var input = e.target;
    if (input.id === 'searchInput' || input.id === 'toolsSearch') return;
    if (!input.matches('input[type="search"], input[placeholder*="搜索"], input[placeholder*="Search"]')) {
      return;
    }
    clearTimeout(searchTimers.get(input));
    searchTimers.set(input, setTimeout(function () {
      var q = input.value.trim();
      if (q.length < 2) return;
      track('search_use', { query: q.slice(0, 100), results: 0 });
    }, 400));
  });
})();
