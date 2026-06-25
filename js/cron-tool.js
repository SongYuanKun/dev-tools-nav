/**
 * Cron 表达式生成器（从 pages/tools/cron.html 内联脚本提取）
 */
(function () {
  "use strict";

  var LINUX_META = [
    { id: "min", label: "分钟", min: 0, max: 59, ph: "如 0,30 或 9-17 或 5（配合类型）" },
    { id: "hour", label: "小时", min: 0, max: 23, ph: "如 0,12 或 8-18" },
    { id: "dom", label: "日", min: 1, max: 31, ph: "如 1,15 或 1-5" },
    { id: "mon", label: "月", min: 1, max: 12, ph: "如 1,6,12" },
    { id: "dow", label: "星期", min: 0, max: 6, ph: "0=周日，1=周一…" }
  ];

  var QUARTZ_META = [
    { id: "sec", label: "秒", min: 0, max: 59, ph: "如 0,30 或 */15" },
    { id: "min", label: "分钟", min: 0, max: 59, ph: "如 0,30 或 9-17" },
    { id: "hour", label: "小时", min: 0, max: 23, ph: "如 0,12 或 8-18" },
    { id: "dom", label: "日", min: 1, max: 31, ph: "如 1,15 或 1-5" },
    { id: "mon", label: "月", min: 1, max: 12, ph: "如 1,6,12" },
    { id: "dow", label: "星期", min: 0, max: 6, ph: "0=周日，1=周一…" }
  ];

  // 与 tool-upgrades.js initCron 高级预设一致
  var ADVANCED_PRESETS = [
    ["*/5 * * * *", "每 5 分钟"],
    ["0 9 * * 1-5", "工作日 9 点"],
    ["30 2 * * *", "每天 02:30"],
    ["0 0 1 */3 *", "每季度首日"],
    ["15 9-18 * * 1-5", "工作时间每小时 15 分"]
  ];

  var MODE_OPTIONS = [
    { value: "any", text: "任意（*）" },
    { value: "every", text: "每 X（*/X）" },
    { value: "list", text: "指定值" },
    { value: "range", text: "范围（A-B）" },
    { value: "step", text: "间隔（*/N）" }
  ];

  var BASIC_PRESETS = {
    every_min: ["*", "*", "*", "*", "*"],
    every_hour: ["0", "*", "*", "*", "*"],
    daily_midnight: ["0", "0", "*", "*", "*"],
    weekly_mon: ["0", "0", "*", "*", "1"],
    monthly_first: ["0", "0", "1", "*", "*"],
    weekdays: ["0", "0", "*", "*", "1-5"]
  };

  var cronMode = "linux";
  var fieldsRoot;
  var selects = [];
  var inputs = [];

  function onReady(fn) {
    if (window.ToolChrome && ToolChrome.ready) ToolChrome.ready(fn);
    else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function getQueryParam(key) {
    if (window.ToolChrome && ToolChrome.getQueryParam) return ToolChrome.getQueryParam(key);
    try { return new URLSearchParams(location.search).get(key); } catch (_) { return null; }
  }

  function setCronStatus(kind, text) {
    var el = document.getElementById("cronStatus");
    if (!el) return;
    el.className = "tool-status-pill";
    if (kind === "ok") el.classList.add("tool-status-success");
    else if (kind === "err") el.classList.add("tool-status-error");
    else el.classList.add("tool-status-info");
    el.textContent = text;
  }

  function switchCronTab(name) {
    document.querySelectorAll("[data-cron-tab]").forEach(function (btn) {
      var active = btn.getAttribute("data-cron-tab") === name;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-cron-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-cron-panel") !== name;
    });
  }

  function getPreviewCount() {
    var el = document.getElementById("cronCount");
    var n = el ? parseInt(el.value, 10) : 5;
    if (isNaN(n) || n < 1) return 5;
    return Math.min(n, 50);
  }

  function validateExpression(expr) {
    expr = (expr || "").trim();
    if (!expr) return { ok: false, empty: true, note: "" };
    var parts = expr.split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) {
      return { ok: false, note: "须为 5 段（Linux）或 6 段（Quartz）字段。" };
    }
    for (var t = 0; t < parts.length; t++) {
      if (!parts[t]) return { ok: false, note: "字段不能为空。" };
    }
    return { ok: true, parts: parts };
  }

  function setParseInputStyle(kind) {
    var input = document.getElementById("parseInput");
    if (!input) return;
    input.classList.remove("cron-input-valid", "cron-input-invalid");
    if (kind === "valid") input.classList.add("cron-input-valid");
    if (kind === "invalid") input.classList.add("cron-input-invalid");
  }

  function renderRunsList(ul, nr, noteEl) {
    if (!ul) return;
    ul.innerHTML = "";
    if (!nr.ok) {
      var li = document.createElement("li");
      li.textContent = nr.note || "解析失败";
      ul.appendChild(li);
    } else if (nr.runs.length === 0) {
      var li2 = document.createElement("li");
      li2.textContent = "未找到即将到来的执行时间。";
      ul.appendChild(li2);
    } else {
      nr.runs.forEach(function (dt) {
        var li3 = document.createElement("li");
        li3.textContent = dt.toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        });
        ul.appendChild(li3);
      });
    }
    if (noteEl) noteEl.textContent = nr.note || "";
  }

  function renderParsePreview() {
    var input = document.getElementById("parseInput");
    var descEl = document.getElementById("parseHumanDesc");
    var ul = document.getElementById("parseNextRuns");
    var noteEl = document.getElementById("parseNextRunsNote");
    if (!input) return;
    var raw = input.value.trim();
    var v = validateExpression(raw);
    setParseInputStyle(v.ok ? "valid" : v.empty ? "neutral" : "invalid");
    if (!raw) {
      if (descEl) { descEl.hidden = true; descEl.textContent = ""; }
      if (ul) { ul.hidden = true; ul.innerHTML = ""; }
      if (noteEl) noteEl.textContent = "";
      setCronStatus("info", "输入表达式后将自动校验并预览");
      return;
    }
    if (!v.ok) {
      if (descEl) { descEl.hidden = false; descEl.textContent = v.note; }
      if (ul) { ul.hidden = true; ul.innerHTML = ""; }
      if (noteEl) noteEl.textContent = "";
      setCronStatus("err", v.note);
      return;
    }
    if (descEl) {
      descEl.hidden = false;
      descEl.textContent = describeCron(raw);
    }
    var nr = nextRuns(raw, getPreviewCount(), new Date());
    renderRunsList(ul, nr, noteEl);
    if (ul) ul.hidden = false;
    setCronStatus("ok", "表达式有效");
  }

  function updateModeHint() {
    var hint = document.getElementById("cronModeHint");
    if (!hint) return;
    hint.textContent = cronMode === "quartz"
      ? "Quartz 六段：秒 分 时 日 月 周（日/周可用 ?，如 0 0 12 * * ?）"
      : "Linux 五段：分 时 日 月 周（如 0 0 * * *）";
  }

  function applyUrlPrefill() {
    var expr = getQueryParam("expr");
    if (!expr) return;
    switchCronTab("parse");
    var input = document.getElementById("parseInput");
    if (input) {
      input.value = expr;
      renderParsePreview();
    }
  }

  function getFieldMeta() {
    return cronMode === "quartz" ? QUARTZ_META : LINUX_META;
  }

  function partFromMode(mode, raw, meta) {
    raw = (raw || "").trim();
    if (mode === "any") return "*";
    if (mode === "every" || mode === "step") {
      var n = parseInt(raw, 10);
      if (!raw || isNaN(n) || n <= 0) return "*";
      return "*/" + n;
    }
    if (mode === "range") {
      if (!raw) return "*";
      var m = raw.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!m) return "*";
      var a = parseInt(m[1], 10);
      var b = parseInt(m[2], 10);
      if (isNaN(a) || isNaN(b)) return "*";
      if (a < meta.min || b > meta.max || a > b) return "*";
      return a + "-" + b;
    }
    if (mode === "list") {
      if (!raw) return "*";
      return raw.replace(/\s+/g, "");
    }
    return "*";
  }

  function buildExpression() {
    var meta = getFieldMeta();
    var parts = [];
    for (var i = 0; i < meta.length; i++) {
      parts.push(partFromMode(selects[i].value, inputs[i].value, meta[i]));
    }
    return parts.join(" ");
  }

  function inferModeAndValue(part) {
    part = (part || "").trim();
    if (part === "*" || part === "?") return { mode: "any", val: "" };
    if (/^\*\/\d+$/.test(part)) return { mode: "every", val: part.slice(2) };
    if (/^\d+\s*-\s*\d+$/.test(part)) return { mode: "range", val: part.replace(/\s/g, "") };
    if (part.indexOf(",") !== -1 || /^\d+$/.test(part)) return { mode: "list", val: part };
    return { mode: "list", val: part };
  }

  function applyParts(parts) {
    var meta = getFieldMeta();
    if (!parts || parts.length !== meta.length) return false;
    for (var i = 0; i < meta.length; i++) {
      var iv = inferModeAndValue(parts[i]);
      selects[i].value = iv.mode === "step" ? "every" : iv.mode;
      inputs[i].value = iv.val;
    }
    return true;
  }

  function syncFromExpression(expr) {
    var p = expr.trim().split(/\s+/);
    if (p.length === 5) {
      cronMode = "linux";
      setCronModeSelect();
      buildFieldUI();
      return applyParts(p);
    }
    if (p.length === 6) {
      cronMode = "quartz";
      setCronModeSelect();
      buildFieldUI();
      return applyParts(p);
    }
    return false;
  }

  function setCronModeSelect() {
    var sel = document.getElementById("cronMode");
    if (sel) sel.value = cronMode;
  }

  function numInDowSpec(spec, wd) {
    var n = parseInt(spec, 10);
    if (isNaN(n)) return false;
    if (n === 7) n = 0;
    return wd === n;
  }

  function valueMatchesPart(part, value, min, max, isDow) {
    part = (part || "").trim();
    if (part === "*" || part === "?") return true;
    if (part.indexOf("/") !== -1) {
      var segs = part.split("/");
      var base = segs[0];
      var step = parseInt(segs[1], 10);
      if (isNaN(step) || step <= 0) return false;
      if (base === "*") return (value - min) % step === 0;
      if (base.indexOf("-") !== -1) {
        var ab = base.split("-");
        var lo = parseInt(ab[0], 10);
        var hi = parseInt(ab[1], 10);
        if (value < lo || value > hi) return false;
        return (value - lo) % step === 0;
      }
      var start = parseInt(base, 10);
      if (isNaN(start)) return false;
      return value >= start && (value - start) % step === 0;
    }
    var subs = part.split(",");
    for (var s = 0; s < subs.length; s++) {
      var sub = subs[s].trim();
      if (!sub) continue;
      if (sub.indexOf("-") !== -1) {
        var range = sub.split("-");
        var a = parseInt(range[0], 10);
        var b = parseInt(range[1], 10);
        if (isDow && a === 7) a = 0;
        if (isDow && b === 7) b = 0;
        if (!isNaN(a) && !isNaN(b) && value >= a && value <= b) return true;
      } else {
        if (isDow && numInDowSpec(sub, value)) return true;
        if (!isDow && parseInt(sub, 10) === value) return true;
      }
    }
    return false;
  }

  function dayMatches(domPart, dowPart, d) {
    var domStar = domPart === "*" || domPart === "?";
    var dowStar = dowPart === "*" || dowPart === "?";
    var md = d.getDate();
    var wd = d.getDay();
    var domOk = domStar || valueMatchesPart(domPart, md, 1, 31, false);
    var dowOk = dowStar || valueMatchesPart(dowPart, wd, 0, 6, true);
    if (domStar && dowStar) return true;
    if (domStar && !dowStar) return dowOk;
    if (!domStar && dowStar) return domOk;
    return domOk || dowOk;
  }

  function matchesCron(parts, date) {
    if (!parts) return false;
    if (parts.length === 6) {
      if (!valueMatchesPart(parts[0], date.getSeconds(), 0, 59, false)) return false;
      if (!valueMatchesPart(parts[1], date.getMinutes(), 0, 59, false)) return false;
      if (!valueMatchesPart(parts[2], date.getHours(), 0, 23, false)) return false;
      if (!valueMatchesPart(parts[4], date.getMonth() + 1, 1, 12, false)) return false;
      return dayMatches(parts[3], parts[5], date);
    }
    if (parts.length === 5) {
      if (!valueMatchesPart(parts[0], date.getMinutes(), 0, 59, false)) return false;
      if (!valueMatchesPart(parts[1], date.getHours(), 0, 23, false)) return false;
      if (!valueMatchesPart(parts[3], date.getMonth() + 1, 1, 12, false)) return false;
      return dayMatches(parts[2], parts[4], date);
    }
    return false;
  }

  function nextRuns(expr, count, from) {
    var parts = expr.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) {
      return { ok: false, runs: [], note: "表达式须为五段（Linux）或六段（Quartz）。" };
    }
    for (var t = 0; t < parts.length; t++) {
      if (!parts[t]) return { ok: false, runs: [], note: "字段不能为空。" };
    }
    var d = new Date(from.getTime());
    d.setMilliseconds(0);
    if (parts.length === 6) {
      d.setSeconds(d.getSeconds() + 1);
    } else {
      d.setSeconds(0, 0);
      d.setMinutes(d.getMinutes() + 1);
    }
    var out = [];
    var iter = 0;
    var MAX = parts.length === 6 ? 500000 : 250000;
    while (out.length < count && iter < MAX) {
      if (matchesCron(parts, d)) out.push(new Date(d.getTime()));
      if (parts.length === 6) d.setSeconds(d.getSeconds() + 1);
      else d.setMinutes(d.getMinutes() + 1);
      iter++;
    }
    var note = "";
    if (out.length < count) {
      note = "在搜索范围内未凑满 " + count + " 次，可能为稀疏规则或无法匹配的表达式。";
    }
    return { ok: true, runs: out, note: note };
  }

  function describePart(name, part, meta) {
    part = (part || "").trim();
    if (part === "*" || part === "?") return name + "为任意";
    if (/^\*\/(\d+)$/.test(part)) {
      var n = RegExp.$1;
      if (meta.id === "sec") return "每隔 " + n + " 秒";
      if (meta.id === "min") return "每隔 " + n + " 分钟";
      if (meta.id === "hour") return "每隔 " + n + " 小时";
      if (meta.id === "dom") return "每隔 " + n + " 天（日字段步进）";
      if (meta.id === "mon") return "每隔 " + n + " 个月";
      if (meta.id === "dow") return "每隔 " + n + " 天（周字段步进）";
    }
    if (meta.id === "dow") {
      var map = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      if (/^\d+$/.test(part)) {
        var di = parseInt(part, 10) % 7;
        return "星期为 " + map[di];
      }
      return "星期为 " + part;
    }
    if (meta.id === "dom" && part === "1") return "每月 1 日";
    if (meta.id === "hour" && part === "0") return "0 点（午夜）";
    if (meta.id === "min" && part === "0") return "0 分";
    if (meta.id === "sec" && part === "0") return "0 秒";
    return name + "为 " + part;
  }

  function describeCron(expr) {
    var parts = expr.trim().split(/\s+/);
    if (parts.length === 5) {
      if (expr.replace(/\s+/g, " ") === "* * * * *") return "每一分钟执行一次。";
      if (expr.replace(/\s+/g, " ") === "0 * * * *") return "每小时的第 0 分钟执行一次。";
      if (expr.replace(/\s+/g, " ") === "0 0 * * *") return "每天 0 点 0 分执行一次。";
      if (expr.replace(/\s+/g, " ") === "0 0 * * 1") return "每周一 0 点执行一次。";
      if (expr.replace(/\s+/g, " ") === "0 0 1 * *") return "每月 1 号 0 点执行一次。";
      if (expr.replace(/\s+/g, " ") === "0 0 * * 1-5") return "每个工作日（周一至周五）0 点执行一次。";
      var bits5 = [];
      for (var i = 0; i < 5; i++) bits5.push(describePart(LINUX_META[i].label, parts[i], LINUX_META[i]));
      return "在满足以下条件时执行：" + bits5.join("；") +
        "。（日与星期同时限制时，按常见 crontab 规则取「日匹配或星期匹配」）";
    }
    if (parts.length === 6) {
      if (expr.replace(/\s+/g, " ") === "0 * * * * *") return "每一分钟执行一次（Quartz）。";
      if (expr.replace(/\s+/g, " ") === "0 0 * * * *") return "每小时整点执行一次（Quartz）。";
      if (expr.replace(/\s+/g, " ") === "0 0 0 * * *") return "每天 0 点 0 分 0 秒执行一次（Quartz）。";
      var bits6 = [];
      for (var j = 0; j < 6; j++) bits6.push(describePart(QUARTZ_META[j].label, parts[j], QUARTZ_META[j]));
      return "在满足以下条件时执行（Quartz 六段式）：" + bits6.join("；") + "。";
    }
    return "无法识别：需要五段（Linux）或六段（Quartz）字段。";
  }

  function toLinuxFive(expr) {
    var p = expr.trim().split(/\s+/);
    if (p.length === 5) return p.join(" ");
    if (p.length === 6) return p.slice(1).join(" ");
    return expr;
  }

  function toQuartzSix(expr) {
    var p = expr.trim().split(/\s+/);
    if (p.length === 6) return p.join(" ");
    if (p.length === 5) return "0 " + p.join(" ");
    return expr;
  }

  function updateCronSnippets(expr) {
    var el = document.getElementById("cronSnippets");
    if (!el) return;
    var linux = toLinuxFive(expr);
    var quartz = toQuartzSix(expr);
    el.textContent =
      "=== Kubernetes CronJob（5 段）===\n" +
      "apiVersion: batch/v1\n" +
      "kind: CronJob\n" +
      "metadata:\n" +
      "  name: my-job\n" +
      "spec:\n" +
      "  schedule: \"" + linux + "\"\n" +
      "  jobTemplate:\n" +
      "    spec:\n" +
      "      template:\n" +
      "        spec:\n" +
      "          containers:\n" +
      "          - name: worker\n" +
      "            image: my-image:latest\n" +
      "          restartPolicy: OnFailure\n\n" +
      "=== GitHub Actions（5 段）===\n" +
      "on:\n" +
      "  schedule:\n" +
      "    - cron: '" + linux + "'\n" +
      "jobs:\n" +
      "  run:\n" +
      "    runs-on: ubuntu-latest\n" +
      "    steps:\n" +
      "      - run: echo \"scheduled task\"\n\n" +
      "=== Spring @Scheduled（6 段 Quartz）===\n" +
      "@Scheduled(cron = \"" + quartz + "\")\n" +
      "public void scheduledTask() {\n" +
      "    // 业务逻辑\n" +
      "}";
  }

  function refreshUI() {
    var expr = buildExpression();
    document.getElementById("cronDisplay").textContent = expr;
    document.getElementById("humanDesc").textContent = describeCron(expr);
    updateCronSnippets(expr);

    var nr = nextRuns(expr, getPreviewCount(), new Date());
    var ul = document.getElementById("nextRuns");
    renderRunsList(ul, nr, document.getElementById("nextRunsNote"));
  }

  function bindFieldListeners() {
    for (var i = 0; i < selects.length; i++) {
      selects[i].addEventListener("change", refreshUI);
      inputs[i].addEventListener("input", refreshUI);
    }
  }

  function buildFieldUI() {
    var meta = getFieldMeta();
    fieldsRoot.innerHTML = "";
    selects = [];
    inputs = [];
    meta.forEach(function (m) {
      var row = document.createElement("div");
      row.className = "cron-field-row";
      row.innerHTML =
        '<div class="cron-part-label">' + m.label +
        '<br><span style="font-weight:400;font-size:11px;color:var(--text-muted);">' +
        m.min + "–" + m.max + "</span></div>";
      var sel = document.createElement("select");
      sel.className = "tool-select";
      sel.setAttribute("aria-label", m.label + " 规则类型");
      MODE_OPTIONS.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.text;
        sel.appendChild(o);
      });
      var inp = document.createElement("input");
      inp.type = "text";
      inp.className = "tool-input";
      inp.placeholder = m.ph;
      inp.setAttribute("aria-label", m.label + " 参数");
      row.appendChild(sel);
      row.appendChild(inp);
      fieldsRoot.appendChild(row);
      selects.push(sel);
      inputs.push(inp);
    });
    bindFieldListeners();
  }

  function applyBasicPreset(key) {
    var pr = BASIC_PRESETS[key];
    if (!pr) return;
    if (cronMode === "quartz") applyParts(["0"].concat(pr));
    else applyParts(pr);
    refreshUI();
  }

  function applyAdvancedPreset(expr) {
    syncFromExpression(expr);
    refreshUI();
  }

  function renderAdvancedPresets() {
    var host = document.getElementById("cronAdvancedPresets");
    if (!host || host.getAttribute("data-filled") === "1") return;
    ADVANCED_PRESETS.forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tool-btn tool-pro-chip";
      btn.innerHTML = p[1] + ' · <code>' + p[0] + "</code>";
      btn.addEventListener("click", function () {
        var parseInput = document.getElementById("parseInput");
        if (parseInput) parseInput.value = p[0];
        switchCronTab("parse");
        renderParsePreview();
      });
      host.appendChild(btn);
    });
    host.setAttribute("data-filled", "1");
  }

  function bindEvents() {
    document.querySelectorAll("[data-cron-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchCronTab(btn.getAttribute("data-cron-tab"));
      });
    });

    var modeSel = document.getElementById("cronMode");
    if (modeSel) {
      cronMode = modeSel.value || "linux";
      modeSel.addEventListener("change", function () {
        cronMode = modeSel.value;
        buildFieldUI();
        updateModeHint();
        refreshUI();
      });
    }

    document.querySelectorAll("[data-preset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyBasicPreset(btn.getAttribute("data-preset"));
        setCronStatus("ok", "已应用预设");
      });
    });

    var parseDebounce;
    var parseInput = document.getElementById("parseInput");
    if (parseInput) {
      parseInput.addEventListener("input", function () {
        clearTimeout(parseDebounce);
        parseDebounce = setTimeout(renderParsePreview, 300);
      });
      parseInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") document.getElementById("btnParse").click();
      });
    }

    var cronCount = document.getElementById("cronCount");
    if (cronCount) {
      cronCount.addEventListener("change", function () {
        renderParsePreview();
        refreshUI();
      });
    }

    document.getElementById("btnParse").addEventListener("click", function () {
      window.umamiTrack?.("tool_used", { tool: "cron", action: "parse" });
      var raw = document.getElementById("parseInput").value;
      if (syncFromExpression(raw)) {
        switchCronTab("gen");
        refreshUI();
        setCronStatus("ok", "已同步到生成器");
        window.umamiTrack?.("tool_used", { tool: "cron", action: "apply" });
      } else {
        setCronStatus("err", "请输入有效的五段或六段表达式");
      }
    });

    document.getElementById("btnCopy").addEventListener("click", function () {
      var text = document.getElementById("cronDisplay").textContent;
      var hint = document.getElementById("copyHint");
      var done = function () {
        window.umamiTrack?.("tool_used", { tool: "cron", action: "copy" });
        if (window.ToolChrome && ToolChrome.showToast) {
          ToolChrome.showToast("已复制到剪贴板");
          return;
        }
        hint.textContent = "已复制到剪贴板";
        setTimeout(function () { hint.textContent = ""; }, 2000);
      };
      navigator.clipboard.writeText(text).then(done).catch(function () {
        if (window.ToolChrome && ToolChrome.showToast) {
          ToolChrome.showToast("复制失败，请手动选择");
        } else {
          hint.textContent = "复制失败，请手动选择复制";
        }
      });
    });
  }

  onReady(function () {
    fieldsRoot = document.getElementById("cronFields");
    if (!fieldsRoot) return;
    buildFieldUI();
    renderAdvancedPresets();
    bindEvents();
    updateModeHint();
    refreshUI();
    applyUrlPrefill();
  });
})();
