(function () {
  "use strict";

  var STORAGE_KEY = "dev-tools-json-content";
  var PREFS_KEY = "dev-tools-json-prefs";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function html(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getPrefs() {
    try {
      return Object.assign(
        { indent: "2", autoFormat: false, relaxed: true },
        JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")
      );
    } catch (_) {
      return { indent: "2", autoFormat: false, relaxed: true };
    }
  }

  function savePrefs(prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function getIndentUnit(prefs) {
    if (prefs.indent === "tab") return "\t";
    if (prefs.indent === "4") return "    ";
    return "  ";
  }

  // 字符串感知地移除 // 与 /* */ 注释
  function stripComments(raw) {
    var out = "";
    var i = 0;
    var inStr = false;
    var strCh = "";
    var esc = false;
    while (i < raw.length) {
      var ch = raw[i];
      if (inStr) {
        out += ch;
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === strCh) inStr = false;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inStr = true;
        strCh = ch;
        out += ch;
        i++;
        continue;
      }
      if (ch === "/" && raw[i + 1] === "/") {
        i += 2;
        while (i < raw.length && raw[i] !== "\n") i++;
        continue;
      }
      if (ch === "/" && raw[i + 1] === "*") {
        i += 2;
        while (i < raw.length - 1 && !(raw[i] === "*" && raw[i + 1] === "/")) i++;
        i += 2;
        continue;
      }
      out += ch;
      i++;
    }
    return out;
  }

  // 移除对象/数组末尾多余逗号
  function stripTrailingCommas(raw) {
    return raw.replace(/,(\s*[}\]])/g, "$1");
  }

  // 将单引号字符串转为双引号（简单场景）
  function singleToDoubleQuotes(raw) {
    return raw.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, function (_, inner) {
      return '"' + inner.replace(/"/g, '\\"') + '"';
    });
  }

  function preprocess(raw, relaxed) {
    if (!relaxed) return raw;
    var s = stripComments(raw);
    s = stripTrailingCommas(s);
    s = singleToDoubleQuotes(s);
    return s;
  }

  function parseJsonPosition(err, raw) {
    var msg = err && err.message ? String(err.message) : "未知错误";
    var m = msg.match(/position\s+(\d+)/i);
    if (m) {
      var pos = parseInt(m[1], 10);
      if (!isNaN(pos) && raw && pos >= 0 && pos <= raw.length) {
        var before = raw.slice(0, pos);
        var line = (before.match(/\n/g) || []).length + 1;
        var col = pos - before.lastIndexOf("\n");
        return { msg: msg, pos: pos, line: line, col: col };
      }
    }
    return { msg: msg, pos: null, line: null, col: null };
  }

  function tryParse(raw, relaxed) {
    var processed = preprocess(raw, relaxed);
    try {
      return { ok: true, data: JSON.parse(processed), processed: processed };
    } catch (e) {
      return { ok: false, err: e, processed: processed };
    }
  }

  function stringify(data, prefs) {
    return JSON.stringify(data, null, getIndentUnit(prefs));
  }

  // Unicode 转义 / 还原
  function escapeUnicode(str) {
    return str.replace(/[\u007f-\uffff]/g, function (ch) {
      var code = ch.charCodeAt(0).toString(16).padStart(4, "0");
      return "\\u" + code;
    });
  }

  function unescapeUnicode(str) {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  // 树形视图
  function renderTree(data, depth) {
    depth = depth || 0;
    if (data === null) return '<span class="json-tree-null">null</span>';
    if (typeof data === "boolean") return '<span class="json-tree-bool">' + data + "</span>";
    if (typeof data === "number") return '<span class="json-tree-num">' + data + "</span>";
    if (typeof data === "string") {
      var preview = data.length > 80 ? data.slice(0, 80) + "…" : data;
      return '<span class="json-tree-str">"' + html(preview) + '"</span><span class="json-tree-meta">(' + data.length + " 字符)</span>";
    }
    if (Array.isArray(data)) {
      if (!data.length) return '<span class="json-tree-bracket">[]</span>';
      var items = data.map(function (item, idx) {
        var nested = item !== null && typeof item === "object";
        return (
          '<div class="json-tree-node" style="padding-left:' +
          (depth * 14) +
          'px">' +
          (nested ? '<button type="button" class="json-tree-toggle" aria-expanded="true">▼</button>' : '<span class="json-tree-leaf"></span>') +
          '<span class="json-tree-key">[' +
          idx +
          "]</span> " +
          renderTree(item, depth + 1) +
          "</div>"
        );
      });
      return '<div class="json-tree-group">' + items.join("") + "</div>";
    }
    if (typeof data === "object") {
      var keys = Object.keys(data);
      if (!keys.length) return '<span class="json-tree-bracket">{}</span>';
      var nodes = keys.map(function (key) {
        var val = data[key];
        var nested = val !== null && typeof val === "object";
        return (
          '<div class="json-tree-node" style="padding-left:' +
          (depth * 14) +
          'px">' +
          (nested ? '<button type="button" class="json-tree-toggle" aria-expanded="true">▼</button>' : '<span class="json-tree-leaf"></span>') +
          '<span class="json-tree-key">"' +
          html(key) +
          '"</span>: ' +
          renderTree(val, depth + 1) +
          "</div>"
        );
      });
      return '<div class="json-tree-group">' + nodes.join("") + "</div>";
    }
    return html(String(data));
  }

  function init() {
    var input = document.getElementById("jsonInput");
    if (!input) return;

    var statusEl = document.getElementById("statusMsg");
    var lineNums = document.getElementById("jsonLineNums");
    var treeEl = document.getElementById("jsonTree");
    var editorWrap = document.getElementById("jsonEditorWrap");
    var indentSelect = document.getElementById("indentSelect");
    var autoFormatChk = document.getElementById("autoFormat");
    var relaxedChk = document.getElementById("relaxedParse");
    var fileInput = document.getElementById("jsonFileInput");
    var tabBtns = document.querySelectorAll("[data-json-tab]");
    var viewPanels = document.querySelectorAll("[data-json-view]");

    var prefs = getPrefs();
    if (indentSelect) indentSelect.value = prefs.indent;
    if (autoFormatChk) autoFormatChk.checked = prefs.autoFormat;
    if (relaxedChk) relaxedChk.checked = prefs.relaxed;

    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !new URLSearchParams(window.location.search).get("q")) {
      input.value = saved;
    }

    var debounceTimer = null;
    var lastErrorLine = null;

    function setStatus(kind, text) {
      if (!statusEl) return;
      statusEl.className = "tool-status";
      if (kind === "ok") statusEl.classList.add("tool-status-success");
      else if (kind === "err") statusEl.classList.add("tool-status-error");
      else statusEl.classList.add("tool-status-info");
      statusEl.textContent = text;
    }

    function updateLineNums(errorLine) {
      if (!lineNums) return;
      var lines = input.value.split("\n");
      var nums = lines.map(function (_, i) {
        var n = i + 1;
        var cls = n === errorLine ? "json-ln json-ln-err" : "json-ln";
        return '<span class="' + cls + '">' + n + "</span>";
      });
      lineNums.innerHTML = nums.join("");
      lastErrorLine = errorLine;
      if (editorWrap) {
        editorWrap.classList.toggle("has-error", !!errorLine);
      }
    }

    function syncScroll() {
      if (lineNums) lineNums.scrollTop = input.scrollTop;
    }

    function getRaw() {
      return input.value;
    }

    function setInput(text) {
      input.value = text;
      scheduleValidate();
    }

    function refreshTree(data) {
      if (!treeEl) return;
      treeEl.innerHTML = renderTree(data);
      treeEl.querySelectorAll(".json-tree-toggle").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var expanded = btn.getAttribute("aria-expanded") === "true";
          btn.setAttribute("aria-expanded", expanded ? "false" : "true");
          btn.textContent = expanded ? "▶" : "▼";
          var group = btn.parentElement.querySelector(".json-tree-group");
          if (group) group.style.display = expanded ? "none" : "";
        });
      });
    }

    function validateAndMaybeFormat(silent) {
      var raw = getRaw();
      if (!raw.trim()) {
        setStatus("info", "就绪：粘贴或输入 JSON，将实时校验语法。");
        updateLineNums(null);
        if (treeEl) treeEl.innerHTML = '<p class="json-tree-empty">解析成功后显示树形结构。</p>';
        return null;
      }

      var relaxed = relaxedChk ? relaxedChk.checked : true;
      var r = tryParse(raw, relaxed);

      if (r.ok) {
        var pretty = stringify(r.data, prefs);
        var lines = raw.split("\n").length;
        var keys = typeof r.data === "object" && r.data ? Object.keys(r.data).length : 0;
        var type = Array.isArray(r.data) ? "数组" : typeof r.data === "object" ? "对象" : typeof r.data;
        setStatus("ok", "✓ JSON 合法 · " + type + (keys ? " · " + keys + " 个键" : "") + " · " + lines + " 行 · " + raw.length + " 字符");
        updateLineNums(null);

        if (prefs.autoFormat && raw !== pretty) {
          input.value = pretty;
          localStorage.setItem(STORAGE_KEY, pretty);
        } else {
          localStorage.setItem(STORAGE_KEY, raw);
        }
        refreshTree(r.data);
        return r.data;
      }

      var info = parseJsonPosition(r.err, r.processed);
      var extra = info.line != null ? "第 " + info.line + " 行，第 " + info.col + " 列" : "";
      setStatus("err", "✗ 语法错误" + (extra ? "：" + extra : "") + " — " + info.msg);
      updateLineNums(info.line);
      if (treeEl) treeEl.innerHTML = '<p class="json-tree-empty json-tree-err">无法生成树形视图，请先修复语法错误。</p>';
      if (!silent && info.line != null) {
        var pos = input.value.split("\n").slice(0, info.line - 1).join("\n").length + (info.line > 1 ? 1 : 0) + info.col - 1;
        input.focus();
        input.setSelectionRange(pos, pos + 1);
      }
      return null;
    }

    function scheduleValidate() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        validateAndMaybeFormat(true);
      }, 280);
    }

    function doFormat() {
      var raw = getRaw();
      if (!raw.trim()) {
        setStatus("info", "请输入 JSON 后再格式化。");
        return;
      }
      var r = tryParse(raw, relaxedChk ? relaxedChk.checked : true);
      if (!r.ok) {
        validateAndMaybeFormat(false);
        return;
      }
      var pretty = stringify(r.data, prefs);
      setInput(pretty);
      setStatus("ok", "已格式化。");
      window.umamiTrack?.("tool_used", { tool: "json", action: "format" });
    }

    function doMinify() {
      var raw = getRaw();
      if (!raw.trim()) {
        setStatus("info", "请输入 JSON 后再压缩。");
        return;
      }
      var r = tryParse(raw, relaxedChk ? relaxedChk.checked : true);
      if (!r.ok) {
        validateAndMaybeFormat(false);
        return;
      }
      setInput(JSON.stringify(r.data));
      setStatus("ok", "已压缩为一行。");
      window.umamiTrack?.("tool_used", { tool: "json", action: "minify" });
    }

    function doRepair() {
      var raw = getRaw();
      if (!raw.trim()) return;
      var repaired = preprocess(raw, true);
      if (repaired !== raw) {
        setInput(repaired);
        setStatus("ok", "已尝试修复：移除注释、尾逗号，转换单引号。");
      } else {
        setStatus("info", "未发现可自动修复的常见问题。");
      }
      window.umamiTrack?.("tool_used", { tool: "json", action: "repair" });
    }

    function doCopy() {
      var text = getRaw();
      if (!text.trim()) {
        setStatus("info", "没有可复制的内容。");
        return;
      }
      navigator.clipboard.writeText(text).then(function () {
        setStatus("ok", "已复制到剪贴板。");
      }).catch(function () {
        setStatus("err", "复制失败，请手动选择复制。");
      });
    }

    function doDownload() {
      var text = getRaw();
      if (!text.trim()) return;
      var blob = new Blob([text], { type: "application/json;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "formatted.json";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus("ok", "已下载 formatted.json");
    }

    function doClear() {
      input.value = "";
      localStorage.removeItem(STORAGE_KEY);
      setStatus("info", "已清空。");
      updateLineNums(null);
      if (treeEl) treeEl.innerHTML = '<p class="json-tree-empty">解析成功后显示树形结构。</p>';
    }

    function switchTab(name) {
      tabBtns.forEach(function (btn) {
        btn.classList.toggle("is-active", btn.getAttribute("data-json-tab") === name);
      });
      viewPanels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-json-view") !== name;
      });
    }

    function applyQueryParam() {
      var q = new URLSearchParams(window.location.search).get("q");
      if (q === null || q === "") return;
      input.value = q;
      validateAndMaybeFormat(true);
    }

    function savePrefAndValidate() {
      prefs.indent = indentSelect ? indentSelect.value : "2";
      prefs.autoFormat = autoFormatChk ? autoFormatChk.checked : false;
      prefs.relaxed = relaxedChk ? relaxedChk.checked : true;
      savePrefs(prefs);
      scheduleValidate();
    }

    // 事件绑定
    input.addEventListener("input", scheduleValidate);
    input.addEventListener("scroll", syncScroll);
    if (indentSelect) indentSelect.addEventListener("change", savePrefAndValidate);
    if (autoFormatChk) autoFormatChk.addEventListener("change", savePrefAndValidate);
    if (relaxedChk) relaxedChk.addEventListener("change", savePrefAndValidate);

    document.getElementById("btnFormat")?.addEventListener("click", doFormat);
    document.getElementById("btnMinify")?.addEventListener("click", doMinify);
    document.getElementById("btnRepair")?.addEventListener("click", doRepair);
    document.getElementById("btnValidate")?.addEventListener("click", function () {
      validateAndMaybeFormat(false);
      window.umamiTrack?.("tool_used", { tool: "json", action: "validate" });
    });
    document.getElementById("btnCopy")?.addEventListener("click", doCopy);
    document.getElementById("btnDownload")?.addEventListener("click", doDownload);
    document.getElementById("btnClear")?.addEventListener("click", doClear);
    document.getElementById("btnEscapeUnicode")?.addEventListener("click", function () {
      var r = tryParse(getRaw(), relaxedChk?.checked);
      if (r.ok) {
        setInput(escapeUnicode(stringify(r.data, prefs)));
        setStatus("ok", "已将非 ASCII 字符转为 \\uXXXX。");
      } else {
        setInput(escapeUnicode(getRaw()));
        setStatus("info", "已对原始文本做 Unicode 转义（未校验 JSON）。");
      }
    });
    document.getElementById("btnUnescapeUnicode")?.addEventListener("click", function () {
      setInput(unescapeUnicode(getRaw()));
      scheduleValidate();
      setStatus("ok", "已还原 \\uXXXX 转义。");
    });
    document.getElementById("btnSample")?.addEventListener("click", function () {
      setInput(
        JSON.stringify(
          {
            app: "Koen Tools",
            version: 2,
            features: ["format", "tree", "repair"],
            config: { theme: "dark", indent: 2 },
            users: [{ id: 1, name: "Koen", active: true }],
            note: "支持 // 注释和尾逗号,",
          },
          null,
          2
        )
      );
    });

    if (fileInput) {
      fileInput.addEventListener("change", function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          setInput(String(reader.result || ""));
          setStatus("ok", "已加载文件：" + f.name);
        };
        reader.readAsText(f);
        e.target.value = "";
      });
    }

    tabBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(btn.getAttribute("data-json-tab"));
      });
    });

    input.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        doFormat();
      }
    });

    applyQueryParam();
    updateLineNums(null);
    if (!input.value.trim()) {
      if (treeEl) treeEl.innerHTML = '<p class="json-tree-empty">解析成功后显示树形结构。</p>';
    } else {
      scheduleValidate();
    }
  }

  ready(init);
})();
