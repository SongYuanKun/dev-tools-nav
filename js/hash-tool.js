(function () {
  "use strict";

  function toUtf8Bytes(text) {
    return new TextEncoder().encode(String(text ?? ""));
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function bytesToBase64(bytes) {
    var binary = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function md5Bytes(input) {
    function cmn(q, a, b, x, s, t) {
      a = (a + q + x + t) | 0;
      return (((a << s) | (a >>> (32 - s))) + b) | 0;
    }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

    var originalLength = input.length;
    var bitLen = originalLength * 8;
    var total = ((((originalLength + 8) >>> 6) + 1) << 6);
    var buf = new Uint8Array(total);
    buf.set(input);
    buf[originalLength] = 0x80;
    var view = new DataView(buf.buffer);
    view.setUint32(total - 8, bitLen >>> 0, true);
    view.setUint32(total - 4, Math.floor(bitLen / 0x100000000), true);

    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (var i = 0; i < total; i += 64) {
      var x = new Uint32Array(16);
      for (var j = 0; j < 16; j++) x[j] = view.getUint32(i + j * 4, true);
      var a = a0, b = b0, c = c0, d = d0;
      a = ff(a, b, c, d, x[0], 7, 0xd76aa478); d = ff(d, a, b, c, x[1], 12, 0xe8c7b756);
      c = ff(c, d, a, b, x[2], 17, 0x242070db); b = ff(b, c, d, a, x[3], 22, 0xc1bdceee);
      a = ff(a, b, c, d, x[4], 7, 0xf57c0faf); d = ff(d, a, b, c, x[5], 12, 0x4787c62a);
      c = ff(c, d, a, b, x[6], 17, 0xa8304613); b = ff(b, c, d, a, x[7], 22, 0xfd469501);
      a = ff(a, b, c, d, x[8], 7, 0x698098d8); d = ff(d, a, b, c, x[9], 12, 0x8b44f7af);
      c = ff(c, d, a, b, x[10], 17, 0xffff5bb1); b = ff(b, c, d, a, x[11], 22, 0x895cd7be);
      a = ff(a, b, c, d, x[12], 7, 0x6b901122); d = ff(d, a, b, c, x[13], 12, 0xfd987193);
      c = ff(c, d, a, b, x[14], 17, 0xa679438e); b = ff(b, c, d, a, x[15], 22, 0x49b40821);
      a = gg(a, b, c, d, x[1], 5, 0xf61e2562); d = gg(d, a, b, c, x[6], 9, 0xc040b340);
      c = gg(c, d, a, b, x[11], 14, 0x265e5a51); b = gg(b, c, d, a, x[0], 20, 0xe9b6c7aa);
      a = gg(a, b, c, d, x[5], 5, 0xd62f105d); d = gg(d, a, b, c, x[10], 9, 0x02441453);
      c = gg(c, d, a, b, x[15], 14, 0xd8a1e681); b = gg(b, c, d, a, x[4], 20, 0xe7d3fbc8);
      a = gg(a, b, c, d, x[9], 5, 0x21e1cde6); d = gg(d, a, b, c, x[14], 9, 0xc33707d6);
      c = gg(c, d, a, b, x[3], 14, 0xf4d50d87); b = gg(b, c, d, a, x[8], 20, 0x455a14ed);
      a = gg(a, b, c, d, x[13], 5, 0xa9e3e905); d = gg(d, a, b, c, x[2], 9, 0xfcefa3f8);
      c = gg(c, d, a, b, x[7], 14, 0x676f02d9); b = gg(b, c, d, a, x[12], 20, 0x8d2a4c8a);
      a = hh(a, b, c, d, x[5], 4, 0xfffa3942); d = hh(d, a, b, c, x[8], 11, 0x8771f681);
      c = hh(c, d, a, b, x[11], 16, 0x6d9d6122); b = hh(b, c, d, a, x[14], 23, 0xfde5380c);
      a = hh(a, b, c, d, x[1], 4, 0xa4beea44); d = hh(d, a, b, c, x[4], 11, 0x4bdecfa9);
      c = hh(c, d, a, b, x[7], 16, 0xf6bb4b60); b = hh(b, c, d, a, x[10], 23, 0xbebfbc70);
      a = hh(a, b, c, d, x[13], 4, 0x289b7ec6); d = hh(d, a, b, c, x[0], 11, 0xeaa127fa);
      c = hh(c, d, a, b, x[3], 16, 0xd4ef3085); b = hh(b, c, d, a, x[6], 23, 0x04881d05);
      a = hh(a, b, c, d, x[9], 4, 0xd9d4d039); d = hh(d, a, b, c, x[12], 11, 0xe6db99e5);
      c = hh(c, d, a, b, x[15], 16, 0x1fa27cf8); b = hh(b, c, d, a, x[2], 23, 0xc4ac5665);
      a = ii(a, b, c, d, x[0], 6, 0xf4292244); d = ii(d, a, b, c, x[7], 10, 0x432aff97);
      c = ii(c, d, a, b, x[14], 15, 0xab9423a7); b = ii(b, c, d, a, x[5], 21, 0xfc93a039);
      a = ii(a, b, c, d, x[12], 6, 0x655b59c3); d = ii(d, a, b, c, x[3], 10, 0x8f0ccc92);
      c = ii(c, d, a, b, x[10], 15, 0xffeff47d); b = ii(b, c, d, a, x[1], 21, 0x85845dd1);
      a = ii(a, b, c, d, x[8], 6, 0x6fa87e4f); d = ii(d, a, b, c, x[15], 10, 0xfe2ce6e0);
      c = ii(c, d, a, b, x[6], 15, 0xa3014314); b = ii(b, c, d, a, x[13], 21, 0x4e0811a1);
      a = ii(a, b, c, d, x[4], 6, 0xf7537e82); d = ii(d, a, b, c, x[11], 10, 0xbd3af235);
      c = ii(c, d, a, b, x[2], 15, 0x2ad7d2bb); b = ii(b, c, d, a, x[9], 21, 0xeb86d391);
      a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
    }
    var out = new Uint8Array(16);
    var outView = new DataView(out.buffer);
    outView.setUint32(0, a0, true);
    outView.setUint32(4, b0, true);
    outView.setUint32(8, c0, true);
    outView.setUint32(12, d0, true);
    return out;
  }

  async function digest(algorithm, text, format) {
    var bytes = toUtf8Bytes(text);
    var digestBytes;
    if (algorithm === "MD5") {
      digestBytes = md5Bytes(bytes);
    } else {
      var subtle = globalThis.crypto && globalThis.crypto.subtle;
      if (!subtle) throw new Error("当前环境不支持 Web Crypto");
      digestBytes = new Uint8Array(await subtle.digest(algorithm, bytes));
    }
    return format === "base64" ? bytesToBase64(digestBytes) : bytesToHex(digestBytes);
  }

  function init() {
    var input = document.getElementById("hashInput");
    var output = document.getElementById("hashOutput");
    var algoEl = document.getElementById("hashAlgo");
    var formatEl = document.getElementById("hashFormat");
    var status = document.getElementById("hashStatus");
    var btnRun = document.getElementById("btnHashRun");
    var btnCopy = document.getElementById("btnHashCopy");
    var fileInput = document.getElementById("hashFile");
    if (!input || !output || !algoEl) return;

    function setStatus(msg, isError) {
      if (!status) return;
      status.textContent = msg || "";
      status.classList.toggle("is-error", !!isError);
    }

    async function run() {
      try {
        var algo = algoEl.value;
        var format = formatEl ? formatEl.value : "hex";
        var result = await digest(algo, input.value, format);
        output.value = result;
        setStatus(algo + " · " + format + " · " + toUtf8Bytes(input.value).length + " 字节");
        window.umamiTrack?.("tool_used", { tool: "hash", action: "digest", algorithm: algo });
      } catch (err) {
        output.value = "";
        setStatus(err && err.message ? err.message : "计算失败", true);
      }
    }

    if (btnRun) btnRun.addEventListener("click", function () { void run(); });
    algoEl.addEventListener("change", function () { void run(); });
    if (formatEl) formatEl.addEventListener("change", function () { void run(); });
    input.addEventListener("input", function () {
      clearTimeout(input._hashTimer);
      input._hashTimer = setTimeout(function () { void run(); }, 200);
    });

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          setStatus("文件过大（上限 2MB）", true);
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          input.value = String(reader.result || "");
          void run();
        };
        reader.readAsText(file);
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener("click", function () {
        var text = output.value;
        if (!text) {
          window.ToolChrome?.showToast?.("请先计算哈希");
          return;
        }
        var copyFn = window.ToolChrome?.copyText
          ? function (t) { return window.ToolChrome.copyText(t, "已复制哈希"); }
          : function (t) { return navigator.clipboard.writeText(t); };
        copyFn(text).catch(function () {
          window.ToolChrome?.showToast?.("复制失败");
        });
      });
    }

    if (!input.value) input.value = "Koen's 工具箱";
    void run();
  }

  var ready = window.ToolChrome && ToolChrome.ready ? ToolChrome.ready : function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };
  ready(init);
})();
