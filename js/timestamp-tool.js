/**
 * 时间戳转换工具逻辑（从 pages/tools/timestamp.html 内联脚本提取）
 */
(function () {
  "use strict";

  var WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  var COMPARE_ZONES = [
    "Asia/Shanghai",
    "UTC",
    "America/Los_Angeles",
    "America/New_York",
    "Europe/London",
    "Asia/Tokyo"
  ];
  var COMMON_ZONES = COMPARE_ZONES.concat(["Europe/Berlin", "Asia/Singapore"]);

  function $(id) { return document.getElementById(id); }

  function onReady(fn) {
    if (window.ToolChrome && ToolChrome.ready) ToolChrome.ready(fn);
    else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function getQueryParam(key) {
    if (window.ToolChrome && ToolChrome.getQueryParam) return ToolChrome.getQueryParam(key);
    try { return new URLSearchParams(location.search).get(key); } catch (_) { return null; }
  }

  function pad(n, len) { return String(Math.abs(Math.trunc(n))).padStart(len || 2, "0"); }

  function getTimeZone() {
    var v = $("timezoneSelect").value;
    return v === "local" ? Intl.DateTimeFormat().resolvedOptions().timeZone : v;
  }

  function getZoneParts(date, timeZone) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);
    var map = {};
    parts.forEach(function (p) { if (p.type !== "literal") map[p.type] = p.value; });
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour === "24" ? "0" : map.hour),
      minute: Number(map.minute),
      second: Number(map.second)
    };
  }

  function getOffsetMinutes(date, timeZone) {
    var p = getZoneParts(date, timeZone);
    var asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUtc - date.getTime()) / 60000);
  }

  function formatOffset(mins, compact) {
    var sign = mins >= 0 ? "+" : "-";
    var abs = Math.abs(mins);
    var h = pad(Math.floor(abs / 60), 2);
    var m = pad(abs % 60, 2);
    return compact ? sign + h + m : "UTC" + sign + h + ":" + m;
  }

  function formatInZone(date, timeZone) {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date) + " " + formatOffset(getOffsetMinutes(date, timeZone));
  }

  function formatCustom(date) {
    var tz = getTimeZone();
    var p = getZoneParts(date, tz);
    var offset = getOffsetMinutes(date, tz);
    var tpl = $("formatInput").value || "YYYY-MM-DD HH:mm:ss.SSS Z";
    return tpl
      .replace(/YYYY/g, String(p.year))
      .replace(/MM/g, pad(p.month, 2))
      .replace(/DD/g, pad(p.day, 2))
      .replace(/HH/g, pad(p.hour, 2))
      .replace(/mm/g, pad(p.minute, 2))
      .replace(/ss/g, pad(p.second, 2))
      .replace(/SSS/g, pad(date.getMilliseconds(), 3))
      .replace(/ZZ/g, formatOffset(offset, true))
      .replace(/Z/g, formatOffset(offset, false))
      .replace(/ddd/g, WEEKDAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()]);
  }

  // 两时间点之间的中文时长（from 早于 to）
  function relativeTime(from, to) {
    to = to || new Date();
    from = from instanceof Date ? from : new Date(from);
    var ms = to.getTime() - from.getTime();
    if (ms < 0) ms = -ms;
    var sec = Math.floor(ms / 1000);
    var min = Math.floor(sec / 60);
    var hr = Math.floor(min / 60);
    var day = Math.floor(hr / 24);
    var yr = Math.floor(day / 365.25);
    if (yr >= 1) return "约 " + yr + " 年 " + Math.floor(day % 365.25) + " 天";
    if (day >= 1) return day + " 天 " + (hr % 24) + " 小时";
    if (hr >= 1) return hr + " 小时 " + (min % 60) + " 分钟";
    if (min >= 1) return min + " 分钟 " + (sec % 60) + " 秒";
    return sec + " 秒";
  }

  function normalizeDateText(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    if (/^\d{4}-\d{1,2}-\d{1,2} \d/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      return s.replace(" ", "T");
    }
    return s;
  }

  function parseUnix(raw, unit) {
    var s = String(raw || "").trim().replace(/,/g, "");
    if (!s || !/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
    var n = Number(s);
    if (!Number.isFinite(n)) return null;
    var u = unit || "auto";
    if (u === "auto") {
      var digits = s.replace(/^[+-]/, "").replace(/\..*$/, "").length;
      if (digits >= 18) u = "ns";
      else if (digits >= 15) u = "us";
      else if (digits >= 12) u = "ms";
      else u = "s";
    }
    var ms = u === "ns" ? n / 1000000 : u === "us" ? n / 1000 : u === "ms" ? n : n * 1000;
    var date = new Date(ms);
    if (Number.isNaN(date.getTime())) return null;
    return { date: date, unit: u, raw: s };
  }

  function parseAny(raw) {
    var unix = parseUnix(raw, "auto");
    if (unix) return { date: unix.date, kind: "timestamp " + unix.unit };
    var text = normalizeDateText(raw);
    var d = new Date(text);
    if (!text || Number.isNaN(d.getTime())) return null;
    return { date: d, kind: "date" };
  }

  function toDatetimeLocalValue(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" +
      pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function showError(el, msg) {
    if (!msg) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.style.display = "flex";
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value;
  }

  function copyFromEl(id, btn) {
    var el = $(id);
    if (!el) return;
    var value = el.textContent || "";
    if (!value || value === "—") return;
    var done = function () {
      if (window.ToolChrome && ToolChrome.showToast) {
        ToolChrome.showToast("已复制到剪贴板");
        return;
      }
      var old = btn.textContent;
      btn.textContent = "已复制";
      setTimeout(function () { btn.textContent = old; }, 1300);
    };
    navigator.clipboard.writeText(value).then(done).catch(function () {
      if (window.ToolChrome && ToolChrome.showToast) ToolChrome.showToast("复制失败，请手动选择");
    });
  }

  // 根据秒级时间戳更新代码片段面板
  function updateCodeSnippets(sec) {
    var el = $("codeSnippets");
    if (!el) return;
    var s = String(sec);
    el.textContent =
      "/* JavaScript */\n" +
      "const ts = " + s + ";\n" +
      "const ms = ts * 1000;\n" +
      "new Date(ms).toISOString();\n" +
      "Math.floor(Date.now() / 1000);\n\n" +
      "/* Java */\n" +
      "long ts = " + s + "L;\n" +
      "Instant instant = Instant.ofEpochSecond(ts);\n" +
      "ZonedDateTime zdt = instant.atZone(ZoneId.systemDefault());\n\n" +
      "/* Python */\n" +
      "import time\n" +
      "from datetime import datetime, timezone\n" +
      "ts = " + s + "\n" +
      "datetime.fromtimestamp(ts, tz=timezone.utc)\n" +
      "int(time.time())\n\n" +
      "/* Go */\n" +
      "package main\n" +
      "import \"time\"\n" +
      "ts := int64(" + s + ")\n" +
      "t := time.Unix(ts, 0)\n" +
      "time.Now().Unix()";
  }

  function populateTimezones() {
    var sel = $("timezoneSelect");
    if (!sel) return;
    var zones;
    try {
      if (typeof Intl.supportedValuesOf === "function") zones = Intl.supportedValuesOf("timeZone");
    } catch (_) {}
    if (!zones || !zones.length) return;

    var saved = sel.value || "local";
    var localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    sel.innerHTML = "";
    var optLocal = document.createElement("option");
    optLocal.value = "local";
    optLocal.textContent = "本机时区（" + localTz + "）";
    sel.appendChild(optLocal);

    var seen = {};
    zones.slice().sort().forEach(function (z) {
      if (seen[z]) return;
      seen[z] = 1;
      var o = document.createElement("option");
      o.value = z;
      o.textContent = z;
      sel.appendChild(o);
    });

    COMMON_ZONES.forEach(function (z) {
      if (seen[z]) return;
      var o = document.createElement("option");
      o.value = z;
      o.textContent = z;
      sel.appendChild(o);
    });

    if (saved === "local" || seen[saved] || COMMON_ZONES.indexOf(saved) !== -1) sel.value = saved;
    else sel.value = "local";
  }

  function setTsStatus(kind, text) {
    var el = $("tsStatus");
    if (!el) return;
    el.className = "tool-status-pill";
    if (kind === "ok") el.classList.add("tool-status-success");
    else if (kind === "err") el.classList.add("tool-status-error");
    else el.classList.add("tool-status-info");
    el.textContent = text;
  }

  function renderTzCompare(date) {
    var wrap = $("tzCompareWrap");
    var body = $("tzCompareBody");
    if (!wrap || !body) return;
    body.innerHTML = COMPARE_ZONES.map(function (zone) {
      return "<tr><td>" + escapeHtml(zone) + "</td><td>" + escapeHtml(formatInZone(date, zone)) + "</td></tr>";
    }).join("");
    wrap.hidden = false;
  }

  function switchTsTab(name) {
    document.querySelectorAll("[data-ts-tab]").forEach(function (btn) {
      var active = btn.getAttribute("data-ts-tab") === name;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-ts-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-ts-panel") !== name;
    });
  }

  function tickLive() {
    var now = new Date();
    var sec = Math.floor(now.getTime() / 1000);
    setText("liveSec", String(sec));
    setText("liveMs", String(now.getTime()));
    setText("liveLocal", formatInZone(now, getTimeZone()));
    if ($("liveRelative")) {
      setText("liveRelative", relativeTime(new Date(0), now) + "（自 Unix 纪元）");
    }
    updateCodeSnippets(sec);
  }

  function fillDate(date) {
    $("dtLocal").value = toDatetimeLocalValue(date);
    $("dateTextInput").value = "";
  }

  function renderTimestamp(date, unit) {
    var tz = getTimeZone();
    setText("outZone", formatInZone(date, tz));
    setText("outCustom", formatCustom(date));
    setText("outIso", date.toISOString());
    setText("outUtc", date.toUTCString());
    setText("outRfc", date.toUTCString().replace("GMT", "+0000"));
    setText("outHint", "输入按 " + unit + " 解析；目标时区：" + tz + "；本机时区：" +
      Intl.DateTimeFormat().resolvedOptions().timeZone + "。");
    var out = $("ts2dateOut");
    if (out) {
      out.hidden = false;
      out.style.display = "block";
    }
    renderTzCompare(date);
    setTsStatus("ok", "转换成功：" + formatInZone(date, tz));
    updateCodeSnippets(Math.floor(date.getTime() / 1000));
  }

  function runTsToDate() {
    var parsed = parseUnix($("tsInput").value, $("unitSelect").value);
    if (!parsed) {
      showError($("ts2dateError"), "请输入有效的 Unix 时间戳。支持秒、毫秒、微秒和纳秒。");
      var out = $("ts2dateOut");
      if (out) out.hidden = true;
      if ($("tzCompareWrap")) $("tzCompareWrap").hidden = true;
      setTsStatus("err", "时间戳格式无效");
      return;
    }
    showError($("ts2dateError"), "");
    renderTimestamp(parsed.date, parsed.unit);
    window.umamiTrack?.("tool_used", { tool: "timestamp", action: "ts_to_date" });
  }

  function readDateInput() {
    var text = $("dateTextInput").value.trim();
    if (text) return parseAny(text);
    var local = $("dtLocal").value;
    if (!local) return null;
    var d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : { date: d, kind: "local datetime" };
  }

  function runDateToTs() {
    var parsed = readDateInput();
    if (!parsed) {
      showError($("date2tsError"), "请输入可识别的日期时间，或选择本地日期时间。");
      $("date2tsOut").style.display = "none";
      return;
    }
    showError($("date2tsError"), "");
    var ms = parsed.date.getTime();
    setText("outSec", String(Math.floor(ms / 1000)));
    setText("outMs", String(ms));
    setText("outUs", String(ms * 1000));
    setText("outNs", String(ms * 1000000));
    $("date2tsOut").hidden = false;
    $("date2tsOut").style.display = "block";
    updateCodeSnippets(Math.floor(ms / 1000));
    setTsStatus("ok", "已转换为时间戳：秒 " + Math.floor(ms / 1000));
    window.umamiTrack?.("tool_used", { tool: "timestamp", action: "date_to_ts" });
  }

  function startOfWeekMonday(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay();
    x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function runBatch() {
    var lines = $("batchInput").value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var rows = [];
    var csv = ["input,type,unix_seconds,unix_milliseconds,date"];
    lines.forEach(function (line) {
      var parsed = parseAny(line);
      if (!parsed) {
        rows.push("<tr><td>" + escapeHtml(line) + "</td><td>无法识别</td><td>—</td><td>—</td><td>—</td></tr>");
        csv.push(csvCell(line) + ",invalid,,,");
        return;
      }
      var ms = parsed.date.getTime();
      var sec = Math.floor(ms / 1000);
      var zone = formatInZone(parsed.date, getTimeZone());
      rows.push("<tr><td>" + escapeHtml(line) + "</td><td>" + parsed.kind + "</td><td>" + sec +
        "</td><td>" + ms + "</td><td>" + escapeHtml(zone) + "</td></tr>");
      csv.push([line, parsed.kind, sec, ms, zone].map(csvCell).join(","));
    });
    $("batchRows").innerHTML = rows.join("");
    $("batchCsv").textContent = csv.join("\n");
    $("batchTableWrap").style.display = rows.length ? "block" : "none";
    $("batchCsv").style.display = rows.length ? "block" : "none";
    window.umamiTrack?.("tool_used", { tool: "timestamp", action: "batch" });
  }

  function runDiff() {
    var a = parseAny($("diffStart").value);
    var b = parseAny($("diffEnd").value);
    if (!a || !b) {
      showError($("diffError"), "开始时间和结束时间都需要填写，可输入时间戳或日期字符串。");
      $("diffOut").style.display = "none";
      return;
    }
    showError($("diffError"), "");
    var diff = b.date.getTime() - a.date.getTime();
    var sign = diff < 0 ? "-" : "";
    var abs = Math.abs(diff);
    var days = Math.floor(abs / 86400000);
    var hours = Math.floor(abs % 86400000 / 3600000);
    var mins = Math.floor(abs % 3600000 / 60000);
    var secs = Math.floor(abs % 60000 / 1000);
    $("diffOut").textContent =
      "相差：" + sign + days + " 天 " + hours + " 小时 " + mins + " 分 " + secs + " 秒\n" +
      "毫秒差：" + diff + "\n" +
      "秒差：" + Math.trunc(diff / 1000) + "\n" +
      "相对：" + relativeTime(a.date, b.date) + (diff < 0 ? "（结束早于开始）" : "");
    $("diffOut").style.display = "block";
    window.umamiTrack?.("tool_used", { tool: "timestamp", action: "diff" });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function csvCell(v) {
    var s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function applyUrlPrefill() {
    var tsParam = getQueryParam("ts");
    if (tsParam) {
      switchTsTab("ts2date");
      $("tsInput").value = tsParam;
      runTsToDate();
    }
    var dateParam = getQueryParam("date");
    if (dateParam) {
      switchTsTab("date2ts");
      $("dateTextInput").value = dateParam;
      runDateToTs();
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-ts-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTsTab(btn.getAttribute("data-ts-tab"));
      });
    });

    var tsDebounce;
    var dateDebounce;
    $("tsInput").addEventListener("input", function () {
      clearTimeout(tsDebounce);
      tsDebounce = setTimeout(function () {
        if ($("tsInput").value.trim()) runTsToDate();
        else {
          $("ts2dateOut").hidden = true;
          if ($("tzCompareWrap")) $("tzCompareWrap").hidden = true;
          showError($("ts2dateError"), "");
          setTsStatus("info", "输入时间戳后将自动转换");
        }
      }, 280);
    });

    $("tsConvertBtn").addEventListener("click", runTsToDate);
    $("tsInput").addEventListener("keydown", function (e) { if (e.key === "Enter") runTsToDate(); });
    $("unitSelect").addEventListener("change", function () {
      if ($("tsInput").value.trim()) runTsToDate();
    });
    $("timezoneSelect").addEventListener("change", function () {
      tickLive();
      var out = $("ts2dateOut");
      if (out && !out.hidden && $("tsInput").value.trim()) runTsToDate();
      if ($("batchTableWrap").style.display !== "none") runBatch();
    });
    $("formatInput").addEventListener("input", function () {
      var out = $("ts2dateOut");
      if (out && !out.hidden && $("tsInput").value.trim()) runTsToDate();
    });

    $("tsClearBtn").addEventListener("click", function () {
      $("tsInput").value = "";
      $("ts2dateOut").hidden = true;
      if ($("tzCompareWrap")) $("tzCompareWrap").hidden = true;
      showError($("ts2dateError"), "");
      setTsStatus("info", "已清空");
    });
    $("dtConvertBtn").addEventListener("click", runDateToTs);
    $("dateTextInput").addEventListener("keydown", function (e) { if (e.key === "Enter") runDateToTs(); });
    $("dateTextInput").addEventListener("input", function () {
      clearTimeout(dateDebounce);
      dateDebounce = setTimeout(function () {
        if ($("dateTextInput").value.trim() || $("dtLocal").value) runDateToTs();
      }, 320);
    });
    $("dtLocal").addEventListener("change", runDateToTs);
    $("useNowBtn").addEventListener("click", function () {
      fillDate(new Date());
      switchTsTab("date2ts");
      runDateToTs();
    });

    document.querySelectorAll("[data-fill-ts]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var now = Date.now();
        var kind = btn.getAttribute("data-fill-ts");
        if (kind === "nowSec") { $("tsInput").value = String(Math.floor(now / 1000)); $("unitSelect").value = "s"; }
        if (kind === "nowMs") { $("tsInput").value = String(now); $("unitSelect").value = "ms"; }
        if (kind === "y2k") { $("tsInput").value = "946684800"; $("unitSelect").value = "s"; }
        if (kind === "unix0") { $("tsInput").value = "0"; $("unitSelect").value = "s"; }
        switchTsTab("ts2date");
        runTsToDate();
      });
    });

    document.querySelectorAll("[data-shift]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var d = new Date(Date.now() + Number(btn.getAttribute("data-shift")) * 1000);
        fillDate(d);
        switchTsTab("date2ts");
        runDateToTs();
      });
    });

    document.querySelectorAll("[data-quick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var now = new Date();
        var kind = btn.getAttribute("data-quick");
        var d = new Date();
        if (kind === "todayStart") d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        if (kind === "todayEnd") d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (kind === "weekStart") d = startOfWeekMonday(now);
        if (kind === "monthStart") d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        if (kind === "yearStart") d = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        fillDate(d);
        switchTsTab("date2ts");
        runDateToTs();
      });
    });

    $("batchConvertBtn").addEventListener("click", runBatch);
    $("batchSampleBtn").addEventListener("click", function () {
      $("batchInput").value = "1704067200\n1704067200000\n2026-05-27 20:30:00\n2026-05-27T12:30:00Z";
      runBatch();
    });
    $("diffBtn").addEventListener("click", runDiff);
    $("diffNowBtn").addEventListener("click", function () {
      $("diffEnd").value = String(Math.floor(Date.now() / 1000));
      runDiff();
    });

    document.body.addEventListener("click", function (e) {
      var btn = e.target.closest(".copy-btn");
      if (!btn) return;
      var id = btn.getAttribute("data-copy-el");
      if (id) copyFromEl(id, btn);
    });
  }

  onReady(function () {
    populateTimezones();
    fillDate(new Date());
    tickLive();
    setInterval(tickLive, 1000);
    bindEvents();
    applyUrlPrefill();
  });
})();
