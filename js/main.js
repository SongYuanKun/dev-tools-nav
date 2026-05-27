/**
 * Koen 工具箱 - 主交互逻辑
 * 功能：暗色模式、分类筛选、实时搜索、卡片渲染
 */

// ============================================================
// 状态
// ============================================================
const state = {
  currentCategory: "all",
  searchQuery: "",
  secretUnlocked: false,
};

// ============================================================
// 安全存储（兼容隐私模式/受限环境）
// ============================================================
const SafeStorage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================================
// 收藏管理（localStorage）
// ============================================================
const Favorites = {
  STORAGE_KEY: "devtools-favorites",
  _set: null,

  _load() {
    if (this._set) return;
    try {
      this._set = new Set(JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || []);
    } catch { this._set = new Set(); }
  },

  getAll() {
    this._load();
    return [...this._set];
  },

  has(id) {
    this._load();
    return this._set.has(id);
  },

  toggle(id) {
    this._load();
    const existed = this._set.has(id);
    if (existed) { this._set.delete(id); } else { this._set.add(id); }
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...this._set]));
    } catch {
      /* 忽略配额/隐私模式异常，保持内存态可用 */
    }
    return !existed;
  },
};

// ============================================================
// 最近访问记录（localStorage）
// ============================================================
const RecentVisits = {
  STORAGE_KEY: "devtools-recent",
  MAX: 8,

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch { return []; }
  },

  add(id) {
    let list = this.getAll().filter((i) => i !== id);
    list.unshift(id);
    if (list.length > this.MAX) list = list.slice(0, this.MAX);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* 忽略配额/隐私模式异常，保持页面功能可用 */
    }
  },
};

// ============================================================
// 暗色模式
// ============================================================
const ThemeManager = {
  STORAGE_KEY: "dev-tools-theme",

  init() {
    const saved = SafeStorage.get(this.STORAGE_KEY);
    if (saved) {
      this.apply(saved);
    } else {
      this.apply("dark");
    }
  },

  apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.textContent = theme === "dark" ? "亮色" : "暗色";
      btn.setAttribute("title", theme === "dark" ? "切换到亮色模式" : "切换到暗色模式");
    }
  },

  toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    SafeStorage.set(this.STORAGE_KEY, next);
    this.apply(next);
  },
};

// ============================================================
// 彩蛋系统 - 激活工具分类解锁
// ============================================================
const EasterEgg = {
  SECRET_KEY: "devtools2024", // URL 参数密钥
  SECRET_CLICKS: 7, // Logo 点击次数
  CLICK_TIMEOUT: 3000, // 点击超时时间(ms)
  STORAGE_KEY: "devtools-secret-unlocked",

  // 检查是否已解锁
  isUnlocked() {
    return SafeStorage.get(this.STORAGE_KEY) === "true" || state.secretUnlocked;
  },

  // 解锁彩蛋
  unlock() {
    state.secretUnlocked = true;
    SafeStorage.set(this.STORAGE_KEY, "true");
    this.showToast("恭喜，发现隐藏分类！");
    this.revealSecretCategory();
    this.addSecretConfetti();
    window.umami?.track?.("easter_egg_unlocked");
  },

  // 显示提示（完整版，用于解锁成功等场景）
  showToast(message) {
    const existing = document.querySelector(".secret-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "secret-toast";
    toast.innerHTML = `
      <div class="secret-toast-content">
        <span class="secret-toast-icon">!</span>
        <span class="secret-toast-message">${message}</span>
      </div>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // 轻量级提示（用于点击计数，避免卡顿）
  showLightToast(message, existingEl) {
    // 复用已有元素，减少 DOM 操作
    if (existingEl && document.body.contains(existingEl)) {
      const msgEl = existingEl.querySelector(".secret-toast-message");
      if (msgEl) {
        msgEl.textContent = message;
        return existingEl;
      }
    }

    // 首次创建
    if (existingEl) existingEl.remove();
    
    const toast = document.createElement("div");
    toast.className = "secret-toast light";
    toast.innerHTML = `<span class="secret-toast-message">${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    return toast;
  },

  // 揭示隐藏分类
  revealSecretCategory() {
    const activateCat = CATEGORIES.find(c => c.id === "activate");
    if (!activateCat) return;

    const container = document.getElementById("categoryBar");
    if (!container) return;

    // 检查是否已存在
    if (container.querySelector(`[data-category="activate"]`)) return;

    const btn = document.createElement("button");
    btn.className = "category-btn secret-category";
    btn.dataset.category = "activate";
    btn.innerHTML = `<span>${activateCat.icon}</span><span>${activateCat.label}</span>`;
    btn.addEventListener("click", () => {
      state.currentCategory = "activate";
      activateCategoryBtn(btn);
      renderTools();
    });

    container.appendChild(btn);

    // 添加动画效果
    setTimeout(() => {
      btn.classList.add("animate-in");
    }, 100);
  },

  // 撒花效果
  addSecretConfetti() {
    const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement("div");
      confetti.className = "secret-confetti";
      confetti.style.left = Math.random() * 100 + "vw";
      confetti.style.top = "-20px";
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 2 + "s";
      confetti.style.animationDuration = (2 + Math.random() * 2) + "s";
      document.body.appendChild(confetti);

      setTimeout(() => confetti.remove(), 5000);
    }
  },

  // 初始化彩蛋系统
  init() {
    // 1. 检查 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get(this.SECRET_KEY) === "unlock") {
      this.unlock();
      // 清理 URL 参数
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // 2. 检查已解锁状态
    if (this.isUnlocked()) {
      this.revealSecretCategory();
    }

    // 3. Logo 点击序列（兼容单击回首页）
    const logoClick = { timer: null, navTimer: null, count: 0, toast: null };
    const NAV_DELAY = 300;

    const logo = document.querySelector(".logo");
    if (logo) {
      logo.addEventListener("click", (e) => {
        e.preventDefault();
        clearTimeout(logoClick.timer);
        clearTimeout(logoClick.navTimer);
        logoClick.count++;

        if (logoClick.count === 1) {
          logoClick.navTimer = setTimeout(() => {
            logoClick.count = 0;
            window.location.href = logo.href;
          }, NAV_DELAY);
          return;
        }

        const remaining = this.SECRET_CLICKS - logoClick.count;
        const messages = { 2: "继续点击...", 4: `还需要 ${remaining} 次...`, 6: "最后一次点击" };
        if (messages[logoClick.count]) {
          logoClick.toast = this.showLightToast(messages[logoClick.count], logoClick.toast);
        }

        if (logoClick.count >= this.SECRET_CLICKS) {
          logoClick.count = 0;
          if (logoClick.toast) { logoClick.toast.remove(); logoClick.toast = null; }
          this.unlock();
          return;
        }

        logoClick.timer = setTimeout(() => {
          logoClick.count = 0;
          if (logoClick.toast) { logoClick.toast.remove(); logoClick.toast = null; }
        }, 1500);
      });
    }

    // 4. 搜索框密钥
    const searchInput = getDom("searchInput");
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        // Ctrl+Shift+A 或 Cmd+Shift+A
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
          e.preventDefault();
          this.unlock();
        }
      });
    }

    // 5. Konami 代码
    const konamiSequence = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
      "b", "a"
    ];
    let konamiIndex = 0;

    document.addEventListener("keydown", (e) => {
      if (e.key === konamiSequence[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiSequence.length) {
          this.unlock();
          konamiIndex = 0;
        }
      } else {
        konamiIndex = 0;
      }
    });

    // 6. 页脚神秘问号
    const footerHint = document.querySelector(".footer-secret-hint");
    if (footerHint) {
      let hintClickCount = 0;
      footerHint.addEventListener("click", () => {
        hintClickCount++;
        const hints = [
          "秘密藏在暗处...",
          "有时候，答案就在眼前...",
          "尝试点击 Logo？",
          "还记得 Konami 代码吗？",
          "URL 参数也能解锁秘密...",
          "Ctrl+Shift+A 可能会有惊喜...",
          "再点一次试试？"
        ];

        if (hintClickCount < hints.length) {
          this.showToast(hints[hintClickCount - 1]);
        } else {
          this.unlock();
          hintClickCount = 0;
        }
      });
    }
  },
};

// ============================================================
// 分类筛选
// ============================================================
function initCategories() {
  const container = document.getElementById("categoryBar");
  if (!container || typeof CATEGORIES === "undefined") return;

  const extraTabs = [
    { id: "favorites", label: "我的收藏", icon: "*" },
    { id: "recent", label: "最近访问", icon: "REC" },
  ];

  CATEGORIES.filter((cat) => !cat.hidden).forEach((cat, i) => {
    const btn = createCategoryBtn(cat, container);
    if (cat.id === "all") btn.classList.add("active");
    container.appendChild(btn);

    if (i === 0) {
      extraTabs.forEach((tab) => container.appendChild(createCategoryBtn(tab, container)));
    }
  });
}

function activateCategoryBtn(btn) {
  document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

function createCategoryBtn(cat, container) {
  const btn = document.createElement("button");
  btn.className = "category-btn";
  btn.dataset.category = cat.id;
  btn.innerHTML = `<span>${cat.icon}</span><span>${cat.label}</span>`;
  btn.addEventListener("click", () => {
    state.currentCategory = cat.id;
    activateCategoryBtn(btn);
    renderTools();
    window.umami?.track?.("category_switch", { category: cat.id });
  });
  return btn;
}

// ============================================================
// 搜索
// ============================================================
function initSearch() {
  const input = getDom("searchInput");
  if (!input) return;

  let debounceTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      const count = renderTools();
      if (state.searchQuery.length > 1) {
        window.umami?.track?.("search", {
          query: state.searchQuery,
          results_count: count,
          has_results: count > 0,
        });
      }
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

/** 与首页 JSON-LD SearchAction 的 ?q= 参数对齐，支持从搜索结果或分享链接带参打开 */
function initSearchFromUrl() {
  const input = getDom("searchInput");
  if (!input) return;
  let q = "";
  try {
    q = new URLSearchParams(window.location.search).get("q") || "";
  } catch {
    return;
  }
  q = q.trim();
  if (!q) return;
  input.value = q;
  state.searchQuery = q.toLowerCase();
}

// ============================================================
// 工具卡片渲染
// ============================================================
function getCategoryLabel(categoryId) {
  if (typeof CATEGORIES === "undefined") return "";
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat ? `${cat.icon} ${cat.label}` : "";
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch { return ""; }
}

function createToolCard(tool) {
  const card = document.createElement("article");
  card.className = "tool-card" + (tool.featured ? " featured" : "");
  const isFav = Favorites.has(tool.id);
  if (isFav) card.classList.add("favorited");
  card.dataset.id = tool.id;
  const safeName = String(tool.name || "");
  const safeDescription = String(tool.description || "");
  const safeCategory = String(tool.category || "");

  const safeTags = Array.isArray(tool.tags) ? tool.tags : [];
  const tagsHtml = safeTags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");

  const safeUrl = typeof tool.url === "string" ? tool.url : "#";
  const domain = safeUrl.startsWith("http") ? getDomain(safeUrl) : "";
  const domainHtml = domain ? `<span class="card-domain">${domain}</span>` : "";

  card.innerHTML = `
    ${tool.featured ? '<span class="featured-badge">精选</span>' : ""}
    <button class="fav-btn${isFav ? " active" : ""}" data-id="${tool.id}" title="${isFav ? "取消收藏" : "收藏"}">
      ${isFav ? "★" : "☆"}
    </button>
    <div class="card-header">
      <div class="card-icon" id="icon-${tool.id}">
        <span class="card-icon-fallback">TOOL</span>
      </div>
      <div>
        <div class="card-title">${escapeHtml(safeName)}</div>
        <div class="card-category-label">${getCategoryLabel(safeCategory)}${domainHtml}</div>
      </div>
    </div>
    <p class="card-desc">${escapeHtml(safeDescription)}</p>
    <div class="card-tags">${tagsHtml}</div>
    <div class="card-footer">
      ${tool.content
        ? `<a href="pages/template.html?id=${tool.id}" class="visit-btn" data-tool-id="${tool.id}">教程</a>`
        : (safeCategory === "activate" || safeCategory === "online-tools")
          ? `<a href="${safeUrl}" class="visit-btn" data-tool-id="${tool.id}">${safeCategory === "online-tools" ? "使用" : "访问"}</a>`
          : `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="visit-btn" data-tool-id="${tool.id}">
            ↗ 访问
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>`
      }
      <a href="${(safeCategory === "activate" || safeCategory === "online-tools") ? safeUrl : `pages/template.html?id=${tool.id}`}" class="detail-link" data-tool-id="${tool.id}">${safeCategory === "online-tools" ? "打开 →" : "详情 →"}</a>
    </div>
  `;

  const iconContainer = card.querySelector(`#icon-${tool.id}`);
  if (iconContainer) loadIcon(tool, iconContainer);

  card.querySelector(".fav-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const added = Favorites.toggle(tool.id);
    window.umami?.track?.("favorite_toggle", {
      tool_id: tool.id,
      tool_name: tool.name,
      action: added ? "add" : "remove",
    });
    if (!added && state.currentCategory === "favorites") {
      renderTools();
      return;
    }
    const btn = e.currentTarget;
    btn.classList.toggle("active", added);
    btn.textContent = added ? "★" : "☆";
    btn.title = added ? "取消收藏" : "收藏";
    card.classList.toggle("favorited", added);
  });

  // 记录访问 + 埋点
  card.querySelectorAll("[data-tool-id]").forEach((link) => {
    link.addEventListener("click", () => {
      RecentVisits.add(tool.id);
      window.umami?.track?.("tool_click", {
        tool_id: tool.id,
        tool_name: tool.name,
        category: tool.category,
        action: link.classList.contains("visit-btn") ? "visit" : "detail",
      });
    });
  });

  return card;
}

const ICON_FALLBACK_MAP = {
  dev: "DEV", hosting: "WEB", security: "SEC",
  ops: "OPS", design: "UI", ai: "AI", activate: "KEY",
  "online-tools": "TOOL",
};

// 共享单个懒加载 observer，避免每个图标创建新实例
const _iconPending = new WeakMap();
const _iconObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const pending = _iconPending.get(entry.target);
        if (pending) pending.img.src = pending.src;
        _iconObserver.unobserve(entry.target);
        _iconPending.delete(entry.target);
      });
    }, { rootMargin: "120px" })
  : null;

function loadIcon(tool, container) {
  if (!container) return;
  if (typeof tool.icon !== "string" || !tool.icon) return;

  const isEmoji = tool.icon.length <= 2 && !tool.icon.startsWith("http") && !tool.icon.startsWith("/");
  if (isEmoji) {
    const fallback = container.querySelector(".card-icon-fallback");
    if (fallback) fallback.textContent = tool.icon;
    return;
  }

  const img = document.createElement("img");
  img.alt = tool.name;
  img.onload = () => {
    container.innerHTML = "";
    container.appendChild(img);
  };
  img.onerror = () => {
    const fallback = container.querySelector(".card-icon-fallback");
    if (fallback) fallback.textContent = ICON_FALLBACK_MAP[tool.category] || "🔧";
  };

  if (_iconObserver) {
    _iconPending.set(container, { img, src: tool.icon });
    _iconObserver.observe(container);
  } else {
    img.src = tool.icon;
  }
}

// 预计算隐藏分类 Set，O(1) 查找替代每次 O(n) 线性扫描
function getHiddenCategoryIds() {
  if (!getHiddenCategoryIds._cache && typeof CATEGORIES !== "undefined") {
    getHiddenCategoryIds._cache = new Set(CATEGORIES.filter((c) => c.hidden).map((c) => c.id));
  }
  return getHiddenCategoryIds._cache || new Set();
}

function isCategoryHidden(categoryId) {
  return getHiddenCategoryIds().has(categoryId);
}

// O(1) 查找索引，避免 O(n²) 的 find 循环
function getToolsIndex() {
  if (typeof TOOLS_DATA === "undefined") return new Map();
  if (!getToolsIndex._cache) {
    getToolsIndex._cache = new Map(TOOLS_DATA.map((t) => [t.id, t]));
  }
  return getToolsIndex._cache;
}

function filterTools() {
  if (typeof TOOLS_DATA === "undefined") return [];

  const isSecretCategory = state.currentCategory === "activate";
  const isSpecialTab = state.currentCategory === "favorites" || state.currentCategory === "recent";
  const index = getToolsIndex();

  let pool;
  if (state.currentCategory === "favorites") {
    pool = Favorites.getAll().map((id) => index.get(id)).filter(Boolean);
  } else if (state.currentCategory === "recent") {
    pool = RecentVisits.getAll().map((id) => index.get(id)).filter(Boolean);
  } else {
    pool = TOOLS_DATA;
  }

  const q = state.searchQuery;
  const words = q ? q.split(/\s+/).filter(Boolean) : [];

  return pool.filter((tool) => {
    if (!isSecretCategory && !isSpecialTab && tool.hidden === true) return false;
    if (!isSecretCategory && !isSpecialTab && isCategoryHidden(tool.category)) return false;
    const matchCategory = isSpecialTab || state.currentCategory === "all" || tool.category === state.currentCategory;
    if (!matchCategory) return false;
    if (!words.length) return true;
    const name = String(tool.name || "").toLowerCase();
    const desc = String(tool.description || "").toLowerCase();
    const tags = (Array.isArray(tool.tags) ? tool.tags : []).map((t) => String(t).toLowerCase());
    return words.every((w) => name.includes(w) || desc.includes(w) || tags.some((t) => t.includes(w)));
  });
}

// 缓存频繁访问的 DOM 元素
const _dom = {};
function getDom(id) {
  if (!_dom[id]) _dom[id] = document.getElementById(id);
  return _dom[id];
}

function renderTools() {
  const grid = getDom("toolsGrid");
  const emptyState = getDom("emptyState");
  const statsCount = getDom("statsCount");
  if (!grid) return;

  const filtered = filterTools();

  if (statsCount) statsCount.textContent = filtered.length;

  // AI 专题横幅：选中 AI 分类或全部时显示
  const aiBanner = getDom("aiBanner");
  if (aiBanner) {
    const showBanner = state.currentCategory === "ai" || state.currentCategory === "all";
    aiBanner.classList.toggle("is-hidden", !showBanner);
  }

  grid.innerHTML = "";

  if (filtered.length === 0) {
    if (emptyState) {
      const icon = emptyState.querySelector(".empty-icon");
      const title = emptyState.querySelector(".empty-title");
      const desc = emptyState.querySelector(".empty-desc");
      if (state.currentCategory === "favorites") {
        if (icon) icon.textContent = "*";
        if (title) title.textContent = "还没有收藏任何工具";
        if (desc) desc.textContent = "浏览工具列表，点击 ☆ 收藏喜欢的工具";
      } else if (state.currentCategory === "recent") {
        if (icon) icon.textContent = "REC";
        if (title) title.textContent = "还没有访问记录";
        if (desc) desc.textContent = "点击工具的「访问」或「详情」后会自动记录";
      } else {
        if (icon) icon.textContent = "NO";
        if (title) title.textContent = "没有找到相关工具";
        if (desc) desc.textContent = "试试其他关键词，或切换分类查看";
      }
      emptyState.classList.add("visible");
    }
    return;
  }

  if (emptyState) emptyState.classList.remove("visible");

  const sorted = state.currentCategory === "favorites" || state.currentCategory === "recent"
    ? filtered
    : [...filtered].sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return 0;
      });

  const fragment = document.createDocumentFragment();
  sorted.forEach((tool) => fragment.appendChild(createToolCard(tool)));
  grid.appendChild(fragment);
  return filtered.length;
}

// ============================================================
// 工具函数
// ============================================================
const _escapeMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => _escapeMap[c]);
}

// ============================================================
// 最新动态渲染（优先 fetch data/csdn-articles.json，由 CI 从 CSDN RSS 生成）
// ============================================================
async function initArticles() {
  const section = document.getElementById("articlesSection");
  const grid = document.getElementById("articlesGrid");
  if (!section || !grid) return;

  let articles = [];
  try {
    const res = await fetch("data/csdn-articles.json", { cache: "default" });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        articles = data.items.slice(0, 3);
      }
    }
  } catch {
    /* file:// 或网络失败时走下方兜底 */
  }

  if (articles.length === 0 && typeof ARTICLES_DATA !== "undefined") {
    articles = ARTICLES_DATA.slice(0, 3);
  }

  if (articles.length === 0) return;

  section.classList.remove("is-hidden");

  grid.innerHTML = articles.map((a) => {
    const tags = Array.isArray(a.tags) ? a.tags : [];
    const tagsHtml = tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    const platform = a.platform || "CSDN";
    const dateStr = a.date || "";
    let safeUrl = "#";
    try { const u = new URL(a.url); if (u.protocol === "https:" || u.protocol === "http:") safeUrl = a.url; } catch (_) {}

    return `
      <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="article-card">
        <div class="article-meta">
          <span class="article-platform">${escapeHtml(platform)}</span>
          <span>${escapeHtml(dateStr)}</span>
        </div>
        <h3 class="article-card-title">${escapeHtml(a.title)}</h3>
        <p class="article-card-desc">${escapeHtml(a.description || "")}</p>
        <div class="article-card-tags">${tagsHtml}</div>
      </a>
    `;
  }).join("");
}

// ============================================================
// 信任指标
// ============================================================
function initTrustBar() {
  const toolCountEl = document.getElementById("trustToolCount");
  const catCountEl = document.getElementById("trustCategoryCount");
  const heroCountEl = document.getElementById("heroToolCount");

  if (typeof TOOLS_DATA !== "undefined") {
    const count = TOOLS_DATA.filter((t) => !t.hidden && !isCategoryHidden(t.category)).length;
    if (toolCountEl) animateCounter(toolCountEl, count);
    if (heroCountEl) heroCountEl.textContent = count + "+";
  }
  if (catCountEl && typeof CATEGORIES !== "undefined") {
    const count = CATEGORIES.filter((c) => !c.hidden && c.id !== "all").length;
    animateCounter(catCountEl, count);
  }
}

function animateCounter(el, target) {
  let current = 0;
  const step = Math.max(1, Math.floor(target / 15));
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current;
  }, 50);
}

/** 双线路引流：高亮当前访问域名对应的入口 */
function initHeroMirror() {
  const host = window.location.hostname;
  document.querySelectorAll(".hero-mirror-link").forEach((a) => {
    try {
      if (new URL(a.href).hostname === host) {
        a.classList.add("hero-mirror-link--current");
        a.setAttribute("aria-current", "page");
      }
    } catch (_) { /* ignore */ }
  });
}

// ============================================================
// 侧边面板
// ============================================================
function initSidePanel() {
  const toggle = document.getElementById("sidePanelToggle");
  const content = document.getElementById("sidePanelContent");

  if (!toggle || !content) return;

  let isOpen = false;

  // 点击切换
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    content.classList.toggle("active", isOpen);
  });

  // 点击外部关闭
  document.addEventListener("click", (e) => {
    if (isOpen && !content.contains(e.target) && !toggle.contains(e.target)) {
      isOpen = false;
      content.classList.remove("active");
    }
  });

  // ESC 关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      isOpen = false;
      content.classList.remove("active");
    }
  });
}

// ============================================================
// 回到顶部
// ============================================================
function initBackToTop() {
  const btn = document.getElementById("backToTop");
  if (!btn) return;

  const onScroll = () => {
    btn.classList.toggle("visible", window.scrollY > 400);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ============================================================
// 全站图片兜底：外部 favicon 服务不可用时不显示破图
// ============================================================
function initImageFallbacks() {
  const handled = new WeakSet();

  const fallbackText = (img) => {
    const label = (img.alt || img.closest("a, span, td, div")?.textContent || "").trim();
    if (!label) return "AI";
    return /[\u4e00-\u9fa5]/.test(label) ? label.slice(0, 1) : label.slice(0, 1).toUpperCase();
  };

  const replaceBrokenImg = (img) => {
    if (!(img instanceof HTMLImageElement) || handled.has(img)) return;
    if (!img.matches(".tool-favicon, .tool-favicon-sm, .tool-favicon-xs, .ai-topic-badge-icon")) return;
    handled.add(img);

    const fallback = document.createElement("span");
    fallback.className = `${img.className} icon-fallback-chip`;
    fallback.textContent = fallbackText(img);
    fallback.setAttribute("aria-hidden", img.alt ? "true" : "false");
    img.replaceWith(fallback);
  };

  document.addEventListener("error", (event) => {
    replaceBrokenImg(event.target);
  }, true);

  // 兼容脚本动态插入但 error 事件已错过的图片。
  const check = (root = document) => {
    root.querySelectorAll?.("img.tool-favicon, img.tool-favicon-sm, img.tool-favicon-xs, img.ai-topic-badge-icon").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) replaceBrokenImg(img);
    });
  };

  check();
  new MutationObserver((mutations) => {
    mutations.forEach((m) => m.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches?.("img")) check(node.parentElement || document);
      else check(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}

// ============================================================
// 顶栏下拉增强：点击外部 / Esc 关闭，保持静态 details 的低成本实现
// ============================================================
function initNavMenu() {
  const menus = Array.from(document.querySelectorAll(".nav-menu"));
  if (!menus.length) return;

  document.addEventListener("click", (event) => {
    menus.forEach((menu) => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    menus.forEach((menu) => { menu.open = false; });
  });
}

// ============================================================
// 键盘快捷键
// ============================================================
function initKeyboard() {
  let _categoryBtns = null;
  const getCategoryBtns = () => {
    if (!_categoryBtns) _categoryBtns = Array.from(document.querySelectorAll(".category-btn:not(.secret-category)"));
    return _categoryBtns;
  };
  // 分类按钮变化时（如彩蛋解锁新增按钮）清除缓存
  const categoryBar = document.getElementById("categoryBar");
  if (categoryBar) new MutationObserver(() => { _categoryBtns = null; }).observe(categoryBar, { childList: true });

  const searchInput = getDom("searchInput");

  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);

    if (e.key === "/" && !isInput) {
      e.preventDefault();
      if (searchInput) searchInput.focus();
      return;
    }

    if (e.key === "Escape" && isInput && active === searchInput) {
      searchInput.value = "";
      state.searchQuery = "";
      renderTools();
      searchInput.blur();
      return;
    }

    if (!isInput && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const btns = getCategoryBtns();
      if (btns.length === 0) return;
      const currentIdx = btns.findIndex((b) => b.classList.contains("active"));
      const nextIdx = e.key === "ArrowLeft"
        ? (currentIdx <= 0 ? btns.length - 1 : currentIdx - 1)
        : (currentIdx >= btns.length - 1 ? 0 : currentIdx + 1);
      btns[nextIdx].click();
      btns[nextIdx].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  });
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
  initSearchFromUrl();
  renderTools(); /* initSearchFromUrl 可能已写入 state.searchQuery */
  void initArticles();
  initTrustBar();
  initHeroMirror();
  initBackToTop();
  initImageFallbacks();
  initNavMenu();
  initKeyboard();
  EasterEgg.init();
  initSidePanel();
});

// 暴露给详情页使用
window.ThemeManager = ThemeManager;
window.TOOLS_DATA = typeof TOOLS_DATA !== "undefined" ? TOOLS_DATA : [];
window.escapeHtml = escapeHtml;
