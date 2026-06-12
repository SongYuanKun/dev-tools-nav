(function () {
  "use strict";

  var STORAGE_KEY = "dev-tools-json-content";
  var PREFS_KEY = "dev-tools-json-prefs";

  function boot(fn) {
    if (window.ToolChrome && ToolChrome.ready) ToolChrome.ready(fn);
    else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function toast(msg) {
    if (window.ToolChrome && ToolChrome.showToast) ToolChrome.showToast(msg);
  }

  function copyWithToast(text, okMsg) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      toast(okMsg || "已复制到剪贴板");
    }).catch(function () {
      toast("复制失败，请手动选择");
    });
  }

  function after(ref, node) {
    if (ref && ref.parentNode) ref.parentNode.insertBefore(node, ref.nextSibling);
  }

  function node(markup) {
    var d = document.createElement("div");
    d.innerHTML = markup.trim();
    return d.firstElementChild;
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

  // 结构统计：对象、数组、键数量、深度
  function jsonStats(v) {
    var s = { obj: 0, arr: 0, keys: 0, depth: 0 };
    function walk(x, d) {
      s.depth = Math.max(s.depth, d);
      if (Array.isArray(x)) {
        s.arr++;
        x.forEach(function (item) { walk(item, d + 1); });
      } else if (x && typeof x === "object") {
        s.obj++;
        var ks = Object.keys(x);
        s.keys += ks.length;
        ks.forEach(function (k) { walk(x[k], d + 1); });
      }
    }
    walk(v, 0);
    return s;
  }

  // 递归按 key 排序
  function sortJsonKeys(v) {
    if (Array.isArray(v)) return v.map(sortJsonKeys);
    if (v && typeof v === "object") {
      return Object.keys(v).sort().reduce(function (acc, k) {
        acc[k] = sortJsonKeys(v[k]);
        return acc;
      }, {});
    }
    return v;
  }

  // JSON Path：users[0].name 或 $.users[0].name
  function jsonPathQuery(v, p) {
    p = String(p || "").trim().replace(/^\$\.?/, "");
    if (!p) return v;
    var parts = [];
    p.replace(/([^.[\]]+)|\[(\d+|"[^"]+"|'[^']+')\]/g, function (_, a, b) {
      parts.push(a || b.replace(/^['"]|['"]$/g, ""));
    });
    return parts.reduce(function (cur, k) {
      if (cur == null) throw new Error("路径不存在：" + k);
      return cur[k];
    }, v);
  }

  // 行级 diff（LCS）
  function buildLcsTable(a, b) {
    var m = a.length;
    var n = b.length;
    var dp = new Array(m + 1);
    for (var i = 0; i <= m; i++) dp[i] = new Array(n + 1).fill(0);
    for (var ri = 1; ri <= m; ri++) {
      for (var cj = 1; cj <= n; cj++) {
        if (a[ri - 1] === b[cj - 1]) dp[ri][cj] = dp[ri - 1][cj - 1] + 1;
        else dp[ri][cj] = Math.max(dp[ri - 1][cj], dp[ri][cj - 1]);
      }
    }
    return dp;
  }

  function diffLines(leftText, rightText) {
    var left = leftText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var right = rightText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var dp = buildLcsTable(left, right);
    var ops = [];
    var i = left.length;
    var j = right.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
        ops.unshift({ type: "same", text: left[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.unshift({ type: "add", text: right[j - 1] });
        j--;
      } else {
        ops.unshift({ type: "del", text: left[i - 1] });
        i--;
      }
    }
    return ops;
  }

  function renderJsonDiff(ops) {
    return ops.map(function (op) {
      var cls = op.type === "add" ? "json-diff-add" : op.type === "del" ? "json-diff-del" : "";
      var prefix = op.type === "add" ? "+ " : op.type === "del" ? "- " : "  ";
      return '<div class="' + cls + '">' + html(prefix + op.text) + "</div>";
    }).join("");
  }

  function yamlScalarNeedsQuote(s) {
    return !s || /[:#"'&*!|>@[\]{},]|\s/.test(s) || s === "true" || s === "false" || s === "null";
  }

  function jsonToYaml(value, indent) {
    indent = indent || 0;
    var sp = indent ? Array(indent + 1).join("  ") : "";
    if (value === null) return "null";
    if (typeof value === "boolean" || typeof value === "number") return String(value);
    if (typeof value === "string") {
      return yamlScalarNeedsQuote(value) ? JSON.stringify(value) : value;
    }
    if (Array.isArray(value)) {
      if (!value.length) return "[]";
      return value.map(function (item) {
        if (item !== null && typeof item === "object") {
          var nested = jsonToYaml(item, indent + 1);
          if (nested.indexOf("\n") >= 0) {
            return sp + "-\n" + nested.split("\n").map(function (line, idx) {
              return idx === 0 ? line : sp + "  " + line;
            }).join("\n");
          }
          return sp + "- " + nested;
        }
        return sp + "- " + jsonToYaml(item, 0);
      }).join("\n");
    }
    if (typeof value === "object") {
      var keys = Object.keys(value);
      if (!keys.length) return "{}";
      return keys.map(function (key) {
        var v = value[key];
        var k = yamlScalarNeedsQuote(key) ? JSON.stringify(key) : key;
        if (v !== null && typeof v === "object") {
          var inner = jsonToYaml(v, indent + 1);
          if (Array.isArray(v) && !v.length) return sp + k + ": []";
          if (!Array.isArray(v) && !Object.keys(v).length) return sp + k + ": {}";
          if (inner.indexOf("\n") >= 0) return sp + k + ":\n" + inner;
          return sp + k + ": " + inner;
        }
        return sp + k + ": " + jsonToYaml(v, 0);
      }).join("\n");
    }
    return String(value);
  }

  function parseYamlScalar(s) {
    s = String(s || "").trim();
    if (!s || s === "~" || s === "null") return null;
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "[]") return [];
    if (s === "{}") return {};
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if ((s.charAt(0) === '"' && s.slice(-1) === '"') || (s.charAt(0) === "'" && s.slice(-1) === "'")) {
      return s.slice(1, -1);
    }
    return s;
  }

  function yamlToJson(text) {
    var lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var root = {};
    var stack = [{ indent: -1, node: root, isArray: false }];
    function lineIndent(line) {
      var m = line.match(/^ */);
      return m ? m[0].length : 0;
    }
    for (var li = 0; li < lines.length; li++) {
      var raw = lines[li];
      if (!raw.trim() || raw.trim().charAt(0) === "#") continue;
      var indent = lineIndent(raw);
      var content = raw.trim();
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      var parent = stack[stack.length - 1];
      if (content.charAt(0) === "-") {
        var arrParent = parent;
        if (!arrParent.isArray) {
          var newArr = [];
          if (parent.key != null) parent.node[parent.key] = newArr;
          else if (parent.node !== root) parent.node = newArr;
          arrParent = { indent: parent.indent, node: newArr, isArray: true, key: null };
          stack[stack.length - 1] = arrParent;
        }
        var itemRest = content.slice(1).trim();
        if (!itemRest) {
          var childObj = {};
          arrParent.node.push(childObj);
          stack.push({ indent: indent, node: childObj, isArray: false, key: null });
        } else if (itemRest.indexOf(":") >= 0) {
          var ic = itemRest.indexOf(":");
          var ik = itemRest.slice(0, ic).trim();
          var iv = itemRest.slice(ic + 1).trim();
          var itemObj = {};
          if (iv) itemObj[ik] = parseYamlScalar(iv);
          else stack.push({ indent: indent + 2, node: itemObj, isArray: false, key: ik });
          arrParent.node.push(itemObj);
          if (!iv) stack.push({ indent: indent, node: itemObj, isArray: false, key: null });
        } else {
          arrParent.node.push(parseYamlScalar(itemRest));
        }
      } else {
        var colon = content.indexOf(":");
        if (colon < 0) throw new Error("无效 YAML 行：" + content);
        var key = content.slice(0, colon).trim();
        var val = content.slice(colon + 1).trim();
        if (!val) {
          var emptyChild = {};
          parent.node[key] = emptyChild;
          stack.push({ indent: indent, node: emptyChild, isArray: false, key: null });
        } else if (val === "[]") parent.node[key] = [];
        else if (val === "{}") parent.node[key] = {};
        else parent.node[key] = parseYamlScalar(val);
      }
    }
    return root;
  }

  var JSON_PRO_SAMPLE = {
    app: "Koen Tools",
    users: [{ id: 1, name: "Koen", roles: ["admin", "dev"] }],
    metrics: { tools: 8, uptime: 99.99 },
  };

  function ensureJsonPanels(input) {
    if (document.getElementById("jsonProStats")) return;
    var anchor = input.closest(".tool-panel");
    if (!anchor) return;
    var pro = node(
      '<section class="tool-panel" id="jsonProPanel">' +
      '<h2 class="tool-panel-title">高级分析</h2>' +
      '<div class="tool-pro-grid tool-pro-grid-three">' +
      '<div class="tool-pro-card"><span>结构统计</span><strong id="jsonProStats">—</strong></div>' +
      '<div class="tool-pro-card"><span>大小对比</span><strong id="jsonProSize">—</strong></div>' +
      '<div class="tool-pro-card"><span>路径查询</span><strong id="jsonProState">支持 $.a[0].b</strong></div>' +
      "</div>" +
      '<div class="tool-pro-inline" style="margin-top:14px;">' +
      '<div><label class="tool-label" for="jsonProPath">JSON Path</label>' +
      '<input id="jsonProPath" class="tool-input" placeholder="users[0].name 或 $.users[0].name" /></div>' +
      '<button type="button" class="tool-btn tool-btn-primary" id="jsonProQuery">查询</button>' +
      "</div>" +
      '<div class="tool-actions">' +
      '<button type="button" class="tool-btn" id="jsonProRefresh">刷新统计</button>' +
      '<button type="button" class="tool-btn" id="btnJsonProSort">按 Key 排序</button>' +
      '<button type="button" class="tool-btn" id="btnJsonProSample">复杂示例</button>' +
      '<button type="button" class="tool-btn" id="btnJsonToYaml">JSON → YAML</button>' +
      '<button type="button" class="tool-btn" id="btnYamlToJson">YAML → JSON</button>' +
      '<button type="button" class="tool-btn" id="jsonProCopy">复制结果</button>' +
      "</div>" +
      '<pre class="tool-pro-result" id="jsonProOut">路径查询与 YAML 转换结果会显示在这里。</pre>' +
      "</section>"
    );
    after(anchor, pro);
    if (!document.getElementById("jsonDiffLeft")) {
      var diffPanel = node(
        '<section class="tool-panel" id="jsonDiffPanel">' +
        '<h2 class="tool-panel-title">JSON 对比</h2>' +
        '<div class="diff-grid">' +
        '<div><label class="tool-label" for="jsonDiffLeft">左侧 JSON</label>' +
        '<textarea id="jsonDiffLeft" class="tool-textarea" rows="8" spellcheck="false"></textarea></div>' +
        '<div><label class="tool-label" for="jsonDiffRight">右侧 JSON</label>' +
        '<textarea id="jsonDiffRight" class="tool-textarea" rows="8" spellcheck="false"></textarea></div>' +
        "</div>" +
        '<div class="tool-actions" style="margin-top:12px;">' +
        '<button type="button" class="tool-btn tool-btn-primary" id="btnJsonDiff">对比</button>' +
        "</div>" +
        '<div class="tool-pro-result" id="jsonDiffOut">逐行 diff 结果会显示在这里。</div>' +
        "</section>"
      );
      after(pro, diffPanel);
    }
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

    ensureJsonPanels(input);

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
      statusEl.className = "tool-status-pill";
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

    function refreshJsonPro(data, state) {
      var statsEl = document.getElementById("jsonProStats");
      var sizeEl = document.getElementById("jsonProSize");
      var stateEl = document.getElementById("jsonProState");
      if (!statsEl || !sizeEl) return data;
      if (!getRaw().trim()) {
        statsEl.textContent = "—";
        sizeEl.textContent = "—";
        if (stateEl) stateEl.textContent = state || "支持 $.a[0].b";
        return null;
      }
      if (!data) {
        statsEl.textContent = "JSON 无效";
        sizeEl.textContent = "—";
        if (stateEl) stateEl.textContent = state || "校验失败";
        return null;
      }
      var st = jsonStats(data);
      statsEl.textContent = "对象 " + st.obj + " / 数组 " + st.arr + " / Key " + st.keys + " / 深度 " + st.depth;
      var pretty = stringify(data, prefs);
      var mini = JSON.stringify(data);
      sizeEl.textContent = pretty.length + " → " + mini.length + " 字符";
      if (stateEl && state) stateEl.textContent = state;
      return data;
    }

    function parseInputData() {
      var raw = getRaw();
      if (!raw.trim()) return null;
      var r = tryParse(raw, relaxedChk ? relaxedChk.checked : true);
      return r.ok ? r.data : null;
    }

    function validateAndMaybeFormat(silent) {
      var raw = getRaw();
      if (!raw.trim()) {
        setStatus("info", "就绪：粘贴或输入 JSON，将实时校验语法。");
        updateLineNums(null);
        if (treeEl) treeEl.innerHTML = '<p class="json-tree-empty">解析成功后显示树形结构。</p>';
        refreshJsonPro(null, "支持 $.a[0].b");
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
        refreshJsonPro(r.data, "校验通过");

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
      refreshJsonPro(null, "校验失败");
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
      copyWithToast(text);
      setStatus("ok", "已复制到剪贴板。");
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

    function bindJsonProExtras() {
      var proOut = document.getElementById("jsonProOut");
      var proPath = document.getElementById("jsonProPath");
      var stateEl = document.getElementById("jsonProState");

      function setProOut(text) {
        if (!proOut) return;
        if (proOut.tagName === "PRE") proOut.textContent = text;
        else proOut.innerHTML = text;
      }

      function runPathQuery() {
        try {
          var data = parseInputData();
          if (!data) throw new Error("请先输入合法 JSON。");
          refreshJsonPro(data);
          var r = jsonPathQuery(data, proPath ? proPath.value : "");
          setProOut(typeof r === "string" ? r : JSON.stringify(r, null, 2));
          if (stateEl) stateEl.textContent = "查询成功";
        } catch (e) {
          setProOut(e.message || String(e));
          if (stateEl) stateEl.textContent = "查询失败";
        }
      }

      document.getElementById("jsonProRefresh")?.addEventListener("click", function () {
        var data = validateAndMaybeFormat(true);
        if (!data) refreshJsonPro(null);
      });

      document.getElementById("jsonProQuery")?.addEventListener("click", runPathQuery);
      if (proPath) {
        proPath.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            runPathQuery();
          }
        });
      }

      document.getElementById("btnJsonProSort")?.addEventListener("click", function () {
        try {
          var data = parseInputData();
          if (!data) throw new Error("请先输入合法 JSON。");
          var sorted = sortJsonKeys(data);
          setInput(stringify(sorted, prefs));
          refreshJsonPro(sorted, "已按 Key 排序");
          setStatus("ok", "已按 Key 排序。");
        } catch (e) {
          setStatus("err", e.message || String(e));
        }
      });

      document.getElementById("btnJsonProSample")?.addEventListener("click", function () {
        setInput(stringify(JSON_PRO_SAMPLE, prefs));
        setStatus("ok", "已填入复杂示例。");
      });

      document.getElementById("btnJsonToYaml")?.addEventListener("click", function () {
        try {
          var data = parseInputData();
          if (!data) throw new Error("请先输入合法 JSON。");
          setProOut(jsonToYaml(data));
          if (stateEl) stateEl.textContent = "已转为 YAML";
        } catch (e) {
          setProOut(e.message || String(e));
          if (stateEl) stateEl.textContent = "转换失败";
        }
      });

      document.getElementById("btnYamlToJson")?.addEventListener("click", function () {
        try {
          var yamlText = proOut && proOut.textContent ? proOut.textContent.trim() : "";
          if (!yamlText || yamlText === "路径查询与 YAML 转换结果会显示在这里。") {
            throw new Error("请先在结果区填入 YAML。");
          }
          var data = yamlToJson(yamlText);
          setInput(stringify(data, prefs));
          if (stateEl) stateEl.textContent = "已转为 JSON";
        } catch (e) {
          setProOut(e.message || String(e));
          if (stateEl) stateEl.textContent = "转换失败";
        }
      });

      document.getElementById("jsonProCopy")?.addEventListener("click", function () {
        var text = proOut ? (proOut.textContent || "") : "";
        if (!text.trim() || text === "路径查询与 YAML 转换结果会显示在这里。") return;
        copyWithToast(text);
      });

      document.getElementById("btnJsonDiff")?.addEventListener("click", function () {
        var leftEl = document.getElementById("jsonDiffLeft");
        var rightEl = document.getElementById("jsonDiffRight");
        var outEl = document.getElementById("jsonDiffOut");
        if (!leftEl || !rightEl || !outEl) return;
        var leftText = leftEl.value;
        var rightText = rightEl.value;
        if (!leftText.trim() && !rightText.trim()) {
          outEl.innerHTML = '<span class="tool-pro-muted">在左右两侧输入 JSON 后点击对比。</span>';
          return;
        }
        var relaxed = relaxedChk ? relaxedChk.checked : true;
        try {
          if (leftText.trim()) {
            var lr = tryParse(leftText, relaxed);
            if (lr.ok) leftText = stringify(lr.data, prefs);
          }
          if (rightText.trim()) {
            var rr = tryParse(rightText, relaxed);
            if (rr.ok) rightText = stringify(rr.data, prefs);
          }
        } catch (_) {}
        var ops = diffLines(leftText, rightText);
        var added = 0;
        var removed = 0;
        ops.forEach(function (op) {
          if (op.type === "add") added++;
          else if (op.type === "del") removed++;
        });
        outEl.innerHTML = renderJsonDiff(ops);
        if (added === 0 && removed === 0) {
          setStatus("ok", "两侧 JSON 格式化后完全一致（" + ops.length + " 行）。");
        } else {
          setStatus("info", "对比完成：+" + added + " 行 / -" + removed + " 行");
        }
        window.umamiTrack?.("tool_used", { tool: "json", action: "diff" });
      });
    }

    bindJsonProExtras();

    applyQueryParam();
    updateLineNums(null);
    if (!input.value.trim()) {
      if (treeEl) treeEl.innerHTML = '<p class="json-tree-empty">解析成功后显示树形结构。</p>';
      refreshJsonPro(null, "支持 $.a[0].b");
    } else {
      scheduleValidate();
    }
  }

  boot(init);
})();
