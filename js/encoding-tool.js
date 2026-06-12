(function () {
  "use strict";

  var TC = window.ToolChrome || {};
  var showToast = TC.showToast || function (msg) { alert(msg); };
  var copyText = TC.copyText || function (text) {
    return navigator.clipboard.writeText(text).then(function () {
      showToast("已复制到剪贴板");
    });
  };

  // UTF-8 ↔ Base64
  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function base64ToUtf8(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }

  function toUrlSafeB64(stdB64) {
    return stdB64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromUrlSafeB64(s) {
    var t = s.replace(/-/g, "+").replace(/_/g, "/");
    var pad = t.length % 4;
    if (pad) t += "====".slice(pad);
    return t;
  }

  function stripPadding(b64) {
    return b64.replace(/=+$/, "");
  }

  function hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function init() {
    var inputArea = document.getElementById("inputArea");
    if (!inputArea) return;

    var outputArea = document.getElementById("outputArea");
    var inputCountEl = document.getElementById("inputCount");
    var outputCountEl = document.getElementById("outputCount");
    var toolMsg = document.getElementById("toolMsg");
    var b64Options = document.getElementById("b64Options");
    var imgPreview = document.getElementById("imgPreview");
    var hashOutput = document.getElementById("hashOutput");
    var encFileInput = document.getElementById("encFileInput");
    var encStatSize = document.getElementById("encStatSize");

    var mainTab = "encode";
    var encodeMode = "base64";
    var textEncoder = new TextEncoder();

    function showMsg(text, kind) {
      if (!toolMsg) return;
      toolMsg.className = "tool-msg";
      if (!text) return;
      toolMsg.textContent = text;
      toolMsg.classList.add(kind === "error" ? "is-error" : "is-ok");
      if (kind !== "error") {
        setTimeout(function () {
          if (toolMsg.textContent === text) {
            toolMsg.textContent = "";
            toolMsg.className = "tool-msg";
          }
        }, 2200);
      }
    }

    function clearMsg() {
      if (!toolMsg) return;
      toolMsg.textContent = "";
      toolMsg.className = "tool-msg";
    }

    function updateCounts() {
      var ins = inputArea.value;
      var outs = outputArea ? outputArea.value : "";
      if (inputCountEl) inputCountEl.textContent = "字符数：" + ins.length;
      if (outputCountEl) outputCountEl.textContent = "字符数：" + outs.length;
      updateSizeStat();
      updateImagePreview(ins, outs);
    }

    function updateSizeStat() {
      if (!encStatSize) return;
      var bytes = textEncoder.encode(inputArea.value).length;
      encStatSize.textContent = inputArea.value.length + " 字符 / " + bytes + " bytes";
    }

    // data:image URL 预览
    function updateImagePreview(input, output) {
      if (!imgPreview) return;
      var src = "";
      if (/^data:image\//i.test(output)) src = output.trim();
      else if (/^data:image\//i.test(input)) src = input.trim();
      if (src) {
        imgPreview.src = src;
        imgPreview.hidden = false;
      } else {
        imgPreview.removeAttribute("src");
        imgPreview.hidden = true;
      }
    }

    function getB64Variant() {
      var r = document.querySelector('input[name="b64Variant"]:checked');
      var v = r ? r.value : "standard";
      if (v === "urlsafe" || v === "nopad") return v;
      return "standard";
    }

    function applyB64Variant(std) {
      var v = getB64Variant();
      if (v === "urlsafe") return toUrlSafeB64(std);
      if (v === "nopad") return stripPadding(std);
      return std;
    }

    function encodeBase64(text) {
      return applyB64Variant(utf8ToBase64(text));
    }

    function decodeBase64(text) {
      var raw = text.replace(/\s/g, "");
      var std;
      if (/[-_]/.test(raw) && !/[+/]/.test(raw)) std = fromUrlSafeB64(raw);
      else std = raw;
      return base64ToUtf8(std);
    }

    function encodeUrl(text) {
      return encodeURIComponent(text);
    }

    function decodeUrl(text) {
      try {
        return decodeURIComponent(text.replace(/\+/g, " "));
      } catch (e) {
        throw new Error("URL 解码失败：字符串可能不完整或包含非法转义序列");
      }
    }

    function encodeUnicode(str) {
      var out = "";
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
          var d = str.charCodeAt(i + 1);
          if (d >= 0xdc00 && d <= 0xdfff) {
            out += "\\u" + c.toString(16).toUpperCase().padStart(4, "0");
            out += "\\u" + d.toString(16).toUpperCase().padStart(4, "0");
            i++;
            continue;
          }
        }
        if (c < 128 && str[i] !== "\\") out += str[i];
        else out += "\\u" + c.toString(16).toUpperCase().padStart(4, "0");
      }
      return out;
    }

    function decodeUnicode(text) {
      var s = text.replace(/\\u\{([0-9a-fA-F]+)\}/g, function (_, h) {
        var cp = parseInt(h, 16);
        if (cp < 0x10000) return String.fromCharCode(cp);
        cp -= 0x10000;
        return String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      });
      var out = "";
      var re = /\\u([0-9a-fA-F]{4})/g;
      var last = 0;
      var m;
      while ((m = re.exec(s)) !== null) {
        out += s.slice(last, m.index);
        out += String.fromCharCode(parseInt(m[1], 16));
        last = m.index + m[0].length;
      }
      out += s.slice(last);
      return out;
    }

    function encodeHtmlEntities(text) {
      var div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    function decodeHtmlEntities(html) {
      var ta = document.createElement("textarea");
      ta.innerHTML = html;
      return ta.value;
    }

    function encodeHex(text) {
      var bytes = textEncoder.encode(text);
      return hex(bytes.buffer);
    }

    function decodeHex(text) {
      var clean = text.replace(/[^0-9a-fA-F]/g, "");
      if (!clean.length) return "";
      if (clean.length % 2) throw new Error("Hex 长度必须为偶数");
      var bytes = new Uint8Array(clean.length / 2);
      for (var i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
      }
      return new TextDecoder("utf-8").decode(bytes);
    }

    function runEncode() {
      clearMsg();
      var text = inputArea.value;
      try {
        var result;
        if (encodeMode === "base64") result = encodeBase64(text);
        else if (encodeMode === "url") result = encodeUrl(text);
        else if (encodeMode === "unicode") result = encodeUnicode(text);
        else result = encodeHtmlEntities(text);
        if (outputArea) outputArea.value = result;
        showMsg("编码完成", "ok");
      } catch (e) {
        if (outputArea) outputArea.value = "";
        showMsg(e.message || "编码失败", "error");
      }
      updateCounts();
    }

    function runDecode() {
      clearMsg();
      var text = inputArea.value;
      try {
        var result;
        if (encodeMode === "base64") result = decodeBase64(text);
        else if (encodeMode === "url") result = decodeUrl(text);
        else if (encodeMode === "unicode") result = decodeUnicode(text);
        else result = decodeHtmlEntities(text);
        if (outputArea) outputArea.value = result;
        showMsg("解码完成", "ok");
      } catch (e) {
        if (outputArea) outputArea.value = "";
        showMsg(e.message || "解码失败", "error");
      }
      updateCounts();
    }

    function runHexEncode() {
      clearMsg();
      try {
        var result = encodeHex(inputArea.value);
        if (outputArea) outputArea.value = result;
        showMsg("Hex 编码完成", "ok");
      } catch (e) {
        if (outputArea) outputArea.value = "";
        showMsg(e.message || "Hex 编码失败", "error");
      }
      updateCounts();
    }

    function runHexDecode() {
      clearMsg();
      try {
        var result = decodeHex(inputArea.value);
        if (outputArea) outputArea.value = result;
        showMsg("Hex 解码完成", "ok");
      } catch (e) {
        if (outputArea) outputArea.value = "";
        showMsg(e.message || "Hex 解码失败", "error");
      }
      updateCounts();
    }

    async function runDigest(alg) {
      clearMsg();
      updateSizeStat();
      try {
        var buf = await crypto.subtle.digest(alg, textEncoder.encode(inputArea.value));
        var out = alg + "\n" + hex(buf);
        if (hashOutput) hashOutput.textContent = out;
        else if (outputArea) outputArea.value = out;
        showMsg(alg + " 计算完成", "ok");
      } catch (e) {
        showMsg(e.message || "Hash 计算失败", "error");
      }
    }

    async function runFileHash(e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      clearMsg();
      try {
        var buf = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
        var out = "文件：" + f.name + "\n大小：" + f.size + " bytes\nSHA-256\n" + hex(buf);
        if (hashOutput) hashOutput.textContent = out;
        else if (outputArea) outputArea.value = out;
        showMsg("文件摘要完成", "ok");
      } catch (err) {
        showMsg(err.message || "文件摘要失败", "error");
      }
      e.target.value = "";
    }

    function swapIo() {
      clearMsg();
      if (!outputArea) return;
      var a = inputArea.value;
      inputArea.value = outputArea.value;
      outputArea.value = a;
      updateCounts();
    }

    function clearAll() {
      clearMsg();
      inputArea.value = "";
      if (outputArea) outputArea.value = "";
      if (hashOutput) hashOutput.textContent = "";
      updateCounts();
      inputArea.focus();
    }

    function copyOutput() {
      var t = "";
      if (mainTab === "hash" || mainTab === "file") {
        t = hashOutput ? hashOutput.textContent : "";
      } else if (outputArea) {
        t = outputArea.value;
      }
      if (!t) {
        showMsg("没有可复制的内容", "error");
        return;
      }
      copyText(t).catch(function () {
        showToast("复制失败，请手动选择");
      });
    }

    function switchMainTab(name) {
      mainTab = name;
      document.querySelectorAll("[data-enc-tab]").forEach(function (tab) {
        var active = tab.getAttribute("data-enc-tab") === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll("[data-enc-panel]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-enc-panel") !== name;
      });
      if (b64Options) {
        b64Options.classList.toggle("is-visible", name === "encode" && encodeMode === "base64");
      }
      clearMsg();
    }

    function switchEncodeMode(mode) {
      encodeMode = mode;
      document.querySelectorAll("[data-mode]").forEach(function (tab) {
        var active = tab.getAttribute("data-mode") === mode;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      if (b64Options) {
        b64Options.classList.toggle("is-visible", mainTab === "encode" && mode === "base64");
      }
      clearMsg();
    }

    // 主 Tab：encode / hash / file / hex
    document.querySelectorAll("[data-enc-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchMainTab(tab.getAttribute("data-enc-tab") || "encode");
      });
    });

    // 编码子模式：base64 / url / unicode / html
    document.querySelectorAll("[data-mode]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchEncodeMode(tab.getAttribute("data-mode") || "base64");
      });
    });

    document.getElementById("btnEncode")?.addEventListener("click", function () {
      runEncode();
      window.umamiTrack?.("tool_used", { tool: "base64", action: "encode" });
    });
    document.getElementById("btnDecode")?.addEventListener("click", function () {
      runDecode();
      window.umamiTrack?.("tool_used", { tool: "base64", action: "decode" });
    });
    document.getElementById("btnHexEncode")?.addEventListener("click", runHexEncode);
    document.getElementById("btnHexDecode")?.addEventListener("click", runHexDecode);
    document.getElementById("btnSwap")?.addEventListener("click", swapIo);
    document.getElementById("btnCopy")?.addEventListener("click", copyOutput);
    document.getElementById("btnClear")?.addEventListener("click", clearAll);

    document.querySelectorAll("[data-hash-alg]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        runDigest(btn.getAttribute("data-hash-alg"));
        window.umamiTrack?.("tool_used", { tool: "base64", action: "hash" });
      });
    });

    if (encFileInput) encFileInput.addEventListener("change", runFileHash);

    document.querySelectorAll('input[name="b64Variant"]').forEach(function (r) {
      r.addEventListener("change", clearMsg);
    });

    inputArea.addEventListener("input", function () {
      updateCounts();
      clearMsg();
    });
    if (outputArea) outputArea.addEventListener("input", updateCounts);

    switchMainTab("encode");
    switchEncodeMode("base64");
    updateCounts();
  }

  (TC.ready || function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  })(init);
})();
