(function () {
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str || "")));
    return div.innerHTML;
  }

  function getBasePath() {
    var p = window.location.pathname || "";
    var idx = p.indexOf("/tools/");
    if (idx === -1) return "";
    return p.slice(0, idx);
  }

  function getSlug() {
    var qp = new URLSearchParams(window.location.search);
    var s = qp.get("slug");
    if (s) return s;
    var parts = (window.location.pathname || "").split("/").filter(Boolean);
    var i = parts.indexOf("tools");
    if (i !== -1 && parts[i + 1]) return parts[i + 1];
    return "";
  }

  function findTool(slug) {
    if (typeof TOOLS_DATA === "undefined") return null;
    var list = TOOLS_DATA.filter(function (t) { return t && t.category === "online-tools" && !t.hidden; });
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var legacyUrl = t.legacyUrl || t.legacy_url || "";
      var s = t.slug;
      if (!s && legacyUrl) {
        var m = legacyUrl.match(/\/([^/]+)\.html$/);
        s = m ? m[1] : "";
      }
      if (String(s || "") === String(slug || "")) return t;
    }
    return null;
  }

  function init() {
    var slug = getSlug();
    var tool = findTool(slug);

    var titleEl = document.getElementById("toolTitle");
    var descEl = document.getElementById("toolDesc");
    var tagsEl = document.getElementById("toolTags");
    var favBtn = document.getElementById("favBtn");
    var legacyLink = document.getElementById("legacyLink");
    var frame = document.getElementById("toolFrame");
    var errorEl = document.getElementById("toolError");

    if (!tool) {
      document.title = "工具不存在 · Koen的工具箱";
      titleEl.textContent = "未找到该工具";
      descEl.textContent = "请返回工具中心重新选择。";
      legacyLink.style.display = "none";
      favBtn.style.display = "none";
      frame.style.display = "none";
      errorEl.style.display = "block";
      return;
    }

    var name = String(tool.name || slug);
    var desc = String(tool.description || "");
    var icon = tool.icon || "🧰";
    var legacyUrl = String(tool.legacyUrl || tool.legacy_url || "");
    var basePath = getBasePath();
    var legacyPath = /^https?:\/\//i.test(legacyUrl)
      ? legacyUrl
      : (basePath + "/" + legacyUrl).replace(/\/+/g, "/");

    document.title = name + " · 在线工具";
    titleEl.innerHTML = '<span class="tools-card-icon" aria-hidden="true">' + escapeHtml(icon) + '</span><span>' + escapeHtml(name) + '</span>';
    descEl.textContent = desc;
    tagsEl.innerHTML = (Array.isArray(tool.tags) ? tool.tags : []).map(function (t) {
      return '<span class="tools-tag">' + escapeHtml(t) + '</span>';
    }).join("");

    legacyLink.setAttribute("href", legacyPath);

    function syncFavUI() {
      var active = window.ToolsPrefs ? window.ToolsPrefs.hasFavorite(slug) : false;
      favBtn.classList.toggle("is-active", active);
      favBtn.setAttribute("aria-pressed", active ? "true" : "false");
      favBtn.textContent = active ? "★ 已收藏" : "☆ 收藏";
    }

    syncFavUI();

    favBtn.addEventListener("click", function () {
      if (!window.ToolsPrefs) return;
      window.ToolsPrefs.toggleFavorite(slug);
      syncFavUI();
    });

    if (window.ToolsPrefs) window.ToolsPrefs.addRecent(slug);

    // 详情页内嵌时使用 embed 模式，只展示工具主体，避免 iframe 里再出现一套站点导航。
    var frameUrl = legacyPath;
    if (!/^https?:\/\//i.test(frameUrl)) {
      frameUrl += frameUrl.indexOf("?") === -1 ? "?embed=1" : "&embed=1";
    }

    function resizeFrame() {
      try {
        var doc = frame.contentDocument || frame.contentWindow.document;
        if (!doc) return;
        var height = Math.max(
          doc.body ? doc.body.scrollHeight : 0,
          doc.documentElement ? doc.documentElement.scrollHeight : 0
        );
        if (height > 0) frame.style.height = Math.min(Math.max(height + 24, 560), 1400) + "px";
      } catch (_) {}
    }

    frame.setAttribute("src", frameUrl);
    frame.addEventListener("load", function () {
      errorEl.style.display = "none";
      resizeFrame();
      setTimeout(resizeFrame, 200);
      try {
        var doc = frame.contentDocument || frame.contentWindow.document;
        if (doc && doc.body) new MutationObserver(resizeFrame).observe(doc.body, { childList: true, subtree: true, attributes: true });
      } catch (_) {}
    });
    window.addEventListener("resize", resizeFrame);

    frame.addEventListener("error", function () {
      errorEl.style.display = "block";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
