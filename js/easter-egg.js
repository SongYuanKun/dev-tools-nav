/**
 * 彩蛋系统 - 激活工具解锁（全站可用，不依赖 main.js）
 */
(function () {
  var STORAGE_KEY = "devtools-secret-unlocked";
  var SECRET_KEY = "devtools2024";
  var SECRET_CLICKS = 7;
  var initDone = false;
  var unlocked = false;
  var onUnlockCallbacks = [];

  var ACTIVATE_TOOLS = [
    {
      id: "kms",
      name: "KMS 激活",
      description: "Windows / Office / Server 全版本 KMS 激活工具",
      url: "pages/kms.html",
      icon: "💻",
      color: "#f59e0b",
    },
    {
      id: "jrebel",
      name: "JRebel 激活",
      description: "JRebel 热部署 License Server，支持 2023.4.0+",
      url: "tools/jrebel/",
      icon: "JR",
      color: "#8b5cf6",
    },
  ];

  var SafeStorage = {
    get: function (key) {
      try { return localStorage.getItem(key); } catch (_) { return null; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
    },
  };

  // 与 base.js 一致的根路径计算
  function getRootPrefix() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      try {
        var canonPath = new URL(canonical.href).pathname;
        var parts = canonPath.split("/").filter(Boolean);
        if (parts.length && parts[parts.length - 1].indexOf(".") !== -1) parts.pop();
        var canonHost = new URL(canonical.href).hostname;
        if (canonHost.endsWith(".github.io") && parts.length > 0) parts = parts.slice(1);
        return parts.length === 0 ? "" : parts.map(function () { return ".."; }).join("/") + "/";
      } catch (_) {}
    }
    var parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length && parts[parts.length - 1].indexOf(".") !== -1) parts.pop();
    return parts.length === 0 ? "" : parts.map(function () { return ".."; }).join("/") + "/";
  }

  function isUnlocked() {
    return unlocked || SafeStorage.get(STORAGE_KEY) === "true";
  }

  function showToast(message) {
    var existing = document.querySelector(".secret-toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.className = "secret-toast";
    toast.innerHTML =
      '<div class="secret-toast-content">' +
      '<span class="secret-toast-icon">!</span>' +
      '<span class="secret-toast-message">' + message + "</span>" +
      "</div>";
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("show"); });
    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  function showLightToast(message, existingEl) {
    if (existingEl && document.body.contains(existingEl)) {
      var msgEl = existingEl.querySelector(".secret-toast-message");
      if (msgEl) {
        msgEl.textContent = message;
        return existingEl;
      }
    }
    if (existingEl) existingEl.remove();

    var toast = document.createElement("div");
    toast.className = "secret-toast light";
    toast.innerHTML = '<span class="secret-toast-message">' + message + "</span>";
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("show"); });
    return toast;
  }

  function addSecretConfetti() {
    var colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
    for (var i = 0; i < 50; i++) {
      var confetti = document.createElement("div");
      confetti.className = "secret-confetti";
      confetti.style.left = Math.random() * 100 + "vw";
      confetti.style.top = "-20px";
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 2 + "s";
      confetti.style.animationDuration = 2 + Math.random() * 2 + "s";
      document.body.appendChild(confetti);
      setTimeout(function () { confetti.remove(); }, 5000);
    }
  }

  function appendActivateCardsToGrid(grid, prefix) {
    ACTIVATE_TOOLS.forEach(function (tool) {
      if (grid.querySelector('[data-secret-tool="' + tool.id + '"]')) return;
      var card = document.createElement("a");
      card.className = "tool-index-card secret-activate-card";
      card.href = prefix + tool.url;
      card.setAttribute("data-secret-tool", tool.id);
      card.style.setProperty("--t-color", tool.color);
      card.style.setProperty("--t-bg", tool.color + "1a");
      card.innerHTML =
        '<div class="tool-index-body">' +
        '<div class="tool-index-icon-wrap">' + tool.icon + "</div>" +
        '<div class="tool-index-name">' + tool.name + "</div>" +
        '<p class="tool-index-desc">' + tool.description + "</p>" +
        '<div class="tool-index-footer">' +
        '<div class="tool-index-tags"><span class="tag">激活</span></div>' +
        '<span class="tool-index-cta">使用 →</span>' +
        "</div></div>";
      grid.appendChild(card);
    });
  }

  function revealActivatePanel() {
    var prefix = getRootPrefix();
    var grid = document.getElementById("toolsGrid");
    if (grid) {
      appendActivateCardsToGrid(grid, prefix);
      return;
    }

    if (document.getElementById("secretActivatePanel")) return;

    var links = ACTIVATE_TOOLS.map(function (tool) {
      return (
        '<a class="secret-activate-link" href="' + prefix + tool.url + '">' +
        '<span class="secret-activate-icon">' + tool.icon + "</span>" +
        "<span><strong>" + tool.name + "</strong><small>" + tool.description + "</small></span>" +
        "</a>"
      );
    }).join("");

    var panel = document.createElement("section");
    panel.id = "secretActivatePanel";
    panel.className = "secret-activate-panel";
    panel.setAttribute("aria-label", "隐藏激活工具");
    panel.innerHTML =
      '<div class="secret-activate-inner">' +
      '<p class="secret-activate-label">🔑 隐藏分类已解锁</p>' +
      '<div class="secret-activate-links">' + links + "</div>" +
      "</div>";

    var footer = document.querySelector("footer.footer");
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(panel, footer);
    } else {
      document.body.appendChild(panel);
    }
  }

  function runUnlockCallbacks() {
    onUnlockCallbacks.forEach(function (fn) {
      try { fn(); } catch (_) {}
    });
    window.dispatchEvent(new CustomEvent("easterEggUnlocked"));
  }

  function unlock() {
    if (unlocked) {
      revealActivatePanel();
      return;
    }
    unlocked = true;
    SafeStorage.set(STORAGE_KEY, "true");
    showToast("恭喜，发现隐藏分类！");
    revealActivatePanel();
    addSecretConfetti();
    window.umamiTrack?.("easter_egg_unlocked");
    runUnlockCallbacks();
  }

  function bindSearchUnlock() {
    var ids = ["searchInput", "toolsSearch"];
    ids.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
          e.preventDefault();
          unlock();
        }
      });
    });
  }

  function bindLogoUnlock() {
    var logoClick = { timer: null, navTimer: null, count: 0, toast: null };
    var NAV_DELAY = 300;
    var logo = document.querySelector(".logo");
    if (!logo) return;

    logo.addEventListener("click", function (e) {
      e.preventDefault();
      clearTimeout(logoClick.timer);
      clearTimeout(logoClick.navTimer);
      logoClick.count++;

      if (logoClick.count === 1) {
        logoClick.navTimer = setTimeout(function () {
          logoClick.count = 0;
          window.location.href = logo.href;
        }, NAV_DELAY);
        return;
      }

      var remaining = SECRET_CLICKS - logoClick.count;
      var messages = { 2: "继续点击...", 4: "还需要 " + remaining + " 次...", 6: "最后一次点击" };
      if (messages[logoClick.count]) {
        logoClick.toast = showLightToast(messages[logoClick.count], logoClick.toast);
      }

      if (logoClick.count >= SECRET_CLICKS) {
        logoClick.count = 0;
        if (logoClick.toast) { logoClick.toast.remove(); logoClick.toast = null; }
        unlock();
        return;
      }

      logoClick.timer = setTimeout(function () {
        logoClick.count = 0;
        if (logoClick.toast) { logoClick.toast.remove(); logoClick.toast = null; }
      }, 1500);
    });
  }

  function bindKonamiUnlock() {
    var konamiSequence = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
      "b", "a",
    ];
    var konamiIndex = 0;

    document.addEventListener("keydown", function (e) {
      if (e.key === konamiSequence[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiSequence.length) {
          unlock();
          konamiIndex = 0;
        }
      } else {
        konamiIndex = 0;
      }
    });
  }

  function bindFooterHint() {
    var footerHint = document.querySelector(".footer-secret-hint");
    if (!footerHint) return;

    var hintClickCount = 0;
    footerHint.addEventListener("click", function () {
      hintClickCount++;
      var hints = [
        "秘密藏在暗处...",
        "有时候，答案就在眼前...",
        "尝试点击 Logo？",
        "还记得 Konami 代码吗？",
        "URL 参数也能解锁秘密...",
        "Ctrl+Shift+A 可能会有惊喜...",
        "再点一次试试？",
      ];

      if (hintClickCount < hints.length) {
        showToast(hints[hintClickCount - 1]);
      } else {
        unlock();
        hintClickCount = 0;
      }
    });
  }

  function init() {
    if (initDone) return;
    initDone = true;

    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get(SECRET_KEY) === "unlock") {
      unlock();
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (isUnlocked()) {
      unlocked = true;
      revealActivatePanel();
      runUnlockCallbacks();
    }

    bindLogoUnlock();
    bindSearchUnlock();
    bindKonamiUnlock();
    bindFooterHint();
  }

  window.EasterEgg = {
    isUnlocked: isUnlocked,
    unlock: unlock,
    init: init,
    registerOnUnlock: function (fn) {
      if (typeof fn !== "function") return;
      onUnlockCallbacks.push(fn);
      if (isUnlocked()) fn();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
