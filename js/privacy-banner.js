/**
 * OP-303：隐私横幅关闭逻辑（记忆 记忆，localStorage 记忆 30 天）
 */
(function () {
  var KEY = 'privacy_banner_closed_v1';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000;

  function track(label) {
    try {
      if (typeof window.umami === 'object' && typeof window.umami.track === 'function') {
        window.umami.track(label, { op: 'OP-303' });
      }
    } catch (_) {}
  }

  function isClosed() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj.at !== 'number') return false;
      return Date.now() - obj.at < TTL_MS;
    } catch (_) { return false; }
  }

  function setClosed() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, at: Date.now() })); } catch (_) {}
  }

  function init() {
    var banner = document.getElementById('privacyBanner');
    var btn = document.getElementById('privacyBannerClose');
    if (!banner) return;
    if (isClosed()) {
      try { banner.parentNode.removeChild(banner); } catch (_) {}
      return;
    }
    track('privacy_banner_shown');
    if (btn) {
      btn.addEventListener('click', function () {
        try { banner.parentNode.removeChild(banner); } catch (_) {}
        setClosed();
        track('privacy_banner_closed');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
