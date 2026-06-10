(function () {
  var DATA_URL = "../../data/open-source-radar.json";

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str || "")));
    return div.innerHTML;
  }

  function formatNum(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function repoUrl(repo) {
    return "https://github.com/" + repo;
  }

  function renderMeta(data) {
    var el = document.getElementById("radarMeta");
    if (!el) return;
    var count = (data.projects || []).length;
    var updated = (data.updatedAt || "").replace("T", " ").replace("+08:00", " CST");
    el.innerHTML =
      "<span>更新：" + escapeHtml(updated) + "</span>" +
      "<span>周期：" + escapeHtml(data.weekLabel || "本周") + "</span>" +
      "<span>项目数：" + count + "</span>" +
      "<span>排序：本周新增 Star 优先</span>";
  }

  function renderSummary(data) {
    var summaryEl = document.getElementById("radarSummaryText");
    var themesEl = document.getElementById("radarThemePills");
    if (summaryEl) summaryEl.textContent = data.summary || "";
    if (!themesEl || !Array.isArray(data.themes)) return;

    themesEl.innerHTML = data.themes.map(function (t) {
      var active = t.id === "all" ? " is-active" : "";
      return (
        '<button type="button" class="radar-theme-btn' + active + '" data-radar-topic="' +
        escapeHtml(t.id) + '">' + escapeHtml(t.label) + "</button>"
      );
    }).join("");
  }

  function renderCard(project) {
    var tags = (project.tags || []).map(function (t) {
      return "<span>" + escapeHtml(t) + "</span>";
    }).join("");
    var features = (project.features || []).map(function (f) {
      return "<li>" + escapeHtml(f) + "</li>";
    }).join("");
    var badge = project.trending
      ? '<span class="radar-badge radar-badge-hot">本周 Trending</span>'
      : '<span class="radar-badge">持续热门</span>';
    var weekStat = project.weekStars
      ? "<strong>+" + formatNum(project.weekStars) + "</strong>"
      : "<strong>—</strong>";

    return (
      '<article class="radar-card" data-radar-card data-topic="' + escapeHtml(project.topic || "all") + '" data-search="' +
      escapeHtml((project.repo + " " + project.summary + " " + (project.tags || []).join(" ")).toLowerCase()) + '">' +
      '<div class="radar-card-head">' +
        '<div class="radar-card-title-wrap">' +
          badge +
          '<span class="radar-rank">#' + String(project.rank).padStart(2, "0") + "</span>" +
          '<h2><a href="' + escapeHtml(repoUrl(project.repo)) + '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(project.repo) + "</a></h2>" +
        "</div>" +
        '<div class="radar-stats">' +
          "<span>" + escapeHtml(project.language || "—") + "</span>" +
          "<span>Star " + formatNum(project.stars) + "</span>" +
          weekStat +
          '<button type="button" class="radar-copy-btn" data-copy="' + escapeHtml(repoUrl(project.repo)) + '" title="复制仓库链接">复制链接</button>' +
        "</div>" +
      "</div>" +
      '<p class="radar-desc">' + escapeHtml(project.summary) + "</p>" +
      '<details class="radar-details">' +
        '<summary>核心功能与适用场景</summary>' +
        "<ul>" + features + "</ul>" +
      "</details>" +
      '<div class="radar-tags">' + tags + "</div>" +
      "</article>"
    );
  }

  function renderGrid(projects) {
    var grid = document.getElementById("radarGrid");
    var empty = document.getElementById("radarEmpty");
    if (!grid) return;
    if (!projects.length) {
      grid.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = projects.map(renderCard).join("");
    bindCopyButtons(grid);
  }

  function bindCopyButtons(root) {
    root.querySelectorAll(".radar-copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = btn.getAttribute("data-copy") || "";
        if (!url) return;
        navigator.clipboard.writeText(url).then(function () {
          var old = btn.textContent;
          btn.textContent = "已复制";
          setTimeout(function () { btn.textContent = old; }, 1500);
        }).catch(function () {
          window.prompt("复制链接：", url);
        });
        window.umamiTrack?.("radar_copy_link", { repo: url.replace("https://github.com/", "") });
      });
    });
  }

  function filterProjects(data, topic, query) {
    var q = (query || "").trim().toLowerCase();
    return (data.projects || []).filter(function (p) {
      if (topic && topic !== "all" && p.topic !== topic) return false;
      if (!q) return true;
      var blob = (p.repo + " " + p.summary + " " + (p.tags || []).join(" ")).toLowerCase();
      return blob.indexOf(q) !== -1;
    });
  }

  function bindControls(data) {
    var searchInput = document.getElementById("radarSearch");
    var themesEl = document.getElementById("radarThemePills");
    var state = { topic: "all", query: "" };

    function apply() {
      renderGrid(filterProjects(data, state.topic, state.query));
      var countEl = document.getElementById("radarResultCount");
      if (countEl) {
        var n = filterProjects(data, state.topic, state.query).length;
        countEl.textContent = "显示 " + n + " / " + (data.projects || []).length + " 个项目";
      }
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.query = searchInput.value;
        apply();
      });
    }

    if (themesEl) {
      themesEl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-radar-topic]");
        if (!btn) return;
        state.topic = btn.getAttribute("data-radar-topic") || "all";
        themesEl.querySelectorAll(".radar-theme-btn").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        window.umamiTrack?.("radar_filter", { topic: state.topic });
        apply();
      });
    }

    apply();
  }

  function init() {
    fetch(DATA_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("load failed");
        return res.json();
      })
      .then(function (data) {
        renderMeta(data);
        renderSummary(data);
        bindControls(data);
      })
      .catch(function () {
        var grid = document.getElementById("radarGrid");
        if (grid) {
          grid.innerHTML = '<p class="radar-load-error">雷达数据加载失败，请刷新页面或稍后再试。</p>';
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
