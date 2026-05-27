(function () {
  function getRootPrefix() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      try {
        var url = new URL(canonical.href);
        var parts = url.pathname.split('/').filter(Boolean);
        if (parts.length && parts[parts.length - 1].indexOf('.') !== -1) parts.pop();
        if (url.hostname.endsWith('.github.io') && parts.length > 0) parts = parts.slice(1);
        return parts.length === 0 ? '' : parts.map(function () { return '..'; }).join('/') + '/';
      } catch (_) {}
    }

    var parts = window.location.pathname.split('/').filter(Boolean);
    if (window.location.hostname.endsWith('.github.io') && parts.length > 0) parts = parts.slice(1);
    if (parts.length && parts[parts.length - 1].indexOf('.') !== -1) parts.pop();
    return parts.length === 0 ? '' : parts.map(function () { return '..'; }).join('/') + '/';
  }

  function localLink(prefix, path) {
    return prefix + path;
  }

  function normalizeFooter() {
    var footer = document.querySelector('footer.footer');
    if (!footer) return;

    var prefix = getRootPrefix();
    var currentYear = new Date().getFullYear();
    var logo = localLink(prefix, 'assets/logo.svg');
    var wechatQr = localLink(prefix, 'assets/sponsor-wechat-card.jpg');
    var alipayQr = localLink(prefix, 'assets/sponsor-alipay-card.jpg');

    footer.setAttribute('data-unified-footer', 'true');
    footer.innerHTML = [
      '<div class="footer-content">',
      '  <div class="footer-main">',
      '    <a class="footer-brand" href="' + localLink(prefix, 'index.html') + '" aria-label="回到 Koen Tools 首页">',
      '      <img src="' + logo + '" alt="" class="footer-logo" loading="lazy">',
      '      <span class="footer-brand-name">Koen Tools</span>',
      '    </a>',
      '    <nav class="footer-links" aria-label="页脚导航">',
      '      <a href="' + localLink(prefix, 'index.html') + '">首页</a>',
      '      <span class="footer-divider">/</span>',
      '      <a href="' + localLink(prefix, 'pages/ai/index.html') + '">AI 专题</a>',
      '      <span class="footer-divider">/</span>',
      '      <a href="' + localLink(prefix, 'pages/tools/index.html') + '">工具</a>',
      '      <span class="footer-divider">/</span>',
      '      <a href="' + localLink(prefix, 'pages/blog/index.html') + '">博客</a>',
      '      <span class="footer-divider">/</span>',
      '      <a href="https://songyuankun.github.io/dev-tools-nav/" target="_blank" rel="noopener">备用入口</a>',
      '      <span class="footer-divider">/</span>',
      '      <a href="https://koen.songyuankun.top" target="_blank" rel="noopener">个人页</a>',
      '      <span class="footer-divider">/</span>',
      '      <a href="https://github.com/SongYuanKun/dev-tools-nav" target="_blank" rel="noopener">GitHub</a>',
      '      <span class="footer-divider">/</span>',
      '      <a href="https://blog.csdn.net/syk123839070" target="_blank" rel="noopener">CSDN</a>',
      '    </nav>',
      '  </div>',
      '  <details class="footer-support">',
      '    <summary class="footer-support-summary">',
      '      <span>支持作者</span>',
      '      <span class="footer-support-hint">微信 / 支付宝</span>',
      '    </summary>',
      '    <div class="footer-support-body">',
      '      <div class="footer-support-intro">',
      '        <span class="footer-support-kicker">Koen Tools</span>',
      '        <p class="footer-support-copy">如果这些工具帮到了你，可以请 Koen 喝杯咖啡。</p>',
      '      </div>',
      '      <div class="footer-qr-grid" aria-label="作者收款码">',
      '        <figure class="footer-qr-card footer-qr-card-wechat">',
      '          <span class="footer-qr-badge">微信</span>',
      '          <a class="footer-qr-link" href="' + wechatQr + '" target="_blank" rel="noopener" aria-label="打开微信收款码大图">',
      '            <img src="' + wechatQr + '" alt="微信收款码" loading="lazy">',
      '          </a>',
      '          <figcaption>微信支付</figcaption>',
      '        </figure>',
      '        <figure class="footer-qr-card footer-qr-card-alipay">',
      '          <span class="footer-qr-badge">支付宝</span>',
      '          <a class="footer-qr-link" href="' + alipayQr + '" target="_blank" rel="noopener" aria-label="打开支付宝收款码大图">',
      '            <img src="' + alipayQr + '" alt="支付宝收款码" loading="lazy">',
      '          </a>',
      '          <figcaption>支付宝</figcaption>',
      '        </figure>',
      '      </div>',
      '    </div>',
      '  </details>',
      '  <p class="footer-copyright">Made with code by Koen · © 2024-' + currentYear + '</p>',
      '</div>'
    ].join('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeFooter);
  } else {
    normalizeFooter();
  }
})();
