(function () {
  "use strict";

  // 将 16 字节格式化为 UUID 字符串
  function formatUuid(bytes, opts) {
    var hex = Array.from(bytes).map(function (b) {
      return b.toString(16).padStart(2, "0");
    });
    var parts = [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ];
    var s = opts && opts.hyphen === false ? parts.join("") : parts.join("-");
    return opts && opts.upper ? s.toUpperCase() : s;
  }

  // UUID v4：优先 crypto.randomUUID，否则手动构造
  function uuidV4(opts) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" && (!opts || opts.hyphen !== false)) {
      var raw = crypto.randomUUID();
      if (opts && opts.upper) raw = raw.toUpperCase();
      if (opts && opts.hyphen === false) raw = raw.replace(/-/g, "");
      return raw;
    }
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuid(bytes, opts);
  }

  // UUID v7：时间戳 + 随机（RFC 9562）
  function uuidV7(opts) {
    var ts = BigInt(Date.now());
    var rand = new Uint8Array(10);
    crypto.getRandomValues(rand);
    var bytes = new Uint8Array(16);
    bytes[0] = Number((ts >> 40n) & 0xffn);
    bytes[1] = Number((ts >> 32n) & 0xffn);
    bytes[2] = Number((ts >> 24n) & 0xffn);
    bytes[3] = Number((ts >> 16n) & 0xffn);
    bytes[4] = Number((ts >> 8n) & 0xffn);
    bytes[5] = Number(ts & 0xffn);
    bytes[6] = (rand[0] & 0x0f) | 0x70;
    bytes[7] = rand[1];
    bytes[8] = (rand[2] & 0x3f) | 0x80;
    bytes[9] = rand[3];
    bytes[10] = rand[4];
    bytes[11] = rand[5];
    bytes[12] = rand[6];
    bytes[13] = rand[7];
    bytes[14] = rand[8];
    bytes[15] = rand[9];
    return formatUuid(bytes, opts);
  }

  function getOpts() {
    var upperEl = document.getElementById("uuidUppercase");
    var hyphenEl = document.getElementById("uuidHyphen");
    return {
      upper: upperEl ? upperEl.checked : false,
      hyphen: hyphenEl ? hyphenEl.checked !== false : true,
    };
  }

  function getVersion() {
    var v4 = document.getElementById("uuidVersionV4");
    var v7 = document.getElementById("uuidVersionV7");
    if (v7 && v7.checked) return 7;
    if (v4 && v4.checked) return 4;
    var sel = document.getElementById("uuidVersion");
    if (sel) return parseInt(sel.value, 10) === 7 ? 7 : 4;
    return 4;
  }

  function getCount() {
    var el = document.getElementById("uuidCount");
    var n = el ? parseInt(el.value, 10) : 1;
    if (isNaN(n) || n < 1) n = 1;
    if (n > 100) n = 100;
    if (el && String(n) !== el.value) el.value = String(n);
    return n;
  }

  function generateOne(version, opts) {
    return version === 7 ? uuidV7(opts) : uuidV4(opts);
  }

  function generate() {
    var out = document.getElementById("uuidOutput");
    if (!out) return;

    var version = getVersion();
    var count = getCount();
    var opts = getOpts();
    var lines = [];
    for (var i = 0; i < count; i++) {
      lines.push(generateOne(version, opts));
    }
    out.value = lines.join("\n");

    var stat = document.getElementById("uuidStats");
    if (stat) {
      stat.textContent = "已生成 " + count + " 个 UUID v" + version +
        (opts.upper ? " · 大写" : "") +
        (opts.hyphen === false ? " · 无连字符" : "");
    }

    window.umamiTrack?.("tool_used", { tool: "uuid", action: "generate", version: version, count: count });
  }

  function init() {
    var out = document.getElementById("uuidOutput");
    if (!out) return;

    var btnGen = document.getElementById("btnGenerate") || document.getElementById("btnGenerateUuid") || document.getElementById("btnUuidGenerate");
    if (btnGen) btnGen.addEventListener("click", generate);

    var btnCopy = document.getElementById("btnCopyAll");
    if (btnCopy) {
      btnCopy.addEventListener("click", function () {
        var text = out.value.trim();
        if (!text) {
          if (ToolChrome && ToolChrome.showToast) ToolChrome.showToast("请先生成 UUID");
          return;
        }
        var copyFn = ToolChrome && ToolChrome.copyText ? ToolChrome.copyText : function (t) {
          return navigator.clipboard.writeText(t);
        };
        copyFn(text, "已复制全部 UUID").catch(function () {
          if (ToolChrome && ToolChrome.showToast) ToolChrome.showToast("复制失败");
        });
      });
    }

    ["uuidUppercase", "uuidHyphen", "uuidCount", "uuidVersion", "uuidVersionV4", "uuidVersionV7"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", generate);
      if (el.tagName === "INPUT" && el.type === "number") {
        el.addEventListener("input", function () {
          clearTimeout(el._uuidTimer);
          el._uuidTimer = setTimeout(generate, 200);
        });
      }
    });

    document.querySelectorAll("[data-uuid-version]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll("[data-uuid-version]").forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
        });
        generate();
      });
    });

    generate();
  }

  var ready = window.ToolChrome && ToolChrome.ready ? ToolChrome.ready : function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };
  ready(init);
})();
