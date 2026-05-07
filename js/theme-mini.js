(function () {
  var KEY = "dev-tools-theme";

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    var title = theme === "dark" ? "切换到亮色模式" : "切换到暗色模式";
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.setAttribute("title", title);
    btn.setAttribute("aria-label", title);
  }

  function init() {
    var saved = localStorage.getItem(KEY);
    if (saved) {
      apply(saved);
    } else {
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      apply(prefersDark ? "dark" : "light");
    }

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      if (!localStorage.getItem(KEY)) apply(e.matches ? "dark" : "light");
    });

    var btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme");
        var next = current === "dark" ? "light" : "dark";
        localStorage.setItem(KEY, next);
        apply(next);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

