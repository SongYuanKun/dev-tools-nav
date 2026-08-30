/**
 * OP-107：MRU 最近使用 + 收藏夹 双栏渲染（localStorage 持久化
 * 与主逻辑已存在的 Favorites/RecentVisits 逻辑对齐存储 key 兼容（独立双写）：
 *   Favorites.STORAGE_KEY = devtools-favorites
 * mru_v1 = [{id,name,url,at}
 */
(function () {
  var FAV_KEY = 'devtools-favorites';
  var MRU_KEY = 'mru_v1';
  var MRU_MAX = 8;

  function safeGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  function getFavIds() {
    try {
      var raw = safeGet(FAV_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'string'; }) : [];
    } catch (_) { return []; }
  }
  function toggleFavId(id) {
    var set = new Set(getFavIds());
    var existed = set.has(id);
    if (existed) set.delete(id); else set.add(id);
    safeSet(FAV_KEY, JSON.stringify([...set]));
    return !existed;
  }
  function getMru() {
    try {
      var raw = safeGet(MRU_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function pushMru(entry) {
    if (!entry || !entry.id) return;
    var list = getMru().filter(function (x) { return x.id !== entry.id; });
    list.unshift(entry);
    safeSet(MRU_KEY, JSON.stringify(list.slice(0, MRU_MAX)));
  }
  function findToolMeta(id) {
    var anchor = document.querySelector('.v2-tool-card[data-tool-id="' + id + '"]');
    if (!anchor) return null;
    var btn = document.querySelector('.tool-card-fav[data-tool-id="' + id + '"]');
    return {
      id: id,
      name: btn ? (btn.getAttribute('data-tool-name') || id) : id,
      url: btn ? (btn.getAttribute('data-tool-url') || anchor.getAttribute('href')) : anchor.getAttribute('href')
    };
  }
  function track(label, extra) {
    try {
      if (typeof window.umami === 'object' && typeof window.umami.track === 'function') {
        window.umami.track(label, Object.assign({ op: 'OP-107' }, extra || {}));
      }
    } catch (_) {}
  }

  function renderMru() {
    var ul = document.getElementById('mruList');
    if (!ul) return;
    var list = getMru();
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li class="prefs-empty">暂无记录，打开任意工具后会出现在这里。</li>';
      return;
    }
    ul.innerHTML = list.map(function (t) {
      return '<li><a href="' + (t.url || '#') + '" data-mru-id="' + t.id + '">' +
        '<span>' + (t.name || t.id) + '</span></a></li>';
    }).join('');
  }
  function renderFav() {
    var ul = document.getElementById('favList');
    if (!ul) return;
    var ids = getFavIds();
    var cards = document.querySelectorAll('.tool-card-fav');
    var metaMap = {};
    cards.forEach(function (b) { metaMap[b.getAttribute('data-tool-id')] = {
      name: b.getAttribute('data-tool-name'), url: b.getAttribute('data-tool-url') };
    });
    var items = ids.map(function (id) { return Object.assign({ id: id }, metaMap[id] || { name: id, url: 'tools/' + id + '/' }); });
    ul.innerHTML = '';
    if (!items.length) {
      ul.innerHTML = '<li class="prefs-empty">还没收藏，试试点下面工具卡片的 🤍。</li>';
      return;
    }
    ul.innerHTML = items.map(function (t) {
      return '<li><a href="' + t.url + '" data-fav-id="' + t.id + '">' +
        '❤️ <span>' + t.name + '</span></a></li>';
    }).join('');
    // 更新 10 张卡片上的收藏按钮态
    document.querySelectorAll('.tool-card-fav').forEach(function (btn) {
      btn.textContent = ids.indexOf(btn.getAttribute('data-tool-id')) !== -1 ? '❤️' : '🤍';
      btn.classList.toggle('is-on', ids.indexOf(btn.getAttribute('data-tool-id')) !== -1);
    });
  }

  function bindFavButtons() {
    document.querySelectorAll('.tool-card-fav').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var id = btn.getAttribute('data-tool-id');
        var on = toggleFavId(id);
        btn.textContent = on ? '❤️' : '🤍';
        btn.classList.toggle('is-on', !!on);
        track(on ? 'fav_added' : 'fav_removed', { id: id });
        renderFav();
      });
    });
  }
  function bindSelfBuiltLinkVisit() {
    document.querySelectorAll('a.v2-tool-card[data-tool-id]').forEach(function (a) {
      a.addEventListener('click', function () {
        var id = a.getAttribute('data-tool-id');
        var meta = findToolMeta(id);
        if (meta) pushMru(Object.assign(meta, { at: Date.now() }));
        renderMru();
      });
    });
  }

  function init() {
    renderMru();
    renderFav();
    bindFavButtons();
    bindSelfBuiltLinkVisit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // 暴露给外部工具页（OP-105 场景互链后记录 MRU）
  window.MruFav = {
    record: function (entry) { pushMru(Object.assign({}, entry, { at: Date.now() })); renderMru(); },
    refresh: function () { renderMru(); renderFav(); }
  };
})();
