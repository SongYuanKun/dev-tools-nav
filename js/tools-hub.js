(function () {
  function umamiTrack(name, data) {
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(name, data);
      }
    } catch (_) {}
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str || "")));
    return div.innerHTML;
  }

  function getOnlineTools() {
    if (typeof TOOLS_DATA === "undefined") return [];
    return TOOLS_DATA
      .filter(function (t) { return t && t.category === "online-tools" && !t.hidden && t.id !== "online-tools-hub"; })
      .map(function (t) {
        var legacyUrl = t.legacyUrl || t.legacy_url || "";
        var slug = t.slug;
        if (!slug && legacyUrl) {
          var m = legacyUrl.match(/\/([^/]+)\.html$/);
          slug = m ? m[1] : "";
        }
        return {
          id: String(t.id || slug || ""),
          slug: String(slug || "").trim(),
          name: String(t.name || ""),
          description: String(t.description || ""),
          tags: Array.isArray(t.tags) ? t.tags : [],
          icon: t.icon || "🧰",
          featured: !!t.featured,
          legacyUrl: String(legacyUrl || ""),
        };
      })
      .filter(function (t) { return !!t.slug; });
  }

  var CATEGORY_DEFS = [
    { id: "all", name: "全部" },
    { id: "encode", name: "编码转换" },
    { id: "time", name: "时间日期" },
    { id: "data", name: "数据处理" },
    { id: "auth", name: "鉴权安全" },
    { id: "regex", name: "正则文本" },
  ];

  function inferCategoryId(tool) {
    var slug = tool.slug;
    if (slug === "timestamp" || slug === "cron") return "time";
    if (slug === "json" || slug === "sql-formatter") return "data";
    if (slug === "jwt") return "auth";
    if (slug === "regex") return "regex";
    if (slug === "base64") return "encode";
    return "data";
  }

  function buildTagIndex(tools) {
    var set = new Set();
    tools.forEach(function (t) {
      (t.tags || []).forEach(function (tag) {
        if (typeof tag === "string" && tag.trim()) set.add(tag.trim());
      });
    });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b, "zh"); });
  }

  function matchTool(tool, qTerms) {
    if (!qTerms.length) return true;
    var hay = (tool.name + " " + tool.description + " " + (tool.tags || []).join(" ")).toLowerCase();
    return qTerms.every(function (t) { return hay.indexOf(t) !== -1; });
  }

  function highlight(text, q) {
    var s = String(text || "");
    var t = String(q || "").trim();
    if (!t) return escapeHtml(s);
    var idx = s.toLowerCase().indexOf(t.toLowerCase());
    if (idx === -1) return escapeHtml(s);
    var a = s.slice(0, idx);
    var b = s.slice(idx, idx + t.length);
    var c = s.slice(idx + t.length);
    return escapeHtml(a) + "<mark>" + escapeHtml(b) + "</mark>" + escapeHtml(c);
  }

  function render() {
    var tools = getOnlineTools().map(function (t) {
      t.categoryId = inferCategoryId(t);
      return t;
    });
    var allTags = buildTagIndex(tools);

    var searchEl = document.getElementById("toolsSearch");
    var categoryWrap = document.getElementById("categoryChips");
    var tagWrap = document.getElementById("tagChips");
    var listEl = document.getElementById("toolsList");
    var summaryEl = document.getElementById("resultsSummary");
    var sortEl = document.getElementById("sortSelect");
    var tabAllBtn = document.getElementById("tabAll");
    var tabFavBtn = document.getElementById("tabFav");
    var tabRecentBtn = document.getElementById("tabRecent");

    var prefs = window.ToolsPrefs ? window.ToolsPrefs.load() : { favorites: [], recent: [], lastFilters: {} };
    var last = prefs.lastFilters || {};
    var state = {
      tab: last.tab || "all",
      q: last.q || "",
      categoryId: last.categoryId || "all",
      tags: Array.isArray(last.tags) ? last.tags : [],
      sort: last.sort || "popular",
    };

    function persist() {
      if (!window.ToolsPrefs) return;
      window.ToolsPrefs.setLastFilters({
        tab: state.tab,
        q: state.q,
        categoryId: state.categoryId,
        tags: state.tags,
        sort: state.sort,
      });
    }

    function setTab(tab) {
      state.tab = tab;
      tabAllBtn.classList.toggle("is-active", tab === "all");
      tabFavBtn.classList.toggle("is-active", tab === "favorites");
      tabRecentBtn.classList.toggle("is-active", tab === "recent");
      persist();
      draw();
    }

    function setCategory(categoryId) {
      state.categoryId = categoryId;
      umamiTrack('category_click', { category: categoryId });
      persist();
      draw();
      drawCategoryChips();
    }

    function toggleTag(tag) {
      var idx = state.tags.indexOf(tag);
      if (idx === -1) state.tags.push(tag); else state.tags.splice(idx, 1);
      persist();
      draw();
      drawTagChips();
    }

    function drawCategoryChips() {
      categoryWrap.innerHTML = CATEGORY_DEFS.map(function (c) {
        var active = c.id === state.categoryId ? " is-active" : "";
        return '<button type="button" class="tools-chip' + active + '" data-category="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</button>';
      }).join("");
    }

    function drawTagChips() {
      tagWrap.innerHTML = allTags.map(function (t) {
        var active = state.tags.includes(t) ? " is-active" : "";
        return '<button type="button" class="tools-chip' + active + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
      }).join("");
    }

    function isFav(slug) {
      var p = window.ToolsPrefs ? window.ToolsPrefs.load() : prefs;
      return (p.favorites || []).includes(slug);
    }

    function sortTools(list) {
      var p = window.ToolsPrefs ? window.ToolsPrefs.load() : prefs;
      var favSet = new Set((p.favorites || []).filter(Boolean));
      if (state.sort === "alpha") {
        return list.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "zh"); });
      }
      return list.slice().sort(function (a, b) {
        var af = favSet.has(a.slug) ? 1 : 0;
        var bf = favSet.has(b.slug) ? 1 : 0;
        if (af !== bf) return bf - af;
        var afe = a.featured ? 1 : 0;
        var bfe = b.featured ? 1 : 0;
        if (afe !== bfe) return bfe - afe;
        return a.name.localeCompare(b.name, "zh");
      });
    }

    function pickByTab(list) {
      var p = window.ToolsPrefs ? window.ToolsPrefs.load() : prefs;
      if (state.tab === "favorites") {
        var fav = new Set((p.favorites || []).filter(Boolean));
        return list.filter(function (t) { return fav.has(t.slug); });
      }
      if (state.tab === "recent") {
        var order = (p.recent || []).filter(Boolean);
        var map = new Map(list.map(function (t) { return [t.slug, t]; }));
        return order.map(function (s) { return map.get(s); }).filter(Boolean);
      }
      return list;
    }

    function filterList() {
      var qTerms = String(state.q || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
      var list = tools;
      if (state.categoryId !== "all") {
        list = list.filter(function (t) { return t.categoryId === state.categoryId; });
      }
      if (state.tags.length) {
        var tagSet = new Set(state.tags);
        list = list.filter(function (t) {
          return (t.tags || []).some(function (tag) { return tagSet.has(tag); });
        });
      }
      list = pickByTab(list);
      list = list.filter(function (t) { return matchTool(t, qTerms); });
      return sortTools(list);
    }

    function toolHref(slug) {
      return "./" + encodeURIComponent(slug) + "/";
    }

    function openTool(slug) {
      var tool = tools.find(function (t) { return t.slug === slug; });
      umamiTrack('tool_click', {
        name: tool ? tool.name : slug,
        category: tool ? tool.categoryId : '',
      });
      if (window.ToolsPrefs) window.ToolsPrefs.addRecent(slug);
      window.location.href = toolHref(slug);
    }

    function draw() {
      var list = filterList();
      var total = tools.length;
      var shown = list.length;
      var prefix = state.tab === "favorites" ? "收藏" : (state.tab === "recent" ? "最近" : "全部");
      summaryEl.textContent = prefix + " · 显示 " + shown + " / " + total;

      if (!shown) {
        var emptyText = "暂无结果";
        if (state.tab === "favorites") emptyText = "你还没有收藏工具";
        if (state.tab === "recent") emptyText = "还没有最近使用记录";
        listEl.innerHTML = '<div class="tools-empty">' + escapeHtml(emptyText) + '</div>';
        return;
      }

      listEl.innerHTML = '<div class="tools-grid">' + list.map(function (t) {
        var fav = isFav(t.slug);
        var favClass = fav ? " is-active" : "";
        var favText = fav ? "★" : "☆";
        var tags = (t.tags || []).slice(0, 4).map(function (tag) {
          return '<span class="tools-tag">' + escapeHtml(tag) + '</span>';
        }).join("");
        return (
          '<article class="tools-card" role="link" tabindex="0" data-slug="' + escapeHtml(t.slug) + '" aria-label="打开 ' + escapeHtml(t.name) + '">' +
            '<div class="tools-card-top">' +
              '<div class="tools-card-title">' +
                '<span class="tools-card-icon">' + escapeHtml(t.icon) + '</span>' +
                '<div class="tools-card-name">' + highlight(t.name, state.q) + '</div>' +
              '</div>' +
              '<button type="button" class="tools-fav-btn' + favClass + '" aria-pressed="' + (fav ? "true" : "false") + '" data-action="fav" data-slug="' + escapeHtml(t.slug) + '">' + favText + '</button>' +
            '</div>' +
            '<div class="tools-card-desc">' + highlight(t.description, state.q) + '</div>' +
            '<div class="tools-card-tags">' + tags + '</div>' +
          '</article>'
        );
      }).join("") + '</div>';
    }

    drawCategoryChips();
    drawTagChips();

    searchEl.value = state.q;
    sortEl.value = state.sort;
    setTab(state.tab);

    categoryWrap.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-category]");
      if (!btn) return;
      setCategory(btn.getAttribute("data-category"));
    });

    tagWrap.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-tag]");
      if (!btn) return;
      toggleTag(btn.getAttribute("data-tag"));
    });

    tabAllBtn.addEventListener("click", function () { setTab("all"); });
    tabFavBtn.addEventListener("click", function () { setTab("favorites"); });
    tabRecentBtn.addEventListener("click", function () { setTab("recent"); });

    sortEl.addEventListener("change", function () {
      state.sort = sortEl.value;
      persist();
      draw();
    });

    var searchTrackTimer;
    searchEl.addEventListener("input", function () {
      state.q = searchEl.value;
      persist();
      draw();
      clearTimeout(searchTrackTimer);
      searchTrackTimer = setTimeout(function () {
        var q = String(state.q || "").trim();
        if (q.length < 2) return;
        umamiTrack('search_use', { query: q.slice(0, 100), results: filterList().length });
      }, 400);
    });

    listEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action=\"fav\"]");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (!window.ToolsPrefs) return;
        var slug = btn.getAttribute("data-slug");
        window.ToolsPrefs.toggleFavorite(slug);
        draw();
        return;
      }

      var card = e.target.closest(".tools-card");
      if (!card) return;
      var slug = card.getAttribute("data-slug");
      if (!slug) return;
      openTool(slug);
    });

    listEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var card = e.target.closest(".tools-card");
      if (!card) return;
      var slug = card.getAttribute("data-slug");
      if (!slug) return;
      e.preventDefault();
      openTool(slug);
    });

    document.addEventListener("keydown", function (e) {
      var t = e.target;
      var isInput = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!isInput && e.key === "/") {
        e.preventDefault();
        searchEl.focus();
        searchEl.select();
      }
      if (e.key === "Escape") {
        if (document.activeElement === searchEl && searchEl.value) {
          searchEl.value = "";
          state.q = "";
          persist();
          draw();
          return;
        }
        if (state.tags.length || state.categoryId !== "all") {
          state.tags = [];
          state.categoryId = "all";
          persist();
          drawCategoryChips();
          drawTagChips();
          draw();
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();

