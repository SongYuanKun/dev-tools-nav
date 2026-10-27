/**
 * 信号台首页：搜索舞台 + 分类 LED pills + 工具组过滤
 * Cmd/Ctrl+K 与 / 聚焦首页搜索；Esc 清空。
 */
(function () {
  "use strict";

  var GROUPS = [
    { id: "all", name: "全部" },
    { id: "data", name: "数据格式" },
    { id: "encode", name: "编码解码" },
    { id: "crypto", name: "加密哈希" },
    { id: "time", name: "时间" },
    { id: "gen", name: "生成器" },
    { id: "text", name: "文本" },
    { id: "design", name: "前端设计" }
  ];

  var PINYIN = {
    json: "json",
    "sql-formatter": "sql geshihua",
    base64: "base64 bm",
    "url-encode": "url bmdm urlencode",
    hash: "hash haxi md5 sha",
    jwt: "jwt",
    timestamp: "timestamp sjc shijianchuo",
    cron: "cron dingshi",
    uuid: "uuid",
    qrcode: "qrcode erweima",
    regex: "regex zhengze",
    diff: "diff duibi",
    color: "color yanse"
  };

  var state = { group: "all", query: "" };

  function $(id) { return document.getElementById(id); }

  function rows() {
    return Array.prototype.slice.call(document.querySelectorAll(".tool-row[data-tool-id]"));
  }

  function groups() {
    return Array.prototype.slice.call(document.querySelectorAll(".tool-group[data-group]"));
  }

  function haystack(row) {
    var id = row.getAttribute("data-tool-id") || "";
    var name = (row.querySelector("strong") || {}).textContent || "";
    var desc = (row.querySelector(".tool-row__body span") || {}).textContent || "";
    var py = PINYIN[id] || "";
    return (id + " " + name + " " + desc + " " + py).toLowerCase();
  }

  function matchRow(row, terms) {
    if (!terms.length) return true;
    var hay = haystack(row);
    return terms.every(function (t) { return hay.indexOf(t) !== -1; });
  }

  function renderLeds() {
    var bar = $("categoryLeds");
    if (!bar) return;
    var counts = { all: rows().length };
    rows().forEach(function (row) {
      var g = row.getAttribute("data-group") || "";
      counts[g] = (counts[g] || 0) + 1;
    });
    bar.innerHTML = GROUPS.map(function (g) {
      var count = counts[g.id] || 0;
      var active = state.group === g.id ? " is-active" : "";
      var empty = g.id !== "all" && count === 0 ? " is-empty" : "";
      return (
        '<button type="button" class="led-pill' + active + empty + '" data-group="' + g.id + '"' +
        ' aria-pressed="' + (state.group === g.id ? "true" : "false") + '">' +
        '<span class="led-pill__dot" aria-hidden="true"></span>' +
        '<span>' + g.name + '</span>' +
        '<span class="led-pill__count">' + count + "</span>" +
        "</button>"
      );
    }).join("");

    bar.querySelectorAll(".led-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.classList.contains("is-empty")) return;
        state.group = btn.getAttribute("data-group") || "all";
        apply();
      });
    });
  }

  function apply() {
    var terms = String(state.query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    var visible = 0;
    var firstHit = null;

    rows().forEach(function (row) {
      var inGroup = state.group === "all" || row.getAttribute("data-group") === state.group;
      var ok = inGroup && matchRow(row, terms);
      row.hidden = !ok;
      row.classList.toggle("is-hit", ok && terms.length > 0 && !firstHit);
      if (ok) {
        visible += 1;
        if (terms.length && !firstHit) firstHit = row;
      }
    });

    groups().forEach(function (group) {
      var gid = group.getAttribute("data-group");
      var any = group.querySelectorAll(".tool-row:not([hidden])").length > 0;
      var showGroup = state.group === "all" ? any : gid === state.group && any;
      group.hidden = !showGroup;
      var countEl = group.querySelector(".tool-group__count");
      if (countEl) countEl.textContent = String(group.querySelectorAll(".tool-row:not([hidden])").length);
    });

    renderLeds();

    var field = $("homeSearchField");
    var countEl = $("homeSearchCount");
    if (field) field.classList.toggle("has-query", !!state.query);
    if (countEl) {
      if (state.query) {
        countEl.hidden = false;
        countEl.textContent = visible + " 项";
      } else {
        countEl.hidden = true;
        countEl.textContent = "";
      }
    }
  }

  function focusSearch() {
    var input = $("homeSearchInput");
    if (!input) return false;
    input.focus();
    input.select();
    return true;
  }

  function init() {
    var input = $("homeSearchInput");
    var clear = $("homeSearchClear");
    var countLabel = $("toolCountLabel");
    if (countLabel) countLabel.textContent = String(rows().length);

    if (input) {
      input.addEventListener("input", function () {
        state.query = input.value || "";
        apply();
      });
      input.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
          input.value = "";
          state.query = "";
          apply();
          input.blur();
        } else if (ev.key === "Enter") {
          var hit = document.querySelector(".tool-row.is-hit:not([hidden])") ||
            document.querySelector(".tool-row:not([hidden])");
          if (hit) {
            ev.preventDefault();
            hit.click();
          }
        }
      });
    }

    if (clear) {
      clear.addEventListener("click", function () {
        if (!input) return;
        input.value = "";
        state.query = "";
        apply();
        input.focus();
      });
    }

    document.addEventListener("keydown", function (ev) {
      var tag = (ev.target && ev.target.tagName) || "";
      var typing = /^(INPUT|TEXTAREA|SELECT)$/i.test(tag) || (ev.target && ev.target.isContentEditable);
      if ((ev.key === "k" || ev.key === "K") && (ev.metaKey || ev.ctrlKey)) {
        if (document.body && document.body.classList.contains("json-page")) return;
        ev.preventDefault();
        if (!focusSearch() && window.CommandPalette) window.CommandPalette.open();
        return;
      }
      if (ev.key === "/" && !typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        ev.preventDefault();
        focusSearch();
      }
    });

    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
