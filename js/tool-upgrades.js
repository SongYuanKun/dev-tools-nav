(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  function html(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function after(ref, node) {
    if (ref && ref.parentNode) ref.parentNode.insertBefore(node, ref.nextSibling);
  }
  function node(markup) {
    var d = document.createElement("div");
    d.innerHTML = markup.trim();
    return d.firstElementChild;
  }
  function copy(text, marker) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      if (!marker) return;
      var old = marker.textContent;
      marker.textContent = "已复制";
      setTimeout(function () { marker.textContent = old; }, 1200);
    });
  }

  function initJson() {
    var input = document.getElementById("jsonInput");
    if (!input || document.getElementById("jsonProPanel")) return;
    var anchor = input.closest(".tool-panel");
    var panel = node('<section class="tool-panel" id="jsonProPanel"><h2 class="tool-panel-title">高级分析</h2><div class="tool-pro-grid tool-pro-grid-three"><div class="tool-pro-card"><span>结构统计</span><strong id="jsonProStats">—</strong></div><div class="tool-pro-card"><span>大小对比</span><strong id="jsonProSize">—</strong></div><div class="tool-pro-card"><span>路径查询</span><strong id="jsonProState">支持 $.a[0].b</strong></div></div><div class="tool-pro-inline" style="margin-top:14px;"><div><label class="tool-label" for="jsonProPath">JSON Path</label><input id="jsonProPath" class="tool-input" placeholder="users[0].name 或 $.users[0].name" /></div><button type="button" class="tool-btn tool-btn-primary" id="jsonProQuery">查询</button></div><div class="tool-actions"><button type="button" class="tool-btn" id="jsonProRefresh">刷新统计</button><button type="button" class="tool-btn" id="jsonProSort">按 Key 排序</button><button type="button" class="tool-btn" id="jsonProSample">复杂示例</button><button type="button" class="tool-btn" id="jsonProCopy">复制结果</button></div><pre class="tool-pro-result" id="jsonProOut">路径查询结果会显示在这里。</pre></section>');
    after(anchor, panel);
    function parse() {
      var raw = input.value.trim();
      var relaxed = document.getElementById("relaxedParse");
      if (relaxed && relaxed.checked) {
        raw = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, " ");
        raw = raw.replace(/,(\s*[}\]])/g, "$1");
        raw = raw.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, function (_, inner) {
          return '"' + inner.replace(/"/g, '\\"') + '"';
        });
      }
      return JSON.parse(raw);
    }
    function stats(v) {
      var s = { obj: 0, arr: 0, keys: 0, leaf: 0, depth: 0 };
      function walk(x, d) {
        s.depth = Math.max(s.depth, d);
        if (Array.isArray(x)) { s.arr++; x.forEach(function (i) { walk(i, d + 1); }); }
        else if (x && typeof x === "object") { s.obj++; var ks = Object.keys(x); s.keys += ks.length; ks.forEach(function (k) { walk(x[k], d + 1); }); }
        else s.leaf++;
      }
      walk(v, 0);
      return s;
    }
    function sortKeys(v) {
      if (Array.isArray(v)) return v.map(sortKeys);
      if (v && typeof v === "object") return Object.keys(v).sort().reduce(function (a, k) { a[k] = sortKeys(v[k]); return a; }, {});
      return v;
    }
    function path(v, p) {
      p = String(p || "").trim().replace(/^\$\.?/, "");
      if (!p) return v;
      var parts = [];
      p.replace(/([^.[\]]+)|\[(\d+|"[^"]+"|'[^']+')\]/g, function (_, a, b) { parts.push(a || b.replace(/^['"]|['"]$/g, "")); });
      return parts.reduce(function (cur, k) { if (cur == null) throw new Error("路径不存在：" + k); return cur[k]; }, v);
    }
    function refresh() {
      try {
        var v = parse(), st = stats(v), pretty = JSON.stringify(v, null, 2), mini = JSON.stringify(v);
        document.getElementById("jsonProStats").textContent = "对象 " + st.obj + " / 数组 " + st.arr + " / Key " + st.keys + " / 深度 " + st.depth;
        document.getElementById("jsonProSize").textContent = pretty.length + " -> " + mini.length + " 字符";
        return v;
      } catch (e) {
        document.getElementById("jsonProStats").textContent = "JSON 无效";
        document.getElementById("jsonProOut").textContent = e.message;
        throw e;
      }
    }
    document.getElementById("jsonProRefresh").onclick = function () { try { refresh(); } catch (_) {} };
    document.getElementById("jsonProQuery").onclick = function () {
      try {
        var r = path(refresh(), document.getElementById("jsonProPath").value);
        document.getElementById("jsonProOut").textContent = typeof r === "string" ? r : JSON.stringify(r, null, 2);
        document.getElementById("jsonProState").textContent = "查询成功";
      } catch (e) { document.getElementById("jsonProOut").textContent = e.message; document.getElementById("jsonProState").textContent = "查询失败"; }
    };
    document.getElementById("jsonProSort").onclick = function () {
      try {
        var text = JSON.stringify(sortKeys(parse()), null, 2);
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        refresh();
      } catch (_) {}
    };
    document.getElementById("jsonProSample").onclick = function () {
      input.value = JSON.stringify({ app: "Koen Tools", users: [{ id: 1, name: "Koen", roles: ["admin", "dev"] }], metrics: { tools: 8, uptime: 99.99 } }, null, 2);
      refresh();
    };
    document.getElementById("jsonProCopy").onclick = function () { copy(document.getElementById("jsonProOut").textContent, document.getElementById("jsonProState")); };
  }

  function hex(buf) { return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }
  function initBase64() {
    var input = document.getElementById("inputArea");
    if (!input || document.getElementById("encodingProPanel")) return;
    var panel = node('<section class="tool-panel" id="encodingProPanel"><h2 class="tool-panel-title">摘要与字节工具</h2><div class="tool-pro-grid"><div class="tool-pro-card"><span>输入体积</span><strong id="encProSize">—</strong><span>按 UTF-8 计算</span></div><div class="tool-pro-card"><span>Hash 摘要</span><strong id="encProState">SHA-256 / SHA-1 / SHA-512</strong><span>密钥、配置、文件摘要校验常用</span></div></div><div class="tool-actions"><button type="button" class="tool-btn" data-pro-hash="SHA-1">SHA-1</button><button type="button" class="tool-btn tool-btn-primary" data-pro-hash="SHA-256">SHA-256</button><button type="button" class="tool-btn" data-pro-hash="SHA-512">SHA-512</button><button type="button" class="tool-btn" id="encProCopy">复制 Hash</button></div><label class="tool-label" for="encProFile">本地文件 SHA-256</label><input id="encProFile" class="tool-input" type="file" /><pre class="tool-pro-result" id="encProOut">Hash 结果会显示在这里。</pre></section>');
    after(document.getElementById("outputArea").closest(".tool-panel"), panel);
    var enc = new TextEncoder();
    function size() { document.getElementById("encProSize").textContent = input.value.length + " 字符 / " + enc.encode(input.value).length + " bytes"; }
    async function digest(alg) { size(); var h = await crypto.subtle.digest(alg, enc.encode(input.value)); document.getElementById("encProOut").textContent = alg + "\n" + hex(h); document.getElementById("encProState").textContent = alg + " 完成"; }
    document.querySelectorAll("[data-pro-hash]").forEach(function (b) { b.onclick = function () { digest(b.getAttribute("data-pro-hash")); }; });
    document.getElementById("encProCopy").onclick = function () { copy(document.getElementById("encProOut").textContent, document.getElementById("encProState")); };
    document.getElementById("encProFile").onchange = async function (e) { var f = e.target.files[0]; if (!f) return; var h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer()); document.getElementById("encProOut").textContent = "文件：" + f.name + "\n大小：" + f.size + " bytes\nSHA-256\n" + hex(h); document.getElementById("encProState").textContent = "文件摘要完成"; };
    input.addEventListener("input", size); size();
  }

  function initCron() {
    if (!document.getElementById("cronDisplay") || document.getElementById("cronProPanel")) return;
    var panel = node('<section class="tool-panel" id="cronProPanel"><h2 class="tool-panel-title">高级预设与部署片段</h2><div class="tool-pro-chips" id="cronProPresets"></div><div class="tool-actions"><button type="button" class="tool-btn" id="cronProSnippet">生成 crontab 片段</button><button type="button" class="tool-btn" id="cronProCopy">复制片段</button></div><pre class="tool-pro-result" id="cronProOut">选择或生成后显示部署片段。</pre></section>');
    after(document.getElementById("nextRuns").closest(".tool-panel"), panel);
    [["*/5 * * * *","每 5 分钟"],["0 9 * * 1-5","工作日 9 点"],["30 2 * * *","每天 02:30"],["0 0 1 */3 *","每季度首日"],["15 9-18 * * 1-5","工作时间每小时 15 分"]].forEach(function (p) {
      var b = node('<button type="button" class="tool-pro-chip">' + html(p[1]) + ' · <code>' + html(p[0]) + '</code></button>');
      b.onclick = function () { document.getElementById("parseInput").value = p[0]; document.getElementById("btnParse").click(); };
      document.getElementById("cronProPresets").appendChild(b);
    });
    document.getElementById("cronProSnippet").onclick = function () {
      var expr = document.getElementById("cronDisplay").textContent.trim();
      document.getElementById("cronProOut").textContent = "# crontab -e\nSHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n" + expr + " cd /path/to/app && /usr/bin/env bash ./job.sh >> /var/log/job.log 2>&1\n\n# 生产任务建议评估 systemd timer，便于日志、权限和失败重试管理。";
    };
    document.getElementById("cronProCopy").onclick = function () { copy(document.getElementById("cronProOut").textContent, document.getElementById("cronProSnippet")); };
  }

  function b64url(bytes) {
    var s = "";
    new Uint8Array(bytes).forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function initJwt() {
    var input = document.getElementById("jwtInput");
    if (!input || document.getElementById("jwtProPanel")) return;
    var panel = node('<section class="tool-panel" id="jwtProPanel"><h2 class="tool-panel-title">安全检查与 HMAC 验签</h2><div class="tool-pro-grid"><div class="tool-pro-card"><span>安全检查</span><strong id="jwtProAuditState">等待 Token</strong><div id="jwtProAuditList" class="tool-pro-muted"></div></div><div class="tool-pro-card"><span>签名验证</span><strong id="jwtProVerifyState">支持 HS256 / HS384 / HS512</strong><span>密钥只在浏览器本地使用</span></div></div><div class="tool-pro-inline" style="margin-top:14px;"><div><label class="tool-label" for="jwtProSecret">HMAC Secret</label><input id="jwtProSecret" class="tool-input" type="password" placeholder="输入服务端共享密钥后验证签名" /></div><button type="button" class="tool-btn tool-btn-primary" id="jwtProVerify">验证签名</button></div><pre class="tool-pro-result" id="jwtProOut">验签结果会显示在这里。</pre></section>');
    after(document.getElementById("jwtGlobalStatus").closest(".tool-panel"), panel);
    function parse() {
      var raw = input.value.trim().replace(/^bearer\s+/i, "");
      var parts = raw.split(".");
      if (parts.length < 2) throw new Error("JWT 至少需要 Header.Payload 两段。");
      function dec(part) {
        var s = part.replace(/-/g, "+").replace(/_/g, "/");
        while (s.length % 4) s += "=";
        return JSON.parse(decodeURIComponent(escape(atob(s))));
      }
      return { raw: raw, parts: parts, header: dec(parts[0]), payload: dec(parts[1]) };
    }
    function audit() {
      try {
        var t = parse();
        var now = Math.floor(Date.now() / 1000);
        var issues = [];
        if (!t.header.alg) issues.push("缺少 alg。");
        if (String(t.header.alg).toLowerCase() === "none") issues.push("alg=none，不应在生产系统接受。");
        if (!t.payload.exp) issues.push("缺少 exp，无法判断过期时间。");
        else if (Number(t.payload.exp) < now) issues.push("Token 已过期。");
        if (!t.payload.iat) issues.push("缺少 iat，无法判断签发时间。");
        if (t.payload.nbf && Number(t.payload.nbf) > now) issues.push("Token 尚未生效。");
        document.getElementById("jwtProAuditState").textContent = issues.length ? "发现 " + issues.length + " 项提醒" : "基础检查通过";
        document.getElementById("jwtProAuditList").innerHTML = issues.length ? issues.map(function (x) { return "• " + html(x); }).join("<br>") : "未发现 alg=none、过期或明显时间声明问题。";
      } catch (e) {
        document.getElementById("jwtProAuditState").textContent = "等待有效 Token";
        document.getElementById("jwtProAuditList").textContent = e.message;
      }
    }
    async function verify() {
      try {
        var t = parse();
        var secret = document.getElementById("jwtProSecret").value;
        if (!secret) throw new Error("请输入 HMAC Secret。");
        var algMap = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };
        var hash = algMap[t.header.alg];
        if (!hash) throw new Error("当前只支持 HS256 / HS384 / HS512。");
        var enc = new TextEncoder();
        var key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: hash }, false, ["sign"]);
        var sig = await crypto.subtle.sign("HMAC", key, enc.encode(t.parts[0] + "." + t.parts[1]));
        var expected = b64url(sig);
        var ok = expected === t.parts[2];
        document.getElementById("jwtProVerifyState").textContent = ok ? "签名有效" : "签名不匹配";
        document.getElementById("jwtProOut").textContent = (ok ? "PASS" : "FAIL") + "\n算法：" + t.header.alg + "\n计算签名：" + expected + "\nToken 签名：" + (t.parts[2] || "");
      } catch (e) {
        document.getElementById("jwtProVerifyState").textContent = "验证失败";
        document.getElementById("jwtProOut").textContent = e.message;
      }
    }
    input.addEventListener("input", function () { setTimeout(audit, 0); });
    var sample = document.getElementById("btnSample");
    if (sample) sample.addEventListener("click", function () { setTimeout(audit, 0); });
    var clear = document.getElementById("btnClear");
    if (clear) clear.addEventListener("click", function () { setTimeout(audit, 0); });
    document.getElementById("jwtProVerify").onclick = verify;
    audit();
  }

  function initSql() {
    var input = document.getElementById("sqlInput");
    if (!input || document.getElementById("sqlProPanel")) return;
    var panel = node('<section class="tool-panel" id="sqlProPanel"><h2 class="tool-panel-title">SQL 分析</h2><div class="tool-actions"><button type="button" class="tool-btn tool-btn-primary" id="sqlProAnalyze">分析 SQL</button><button type="button" class="tool-btn" id="sqlProCopy">复制报告</button></div><div class="tool-pro-grid tool-pro-grid-three"><div class="tool-pro-card"><span>语句类型</span><strong id="sqlProType">—</strong></div><div class="tool-pro-card"><span>表 / Join</span><strong id="sqlProTables">—</strong></div><div class="tool-pro-card"><span>参数</span><strong id="sqlProParams">—</strong></div></div><pre class="tool-pro-result" id="sqlProOut">分析报告会显示在这里。</pre></section>');
    after(document.getElementById("sqlOutput").closest(".tool-panel"), panel);
    function analyze() {
      var sql = (input.value || document.getElementById("sqlOutput").textContent || "").trim();
      if (!sql) return "请先输入 SQL。";
      var clean = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, " ");
      var type = (clean.match(/^\s*(select|insert|update|delete|create|alter|drop|with)\b/i) || [, "unknown"])[1].toUpperCase();
      var tables = []; clean.replace(/\b(?:from|join|into|update|table)\s+([\`"\[]?[\w.]+[\`"\]]?)/gi, function (_, t) { tables.push(t.replace(/[\`"\[\]]/g, "")); });
      tables = Array.from(new Set(tables));
      var joins = (clean.match(/\bjoin\b/gi) || []).length;
      var params = (clean.match(/\?/g) || []).length + (clean.match(/[:@][a-zA-Z_]\w*/g) || []).length;
      var risk = [];
      if (/^\s*delete\b/i.test(clean) && !/\bwhere\b/i.test(clean)) risk.push("DELETE 未检测到 WHERE。");
      if (/^\s*update\b/i.test(clean) && !/\bwhere\b/i.test(clean)) risk.push("UPDATE 未检测到 WHERE。");
      if (/\bselect\s+\*/i.test(clean)) risk.push("使用 SELECT *，建议明确字段。");
      document.getElementById("sqlProType").textContent = type;
      document.getElementById("sqlProTables").textContent = tables.length + " 表 / " + joins + " JOIN";
      document.getElementById("sqlProParams").textContent = params + " 个";
      var report = "类型：" + type + "\n表：" + (tables.join(", ") || "未识别") + "\nJOIN 数：" + joins + "\n参数占位：" + params + "\n风险提醒：" + (risk.length ? "\n- " + risk.join("\n- ") : "无明显基础风险");
      document.getElementById("sqlProOut").textContent = report;
      return report;
    }
    document.getElementById("sqlProAnalyze").onclick = analyze;
    document.getElementById("sqlProCopy").onclick = function () { copy(document.getElementById("sqlProOut").textContent, document.getElementById("sqlProAnalyze")); };
  }

  function initRegex() {
    if (!document.getElementById("regexPattern") || document.getElementById("regexProPanel")) return;
    var ref = document.getElementById("replaceOutput") ? document.getElementById("replaceOutput").closest(".tool-panel") : document.querySelector(".tool-panel:last-of-type");
    var panel = node('<section class="tool-panel" id="regexProPanel"><h2 class="tool-panel-title">代码生成与速查</h2><div class="tool-actions"><button type="button" class="tool-btn tool-btn-primary" id="regexProJs">生成 JS 代码</button><button type="button" class="tool-btn" id="regexProJava">生成 Java 代码</button><button type="button" class="tool-btn" id="regexProCopy">复制代码</button></div><pre class="tool-pro-result" id="regexProOut">生成的代码会显示在这里。</pre><div class="tool-pro-grid"><div class="tool-pro-card"><strong>常用速查</strong><span>\\d 数字 · \\w 单词字符 · \\s 空白 · . 任意字符 · * 0+ · + 1+ · ? 0/1 · {n,m} 次数 · () 捕获 · (?:) 非捕获 · (?=) 正向预查</span></div><div class="tool-pro-card"><strong>调试建议</strong><span>先关闭 g 看首个匹配和捕获组；再开启 g 看全量结果。复杂表达式建议拆成多段验证。</span></div></div></section>');
    after(ref, panel);
    function p() { return document.getElementById("regexPattern").value || ""; }
    function f() { return document.getElementById("regexFlags").value || ""; }
    document.getElementById("regexProJs").onclick = function () { document.getElementById("regexProOut").textContent = "const pattern = /" + p().replace(/\//g, "\\/") + "/" + f() + ";\nconst text = String(input);\nconst matches = [...text.matchAll(pattern)];\nconsole.log(matches);"; };
    document.getElementById("regexProJava").onclick = function () { document.getElementById("regexProOut").textContent = 'Pattern pattern = Pattern.compile("' + p().replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '");\nMatcher matcher = pattern.matcher(text);\nwhile (matcher.find()) {\n    System.out.println(matcher.group());\n}'; };
    document.getElementById("regexProCopy").onclick = function () { copy(document.getElementById("regexProOut").textContent, document.getElementById("regexProCopy")); };
  }

  ready(function () {
    initJson();
    initBase64();
    initJwt();
    initCron();
    initSql();
    initRegex();
  });
})();
