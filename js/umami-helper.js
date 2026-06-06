/**
 * dev-tools-nav — Umami 自定义事件埋点
 * 零依赖，事件委托模式
 * 注意：umami 对象由 base.js 内联定义，无需等待加载
 */
(function () {
  'use strict';

  function track(name, props) {
    try {
      if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
        umami.track(name, props);
        console.log('[Umami] tracked:', name, props);
      } else {
        console.warn('[Umami] umami.track not available');
      }
    } catch (e) {
      console.error('[Umami] track error:', e);
    }
  }

  function attr(el, name) {
    if (!el) return '';
    return el.getAttribute(name) || '';
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;

    var href = attr(link, 'href') || '';
    var text = link.textContent.trim().slice(0, 50);

    // 分类 Tab 点击
    var catLink = link.closest('.category-tabs, .tab-nav, [data-category]');
    if (catLink) {
      track('category_click', { category: text });
      return;
    }

    // 外部链接
    if (href.startsWith('http') && !href.includes(location.hostname)) {
      track('external_link', { url: href.slice(0, 200), label: text });
      return;
    }

    // 站内导航
    if (link.closest('nav, .navbar, .sidebar, .header, .menu')) {
      track('nav_click', { page: href, label: text });
      return;
    }

    // 工具/卡片链接
    var card = link.closest('.card, .tool-card, .tool-item, .resource-item, [class*="card"], [class*="item"]');
    if (card) {
      var catParent = card.closest('[data-category]');
      track('tool_click', {
        name: text,
        category: card.getAttribute('data-category') || (catParent ? catParent.getAttribute('data-category') : '') || ''
      });
    }
  });

  // 搜索使用
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var input = e.target.closest('input[type="search"], input[placeholder*="搜索"], input[placeholder*="Search"]');
      if (input) {
        track('search_use', { query: input.value.trim().slice(0, 100), results: 0 });
      }
    }
  });

  // 主题切换
  document.addEventListener('click', function (e) {
    if (e.target.closest('#themeToggle, [data-theme-toggle], .theme-switch')) {
      var current = document.documentElement.getAttribute('data-theme') || 'dark';
      var next = current === 'dark' ? 'light' : 'dark';
      track('theme_toggle', { from: current, to: next });
    }
  });
})();
