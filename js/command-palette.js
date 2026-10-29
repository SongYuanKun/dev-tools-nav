/**
 * Ctrl/Cmd+K 快速搜索面板：检索目录与自建工具，支持键盘导航。
 */
(function () {
  "use strict";

  var state = {
    open: false,
    query: "",
    active: 0,
    results: [],
  };
  var els = {};
  var lastFocus = null;

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getRootPrefix() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      try {
        var canonPath = new URL(canonical.href).pathname;
        var parts = canonPath.split("/").filter(Boolean);
        if (parts.length && parts[parts.length - 1].indexOf(".") !== -1) parts.pop();
        var host = new URL(canonical.href).hostname;
        if (host.endsWith(".github.io") && parts.length > 0) parts = parts.slice(1);
        return parts.length === 0 ? "" : parts.map(function () { return ".."; }).join("/") + "/";
      } catch (_) {}
    }
    var pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts.length && pathParts[pathParts.length - 1].indexOf(".") !== -1) pathParts.pop();
    return pathParts.length === 0 ? "" : pathParts.map(function () { return ".."; }).join("/") + "/";
  }

  function resolveUrl(url) {
    if (!url) return "#";
    if (/^https?:\/\//i.test(url)) return url;
    return (getRootPrefix() + url).replace(/\/{2,}/g, "/");
  }

  function collectTools() {
    if (typeof TOOLS_DATA === "undefined" || !Array.isArray(TOOLS_DATA)) return [];
    return TOOLS_DATA.filter(function (t) {
      return t && !t.hidden && t.id !== "online-tools-hub";
    });
  }

  function scoreTool(tool, terms) {
    var category = tool.category || "";
    var isSelfBuilt = category === "online-tools";
    var isSecondaryCatalog = category === "ai" || category === "hosting";
    // 空查询时优先露出自建工具；AI / 建站目录权重更低
    if (!terms.length) {
      if (isSelfBuilt) return tool.featured ? 4 : 3;
      if (isSecondaryCatalog) return 0.4;
      return 1;
    }
    var name = String(tool.name || "").toLowerCase();
    var desc = String(tool.description || "").toLowerCase();
    var tags = (Array.isArray(tool.tags) ? tool.tags : []).join(" ").toLowerCase();
    var slug = String(tool.slug || tool.id || "").toLowerCase();
    var hay = name + " " + desc + " " + tags + " " + slug;
    var score = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (name.indexOf(t) === 0) score += 8;
      else if (name.indexOf(t) !== -1) score += 5;
      else if (slug.indexOf(t) !== -1) score += 4;
      else if (tags.indexOf(t) !== -1) score += 3;
      else if (hay.indexOf(t) !== -1) score += 1;
      else return 0;
    }
    if (tool.featured) score += 0.5;
    if (isSelfBuilt) score += 2;
    else if (isSecondaryCatalog) score -= 1.25;
    return score;
  }

  function search(query) {
    var terms = String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    var list = collectTools().map(function (tool) {
      return { tool: tool, score: scoreTool(tool, terms) };
    }).filter(function (row) { return row.score > 0; });
    list.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.tool.name || "").localeCompare(String(b.tool.name || ""), "zh");
    });
    return list.slice(0, 12).map(function (row) { return row.tool; });
  }

  function ensureDom() {
    if (els.root) return;
    var root = document.createElement("div");
    root.id = "commandPalette";
    root.className = "cmdk";
    root.hidden = true;
    root.innerHTML =
      '<div class="cmdk-backdrop" data-cmdk-close="1"></div>' +
      '<div class="cmdk-dialog" role="dialog" aria-modal="true" aria-labelledby="cmdkTitle">' +
        '<div class="cmdk-header">' +
          '<h2 id="cmdkTitle" class="cmdk-title">快速搜索</h2>' +
          '<p class="cmdk-hint">按 <kbd>↑</kbd><kbd>↓</kbd> 选择，<kbd>Enter</kbd> 打开，<kbd>Esc</kbd> 关闭</p>' +
        '</div>' +
        '<label class="cmdk-label" for="cmdkInput">搜索工具</label>' +
        '<input id="cmdkInput" class="cmdk-input" type="search" autocomplete="off" spellcheck="false" placeholder="名称、标签、描述…" />' +
        '<div id="cmdkResults" class="cmdk-results" role="listbox" aria-label="搜索结果"></div>' +
        '<div class="cmdk-footer"><span id="cmdkCount">输入关键词开始搜索</span><button type="button" class="cmdk-close" data-cmdk-close="1">关闭</button></div>' +
      '</div>';
    document.body.appendChild(root);
    els.root = root;
    els.input = root.querySelector("#cmdkInput");
    els.results = root.querySelector("#cmdkResults");
    els.count = root.querySelector("#cmdkCount");

    root.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute("data-cmdk-close") === "1") close();
    });
    els.input.addEventListener("input", function () {
      state.query = els.input.value;
      state.active = 0;
      renderResults();
    });
    els.results.addEventListener("click", function (e) {
      var item = e.target.closest("[data-cmdk-index]");
      if (!item) return;
      activate(Number(item.getAttribute("data-cmdk-index")));
    });
  }

  function renderResults() {
    ensureDom();
    state.results = search(state.query);
    if (!state.results.length) {
      els.results.innerHTML = '<div class="cmdk-empty" role="option">没有匹配的工具</div>';
      els.count.textContent = "0 条结果";
      return;
    }
    if (state.active >= state.results.length) state.active = 0;
    els.results.innerHTML = state.results.map(function (tool, index) {
      var active = index === state.active ? " is-active" : "";
      var tags = (Array.isArray(tool.tags) ? tool.tags : []).slice(0, 3).map(function (tag) {
        return '<span class="cmdk-tag">' + escapeHtml(tag) + '</span>';
      }).join("");
      var kind = tool.category === "online-tools"
        ? "自建工具"
        : tool.category === "hosting"
          ? "建站目录"
          : tool.category === "ai"
            ? "AI 目录"
            : "目录";
      return (
        '<button type="button" class="cmdk-item' + active + '" role="option" aria-selected="' +
        (index === state.active ? "true" : "false") + '" data-cmdk-index="' + index + '">' +
          '<span class="cmdk-item-icon" aria-hidden="true">' + escapeHtml(tool.icon || "🔧") + '</span>' +
          '<span class="cmdk-item-body">' +
            '<span class="cmdk-item-name">' + escapeHtml(tool.name || "") + '</span>' +
            '<span class="cmdk-item-desc">' + escapeHtml(tool.description || "") + '</span>' +
            '<span class="cmdk-item-meta">' + escapeHtml(kind) + tags + '</span>' +
          '</span>' +
        '</button>'
      );
    }).join("");
    els.count.textContent = state.results.length + " 条结果";
    var activeEl = els.results.querySelector(".cmdk-item.is-active");
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }

  function open() {
    if (typeof TOOLS_DATA === "undefined") {
      ensureToolsData(function () { open(); });
      return;
    }
    ensureDom();
    lastFocus = document.activeElement;
    state.open = true;
    state.query = "";
    state.active = 0;
    els.root.hidden = false;
    document.documentElement.classList.add("cmdk-open");
    els.input.value = "";
    renderResults();
    els.input.focus();
    window.umamiTrack?.("search_use", { query: "cmdk_open", results: state.results.length });
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    if (els.root) els.root.hidden = true;
    document.documentElement.classList.remove("cmdk-open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      try { lastFocus.focus(); } catch (_) {}
    }
  }

  function activate(index) {
    var tool = state.results[index];
    if (!tool) return;
    var url = resolveUrl(tool.url);
    if (tool.category === "online-tools" && tool.slug && window.ToolsPrefs) {
      try { window.ToolsPrefs.addRecent(tool.slug); } catch (_) {}
    }
    if (window.MruFav && tool.category === "online-tools") {
      try {
        window.MruFav.record({
          id: tool.slug || tool.id,
          name: tool.name,
          url: tool.url,
        });
      } catch (_) {}
    }
    window.umamiTrack?.("tool_click", {
      tool_name: tool.name,
      category: tool.category,
      source: "command_palette",
    });
    close();
    window.location.href = url;
  }

  function ensureToolsData(cb) {
    if (typeof TOOLS_DATA !== "undefined") {
      cb();
      return;
    }
    var prefix = getRootPrefix();
    var s = document.createElement("script");
    var toolsUrl = prefix + "data/tools.js";
    var ver = window.__ASSET_VERSION__;
    if (ver) toolsUrl += (toolsUrl.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(ver);
    s.src = toolsUrl;
    s.onload = function () { cb(); };
    s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }

  function toolOwnsModK() {
    var path = String(window.location.pathname || "");
    // JSON 工作台用 Ctrl/Cmd+K 聚焦 JSONPath，避免抢快捷键
    if (path.indexOf("/tools/json") !== -1) return true;
    if (document.querySelector(".json-workbench, [data-json-workbench]")) return true;
    return false;
  }

  function onKeydown(e) {
    var isModK = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey) && !e.altKey;
    if (isModK) {
      if (toolOwnsModK() && !state.open) return;
      e.preventDefault();
      if (state.open) close();
      else open();
      return;
    }
    if (!state.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!state.results.length) return;
      state.active = (state.active + 1) % state.results.length;
      renderResults();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!state.results.length) return;
      state.active = (state.active - 1 + state.results.length) % state.results.length;
      renderResults();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      activate(state.active);
    }
  }

  document.addEventListener("keydown", onKeydown);

  window.CommandPalette = {
    open: open,
    close: close,
    search: search,
  };
})();
