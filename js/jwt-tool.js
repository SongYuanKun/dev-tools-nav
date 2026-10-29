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

  function readSkewSeconds() {
    var el = document.getElementById("jwtClockSkew");
    var n = el ? Number(el.value) : 60;
    if (!isFinite(n) || n < 0) return 60;
    return Math.min(600, Math.floor(n));
  }

  function formatDuration(sec) {
    var abs = Math.abs(sec);
    if (abs < 60) return abs + " 秒";
    if (abs < 3600) return Math.round(abs / 60) + " 分钟";
    if (abs < 86400) return (abs / 3600).toFixed(1).replace(/\.0$/, "") + " 小时";
    return (abs / 86400).toFixed(1).replace(/\.0$/, "") + " 天";
  }

  function expiryStatus(payload, skewOpt) {
    var now = Math.floor(Date.now() / 1000);
    var skew = typeof skewOpt === "number" ? skewOpt : readSkewSeconds();
    var exp = payload && Object.prototype.hasOwnProperty.call(payload, "exp")
      ? numericDateSeconds(payload.exp)
      : null;
    if (exp == null) {
      return { kind: "none", label: "无过期时间", detail: "Payload 中未包含 exp 声明，无法据此判断过期。" };
    }
    var delta = exp - now;
    if (delta < -skew) {
      return {
        kind: "expired",
        label: "已过期",
        detail: "当前时间已超过 exp " + formatDuration(-delta) + "（容差 ±" + skew + "s）。",
      };
    }
    if (delta < 0) {
      return {
        kind: "skew",
        label: "边界过期（时钟偏差内）",
        detail: "按严格时钟已过期 " + formatDuration(-delta) + "，但仍在 ±" + skew + "s 容差内，排查时注意服务器时钟同步。",
      };
    }
    if (delta <= 300) {
      return {
        kind: "soon",
        label: "即将过期",
        detail: "大约 " + formatDuration(delta) + " 后过期（容差 ±" + skew + "s）。",
      };
    }
    return {
      kind: "valid",
      label: "未过期（有效）",
      detail: "剩余约 " + formatDuration(delta) + "（容差 ±" + skew + "s）。",
    };
  }

  function renderTimeClaim(key, sec, skewOpt) {
    if (sec == null) return html(String(key)) + "：无法解析为 Unix 时间戳（秒）";
    var human = formatZhDate(sec);
    var rel = "";
    var now = Math.floor(Date.now() / 1000);
    var skew = typeof skewOpt === "number" ? skewOpt : readSkewSeconds();
    if (key === "exp") {
      if (sec < now - skew) rel = " · 相对现在：已过期 " + formatDuration(now - sec);
      else if (sec < now) rel = " · 相对现在：边界过期（时钟偏差内）";
      else if (sec - now <= 300) rel = " · 相对现在：约 " + formatDuration(sec - now) + " 后过期";
      else rel = " · 相对现在：尚未过期（剩余约 " + formatDuration(sec - now) + "）";
    } else if (key === "nbf") {
      if (sec > now + skew) rel = " · 相对现在：尚未生效（约 " + formatDuration(sec - now) + " 后）";
      else if (sec > now) rel = " · 相对现在：边界未生效（时钟偏差内）";
      else rel = " · 相对现在：已生效";
    } else if (key === "iat") {
      rel = " · 相对现在：" + (now >= sec ? "已签发 " + formatDuration(now - sec) : "未来时间（异常，检查时钟）");
    }
    return (
      "<strong>" + html(CLAIM_LABELS[key] || key) + "</strong><br>" +
      "Unix 秒：<code>" + html(String(sec)) + "</code><br>" +
      "可读时间：" + html(human) + rel
    );
  }

  function renderPayloadClaims(obj) {
    var keys = Object.keys(obj);
    if (!keys.length) return "<p>（空对象）</p>";
    var skew = readSkewSeconds();
    var out = "";
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = obj[k];
      var label = CLAIM_LABELS[k] || html(k);
      var block = "";
      if (k === "exp" || k === "iat" || k === "nbf") {
        block =
          '<div style="margin-bottom:12px;padding:10px;background:var(--bg-page);border-radius:var(--radius-md);border:1px solid var(--border-color);">' +
          renderTimeClaim(k, numericDateSeconds(v), skew) +
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

  function collectSecurityIssues(tokenObj, skew) {
    var issues = [];
    var now = Math.floor(Date.now() / 1000);
    var header = tokenObj.header || {};
    var payload = tokenObj.payload || {};
    var parts = tokenObj.parts || [];
    var alg = header.alg != null ? String(header.alg) : "";
    var algLower = alg.toLowerCase();

    if (!alg) issues.push({ level: "high", text: "缺少 alg：许多库会拒绝，也有库会错误回退。" });
    if (algLower === "none") {
      issues.push({ level: "high", text: "alg=none：无签名 Token。生产系统必须拒绝；仅可用于本地演示。" });
    }
    if (!parts[2] && algLower && algLower !== "none") {
      issues.push({ level: "high", text: "声明了算法但缺少签名段，常见于截断或错误拼接。" });
    }
    if (/^hs/i.test(alg) && document.getElementById("jwtVerifyPubKey")?.value.trim()) {
      issues.push({ level: "warn", text: "Header 为 HMAC（HS*），但验签区填了 PEM 公钥——注意算法混淆攻击：不要用公钥当 HMAC 密钥。" });
    }
    if (/^rs/i.test(alg) && document.getElementById("jwtVerifySecret")?.value) {
      issues.push({ level: "warn", text: "Header 为 RS*，但同时填写了 HMAC Secret。验签将优先走公钥路径。" });
    }
    if (header.typ && String(header.typ).toUpperCase() !== "JWT") {
      issues.push({ level: "info", text: "typ=" + String(header.typ) + "（非常见 JWT），确认调用方是否刻意为之。" });
    }
    if (!Object.prototype.hasOwnProperty.call(payload, "exp")) {
      issues.push({ level: "warn", text: "缺少 exp：无法判断过期，长期有效 Token 泄露风险更高。" });
    } else {
      var exp = numericDateSeconds(payload.exp);
      if (exp == null) issues.push({ level: "warn", text: "exp 不是合法 Unix 秒。" });
      else if (exp < now - skew) issues.push({ level: "high", text: "Token 已过期（超出 ±" + skew + "s 容差）。" });
      else if (exp < now) issues.push({ level: "warn", text: "严格时钟下已过期，但仍在 ±" + skew + "s 容差内——核对 NTP / 容器时钟。" });
      else if (exp - now <= 300) issues.push({ level: "info", text: "Token 将在约 " + formatDuration(exp - now) + " 后过期。" });
    }
    if (!Object.prototype.hasOwnProperty.call(payload, "iat")) {
      issues.push({ level: "info", text: "缺少 iat，无法判断签发时间与时钟漂移。" });
    } else {
      var iat = numericDateSeconds(payload.iat);
      if (iat != null && iat > now + skew) {
        issues.push({ level: "warn", text: "iat 在未来（超出容差），可能是签发方时钟快了。" });
      }
    }
    if (Object.prototype.hasOwnProperty.call(payload, "nbf")) {
      var nbf = numericDateSeconds(payload.nbf);
      if (nbf != null && nbf > now + skew) {
        issues.push({ level: "warn", text: "Token 尚未生效（nbf 超出容差）。" });
      } else if (nbf != null && nbf > now) {
        issues.push({ level: "info", text: "nbf 略晚于本机时间，但仍在时钟偏差容差内。" });
      }
    }
    if (!header.kid && /^rs/i.test(alg)) {
      issues.push({ level: "info", text: "RS* Token 无 kid：多钥 JWKS 场景下需手工选定公钥。" });
    }
    return issues;
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

    function navigateTop(target) {
      try {
        if (window.top && window.top !== window) {
          window.top.location.href = target;
          return;
        }
      } catch (_) {
        // Cross-origin embedding can deny access to top; stay usable in this frame.
      }
      window.location.href = target;
    }

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
        var issues = collectSecurityIssues(t, readSkewSeconds());
        var highs = issues.filter(function (x) { return x.level === "high"; }).length;
        auditState.textContent = issues.length
          ? ("发现 " + issues.length + " 项提醒" + (highs ? "（含 " + highs + " 项高优先级）" : ""))
          : "基础检查通过";
        auditList.innerHTML = issues.length
          ? issues.map(function (x) {
              var tag = x.level === "high" ? "高" : x.level === "warn" ? "中" : "低";
              return "• <strong>[" + tag + "]</strong> " + html(x.text);
            }).join("<br>")
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

      var expInfo = expiryStatus(payloadObj, readSkewSeconds());
      var statusType = "info";
      if (expInfo.kind === "expired") statusType = "error";
      else if (expInfo.kind === "valid") statusType = "success";
      else if (expInfo.kind === "soon" || expInfo.kind === "skew") statusType = "info";
      if (String(headerObj.alg || "").toLowerCase() === "none") statusType = "error";
      setStatus(
        statusEl,
        statusType,
        "<strong>Token 状态：</strong>" + html(expInfo.label) + " — " + html(expInfo.detail) +
          (String(headerObj.alg || "").toLowerCase() === "none"
            ? " <strong>· 警告：alg=none</strong>"
            : "")
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

      // OP-105 场景①：JWT decode 成功 → 显示「美化 claims 到 JSON 工作台」按钮（sessionStorage 传 payload）
      try {
        var secPayload = document.getElementById("sectionPayload");
        if (secPayload) {
          var oldCta = secPayload.querySelector(".jwt-to-json-cta");
          if (oldCta) oldCta.parentNode.removeChild(oldCta);
          var cta = document.createElement("div");
          cta.className = "jwt-to-json-cta";
          cta.innerHTML =
            '<a class="jwt-to-json-btn" type="button" href="#">🔍 美化 claims → 去 JSON 工作台</a>';
          secPayload.appendChild(cta);
          cta.querySelector("a").addEventListener("click", function (ev) {
            if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
            try {
              var x = JSON.stringify({ header: headerObj, payload: payloadObj, token: token }, null, 2);
              sessionStorage.setItem("jwt_decode_payload_v1", x);
            } catch (e) {
              sessionStorage.setItem("jwt_decode_payload_v1", JSON.stringify(payloadObj, null, 2));
            }
            if (typeof window.umami === "object" && typeof window.umami.track === "function") {
              window.umami.track("jwt_to_json_click", { op: "OP-105" });
            }
            navigateTop(new URL("../../tools/json/?from_jwt=1", window.location.href).href);
          });
        }
      } catch (_) {}

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

    function jwkToPemSpkiLike(jwk) {
      // WebCrypto can import JWK directly for RSASSA-PKCS1-v1_5 verify.
      return crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
      );
    }

    async function verifyRs256WithKey(token, key) {
      var t = parseToken(token);
      if (String(t.header.alg) !== "RS256") throw new Error("当前 JWKS / PEM 验签仅支持 RS256。");
      if (!t.parts[2]) throw new Error("Token 缺少签名段。");
      var ok = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        base64UrlToBytes(t.parts[2]),
        new TextEncoder().encode(t.parts[0] + "." + t.parts[1])
      );
      return { ok: ok, alg: "RS256", expected: "(RSA 公钥验证)", actual: t.parts[2] };
    }

    async function fetchJwksAndPickKey(url, kid) {
      var trimmed = String(url || "").trim();
      if (!trimmed) throw new Error("请填写 JWKS URL。");
      var parsedUrl;
      try {
        parsedUrl = new URL(trimmed);
      } catch (_) {
        throw new Error("JWKS URL 无效。");
      }
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw new Error("JWKS 仅支持 http(s) URL，且请求由浏览器直连目标站。");
      }
      var res;
      try {
        res = await fetch(parsedUrl.toString(), { method: "GET", mode: "cors", credentials: "omit" });
      } catch (e) {
        throw new Error(
          "无法拉取 JWKS（多为 CORS / 网络失败）。本站不会代拉密钥——请改用粘贴 PEM，或让 JWKS 站点允许浏览器跨域。" +
          (e && e.message ? " 细节：" + e.message : "")
        );
      }
      if (!res.ok) throw new Error("JWKS 响应 HTTP " + res.status + "。");
      var body;
      try {
        body = await res.json();
      } catch (_) {
        throw new Error("JWKS 响应不是合法 JSON。");
      }
      var keys = Array.isArray(body.keys) ? body.keys : [];
      if (!keys.length) throw new Error("JWKS 中没有 keys。");
      var match = kid
        ? keys.find(function (k) { return k && k.kid === kid; })
        : keys.find(function (k) { return k && (k.kty === "RSA" || !k.kty); }) || keys[0];
      if (!match) {
        throw new Error("JWKS 中找不到 kid=" + kid + " 的密钥。可用 kid：" + keys.map(function (k) { return k.kid || "(无)"; }).join(", "));
      }
      if (match.kty && match.kty !== "RSA") {
        throw new Error("当前仅支持 RSA JWK（kty=RSA），实际为 " + match.kty + "。");
      }
      if (match.use && match.use !== "sig") {
        throw new Error("选中的 JWK use=" + match.use + "，不是签名密钥。");
      }
      return match;
    }

    async function runVerify() {
      var tokenEl = document.getElementById("jwtVerifyInput") || jwtInput;
      var token = normalizeJwtInput(tokenEl && tokenEl.value);
      var secret = document.getElementById("jwtVerifySecret")?.value || "";
      var pem = document.getElementById("jwtVerifyPubKey")?.value || "";
      var jwksUrl = document.getElementById("jwtJwksUrl")?.value || "";
      if (!token) {
        if (verifyState) verifyState.textContent = "验证失败";
        if (verifyOut) verifyOut.textContent = "请输入 JWT。";
        return;
      }
      try {
        var parsed = parseToken(token);
        var header = parsed.header;
        var alg = String(header.alg || "");
        if (alg.toLowerCase() === "none") {
          throw new Error("alg=none：没有可验证的签名。生产系统应直接拒绝此类 Token。");
        }
        var result;
        var pathNote = "";
        if (/^RS/i.test(alg)) {
          if (pem.trim()) {
            result = await verifyRs256(token, pem);
            pathNote = "验签路径：粘贴的 PEM 公钥";
          } else if (jwksUrl.trim()) {
            var jwk = await fetchJwksAndPickKey(jwksUrl, header.kid);
            var key = await jwkToPemSpkiLike(jwk);
            result = await verifyRs256WithKey(token, key);
            pathNote = "验签路径：浏览器直连 JWKS" + (jwk.kid ? "（kid=" + jwk.kid + "）" : "");
          } else {
            throw new Error("RS 算法请提供 PEM 公钥，或填写可被浏览器 CORS 访问的 JWKS URL。");
          }
        } else if (/^HS/i.test(alg)) {
          if (!secret) throw new Error("HMAC 算法请输入共享密钥。");
          result = await verifyHmac(token, secret);
          pathNote = "验签路径：HMAC Secret（仅本机）";
        } else {
          throw new Error("暂不支持算法 " + (alg || "(空)") + "。当前支持 HS256/384/512 与 RS256。");
        }
        if (verifyState) verifyState.textContent = result.ok ? "签名有效" : "签名不匹配";
        if (verifyOut) {
          verifyOut.textContent =
            (result.ok ? "PASS" : "FAIL") +
            "\n算法：" + result.alg +
            "\n" + pathNote +
            "\n计算签名：" + result.expected +
            "\nToken 签名：" + result.actual +
            "\n说明：Token 与密钥均未离开浏览器。";
        }
      } catch (e) {
        if (verifyState) verifyState.textContent = "验证失败";
        if (verifyOut) verifyOut.textContent = e.message;
      }
      window.umamiTrack?.("tool_used", { tool: "jwt", action: "verify" });
    }

    async function runFetchJwksOnly() {
      var token = normalizeJwtInput(jwtInput && jwtInput.value);
      var jwksUrl = document.getElementById("jwtJwksUrl")?.value || "";
      try {
        var kid = "";
        if (token) {
          try { kid = parseToken(token).header.kid || ""; } catch (_) {}
        }
        var jwk = await fetchJwksAndPickKey(jwksUrl, kid);
        if (verifyState) verifyState.textContent = "JWKS 已拉取";
        if (verifyOut) {
          verifyOut.textContent =
            "已从浏览器直连获取 JWKS 密钥（未上传到本站）。\n" +
            "选中 kid：" + (jwk.kid || "(无)") + "\n" +
            "kty：" + (jwk.kty || "?") + " · alg：" + (jwk.alg || "(未声明)") + "\n" +
            "可继续点「验证签名」。完整 JWK：\n" +
            JSON.stringify(jwk, null, 2);
        }
        showToast("JWKS 已拉取（仅本机）");
      } catch (e) {
        if (verifyState) verifyState.textContent = "JWKS 失败";
        if (verifyOut) verifyOut.textContent = e.message;
        showToast(e.message || "JWKS 拉取失败");
      }
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

    function applyPendingGeneratePayload() {
      var payloadField = document.getElementById("jwtGenPayload");
      if (!payloadField) return;
      var pending = null;
      try {
        pending = sessionStorage.getItem("jwt_encode_payload_v1");
        if (pending !== null) sessionStorage.removeItem("jwt_encode_payload_v1");
      } catch (_) {
        return;
      }
      if (pending === null) return;
      try {
        var parsed = JSON.parse(pending);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("JWT Payload 必须是 JSON 对象。");
        }
        payloadField.value = pending;
        switchTab("generate");
      } catch (e) {
        showToast("JSON 工作台传来的 Payload 无效：" + (e.message || "请检查 JSON 对象"));
      }
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
    document.getElementById("btnJwtFetchJwks")?.addEventListener("click", runFetchJwksOnly);

    document.getElementById("btnCopyGen")?.addEventListener("click", function () {
      var t = genOutput ? genOutput.value : "";
      if (!t) { showToast("没有可复制的内容"); return; }
      copyText(t).catch(function () { showToast("复制失败"); });
    });

    document.getElementById("jwtClockSkew")?.addEventListener("change", function () {
      if (jwtInput && jwtInput.value) decodeAndRender();
      runAudit(jwtInput ? jwtInput.value : "");
    });

    switchTab("decode");
    applyPendingGeneratePayload();
    decodeAndRender();
  }

  (TC.ready || function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  })(init);
})();
