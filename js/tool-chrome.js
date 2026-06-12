/**
 * 在线工具共享壳层：导航、页脚链接、复制反馈、canonical 跳转
 */
(function () {
  "use strict";

  function html(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function getSlug() {
    var el = document.documentElement.getAttribute("data-tool-slug") ||
      document.body.getAttribute("data-tool-slug");
    if (el) return el;
    var m = (location.pathname || "").match(/\/([^/]+)\.html$/);
    return m ? m[1] : "";
  }

  function canonicalRedirect() {
    var slug = getSlug();
    if (!slug || slug === "index") return;
    try {
      if (new URLSearchParams(location.search).get("embed") === "1") return;
    } catch (_) {}
    var canonical = document.documentElement.getAttribute("data-canonical-slug") || slug;
    var q = location.search || "";
    location.replace("../../tools/" + encodeURIComponent(canonical) + "/" + q.replace(/^\?/, q ? "?" : ""));
  }

  canonicalRedirect();

  function getOnlineTools() {
    if (typeof TOOLS_DATA === "undefined") return [];
    return TOOLS_DATA.filter(function (t) {
      return t && t.category === "online-tools" && !t.hidden && t.id !== "online-tools-hub" && t.slug;
    });
  }

  function toolPageHref(slug) {
    return "./" + encodeURIComponent(slug) + ".html";
  }

  function renderNav(slug) {
    var nav = document.querySelector(".tool-nav[data-tool-nav]");
    if (!nav) nav = document.querySelector(".tool-nav");
    if (!nav || nav.getAttribute("data-chrome-filled") === "1") return;
    var tools = getOnlineTools();
    if (!tools.length) return;
    nav.innerHTML = tools.map(function (t) {
      var s = t.slug;
      var active = s === slug ? " active" : "";
      var cur = s === slug ? ' aria-current="page"' : "";
      return (
        '<a class="tool-nav-item' + active + '" href="' + toolPageHref(s) + '"' + cur + ">" +
        html(t.icon || "🧰") + " " + html(t.name) +
        "</a>"
      );
    }).join("");
    nav.setAttribute("data-chrome-filled", "1");
  }

  function renderFooterNav(slug) {
    var wrap = document.querySelector(".tool-footer-links[data-tool-footer]");
    if (!wrap) wrap = document.querySelector(".tool-footer-links");
    if (!wrap || wrap.getAttribute("data-chrome-filled") === "1") return;
    var tools = getOnlineTools().filter(function (t) { return t.slug !== slug; }).slice(0, 6);
    wrap.innerHTML = tools.map(function (t) {
      return '<a class="tool-footer-link" href="' + toolPageHref(t.slug) + '">' + html(t.name) + "</a>";
    }).join("") + '<a class="tool-footer-link" href="../../tools/">全部工具</a>' +
      '<a class="tool-footer-link" href="../../index.html">← 返回首页</a>';
    wrap.setAttribute("data-chrome-filled", "1");
  }

  function ensureLocalBanner() {
    if (document.documentElement.classList.contains("is-embed")) return;
    var main = document.querySelector(".tool-page");
    if (!main || document.getElementById("toolLocalBanner")) return;
    var bar = document.createElement("div");
    bar.id = "toolLocalBanner";
    bar.className = "tool-local-banner";
    bar.setAttribute("role", "note");
    bar.innerHTML = '<span class="tool-local-banner-icon" aria-hidden="true">🔒</span> 数据仅在浏览器本地处理，不会上传到服务器';
    var header = main.querySelector(".tool-page-header");
    if (header) header.after(bar);
    else main.prepend(bar);
  }

  function ensureToast() {
    if (document.getElementById("toolToast")) return;
    var t = document.createElement("div");
    t.id = "toolToast";
    t.className = "tool-toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }

  function showToast(msg, ms) {
    ensureToast();
    var t = document.getElementById("toolToast");
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      t.classList.remove("is-visible");
    }, ms || 1800);
  }

  function copyText(text, label) {
    if (!text) return Promise.reject(new Error("empty"));
    return navigator.clipboard.writeText(text).then(function () {
      showToast(label || "已复制到剪贴板");
    });
  }

  function bindCopyButtons() {
    document.body.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-copy-target]");
      if (!btn) return;
      var sel = btn.getAttribute("data-copy-target");
      var el = sel ? document.querySelector(sel) : null;
      var text = el ? (el.value != null ? el.value : el.textContent) : "";
      if (!text || text === "—") return;
      copyText(text).catch(function () {
        showToast("复制失败，请手动选择");
      });
    });
  }

  function bindSectionToggle() {
    document.body.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-section-toggle]");
      if (!btn) return;
      var id = btn.getAttribute("aria-controls");
      var panel = id ? document.getElementById(id) : btn.closest(".tool-section")?.querySelector(".tool-section-body");
      if (!panel) return;
      var open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      panel.hidden = !open;
    });
  }

  function bindWorkspaceTabs() {
    document.querySelectorAll("[data-ws-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-ws-tab");
        var root = tab.closest(".tool-workspace") || document;
        root.querySelectorAll("[data-ws-tab]").forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });
        root.querySelectorAll("[data-ws-panel]").forEach(function (p) {
          p.hidden = p.getAttribute("data-ws-panel") !== name;
        });
      });
    });
  }

  function getQueryParam(key) {
    try {
      return new URLSearchParams(location.search).get(key);
    } catch (_) {
      return null;
    }
  }

  ready(function () {
    var slug = getSlug();
    renderNav(slug);
    renderFooterNav(slug);
    ensureLocalBanner();
    ensureToast();
    bindCopyButtons();
    bindSectionToggle();
    bindWorkspaceTabs();
  });

  window.ToolChrome = {
    getSlug: getSlug,
    getQueryParam: getQueryParam,
    showToast: showToast,
    copyText: copyText,
    html: html,
    ready: ready,
  };
})();
