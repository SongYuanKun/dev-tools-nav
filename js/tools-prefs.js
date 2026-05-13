(function () {
  var KEY = "devtools-online-tools-prefs-v1";
  var MAX_RECENT = 20;
  var memoryOnly = false;
  var memoryPrefs = normalizePrefs(null);

  function safeParse(v) {
    try { return JSON.parse(v); } catch { return null; }
  }

  function normalizePrefs(prefs) {
    prefs = prefs && typeof prefs === "object" ? prefs : {};
    return {
      favorites: Array.isArray(prefs.favorites) ? prefs.favorites.filter(Boolean) : [],
      recent: Array.isArray(prefs.recent) ? prefs.recent.filter(Boolean) : [],
      lastFilters: prefs.lastFilters && typeof prefs.lastFilters === "object" ? Object.assign({}, prefs.lastFilters) : {},
    };
  }

  function normalizeSlug(s) {
    return String(s || "").trim();
  }

  function load() {
    if (memoryOnly) return normalizePrefs(memoryPrefs);
    try {
      memoryPrefs = normalizePrefs(safeParse(localStorage.getItem(KEY)));
    } catch {
      memoryOnly = true;
    }
    return normalizePrefs(memoryPrefs);
  }

  function save(prefs) {
    memoryPrefs = normalizePrefs(prefs);
    if (memoryOnly) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(memoryPrefs));
      return true;
    } catch {
      memoryOnly = true;
      return false;
    }
  }

  function hasFavorite(slug) {
    var p = load();
    return p.favorites.includes(normalizeSlug(slug));
  }

  function toggleFavorite(slug) {
    var p = load();
    var s = normalizeSlug(slug);
    var idx = p.favorites.indexOf(s);
    var added = false;
    if (idx === -1) {
      p.favorites.push(s);
      added = true;
    } else {
      p.favorites.splice(idx, 1);
    }
    save(p);
    return { added: added, prefs: p };
  }

  function addRecent(slug) {
    var p = load();
    var s = normalizeSlug(slug);
    if (!s) return p;
    var next = [s].concat(p.recent.filter(function (x) { return x !== s; })).filter(Boolean);
    if (next.length > MAX_RECENT) next = next.slice(0, MAX_RECENT);
    p.recent = next;
    save(p);
    return p;
  }

  function setLastFilters(next) {
    var p = load();
    var current = p.lastFilters && typeof p.lastFilters === "object" ? p.lastFilters : {};
    p.lastFilters = Object.assign({}, current, next || {});
    save(p);
    return p;
  }

  window.ToolsPrefs = {
    KEY: KEY,
    load: load,
    save: save,
    hasFavorite: hasFavorite,
    toggleFavorite: toggleFavorite,
    addRecent: addRecent,
    setLastFilters: setLastFilters,
  };
})();

