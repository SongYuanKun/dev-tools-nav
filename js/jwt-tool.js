(function () {
  "use strict";

  var TC = window.ToolChrome || {};
  var html = TC.html || function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };
  var showToast = TC.showToast || function (msg) { alert(msg); };
  var copyText = TC.copyText || function (text) {
    return navigator.clipboard.writeText(text).then(function () {
      showToast("已复制到剪贴板");
    });
  };

  var SAMPLE_JWT =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjIwMDAwMDAwMDB9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

  var CLAIM_LABELS = {
    iss: "签发者 (iss)",
    sub: "主体 (sub)",
    aud: "受众 (aud)",
    exp: "过期时间 (exp)",
    iat: "签发时间 (iat)",
    nbf: "生效时间 (nbf)",
    jti: "JWT ID (jti)",
  };

  function base64UrlDecode(segment) {
    var s = String(segment).replace(/-/g, "+").replace(/_/g, "/");
    var pad = s.length % 4;
    if (pad) s += "====".slice(0, 4 - pad);
    var binary = atob(s);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function base64UrlEncode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlFromBytes(buf) {
    var bytes = new Uint8Array(buf);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(segment) {
    var s = String(segment || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var binary = atob(s);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function normalizeJwtInput(raw) {
    var s = String(raw || "").trim();
    if (/^bearer\s+/i.test(s)) s = s.replace(/^bearer\s+/i, "").trim();
    return s;
  }

  function parseParts(token) {
    var parts = token.split(".");
    if (parts.length < 2) return { error: "JWT 应包含至少两段（Header.Payload），由点号分隔。" };
    return { parts: parts };
  }

  function parseToken(token) {
    var parsed = parseParts(token);
    if (parsed.error) throw new Error(parsed.error);
    var parts = parsed.parts;
    return {
      raw: token,
      parts: parts,
      header: JSON.parse(base64UrlDecode(parts[0])),
      payload: JSON.parse(base64UrlDecode(parts[1])),
    };
  }

  function numericDateSeconds(v) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
    return null;
  }

  function formatZhDate(sec) {
    if (sec == null || !isFinite(sec)) return "—";
    var d = new Date(sec * 1000);
    return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) + "（东八区）";
  }

  function expiryStatus(payload) {
    var now = Math.floor(Date.now() / 1000);
    var exp = payload && Object.prototype.hasOwnProperty.call(payload, "exp")
      ? numericDateSeconds(payload.exp)
      : null;
    if (exp == null) {
      return { kind: "none", label: "无过期时间", detail: "Payload 中未包含 exp 声明，无法据此判断过期。" };
    }
    if (exp < now) return { kind: "expired", label: "已过期", detail: "当前时间已超过 exp。" };
    return { kind: "valid", label: "未过期（有效）", detail: "当前时间早于 exp。" };
  }

  function renderTimeClaim(key, sec) {
    if (sec == null) return html(String(key)) + "：无法解析为 Unix 时间戳（秒）";
    var human = formatZhDate(sec);
    var rel = "";
    var now = Math.floor(Date.now() / 1000);
    if (key === "exp") rel = sec < now ? " · 相对现在：已过期" : " · 相对现在：尚未过期";
    else if (key === "nbf") rel = sec > now ? " · 相对现在：尚未生效" : " · 相对现在：已生效";
    else if (key === "iat") rel = " · 相对现在：" + (now >= sec ? "已签发" : "未来时间（异常）");
    return (
      "<strong>" + html(CLAIM_LABELS[key] || key) + "</strong><br>" +
      "Unix 秒：<code>" + html(String(sec)) + "</code><br>" +
      "可读时间：" + html(human) + rel
    );
  }

  function renderPayloadClaims(obj) {
    var keys = Object.keys(obj);
    if (!keys.length) return "<p>（空对象）</p>";
    var out = "";
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = obj[k];
      var label = CLAIM_LABELS[k] || html(k);
      var block = "";
      if (k === "exp" || k === "iat" || k === "nbf") {
        block =
          '<div style="margin-bottom:12px;padding:10px;background:var(--bg-page);border-radius:var(--radius-md);border:1px solid var(--border-color);">' +
          renderTimeClaim(k, numericDateSeconds(v)) +
          "</div>";
      } else {
        block =
          '<div style="margin-bottom:10px;"><strong>' + label + '</strong><br><code style="word-break:break-all;font-size:12px;">' +
          html(JSON.stringify(v)) +
          "</code></div>";
      }
      out += block;
    }
    return out;
  }

  function setStatus(el, type, message) {
    if (!el) return;
    el.className = "tool-status tool-status-" + type;
    el.innerHTML = "<span>" + message + "</span>";
  }

  function pemToSpki(pem) {
    var body = String(pem || "")
      .replace(/-----BEGIN[^-]+-----/g, "")
      .replace(/-----END[^-]+-----/g, "")
      .replace(/\s+/g, "");
    if (!body) throw new Error("请输入有效的 PEM 公钥。");
    var binary = atob(body);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function init() {
    if (!document.querySelector("[data-jwt-tab]") && !document.getElementById("jwtInput")) return;

    var state = {
      headerRawJson: "",
      payloadRawJson: "",
    };

    var jwtInput = document.getElementById("jwtInput");
    var statusEl = document.getElementById("jwtGlobalStatus");
    var auditState = document.getElementById("jwtAuditState");
    var auditList = document.getElementById("jwtAuditList");
    var verifyOut = document.getElementById("jwtVerifyOut");
    var verifyState = document.getElementById("jwtVerifyState");
    var genOutput = document.getElementById("jwtGenOutput");

    function hideSections() {
      ["sectionHeader", "sectionPayload", "sectionSignature"].forEach(function (id) {
        var n = document.getElementById(id);
        if (n) n.hidden = true;
      });
    }

    function runAudit(token) {
      if (!auditState || !auditList) return;
      try {
        var t = parseToken(normalizeJwtInput(token));
        var now = Math.floor(Date.now() / 1000);
        var issues = [];
        if (!t.header.alg) issues.push("缺少 alg。");
        if (String(t.header.alg).toLowerCase() === "none") issues.push("alg=none，不应在生产系统接受。");
        if (!t.payload.exp) issues.push("缺少 exp，无法判断过期时间。");
        else if (Number(t.payload.exp) < now) issues.push("Token 已过期。");
        if (!t.payload.iat) issues.push("缺少 iat，无法判断签发时间。");
        if (t.payload.nbf && Number(t.payload.nbf) > now) issues.push("Token 尚未生效。");
        auditState.textContent = issues.length ? "发现 " + issues.length + " 项提醒" : "基础检查通过";
        auditList.innerHTML = issues.length
          ? issues.map(function (x) { return "• " + html(x); }).join("<br>")
          : "未发现 alg=none、过期或明显时间声明问题。";
      } catch (e) {
        auditState.textContent = "等待有效 Token";
        auditList.textContent = e.message;
      }
    }

    function decodeAndRender() {
      if (!jwtInput) return;
      var token = normalizeJwtInput(jwtInput.value);

      state.headerRawJson = "";
      state.payloadRawJson = "";

      if (!token) {
        hideSections();
        setStatus(statusEl, "info", "请输入 JWT 或点击「加载示例 Token」。");
        runAudit("");
        return;
      }

      var parsed = parseParts(token);
      if (parsed.error) {
        hideSections();
        setStatus(statusEl, "error", html(parsed.error));
        runAudit(token);
        return;
      }

      var parts = parsed.parts;
      var headerObj;
      var payloadObj;
      try {
        headerObj = JSON.parse(base64UrlDecode(parts[0]));
        payloadObj = JSON.parse(base64UrlDecode(parts[1]));
      } catch (e) {
        hideSections();
        setStatus(statusEl, "error", "Header 或 Payload 解码/解析失败。");
        runAudit(token);
        return;
      }

      state.headerRawJson = JSON.stringify(headerObj, null, 2);
      state.payloadRawJson = JSON.stringify(payloadObj, null, 2);

      var expInfo = expiryStatus(payloadObj);
      setStatus(
        statusEl,
        expInfo.kind === "expired" ? "error" : expInfo.kind === "valid" ? "success" : "info",
        "<strong>Token 状态：</strong>" + html(expInfo.label) + " — " + html(expInfo.detail)
      );

      var secHeader = document.getElementById("sectionHeader");
      var secPayload = document.getElementById("sectionPayload");
      var secSig = document.getElementById("sectionSignature");
      if (secHeader) secHeader.hidden = false;
      if (secPayload) secPayload.hidden = false;
      if (secSig) secSig.hidden = false;

      var alg = headerObj.alg != null ? String(headerObj.alg) : "（未指定）";
      var typ = headerObj.typ != null ? String(headerObj.typ) : "（未指定）";
      var headerSummary = document.getElementById("headerSummary");
      var headerJson = document.getElementById("headerJson");
      var payloadClaims = document.getElementById("payloadClaims");
      if (headerSummary) {
        headerSummary.innerHTML =
          "<strong>算法 (alg)：</strong>" + html(alg) +
          " &nbsp;|&nbsp; <strong>类型 (typ)：</strong>" + html(typ);
      }
      if (headerJson) headerJson.textContent = state.headerRawJson;
      if (payloadClaims) payloadClaims.innerHTML = renderPayloadClaims(payloadObj);

      var sigPart = parts.length > 2 ? parts.slice(2).join(".") : "";
      var signatureBody = document.getElementById("signatureBody");
      if (signatureBody) {
        if (!sigPart) {
          signatureBody.innerHTML = "<p>未包含签名段（不签名的 JWT / 仅前两段）。</p>";
        } else {
          signatureBody.innerHTML =
            "<p><strong>原始签名段（Base64URL）</strong></p>" +
            '<pre class="tool-result" style="max-height:160px;margin:8px 0 12px;">' + html(sigPart) + "</pre>" +
            "<p>字符长度：" + sigPart.length + "。签名使用 Header 中的算法与密钥计算。</p>";
        }
      }

      runAudit(token);
    }

    async function verifyHmac(token, secret) {
      var t = parseToken(token);
      var algMap = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };
      var hash = algMap[t.header.alg];
      if (!hash) throw new Error("当前 HMAC 验签只支持 HS256 / HS384 / HS512。");
      var enc = new TextEncoder();
      var key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: hash },
        false,
        ["sign"]
      );
      var sig = await crypto.subtle.sign("HMAC", key, enc.encode(t.parts[0] + "." + t.parts[1]));
      var expected = base64UrlFromBytes(sig);
      return { ok: expected === t.parts[2], alg: t.header.alg, expected: expected, actual: t.parts[2] || "" };
    }

    async function verifyRs256(token, pem) {
      var t = parseToken(token);
      if (String(t.header.alg) !== "RS256") throw new Error("PEM 公钥验签当前仅支持 RS256。");
      if (!t.parts[2]) throw new Error("Token 缺少签名段。");
      var key = await crypto.subtle.importKey(
        "spki",
        pemToSpki(pem),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
      );
      var ok = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        base64UrlToBytes(t.parts[2]),
        new TextEncoder().encode(t.parts[0] + "." + t.parts[1])
      );
      return { ok: ok, alg: "RS256", expected: "(RSA 公钥验证)", actual: t.parts[2] };
    }

    async function runVerify() {
      var tokenEl = document.getElementById("jwtVerifyInput") || jwtInput;
      var token = normalizeJwtInput(tokenEl && tokenEl.value);
      var secret = document.getElementById("jwtVerifySecret")?.value || "";
      var pem = document.getElementById("jwtVerifyPubKey")?.value || "";
      if (!token) {
        if (verifyState) verifyState.textContent = "验证失败";
        if (verifyOut) verifyOut.textContent = "请输入 JWT。";
        return;
      }
      try {
        var header = parseToken(token).header;
        var result;
        if (/^RS/.test(String(header.alg))) {
          if (!pem) throw new Error("RS 算法请提供 PEM 公钥。");
          result = await verifyRs256(token, pem);
        } else {
          if (!secret) throw new Error("HMAC 算法请输入共享密钥。");
          result = await verifyHmac(token, secret);
        }
        if (verifyState) verifyState.textContent = result.ok ? "签名有效" : "签名不匹配";
        if (verifyOut) {
          verifyOut.textContent =
            (result.ok ? "PASS" : "FAIL") +
            "\n算法：" + result.alg +
            "\n计算签名：" + result.expected +
            "\nToken 签名：" + result.actual;
        }
      } catch (e) {
        if (verifyState) verifyState.textContent = "验证失败";
        if (verifyOut) verifyOut.textContent = e.message;
      }
      window.umamiTrack?.("tool_used", { tool: "jwt", action: "verify" });
    }

    async function runGenerate() {
      var alg = document.getElementById("jwtGenAlg")?.value || "HS256";
      var secret = document.getElementById("jwtGenSecret")?.value || "";
      var payloadRaw = document.getElementById("jwtGenPayload")?.value || "{}";
      var expVal = document.getElementById("jwtGenExp")?.value;
      var iatVal = document.getElementById("jwtGenIat")?.value;
      if (!secret) {
        showToast("请填写签名密钥");
        return;
      }
      try {
        var payload = JSON.parse(payloadRaw);
        if (expVal) payload.exp = Math.floor(new Date(expVal).getTime() / 1000);
        if (iatVal) payload.iat = Math.floor(new Date(iatVal).getTime() / 1000);
        else if (!payload.iat) payload.iat = Math.floor(Date.now() / 1000);

        var header = { alg: alg, typ: "JWT" };
        var headSeg = base64UrlEncode(JSON.stringify(header));
        var paySeg = base64UrlEncode(JSON.stringify(payload));
        var signingInput = headSeg + "." + paySeg;

        var hashMap = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };
        var hash = hashMap[alg];
        if (!hash) throw new Error("生成器仅支持 HS256 / HS384 / HS512。");

        var enc = new TextEncoder();
        var key = await crypto.subtle.importKey(
          "raw",
          enc.encode(secret),
          { name: "HMAC", hash: hash },
          false,
          ["sign"]
        );
        var sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
        var token = signingInput + "." + base64UrlFromBytes(sig);

        if (genOutput) genOutput.value = token;
        showToast("Token 已生成");
        window.umamiTrack?.("tool_used", { tool: "jwt", action: "generate" });
      } catch (e) {
        showToast(e.message || "生成失败");
      }
    }

    function switchTab(name) {
      document.querySelectorAll("[data-jwt-tab]").forEach(function (tab) {
        var active = tab.getAttribute("data-jwt-tab") === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll("[data-jwt-panel]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-jwt-panel") !== name;
      });
    }

    document.querySelectorAll("[data-jwt-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchTab(tab.getAttribute("data-jwt-tab") || "decode");
      });
    });

    if (jwtInput) {
      jwtInput.addEventListener("input", decodeAndRender);
      jwtInput.addEventListener("paste", function () { setTimeout(decodeAndRender, 0); });
    }

    document.getElementById("btnSample")?.addEventListener("click", function () {
      if (jwtInput) jwtInput.value = SAMPLE_JWT;
      decodeAndRender();
      window.umamiTrack?.("tool_used", { tool: "jwt", action: "decode" });
    });

    document.getElementById("btnClear")?.addEventListener("click", function () {
      if (jwtInput) jwtInput.value = "";
      decodeAndRender();
    });

    document.getElementById("btnCopyHeader")?.addEventListener("click", function () {
      copyText(state.headerRawJson).catch(function () { showToast("复制失败"); });
    });

    document.getElementById("btnCopyPayload")?.addEventListener("click", function () {
      copyText(state.payloadRawJson).catch(function () { showToast("复制失败"); });
    });

    document.getElementById("btnJwtGenerate")?.addEventListener("click", runGenerate);
    document.getElementById("btnJwtVerify")?.addEventListener("click", runVerify);

    document.getElementById("btnCopyGen")?.addEventListener("click", function () {
      var t = genOutput ? genOutput.value : "";
      if (!t) { showToast("没有可复制的内容"); return; }
      copyText(t).catch(function () { showToast("复制失败"); });
    });

    switchTab("decode");
    decodeAndRender();
  }

  (TC.ready || function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  })(init);
})();
