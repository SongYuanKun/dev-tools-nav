(function () {
  var currentCat = "all";
  var searchQuery = "";
  var dynamicPosts = [];

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(String(str || "")));
    return d.innerHTML;
  }

  function allPosts() {
    return (typeof BLOG_POSTS !== "undefined" ? BLOG_POSTS : []).concat(dynamicPosts);
  }

  function filterPosts(posts) {
    return posts.filter(function (p) {
      if (p.status !== "published") return false;
      if (currentCat !== "all" && p.category !== currentCat) return false;
      if (!searchQuery) return true;
      var blob = [
        p.title,
        p.description,
        p.category,
        (p.tags || []).join(" ")
      ].join(" ").toLowerCase();
      return blob.indexOf(searchQuery) !== -1;
    }).sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  function updateStats(posts) {
    var totalEl = document.getElementById("blogStatTotal");
    var shownEl = document.getElementById("blogStatShown");
    if (totalEl) totalEl.textContent = allPosts().filter(function (p) { return p.status === "published"; }).length + " 篇文章";
    if (shownEl) shownEl.textContent = "显示 " + posts.length + " 篇";
  }

  function renderFeatured(posts) {
    var wrap = document.getElementById("blogFeatured");
    if (!wrap) return;
    var featured = posts.find(function (p) { return p.featured; }) || posts[0];
    if (!featured) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    var href = featured.externalUrl || featured.url;
    var target = featured.externalUrl ? ' target="_blank" rel="noopener noreferrer"' : "";
    wrap.innerHTML =
      '<p class="blog-featured-label">推荐阅读</p>' +
      '<a href="' + escapeHtml(href) + '" class="blog-card blog-card-featured"' + target + ">" +
        '<div class="blog-card-meta">' +
          '<span class="blog-card-category">' + escapeHtml(featured.category) + "</span>" +
          "<span>" + escapeHtml(featured.date) + "</span>" +
        "</div>" +
        '<h2 class="blog-card-title">' + escapeHtml(featured.title) + "</h2>" +
        '<p class="blog-card-desc">' + escapeHtml(featured.description) + "</p>" +
      "</a>";
  }

  function renderPosts() {
    var list = document.getElementById("blogList");
    var empty = document.getElementById("blogEmpty");
    if (!list) return;

    var filtered = filterPosts(allPosts());
    updateStats(filtered);
    renderFeatured(filtered);

    if (filtered.length === 0) {
      list.innerHTML = "";
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";

    list.innerHTML = filtered.map(function (p) {
      if (p.featured) return "";
      var href = p.externalUrl || p.url;
      var target = p.externalUrl ? ' target="_blank" rel="noopener noreferrer"' : "";
      var externalBadge = p.externalUrl ? '<span class="blog-card-external">↗ CSDN</span>' : "";
      var tags = (p.tags || []).map(function (t) {
        return '<span class="tag">' + escapeHtml(t) + "</span>";
      }).join("");
      return (
        '<a href="' + escapeHtml(href) + '" class="blog-card"' + target + ">" +
          '<div class="blog-card-meta">' +
            '<span class="blog-card-category">' + escapeHtml(p.category) + "</span>" +
            "<span>" + escapeHtml(p.date) + "</span>" +
            "<span>" + p.readTime + " 分钟阅读</span>" +
            externalBadge +
          "</div>" +
          '<h2 class="blog-card-title">' + escapeHtml(p.title) + "</h2>" +
          '<p class="blog-card-desc">' + escapeHtml(p.description) + "</p>" +
          '<div class="blog-card-tags">' + tags + "</div>" +
        "</a>"
      );
    }).join("");
  }

  function initCategories() {
    var container = document.getElementById("blogCategories");
    if (!container || typeof BLOG_CATEGORIES === "undefined") return;

    var categories = BLOG_CATEGORIES.slice();
    if (!categories.some(function (cat) { return cat.id === "CSDN"; })) {
      categories.push({ id: "CSDN", label: "CSDN" });
    }

    categories.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.className = "blog-cat-btn" + (cat.id === "all" ? " active" : "");
      btn.textContent = cat.label;
      btn.addEventListener("click", function () {
        currentCat = cat.id;
        container.querySelectorAll(".blog-cat-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        window.umamiTrack?.("blog_filter", { category: cat.id });
        renderPosts();
      });
      container.appendChild(btn);
    });
  }

  function normalizeCsdnArticle(article) {
    return {
      title: article.title || "未命名文章",
      description: article.description || "查看 CSDN 原文",
      date: article.date || "",
      category: "CSDN",
      tags: article.tags && article.tags.length ? article.tags : ["CSDN", "技术博客"],
      readTime: 6,
      externalUrl: article.url,
      status: "published"
    };
  }

  function loadCsdnArticles() {
    return fetch("../../data/csdn-articles.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("CSDN articles fetch failed");
        return res.json();
      })
      .then(function (data) {
        var existingUrls = {};
        (typeof BLOG_POSTS !== "undefined" ? BLOG_POSTS : []).forEach(function (p) {
          if (p.externalUrl) existingUrls[p.externalUrl] = true;
        });
        dynamicPosts = (data.items || [])
          .filter(function (article) { return article.url && !existingUrls[article.url]; })
          .map(normalizeCsdnArticle);
        renderPosts();
      })
      .catch(function () {
        dynamicPosts = [];
      });
  }

  function bindSearch() {
    var input = document.getElementById("blogSearch");
    if (!input) return;
    input.addEventListener("input", function () {
      searchQuery = input.value.trim().toLowerCase();
      renderPosts();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCategories();
    bindSearch();
    renderPosts();
    loadCsdnArticles();
  });
})();
