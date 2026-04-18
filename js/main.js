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
  secretUnlocked: false,
  clickSequence: [],
  konamiCode: [],
};

// ============================================================
// 收藏管理（localStorage）
// ============================================================
const Favorites = {
  STORAGE_KEY: "devtools-favorites",

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch { return []; }
  },

  has(id) {
    return this.getAll().includes(id);
  },

  toggle(id) {
    const favs = this.getAll();
    const idx = favs.indexOf(id);
    if (idx === -1) { favs.push(id); } else { favs.splice(idx, 1); }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favs));
    return idx === -1;
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
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  },
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
// 彩蛋系统 - 激活工具分类解锁
// ============================================================
const EasterEgg = {
  SECRET_KEY: "devtools2024", // URL 参数密钥
  SECRET_CLICKS: 7, // Logo 点击次数
  CLICK_TIMEOUT: 3000, // 点击超时时间(ms)
  STORAGE_KEY: "devtools-secret-unlocked",

  // 检查是否已解锁
  isUnlocked() {
    return localStorage.getItem(this.STORAGE_KEY) === "true" || state.secretUnlocked;
  },

  // 解锁彩蛋
  unlock() {
    state.secretUnlocked = true;
    localStorage.setItem(this.STORAGE_KEY, "true");
    this.showToast("🎉 恭喜！发现隐藏分类！");
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
        <span class="secret-toast-icon">🔮</span>
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
      document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
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
    let clickTimer = null;
    let navTimer = null;
    let clickCount = 0;
    let toastEl = null;
    const NAV_DELAY = 300;

    const logo = document.querySelector(".logo");
    if (logo) {
      logo.addEventListener("click", (e) => {
        e.preventDefault();
        clearTimeout(clickTimer);
        clearTimeout(navTimer);
        clickCount++;

        if (clickCount === 1) {
          // 首次点击：等一小段时间，没有后续点击就正常跳转
          navTimer = setTimeout(() => {
            clickCount = 0;
            window.location.href = logo.href;
          }, NAV_DELAY);
          return;
        }

        // 第 2 次及之后进入彩蛋流程
        const remaining = this.SECRET_CLICKS - clickCount;
        const messages = {
          2: "🤔 继续点击...",
          4: `🔍 还需要 ${remaining} 次...`,
          6: "✨ 最后一击！"
        };

        if (messages[clickCount]) {
          toastEl = this.showLightToast(messages[clickCount], toastEl);
        }

        if (clickCount >= this.SECRET_CLICKS) {
          clickCount = 0;
          if (toastEl) { toastEl.remove(); toastEl = null; }
          this.unlock();
          return;
        }

        clickTimer = setTimeout(() => {
          clickCount = 0;
          if (toastEl) { toastEl.remove(); toastEl = null; }
        }, 1500);
      });
    }

    // 4. 搜索框密钥
    const searchInput = document.getElementById("searchInput");
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
          "🔮 秘密藏在暗处...",
          "✨ 有时候，答案就在眼前...",
          "🎯 尝试点击 Logo？",
          "🎮 还记得 Konami 代码吗？",
          "🔑 URL 参数也能解锁秘密...",
          "🎨 Ctrl+Shift+A 可能会有惊喜...",
          "🎉 再点一次试试？"
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
    { id: "favorites", label: "我的收藏", icon: "⭐" },
    { id: "recent", label: "最近访问", icon: "🕐" },
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

function createCategoryBtn(cat, container) {
  const btn = document.createElement("button");
  btn.className = "category-btn";
  btn.dataset.category = cat.id;
  btn.innerHTML = `<span>${cat.icon}</span><span>${cat.label}</span>`;
  btn.addEventListener("click", () => {
    state.currentCategory = cat.id;
    document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderTools();
  });
  return btn;
}

// ============================================================
// 搜索
// ============================================================
function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  if (window.innerWidth <= 768) {
    input.placeholder = "搜索工具…";
  }

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

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch { return ""; }
}

function createToolCard(tool) {
  const card = document.createElement("article");
  card.className = "tool-card" + (tool.featured ? " featured" : "");
  if (Favorites.has(tool.id)) card.classList.add("favorited");
  card.dataset.id = tool.id;

  const tagsHtml = tool.tags
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join("");

  const domain = tool.url.startsWith("http") ? getDomain(tool.url) : "";
  const domainHtml = domain ? `<span class="card-domain">${domain}</span>` : "";
  const isFav = Favorites.has(tool.id);

  card.innerHTML = `
    ${tool.featured ? '<span class="featured-badge">精选</span>' : ""}
    <button class="fav-btn${isFav ? " active" : ""}" data-id="${tool.id}" title="${isFav ? "取消收藏" : "收藏"}">
      ${isFav ? "★" : "☆"}
    </button>
    <div class="card-header">
      <div class="card-icon" id="icon-${tool.id}">
        <span class="card-icon-fallback">🔧</span>
      </div>
      <div>
        <div class="card-title">${escapeHtml(tool.name)}</div>
        <div class="card-category-label">${getCategoryLabel(tool.category)}${domainHtml}</div>
      </div>
    </div>
    <p class="card-desc">${escapeHtml(tool.description)}</p>
    <div class="card-tags">${tagsHtml}</div>
    <div class="card-footer">
      ${tool.content
        ? `<a href="pages/template.html?id=${tool.id}" class="visit-btn" data-tool-id="${tool.id}">📖 教程</a>`
        : (tool.category === "activate" || tool.category === "online-tools")
          ? `<a href="${tool.url}" class="visit-btn" data-tool-id="${tool.id}">${tool.category === "online-tools" ? "🧰 使用" : "📖 访问"}</a>`
          : `<a href="${tool.url}" target="_blank" rel="noopener noreferrer" class="visit-btn" data-tool-id="${tool.id}">
            ↗ 访问
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>`
      }
      <a href="${(tool.category === "activate" || tool.category === "online-tools") ? tool.url : `pages/template.html?id=${tool.id}`}" class="detail-link" data-tool-id="${tool.id}">${tool.category === "online-tools" ? "打开 →" : "详情 →"}</a>
    </div>
  `;

  loadIcon(tool, card.querySelector(`#icon-${tool.id}`));

  card.querySelector(".fav-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const added = Favorites.toggle(tool.id);
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

  // 记录访问
  card.querySelectorAll("[data-tool-id]").forEach((link) => {
    link.addEventListener("click", () => RecentVisits.add(tool.id));
  });

  return card;
}

const ICON_FALLBACK_MAP = {
  dev: "🛠️", hosting: "🌐", security: "🔒",
  ops: "📊", design: "🎨", ai: "🤖", activate: "🔑",
  "online-tools": "🧰",
};

function loadIcon(tool, container) {
  if (!tool.icon) return;

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

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) {
        img.src = tool.icon;
        obs.disconnect();
      }
    }, { rootMargin: "120px" });
    observer.observe(container);
  } else {
    img.src = tool.icon;
  }
}

function isCategoryHidden(categoryId) {
  if (typeof CATEGORIES === "undefined") return false;
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat && cat.hidden === true;
}

function filterTools() {
  if (typeof TOOLS_DATA === "undefined") return [];

  let pool = TOOLS_DATA;

  if (state.currentCategory === "favorites") {
    const favIds = Favorites.getAll();
    pool = favIds.map((id) => TOOLS_DATA.find((t) => t.id === id)).filter(Boolean);
  } else if (state.currentCategory === "recent") {
    const recentIds = RecentVisits.getAll();
    pool = recentIds.map((id) => TOOLS_DATA.find((t) => t.id === id)).filter(Boolean);
  }

  return pool.filter((tool) => {
    const isSecretCategory = state.currentCategory === "activate";
    const isSpecialTab = state.currentCategory === "favorites" || state.currentCategory === "recent";
    if (!isSecretCategory && !isSpecialTab && tool.hidden === true) return false;
    if (!isSecretCategory && !isSpecialTab && isCategoryHidden(tool.category)) return false;
    const matchCategory =
      isSpecialTab || state.currentCategory === "all" || tool.category === state.currentCategory;
    const q = state.searchQuery;
    const matchSearch = !q || (() => {
      const words = q.split(/\s+/).filter(Boolean);
      const name = tool.name.toLowerCase();
      const desc = tool.description.toLowerCase();
      const tags = tool.tags.map((t) => t.toLowerCase());
      return words.every((w) => name.includes(w) || desc.includes(w) || tags.some((t) => t.includes(w)));
    })();
    return matchCategory && matchSearch;
  });
}

function renderTools() {
  const grid = document.getElementById("toolsGrid");
  const emptyState = document.getElementById("emptyState");
  const statsCount = document.getElementById("statsCount");
  if (!grid) return;

  const filtered = filterTools();

  if (statsCount) statsCount.textContent = filtered.length;

  // AI 专题横幅：选中 AI 分类或全部时显示
  const aiBanner = document.getElementById("aiBanner");
  if (aiBanner) {
    const showBanner = state.currentCategory === "ai" || state.currentCategory === "all";
    aiBanner.style.display = showBanner ? "flex" : "none";
  }

  grid.innerHTML = "";

  if (filtered.length === 0) {
    if (emptyState) {
      const icon = emptyState.querySelector(".empty-icon");
      const title = emptyState.querySelector(".empty-title");
      const desc = emptyState.querySelector(".empty-desc");
      if (state.currentCategory === "favorites") {
        if (icon) icon.textContent = "⭐";
        if (title) title.textContent = "还没有收藏任何工具";
        if (desc) desc.textContent = "浏览工具列表，点击 ☆ 收藏喜欢的工具";
      } else if (state.currentCategory === "recent") {
        if (icon) icon.textContent = "🕐";
        if (title) title.textContent = "还没有访问记录";
        if (desc) desc.textContent = "点击工具的「访问」或「详情」后会自动记录";
      } else {
        if (icon) icon.textContent = "🔍";
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

  section.style.display = "";

  grid.innerHTML = articles.map((a) => {
    const tags = Array.isArray(a.tags) ? a.tags : [];
    const tagsHtml = tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    const platform = a.platform || "CSDN";
    const dateStr = a.date || "";

    return `
      <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer" class="article-card">
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
// 键盘快捷键
// ============================================================
function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);

    // / 聚焦搜索框（不在输入框时）
    if (e.key === "/" && !isInput) {
      e.preventDefault();
      const input = document.getElementById("searchInput");
      if (input) input.focus();
      return;
    }

    // Esc 清空搜索并失焦
    if (e.key === "Escape" && isInput) {
      const input = document.getElementById("searchInput");
      if (input && active === input) {
        input.value = "";
        state.searchQuery = "";
        renderTools();
        input.blur();
      }
      return;
    }

    // 左右方向键切换分类（不在输入框时）
    if (!isInput && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const btns = Array.from(document.querySelectorAll(".category-btn:not(.secret-category)"));
      if (btns.length === 0) return;
      const currentIdx = btns.findIndex((b) => b.classList.contains("active"));
      let nextIdx;
      if (e.key === "ArrowLeft") {
        nextIdx = currentIdx <= 0 ? btns.length - 1 : currentIdx - 1;
      } else {
        nextIdx = currentIdx >= btns.length - 1 ? 0 : currentIdx + 1;
      }
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
  renderTools();
  void initArticles();
  initTrustBar();
  initHeroMirror();
  initBackToTop();
  initKeyboard();
  EasterEgg.init();
  initSidePanel();
});

// 暴露给详情页使用
window.ThemeManager = ThemeManager;
window.TOOLS_DATA = typeof TOOLS_DATA !== "undefined" ? TOOLS_DATA : [];
window.escapeHtml = escapeHtml;
