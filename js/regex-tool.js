(function () {
  "use strict";

  // 常用正则模板（20+）
  var TEMPLATES = [
    { label: "中国手机号", pattern: "1[3-9]\\d{9}", flags: "g", sample: "联系方式：13812345678 或 15987654321" },
    { label: "+86 手机号", pattern: "(?:\\+86|0086)?[-\\s]?1[3-9]\\d{9}", flags: "g", sample: "致电 +86-13812345678 或 0086 15987654321" },
    { label: "座机号", pattern: "0\\d{2,3}-?\\d{7,8}", flags: "g", sample: "北京 010-88886666，上海 02187654321" },
    { label: "邮箱", pattern: "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}", flags: "gi", sample: "发送到 hello@example.com 或 support@koen.top" },
    { label: "URL", pattern: "https?://[^\\s/$.?#].[^\\s]*", flags: "gi", sample: "访问 https://tools.songyuankun.top 或 http://example.com/path?q=1" },
    { label: "IPv4", pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b", flags: "g", sample: "服务器 IP：192.168.1.1 和 10.0.0.255" },
    { label: "IPv6", pattern: "(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|:(?::[0-9a-fA-F]{1,4}){1,7}|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}", flags: "g", sample: "地址 2001:0db8:85a3:0000:0000:8a2e:0370:7334 与 ::1" },
    { label: "MAC 地址", pattern: "(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}", flags: "g", sample: "网卡 AA:BB:CC:DD:EE:FF 或 00-11-22-33-44-55" },
    { label: "UUID", pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}", flags: "gi", sample: "id=550e8400-e29b-41d4-a716-446655440000" },
    { label: "日期 YYYY-MM-DD", pattern: "\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])", flags: "g", sample: "日期：2024-01-15 至 2024-12-31" },
    { label: "时间 HH:MM:SS", pattern: "(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?", flags: "g", sample: "日志 09:30:00 与 23:59" },
    { label: "身份证号", pattern: "[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[0-9Xx]", flags: "g", sample: "证件号：110101199003077890" },
    { label: "银行卡号", pattern: "\\b[1-9]\\d{12,18}\\b", flags: "g", sample: "卡号 6222021234567890123" },
    { label: "车牌号", pattern: "[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]", flags: "g", sample: "京A12345 沪B88888 粤AD12345" },
    { label: "中文字符", pattern: "[\\u4e00-\\u9fa5]+", flags: "g", sample: "Hello 世界 World 你好" },
    { label: "微信号", pattern: "[a-zA-Z][a-zA-Z0-9_-]{5,19}", flags: "g", sample: "wxid_koen_dev tools_nav_2024" },
    { label: "semver", pattern: "v?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[\\w.-]+)?(?:\\+[\\w.-]+)?", flags: "g", sample: "发布 v1.2.3 与 2.0.0-beta.1+build.42" },
    { label: "十六进制颜色", pattern: "#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b", flags: "gi", sample: "颜色：#6366f1 #fff #FF0000" },
    { label: "Base64", pattern: "(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?", flags: "g", sample: "token SGVsbG8gV29ybGQh" },
    { label: "整数", pattern: "-?\\d+", flags: "g", sample: "数字 42，-100，0，9999" },
    { label: "浮点数", pattern: "-?\\d+\\.\\d+", flags: "g", sample: "pi=3.14159 温度 -12.5" },
    { label: "英文单词", pattern: "\\b[A-Za-z]{2,}\\b", flags: "g", sample: "The quick brown fox jumps" },
    { label: "强密码", pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$", flags: "gm", sample: "Passw0rd!\nweak\nAa1!bbbb" },
    { label: "空行", pattern: "^\\s*$", flags: "gm", sample: "第一行\n\n\n第四行\n\n末尾" },
    { label: "HTML 标签", pattern: "<[^>]+>", flags: "g", sample: "<div class=\"box\"><p>内容</p></div>" },
    { label: "Java 包名", pattern: "[a-z][a-z0-9]*(\\.[a-z][a-z0-9]*)+", flags: "g", sample: "import com.example.service.UserService;" },
  ];

  // 标志说明（悬停 tooltip）
  var FLAG_HELP = {
    g: "全局匹配（global）— 查找所有匹配项",
    i: "忽略大小写（ignore case）",
    m: "多行模式（multiline）— ^ 和 $ 匹配行首行尾",
    s: "dotAll — 点号 . 可匹配换行符",
    u: "Unicode 模式 — 正确处理代理对",
    y: "sticky — 仅从 lastIndex 处匹配",
  };

  function html(s) {
    if (window.ToolChrome && ToolChrome.html) return ToolChrome.html(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getRegex() {
    var patternEl = document.getElementById("regexPattern");
    var flagsEl = document.getElementById("regexFlags");
    if (!patternEl) return null;
    var pattern = patternEl.value;
    var flags = flagsEl ? flagsEl.value.replace(/[^gimsuy]/g, "") : "g";
    if (!pattern) return null;
    try {
      return new RegExp(pattern, flags);
    } catch (e) {
      return { error: e.message };
    }
  }

  function escapePy(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function escapeGo(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  // 生成 Python / Go 代码片段
  function updateCodeGen() {
    var out = document.getElementById("regexCodeOut");
    var patternEl = document.getElementById("regexPattern");
    var flagsEl = document.getElementById("regexFlags");
    if (!out || !patternEl) return;

    var pattern = patternEl.value;
    var flags = flagsEl ? flagsEl.value.replace(/[^gimsuy]/g, "") : "g";
    if (!pattern) {
      out.textContent = "# 输入正则表达式后将生成 Python / Go 示例代码";
      return;
    }

    var pyFlags = [];
    if (flags.indexOf("i") >= 0) pyFlags.push("re.IGNORECASE");
    if (flags.indexOf("m") >= 0) pyFlags.push("re.MULTILINE");
    if (flags.indexOf("s") >= 0) pyFlags.push("re.DOTALL");
    var pyFlagStr = pyFlags.length ? ", " + pyFlags.join(" | ") : "";

    var goFlags = [];
    if (flags.indexOf("i") >= 0) goFlags.push("(?i)");
    var goPattern = goFlags.join("") + pattern;

    out.textContent =
      "# Python\n" +
      "import re\n\n" +
      'pattern = r"' + escapePy(pattern) + '"\n' +
      "text = \"your text here\"\n\n" +
      (flags.indexOf("g") >= 0
        ? "matches = re.findall(pattern, text" + pyFlagStr + ")\n" +
          "for m in matches:\n    print(m)\n"
        : "match = re.search(pattern, text" + pyFlagStr + ")\n" +
          "if match:\n    print(match.group())\n") +
      "\n# Go\n" +
      "package main\n\n" +
      "import \"regexp\"\n\n" +
      "func main() {\n" +
      '    re := regexp.MustCompile(`' + escapeGo(goPattern) + "`)\n" +
      '    text := "your text here"\n' +
      (flags.indexOf("g") >= 0
        ? "    matches := re.FindAllString(text, -1)\n    _ = matches\n"
        : "    match := re.FindString(text)\n    _ = match\n") +
      "}";
  }

  // 为标志字符绑定 tooltip
  function bindFlagTooltips() {
    var flagsEl = document.getElementById("regexFlags");
    var helpEl = document.querySelector(".regex-flags-help");
    if (!flagsEl) return;

    function refreshTips() {
      var flags = flagsEl.value.replace(/[^gimsuy]/g, "");
      var tips = flags.split("").map(function (f) {
        return f + "：" + (FLAG_HELP[f] || f);
      });
      flagsEl.title = tips.length ? tips.join("\n") : "输入 g i m s u y 等标志";

      if (helpEl) {
        var chips = Object.keys(FLAG_HELP).map(function (f) {
          var on = flags.indexOf(f) >= 0;
          return '<code title="' + html(FLAG_HELP[f]) + '" style="' +
            (on ? "opacity:1;font-weight:700;" : "opacity:0.55;") + '">' + f + "</code>";
        });
        helpEl.innerHTML =
          "标志：" + chips.join(" &nbsp; ") +
          ' &nbsp; <span class="regex-flag-tip" id="regexFlagTip">悬停字母查看说明</span>';
      }
    }

    flagsEl.addEventListener("input", refreshTips);
    flagsEl.addEventListener("focus", refreshTips);
    refreshTips();
  }

  function run() {
    var patternError = document.getElementById("patternError");
    var highlightBox = document.getElementById("highlightBox");
    var matchStats = document.getElementById("matchStats");
    var matchDetailSection = document.getElementById("matchDetailSection");
    var matchList = document.getElementById("matchList");
    var testInput = document.getElementById("testInput");
    if (!highlightBox || !testInput) return;

    highlightBox.innerHTML = "";
    if (matchList) matchList.innerHTML = "";
    if (matchDetailSection) matchDetailSection.style.display = "none";

    var re = getRegex();
    var text = testInput.value;

    if (!re) {
      highlightBox.textContent = text;
      if (matchStats) {
        matchStats.className = "tool-status tool-status-info";
        matchStats.textContent = "就绪：输入正则表达式和测试字符串。";
      }
      if (patternError) patternError.style.display = "none";
      updateCodeGen();
      return;
    }

    if (re.error) {
      if (patternError) {
        patternError.style.display = "";
        patternError.textContent = "正则错误：" + re.error;
      }
      highlightBox.textContent = text;
      if (matchStats) {
        matchStats.className = "tool-status tool-status-error";
        matchStats.textContent = "正则表达式有误，请检查。";
      }
      updateCodeGen();
      return;
    }

    if (patternError) patternError.style.display = "none";

    if (!text) {
      if (matchStats) {
        matchStats.className = "tool-status tool-status-info";
        matchStats.textContent = "请在下方输入测试字符串。";
      }
      updateCodeGen();
      return;
    }

    var matches = [];
    var isGlobal = re.flags.indexOf("g") >= 0 || re.flags.indexOf("y") >= 0;

    if (isGlobal) {
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        matches.push({ index: m.index, length: m[0].length, value: m[0], groups: Array.from(m) });
        if (m[0].length === 0) re.lastIndex++;
      }
    } else {
      var single = re.exec(text);
      if (single) matches.push({ index: single.index, length: single[0].length, value: single[0], groups: Array.from(single) });
    }

    if (matches.length === 0) {
      highlightBox.textContent = text;
      if (matchStats) {
        matchStats.className = "tool-status tool-status-error";
        matchStats.textContent = "未找到匹配项。";
      }
      updateCodeGen();
      return;
    }

    var outHtml = "";
    var last = 0;
    matches.forEach(function (item) {
      outHtml += html(text.slice(last, item.index));
      outHtml += '<mark class="regex-match">' + html(text.slice(item.index, item.index + item.length)) + "</mark>";
      last = item.index + item.length;
    });
    outHtml += html(text.slice(last));
    highlightBox.innerHTML = outHtml;

    if (matchStats) {
      matchStats.className = "tool-status tool-status-success";
      matchStats.textContent = "共找到 " + matches.length + " 个匹配项。";
    }

    if (matchDetailSection && matchList) {
      matchDetailSection.style.display = "";
      matches.slice(0, 50).forEach(function (item, idx) {
        var li = document.createElement("li");
        li.className = "match-item";
        var headerDiv = document.createElement("div");
        headerDiv.className = "match-item-header";
        headerDiv.textContent =
          "匹配 " + (idx + 1) + "：「" + item.value + "」（位置 " + item.index + " – " + (item.index + item.length) + "）";
        li.appendChild(headerDiv);

        if (item.groups.length > 1) {
          item.groups.slice(1).forEach(function (g, gi) {
            var row = document.createElement("div");
            row.className = "match-group-row";
            row.innerHTML =
              '<span class="match-group-label">捕获组 $' + (gi + 1) + "：</span>" +
              '<span class="match-group-value">' + (g !== undefined ? html(g) : "<em>undefined</em>") + "</span>";
            li.appendChild(row);
          });
        }
        matchList.appendChild(li);
      });

      if (matches.length > 50) {
        var more = document.createElement("li");
        more.className = "match-item";
        more.style.color = "var(--text-muted)";
        more.textContent = "… 还有 " + (matches.length - 50) + " 个匹配项未显示";
        matchList.appendChild(more);
      }
    }

    updateCodeGen();
  }

  function init() {
    var patternEl = document.getElementById("regexPattern");
    if (!patternEl) return;

    var grid = document.getElementById("templateGrid");
    if (grid) {
      TEMPLATES.forEach(function (tpl) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "template-btn";
        btn.textContent = tpl.label;
        btn.title = "/" + tpl.pattern + "/" + tpl.flags;
        btn.addEventListener("click", function () {
          patternEl.value = tpl.pattern;
          var flagsEl = document.getElementById("regexFlags");
          if (flagsEl) flagsEl.value = tpl.flags;
          var testInput = document.getElementById("testInput");
          if (tpl.sample && testInput && !testInput.value) testInput.value = tpl.sample;
          run();
          window.umamiTrack?.("tool_used", { tool: "regex", action: "template" });
        });
        grid.appendChild(btn);
      });
    }

    bindFlagTooltips();

    var timer;
    function debounceRun() {
      clearTimeout(timer);
      timer = setTimeout(run, 150);
    }

    patternEl.addEventListener("input", debounceRun);
    var flagsEl = document.getElementById("regexFlags");
    if (flagsEl) flagsEl.addEventListener("input", debounceRun);
    var testInput = document.getElementById("testInput");
    if (testInput) testInput.addEventListener("input", debounceRun);

    var btnReplace = document.getElementById("btnReplace");
    if (btnReplace) {
      btnReplace.addEventListener("click", function () {
        window.umamiTrack?.("tool_used", { tool: "regex", action: "replace" });
        var re = getRegex();
        var text = testInput ? testInput.value : "";
        var replaceWithEl = document.getElementById("replaceWith");
        var replaceWith = replaceWithEl ? replaceWithEl.value : "";
        var out = document.getElementById("replaceOutput");

        if (!re || re.error) {
          if (out) out.textContent = "正则表达式有误，无法替换。";
          return;
        }
        if (!text) {
          if (out) out.textContent = "请先输入测试字符串。";
          return;
        }
        try {
          if (out) out.textContent = text.replace(re, replaceWith);
        } catch (e) {
          if (out) out.textContent = "替换出错：" + e.message;
        }
      });
    }

    var btnCopyReplace = document.getElementById("btnCopyReplace");
    if (btnCopyReplace) {
      btnCopyReplace.addEventListener("click", function () {
        var out = document.getElementById("replaceOutput");
        var text = out ? out.textContent : "";
        if (!text) return;
        var copyFn = window.ToolChrome && ToolChrome.copyText ? ToolChrome.copyText : function (t) {
          return navigator.clipboard.writeText(t);
        };
        copyFn(text, "替换结果已复制").catch(function () {
          if (ToolChrome && ToolChrome.showToast) ToolChrome.showToast("复制失败，请手动选择");
        });
      });
    }

    updateCodeGen();
    run();
  }

  var ready = window.ToolChrome && ToolChrome.ready ? ToolChrome.ready : function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };
  ready(init);
})();
