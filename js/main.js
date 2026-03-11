/**
 * 个人工具导航站 - 主交互逻辑
 * 功能：暗色模式、分类筛选、实时搜索、卡片渲染
 */

// ============================================================
// 状态
// ============================================================
const state = {
  currentCategory: "all",
  searchQuery: "",
};

// ============================================================
// 暗色模式
// ============================================================
const ThemeManager = {
  STORAGE_KEY: "dev-tools-theme",

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      this.apply(saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.apply(prefersDark ? "dark" : "light");
    }

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.apply(e.matches ? "dark" : "light");
      }
    });
  },

  apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.textContent = theme === "dark" ? "☀️" : "🌙";
      btn.setAttribute("title", theme === "dark" ? "切换到亮色模式" : "切换到暗色模式");
    }
  },

  toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(this.STORAGE_KEY, next);
    this.apply(next);
  },
};

// ============================================================
// 分类筛选
// ============================================================
function initCategories() {
  const container = document.getElementById("categoryBar");
  if (!container || typeof CATEGORIES === "undefined") return;

  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "category-btn" + (cat.id === "all" ? " active" : "");
    btn.dataset.category = cat.id;
    btn.innerHTML = `<span>${cat.icon}</span><span>${cat.label}</span>`;
    btn.addEventListener("click", () => {
      state.currentCategory = cat.id;
      document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTools();
    });
    container.appendChild(btn);
  });
}

// ============================================================
// 搜索
// ============================================================
function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  let debounceTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderTools();
    }, 200);
  });

  // ESC 清空搜索
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      state.searchQuery = "";
      renderTools();
    }
  });
}

// ============================================================
// 工具卡片渲染
// ============================================================
function getCategoryLabel(categoryId) {
  if (typeof CATEGORIES === "undefined") return "";
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat ? `${cat.icon} ${cat.label}` : "";
}

function createToolCard(tool) {
  const card = document.createElement("article");
  card.className = "tool-card" + (tool.featured ? " featured" : "");
  card.dataset.id = tool.id;

  const tagsHtml = tool.tags
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join("");

  card.innerHTML = `
    ${tool.featured ? '<span class="featured-badge">精选</span>' : ""}
    <div class="card-header">
      <div class="card-icon" id="icon-${tool.id}">
        <span class="card-icon-fallback">🔧</span>
      </div>
      <div>
        <div class="card-title">${escapeHtml(tool.name)}</div>
        <div class="card-category-label">${getCategoryLabel(tool.category)}</div>
      </div>
    </div>
    <p class="card-desc">${escapeHtml(tool.description)}</p>
    <div class="card-tags">${tagsHtml}</div>
    <div class="card-footer">
      ${tool.content
        ? `<a href="pages/template.html?id=${tool.id}" class="visit-btn">📖 教程</a>`
        : `<a href="${tool.url}" target="_blank" rel="noopener noreferrer" class="visit-btn">
            ↗ 访问
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>`
      }
      <a href="pages/template.html?id=${tool.id}" class="detail-link">详情 →</a>
    </div>
  `;

  // 异步加载图标，失败时保留 fallback emoji
  loadIcon(tool, card.querySelector(`#icon-${tool.id}`));

  return card;
}

function loadIcon(tool, container) {
  if (!tool.icon) return;
  const img = document.createElement("img");
  img.alt = tool.name;
  img.onload = () => {
    container.innerHTML = "";
    container.appendChild(img);
  };
  img.onerror = () => {
    // 保持 fallback，根据分类显示不同 emoji
    const fallbackMap = {
      dev: "🛠️",
      hosting: "🌐",
      security: "🔒",
      ops: "📊",
      design: "🎨",
    };
    const fallback = container.querySelector(".card-icon-fallback");
    if (fallback) fallback.textContent = fallbackMap[tool.category] || "🔧";
  };
  img.src = tool.icon;
}

function filterTools() {
  if (typeof TOOLS_DATA === "undefined") return [];
  return TOOLS_DATA.filter((tool) => {
    const matchCategory =
      state.currentCategory === "all" || tool.category === state.currentCategory;
    const q = state.searchQuery;
    const matchSearch =
      !q ||
      tool.name.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchCategory && matchSearch;
  });
}

function renderTools() {
  const grid = document.getElementById("toolsGrid");
  const emptyState = document.getElementById("emptyState");
  const statsCount = document.getElementById("statsCount");
  if (!grid) return;

  const filtered = filterTools();

  // 更新统计
  if (statsCount) statsCount.textContent = filtered.length;

  // 清空并重渲染
  grid.innerHTML = "";

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.add("visible");
    return;
  }

  if (emptyState) emptyState.classList.remove("visible");

  // 精选工具优先显示
  const sorted = [...filtered].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });

  sorted.forEach((tool) => {
    grid.appendChild(createToolCard(tool));
  });
}

// ============================================================
// 工具函数
// ============================================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ============================================================
// 初始化
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => ThemeManager.toggle());
  }

  initCategories();
  initSearch();
  renderTools();
});

// 暴露给详情页使用
window.ThemeManager = ThemeManager;
window.TOOLS_DATA = typeof TOOLS_DATA !== "undefined" ? TOOLS_DATA : [];
